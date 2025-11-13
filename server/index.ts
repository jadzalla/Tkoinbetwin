import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

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

  // Initialize Solana services if configured
  const solanaRpcUrl = process.env.SOLANA_RPC_URL;
  const solanaTreasuryWallet = process.env.SOLANA_TREASURY_WALLET;
  const solanaTreasuryPrivateKey = process.env.SOLANA_TREASURY_PRIVATE_KEY;
  const solanaMintAddress = process.env.SOLANA_MINT_ADDRESS;

  if (solanaRpcUrl && solanaTreasuryWallet && solanaTreasuryPrivateKey && solanaMintAddress) {
    try {
      console.log('\n🔗 Initializing Solana services...');
      
      const treasuryPrivateKey = JSON.parse(solanaTreasuryPrivateKey);
      
      // Initialize Blockchain Monitor (deposit detection)
      const { initializeBlockchainMonitor } = await import('./services/blockchain-monitor');
      const blockchainMonitor = initializeBlockchainMonitor(
        solanaRpcUrl,
        solanaMintAddress,
        solanaTreasuryWallet
      );
      await blockchainMonitor.start();
      
      // Initialize Burn Service (automated fee burning)
      const { initializeBurnService } = await import('./services/burn-service');
      const burnService = initializeBurnService(
        solanaRpcUrl,
        solanaMintAddress,
        treasuryPrivateKey
      );
      burnService.start(60); // Run every 60 minutes
      
      console.log('✅ Solana services initialized successfully\n');
    } catch (error) {
      console.error('❌ Failed to initialize Solana services:', error);
      console.error('   Blockchain monitoring and burn service will not be available');
    }
  } else {
    console.log('\nℹ️  Solana services not configured (missing environment variables)');
    console.log('   To enable blockchain monitoring and burn service:');
    console.log('   - SOLANA_RPC_URL');
    console.log('   - SOLANA_TREASURY_WALLET');
    console.log('   - SOLANA_TREASURY_PRIVATE_KEY');
    console.log('   - SOLANA_MINT_ADDRESS\n');
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
