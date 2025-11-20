import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// SECURITY: Configure trust proxy for proper IP extraction behind Replit's load balancer
// Replit deployments use a single trusted proxy hop
// Setting to 1 means we trust the first proxy in the chain (X-Forwarded-For)
// This prevents IP spoofing while allowing rate limiting to work correctly
app.set('trust proxy', 1);

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  limit: '10mb', // Increased to handle base64-encoded payment proofs (2MB file → ~2.7MB base64)
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Add correlation ID to all requests for distributed tracing
import { correlationMiddleware } from './utils/logger';
app.use(correlationMiddleware);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Initialize Solana Core Service
  try {
    const { solanaCore } = await import('./solana/solana-core');
    const { logger } = await import('./utils/logger');
    solanaCore.configure();

    // Test connection if configured
    if (solanaCore.isReady()) {
      const connectionTest = await solanaCore.testConnection();
      if (connectionTest.success) {
        const balance = await solanaCore.getTreasuryBalance();
        logger.info('Solana connection established', {
          service: 'solana-core',
          slot: connectionTest.slot,
          treasuryBalance: balance.toFixed(4),
          network: process.env.SOLANA_RPC_URL || 'devnet',
        });
      } else {
        logger.warn('Solana connection test failed', {
          service: 'solana-core',
          error: connectionTest.error,
        });
      }
    }
  } catch (error) {
    const { logger } = await import('./utils/logger');
    logger.error('Failed to initialize Solana Core', error);
  }

  // Start periodic cleanup of expired webhook nonces (every 10 minutes)
  // Store timer handle to allow proper cleanup
  const { storage } = await import('./storage');
  const nonceCleanupTimer = setInterval(async () => {
    try {
      const { logger } = await import('./utils/logger');
      const deletedCount = await storage.cleanupExpiredNonces();
      if (deletedCount > 0) {
        logger.info('Cleaned up expired webhook nonces', {
          service: 'nonce-cleanup',
          count: deletedCount,
        });
      }
    } catch (error) {
      const { logger } = await import('./utils/logger');
      logger.error('Failed to cleanup expired nonces', error);
    }
  }, 10 * 60 * 1000); // 10 minutes

  // Start P2P order expiry service (checks every 60 seconds)
  const { initializeOrderExpiryService } = await import('./services/order-expiry-service');
  const orderExpiryService = initializeOrderExpiryService(storage);
  orderExpiryService.start();

  // Cleanup on server shutdown
  // SECURITY: Register shutdown handlers only once to avoid memory leaks
  let shutdownHandlerRegistered = false;
  const shutdownHandler = async () => {
    const { logger } = await import('./utils/logger');
    logger.info('Shutting down gracefully', { service: 'server' });
    clearInterval(nonceCleanupTimer);
    orderExpiryService.stop();
    const { cleanupRateLimitTimers } = await import('./middleware/rate-limit');
    cleanupRateLimitTimers();
    logger.info('Cleanup complete', { service: 'server' });
    process.exit(0);
  };
  
  if (!shutdownHandlerRegistered) {
    // Handle multiple shutdown signals for better coverage
    process.on('SIGTERM', shutdownHandler);
    process.on('SIGINT', shutdownHandler);
    process.on('SIGQUIT', shutdownHandler);
    shutdownHandlerRegistered = true;
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
