import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { NotFoundError } from "./errors";
import { setupAuth, isAuthenticated, isApprovedAgent, isAdmin } from "./replitAuth";
import { fxRateService } from "./services/fx-rate-service";
import { PricingService } from "./services/pricing-service";
import { StakingService } from "./services/staking-service";
import { applicationService } from "./services/application-service";
import { BurnProposalService } from "./services/burn-proposal-service";
import { platformAPIService } from "./services/platform-api-service";
import { TOKEN_DECIMALS, TOKEN_MAX_SUPPLY_TOKENS } from "@shared/token-constants";
import { db } from "./db";
import { tokenConfig, type Transaction, type UserSettlement } from "@shared/schema";
import { eq } from "drizzle-orm";
import { Connection } from "@solana/web3.js";
import { logger } from "./utils/logger";
import { verifyPlatformSignature, getPlatformFromRequest } from "./utils/platform-auth";

const SERVER_START_TIME = Date.now();

/**
 * Format uptime in seconds to human-readable string
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  await setupAuth(app);

  // ========================================
  // Health Check Routes (Public)
  // ========================================
  
  /**
   * Liveness check - Always returns 200 if server is running
   * Used by load balancers to check if the service is alive
   */
  app.get('/api/health/live', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  /**
   * Readiness check - Verifies critical dependencies are available
   * Returns 503 if any critical service is unavailable
   */
  app.get('/api/health/ready', async (_req, res) => {
    const checks: Record<string, any> = {
      database: { status: 'unknown' },
      solana: { status: 'unknown' },
    };

    try {
      // Check database connection
      try {
        await db.select().from(tokenConfig).limit(1);
        checks.database = { status: 'healthy' };
      } catch (error) {
        logger.error('Database health check failed', error);
        checks.database = { 
          status: 'unhealthy', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }

      // Check Solana RPC connection
      try {
        const { solanaCore } = await import('./solana/solana-core');
        if (solanaCore.isReady()) {
          const connectionTest = await solanaCore.testConnection();
          if (connectionTest.success) {
            checks.solana = { 
              status: 'healthy',
              slot: connectionTest.slot,
            };
          } else {
            checks.solana = { 
              status: 'unhealthy', 
              error: connectionTest.error 
            };
          }
        } else {
          checks.solana = { 
            status: 'not_configured',
            message: 'Solana RPC not configured'
          };
        }
      } catch (error) {
        logger.error('Solana health check failed', error);
        checks.solana = { 
          status: 'unhealthy', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }

      // Determine overall status - both database AND Solana must be healthy
      // Solana is critical infrastructure, so not_configured is treated as unhealthy
      const isHealthy = checks.database.status === 'healthy' && 
                       checks.solana.status === 'healthy';

      const statusCode = isHealthy ? 200 : 503;
      res.status(statusCode).json({
        status: isHealthy ? 'ready' : 'not_ready',
        checks,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Health check endpoint failed', error);
      res.status(503).json({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * Comprehensive health status - Includes uptime and system metrics
   * Used for monitoring dashboards
   */
  app.get('/api/health', async (_req, res) => {
    const uptime = Date.now() - SERVER_START_TIME;
    const uptimeSeconds = Math.floor(uptime / 1000);
    
    const checks: Record<string, any> = {
      database: { status: 'unknown' },
      solana: { status: 'unknown' },
    };

    try {
      // Check database
      try {
        await db.select().from(tokenConfig).limit(1);
        checks.database = { status: 'healthy' };
      } catch (error) {
        checks.database = { 
          status: 'unhealthy', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }

      // Check Solana - lightweight connection test only (no balance fetch)
      try {
        const { solanaCore } = await import('./solana/solana-core');
        if (solanaCore.isReady()) {
          const connectionTest = await solanaCore.testConnection();
          if (connectionTest.success) {
            checks.solana = { 
              status: 'healthy',
              slot: connectionTest.slot,
            };
          } else {
            checks.solana = { status: 'unhealthy', error: connectionTest.error };
          }
        } else {
          checks.solana = { status: 'not_configured' };
        }
      } catch (error) {
        checks.solana = { 
          status: 'unhealthy', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }

      res.json({
        status: 'ok',
        uptime: {
          seconds: uptimeSeconds,
          human: formatUptime(uptimeSeconds),
        },
        checks,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      });
    } catch (error) {
      logger.error('Health endpoint failed', error);
      res.status(500).json({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ========================================
  // Authentication Routes
  // ========================================
  
  // Development only: Bootstrap admin access for current logged-in user
  // SECURITY: Only enabled when ENABLE_DEV_BOOTSTRAP=true (must be explicitly set)
  // This allows the first user to grant themselves admin access
  // In production, initial admin should be set via database or environment
  const enableDevBootstrap = process.env.ENABLE_DEV_BOOTSTRAP === 'true';
  
  if (enableDevBootstrap) {
    logger.warn('SECURITY WARNING: Dev bootstrap endpoint is ENABLED. Disable in production!', {
      ENABLE_DEV_BOOTSTRAP: process.env.ENABLE_DEV_BOOTSTRAP,
      NODE_ENV: process.env.NODE_ENV
    });
    
    app.post('/api/dev/bootstrap-admin', isAuthenticated, async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        logger.info('Bootstrap admin requested', { userId });
        
        await storage.updateUserRole(userId, 'admin');
        logger.info('User role updated to admin', { userId });
        
        res.json({ 
          message: "Admin access granted",
          userId,
          role: 'admin'
        });
      } catch (error) {
        logger.error('Failed to bootstrap admin', error);
        res.status(500).json({ message: "Failed to grant admin access" });
      }
    });
  } else {
    // Return 404 when bootstrap is disabled
    app.post('/api/dev/bootstrap-admin', (req, res) => {
      res.status(404).json({ message: "Not found" });
    });
  }
  
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if user is also an agent
      const agent = await storage.getAgentByReplitUserId(userId);
      
      // Check if user is an admin based on role
      const isAdmin = user.role === 'admin';
      
      // Return null-safe user data
      res.json({
        id: user.id,
        email: user.email || null,
        firstName: user.firstName || null,
        lastName: user.lastName || null,
        profileImageUrl: user.profileImageUrl || null,
        isAgent: !!agent,
        agentStatus: agent?.status || null,
        agentId: agent?.id || null,
        isAdmin,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Logout endpoint
  app.post('/api/auth/logout', (req: any, res) => {
    req.logout((err: any) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Failed to logout" });
      }
      req.session.destroy((destroyErr: any) => {
        if (destroyErr) {
          console.error("Session destroy error:", destroyErr);
          return res.status(500).json({ message: "Failed to destroy session" });
        }
        res.clearCookie('connect.sid');
        res.json({ message: "Logged out successfully" });
      });
    });
  });

  // ========================================
  // Agent Registration & Management Routes
  // ========================================
  
  // Apply to become an agent (DEPRECATED)
  // This endpoint is deprecated. Please use POST /api/applications/submit with complete business information.
  app.post('/api/agents/apply', isAuthenticated, async (req: any, res) => {
    return res.status(410).json({ 
      message: "This endpoint is deprecated. Please use POST /api/applications/submit with complete business information including address and phone number.",
      newEndpoint: "/api/applications/submit",
      requiredFields: ["businessName", "businessType", "country", "city", "address", "phoneNumber"]
    });
  });
  
  // Import rate limiting for public endpoints
  const { publicEndpointLimiter } = await import('./middleware/rate-limit');

  // Permissionless agent registration (requires wallet signature + on-chain TKOIN balance)
  app.post('/api/agents/register-permissionless', publicEndpointLimiter, isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const email = req.user.claims.email;
      const username = req.user.claims.preferred_username || req.user.claims.email.split('@')[0];
      
      const { walletAddress, signature, message } = req.body;
      
      // Validate required fields
      if (!walletAddress || !signature || !message) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: walletAddress, signature, message"
        });
      }
      
      // Import and use permissionless registration service
      const { permissionlessRegistrationService } = await import('./services/permissionless-registration-service');
      
      const result = await permissionlessRegistrationService.registerAgent({
        walletAddress,
        signature,
        message,
        replitUserId: userId,
        email,
        username,
      });
      
      if (!result.success) {
        return res.status(400).json(result);
      }
      
      return res.status(201).json(result);
    } catch (error) {
      console.error("Permissionless registration error:", error);
      return res.status(500).json({
        success: false,
        error: "Registration failed. Please try again.",
        blockchainAvailable: true
      });
    }
  });
  
  // Check eligibility for permissionless agent registration
  app.post('/api/agents/check-eligibility', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { walletAddress } = req.body;
      
      if (!walletAddress) {
        return res.status(400).json({
          eligible: false,
          reason: "Wallet address required",
          stakeBalance: 0,
          minimumRequired: 10000,
          blockchainAvailable: false
        });
      }
      
      // Import and use permissionless registration service
      const { permissionlessRegistrationService } = await import('./services/permissionless-registration-service');
      
      const result = await permissionlessRegistrationService.checkEligibility(
        walletAddress,
        userId
      );
      
      return res.json(result);
    } catch (error) {
      console.error("Eligibility check error:", error);
      return res.status(500).json({
        eligible: false,
        reason: "Failed to check eligibility",
        stakeBalance: 0,
        minimumRequired: 10000,
        blockchainAvailable: false
      });
    }
  });
  
  // Get current agent profile
  app.get('/api/agents/me', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const agent = await storage.getAgentByReplitUserId(userId);
      
      if (!agent) {
        return res.status(404).json({ message: "Not registered as an agent" });
      }
      
      res.json(agent);
    } catch (error) {
      console.error("Error fetching agent:", error);
      res.status(500).json({ message: "Failed to fetch agent profile" });
    }
  });
  
  // Update agent availability status
  app.patch('/api/agents/me/availability', isAuthenticated, isApprovedAgent, async (req: any, res) => {
    try {
      const agent = req.agent;
      const { availabilityStatus } = req.body;
      
      if (!['online', 'offline', 'busy'].includes(availabilityStatus)) {
        return res.status(400).json({ message: "Invalid availability status" });
      }
      
      const updated = await storage.updateAgent(agent.id, { availabilityStatus });
      res.json(updated);
    } catch (error) {
      console.error("Error updating availability:", error);
      res.status(500).json({ message: "Failed to update availability" });
    }
  });

  // Get agent transactions
  app.get('/api/agents/me/transactions', isAuthenticated, isApprovedAgent, async (req: any, res) => {
    try {
      const agent = req.agent;
      const transactions = await storage.getTransactionsByAgent(agent.id);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Get agent analytics data (transactions with currency info from payment requests)
  app.get('/api/agents/me/analytics', isAuthenticated, isApprovedAgent, async (req: any, res) => {
    try {
      const agent = req.agent;
      const analyticsData = await storage.getAgentAnalyticsData(agent.id);
      res.json(analyticsData);
    } catch (error) {
      console.error("Error fetching analytics data:", error);
      res.status(500).json({ message: "Failed to fetch analytics data" });
    }
  });
  
  // ========================================
  // Agent Staking Routes
  // ========================================
  
  // Get staking status for current agent
  app.get('/api/agents/me/staking', isAuthenticated, isApprovedAgent, async (req: any, res) => {
    try {
      const agent = req.agent;
      const { solanaCore } = await import('./solana/solana-core');
      
      if (!solanaCore.isReady()) {
        return res.status(503).json({ message: "Solana connection not ready" });
      }
      
      const stakingService = new StakingService(solanaCore.getConnection());
      const stakeInfo = await stakingService.getStakeInfo(agent.id);
      
      res.json(stakeInfo || {
        stakedTokens: 0,
        tier: 'basic',
        isLocked: false,
        daysRemaining: 0,
        nextTier: 'verified',
        tokensNeeded: 10000,
      });
    } catch (error) {
      console.error("Error fetching staking status:", error);
      res.status(500).json({ message: "Failed to fetch staking status" });
    }
  });
  
  // Stake TKOIN tokens
  app.post('/api/agents/stake', isAuthenticated, isApprovedAgent, async (req: any, res) => {
    try {
      const agent = req.agent;
      const { amount } = req.body;
      
      if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: "Invalid stake amount" });
      }
      
      const { solanaCore } = await import('./solana/solana-core');
      
      if (!solanaCore.isReady()) {
        return res.status(503).json({ message: "Solana connection not ready" });
      }
      
      const stakingService = new StakingService(solanaCore.getConnection());
      const result = await stakingService.stake(agent.id, agent.solanaWallet, parseFloat(amount));
      
      res.json({
        success: true,
        stake: result,
        message: `Successfully staked ${amount} TKOIN`,
      });
    } catch (error: any) {
      console.error("Error staking tokens:", error);
      res.status(400).json({ 
        message: error.message || "Failed to stake tokens",
      });
    }
  });
  
  // Unstake TKOIN tokens
  app.post('/api/agents/unstake', isAuthenticated, isApprovedAgent, async (req: any, res) => {
    try {
      const agent = req.agent;
      const { amount, force } = req.body;
      
      if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: "Invalid unstake amount" });
      }
      
      const { solanaCore } = await import('./solana/solana-core');
      
      if (!solanaCore.isReady()) {
        return res.status(503).json({ message: "Solana connection not ready" });
      }
      
      const stakingService = new StakingService(solanaCore.getConnection());
      const result = await stakingService.unstake(agent.id, parseFloat(amount), force || false);
      
      res.json({
        success: true,
        ...result,
        message: result.penalty 
          ? `Unstaked ${amount} TKOIN with ${result.penalty} TKOIN penalty`
          : `Successfully unstaked ${amount} TKOIN`,
      });
    } catch (error: any) {
      console.error("Error unstaking tokens:", error);
      res.status(400).json({ 
        message: error.message || "Failed to unstake tokens",
      });
    }
  });
  
  // Get stake history for current agent
  app.get('/api/agents/me/stake-history', isAuthenticated, isApprovedAgent, async (req: any, res) => {
    try {
      const agent = req.agent;
      const { solanaCore } = await import('./solana/solana-core');
      
      if (!solanaCore.isReady()) {
        return res.status(503).json({ message: "Solana connection not ready" });
      }
      
      const stakingService = new StakingService(solanaCore.getConnection());
      const history = await stakingService.getStakeHistory(agent.id);
      
      res.json(history);
    } catch (error) {
      console.error("Error fetching stake history:", error);
      res.status(500).json({ message: "Failed to fetch stake history" });
    }
  });
  
  // Sync on-chain stake balance (manual trigger)
  app.post('/api/agents/me/sync-stake', isAuthenticated, isApprovedAgent, async (req: any, res) => {
    try {
      const agent = req.agent;
      const { solanaCore } = await import('./solana/solana-core');
      
      if (!solanaCore.isReady()) {
        return res.status(503).json({ message: "Solana connection not ready" });
      }
      
      const stakingService = new StakingService(solanaCore.getConnection());
      const syncResult = await stakingService.syncOnChainBalance(agent.id, agent.solanaWallet);
      
      res.json({
        success: true,
        ...syncResult,
        message: syncResult.inSync 
          ? "Stake balance is synchronized"
          : "Stake balance synchronized, discrepancy detected",
      });
    } catch (error) {
      console.error("Error syncing stake balance:", error);
      res.status(500).json({ message: "Failed to sync stake balance" });
    }
  });
  
  // ========================================
  // P2P Marketplace Routes
  // ========================================
  
  // Payment Methods - Agent Configuration
  
  // Get all payment methods for current agent
  app.get('/api/agents/me/payment-methods', isAuthenticated, isApprovedAgent, async (req: any, res) => {
    try {
      const agent = req.agent;
      const methods = await storage.getPaymentMethodsByAgent(agent.id);
      res.json(methods);
    } catch (error) {
      console.error("Error fetching payment methods:", error);
      res.status(500).json({ message: "Failed to fetch payment methods" });
    }
  });
  
  // Get active payment methods for an agent (public - sanitized, no sensitive data)
  app.get('/api/agents/:agentId/payment-methods/public', async (req: any, res) => {
    try {
      const { agentId } = req.params;
      const methods = await storage.getActivePaymentMethodsByAgent(agentId);
      
      // Sanitize: Remove sensitive accountDetails and instructions from public response
      const sanitizedMethods = methods.map(method => ({
        id: method.id,
        methodType: method.methodType,
        methodName: method.methodName,
        displayName: method.displayName,
        minAmount: method.minAmount,
        maxAmount: method.maxAmount,
        // DO NOT expose: accountDetails, instructions
      }));
      
      res.json(sanitizedMethods);
    } catch (error) {
      console.error("Error fetching agent payment methods:", error);
      res.status(500).json({ message: "Failed to fetch payment methods" });
    }
  });

  // Get all payment methods for an agent (authenticated - full details)
  app.get('/api/agents/:agentId/payment-methods', isAuthenticated, async (req: any, res) => {
    try {
      const { agentId } = req.params;
      const methods = await storage.getPaymentMethodsByAgent(agentId);
      res.json(methods);
    } catch (error) {
      console.error("Error fetching agent payment methods:", error);
      res.status(500).json({ message: "Failed to fetch payment methods" });
    }
  });

  // Create payment method for specific agent (Admin only - for testing)
  app.post('/api/agents/:agentId/payment-methods', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { agentId } = req.params;
      
      // Validate request body
      const { createPaymentMethodSchema } = await import('../shared/p2p-schemas');
      const validation = createPaymentMethodSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid request data",
          errors: validation.error.errors 
        });
      }
      
      const data = validation.data;
      
      const method = await storage.createPaymentMethod({
        agentId,
        ...data,
        isActive: true,
      });
      
      console.log(`[Admin] Created payment method ${method.id} for agent ${agentId}`);
      
      res.status(201).json(method);
    } catch (error) {
      console.error("Error creating payment method:", error);
      res.status(500).json({ message: "Failed to create payment method" });
    }
  });
  
  // Create payment method
  app.post('/api/agents/me/payment-methods', isAuthenticated, isApprovedAgent, async (req: any, res) => {
    try {
      const agent = req.agent;
      
      // Validate request body
      const { createPaymentMethodSchema } = await import('../shared/p2p-schemas');
      const validation = createPaymentMethodSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid request data",
          errors: validation.error.errors 
        });
      }
      
      const data = validation.data;
      
      const method = await storage.createPaymentMethod({
        agentId: agent.id,
        ...data,
        isActive: true,
      });
      
      res.status(201).json(method);
    } catch (error) {
      console.error("Error creating payment method:", error);
      res.status(500).json({ message: "Failed to create payment method" });
    }
  });
  
  // Update payment method
  app.put('/api/agents/me/payment-methods/:id', isAuthenticated, isApprovedAgent, async (req: any, res) => {
    try {
      const agent = req.agent;
      const { id } = req.params;
      
      // Validate request body
      const { updatePaymentMethodSchema } = await import('../shared/p2p-schemas');
      const validation = updatePaymentMethodSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid request data",
          errors: validation.error.errors 
        });
      }
      
      // Verify ownership
      const existingMethod = await storage.getPaymentMethod(id);
      if (!existingMethod || existingMethod.agentId !== agent.id) {
        return res.status(404).json({ message: "Payment method not found" });
      }
      
      const updated = await storage.updatePaymentMethod(id, validation.data);
      res.json(updated);
    } catch (error) {
      console.error("Error updating payment method:", error);
      res.status(500).json({ message: "Failed to update payment method" });
    }
  });
  
  // Delete payment method
  app.delete('/api/agents/me/payment-methods/:id', isAuthenticated, isApprovedAgent, async (req: any, res) => {
    try {
      const agent = req.agent;
      const { id } = req.params;
      
      // Verify ownership
      const existingMethod = await storage.getPaymentMethod(id);
      if (!existingMethod || existingMethod.agentId !== agent.id) {
        return res.status(404).json({ message: "Payment method not found" });
      }
      
      await storage.deletePaymentMethod(id);
      res.json({ message: "Payment method deleted successfully" });
    } catch (error) {
      console.error("Error deleting payment method:", error);
      res.status(500).json({ message: "Failed to delete payment method" });
    }
  });
  
  // P2P Orders - User & Agent Management
  
  // Browse agents marketplace (public - allows filtering)
  app.get('/api/p2p/agents', async (req: any, res) => {
    try {
      const { country, paymentMethod, minRating } = req.query;
      
      const filters: any = {
        status: 'approved',
        verificationTier: undefined,
      };
      
      let agents = await storage.getAllAgents(filters);
      
      // Filter to only online agents
      agents = agents.filter(a => a.availabilityStatus === 'online');
      
      // Filter by country
      if (country) {
        agents = agents.filter(a => a.country === country);
      }
      
      // Filter by minimum rating
      if (minRating) {
        const minRatingNum = parseFloat(minRating);
        agents = agents.filter(a => parseFloat(a.averageRating || '0') >= minRatingNum);
      }
      
      // Filter by payment method (if provided, fetch agents who support it)
      if (paymentMethod) {
        const agentsWithMethod = new Set<string>();
        for (const agent of agents) {
          const methods = await storage.getActivePaymentMethodsByAgent(agent.id);
          if (methods.some(m => m.methodType === paymentMethod)) {
            agentsWithMethod.add(agent.id);
          }
        }
        agents = agents.filter(a => agentsWithMethod.has(a.id));
      }
      
      // Fetch payment methods for each agent
      const agentsWithMethods = await Promise.all(
        agents.map(async (agent) => {
          const paymentMethods = await storage.getActivePaymentMethodsByAgent(agent.id);
          return {
            ...agent,
            paymentMethods,
          };
        })
      );
      
      res.json(agentsWithMethods);
    } catch (error) {
      console.error("Error fetching marketplace agents:", error);
      res.status(500).json({ message: "Failed to fetch agents" });
    }
  });
  
  // Get single agent with payment methods (public)
  app.get('/api/p2p/agents/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      
      const agent = await storage.getAgent(id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      
      const paymentMethods = await storage.getActivePaymentMethodsByAgent(agent.id);
      
      res.json({
        ...agent,
        paymentMethods,
      });
    } catch (error) {
      console.error("Error fetching agent details:", error);
      res.status(500).json({ message: "Failed to fetch agent" });
    }
  });
  
  // Create P2P order (user buys TKOIN from agent)
  app.post('/api/p2p/orders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body
      const { createP2pOrderSchema } = await import('../shared/p2p-schemas');
      const validation = createP2pOrderSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid request data",
          errors: validation.error.errors 
        });
      }
      
      const { agentId, orderType, tkoinAmount, fiatAmount, fiatCurrency, paymentMethodId } = validation.data;
      
      // Validate agent exists and is available
      const agent = await storage.getAgent(agentId);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      if (agent.status !== 'approved') {
        return res.status(400).json({ message: "Agent is not approved" });
      }
      if (agent.availabilityStatus !== 'online') {
        return res.status(400).json({ message: "Agent is not currently available" });
      }
      
      // Lock TKOIN in escrow (database-level inventory tracking)
      const { EscrowService } = await import('./services/escrow-service');
      const escrowService = new EscrowService(storage);
      
      const lockResult = await escrowService.lockTkoin(agentId, tkoinAmount);
      if (!lockResult.success) {
        return res.status(400).json({
          message: lockResult.error || "Failed to lock TKOIN",
          availableBalance: lockResult.availableBalance,
          requiredAmount: lockResult.requiredAmount,
        });
      }
      
      // Calculate expiry time (30 minutes from now)
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      
      // Calculate exchange rate and spread
      const exchangeRate = parseFloat(tkoinAmount) / parseFloat(fiatAmount);
      const agentSpread = parseFloat(agent.markup || '0');
      
      // Create order with TKOIN locked
      try {
        const order = await storage.createP2pOrder({
          agentId,
          userId,
          orderType,
          tkoinAmount,
          fiatAmount,
          fiatCurrency,
          exchangeRate: exchangeRate.toFixed(8),
          agentSpread: agentSpread.toFixed(2),
          paymentMethodId: paymentMethodId || null,
          paymentMethodType: null,
          tkoinLocked: true, // TKOIN is now locked in agent's inventory
          status: 'created',
          expiresAt,
        });
        
        res.status(201).json(order);
      } catch (error) {
        // If order creation fails, unlock the TKOIN
        await escrowService.unlockTkoin(agentId, tkoinAmount);
        throw error;
      }
    } catch (error) {
      console.error("Error creating P2P order:", error);
      res.status(500).json({ message: "Failed to create order" });
    }
  });
  
  // Get user's P2P orders
  app.get('/api/p2p/my-orders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const orders = await storage.getP2pOrdersByUser(userId);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching user orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });
  
  // Get agent's P2P orders
  app.get('/api/agents/me/p2p-orders', isAuthenticated, isApprovedAgent, async (req: any, res) => {
    try {
      const agent = req.agent;
      const orders = await storage.getP2pOrdersByAgent(agent.id);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching agent orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });
  
  // Get specific P2P order
  app.get('/api/p2p/orders/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      const order = await storage.getP2pOrder(id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      // Verify user is participant (buyer or seller)
      const agent = await storage.getAgentByReplitUserId(userId);
      const isParticipant = order.userId === userId || (agent && order.agentId === agent.id);
      
      if (!isParticipant) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(order);
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });
  
  // Update order status (mark payment sent)
  app.post('/api/p2p/orders/:id/payment-sent', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      const order = await storage.getP2pOrder(id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      // Verify user is the buyer
      if (order.userId !== userId) {
        return res.status(403).json({ message: "Only buyer can mark payment sent" });
      }
      
      // Verify order is in correct state
      if (order.status !== 'created' && order.status !== 'payment_pending') {
        return res.status(400).json({ message: "Order cannot be updated in current state" });
      }
      
      // Update order status
      const updated = await storage.updateP2pOrder(id, {
        status: 'payment_sent',
        paymentSentAt: new Date(),
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error marking payment sent:", error);
      res.status(500).json({ message: "Failed to update order" });
    }
  });
  
  // Release TKOIN (agent confirms payment received)
  app.post('/api/p2p/orders/:id/release', isAuthenticated, isApprovedAgent, async (req: any, res) => {
    try {
      const { id } = req.params;
      const agent = req.agent;
      
      const order = await storage.getP2pOrder(id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      // Verify agent is the seller
      if (order.agentId !== agent.id) {
        return res.status(403).json({ message: "Only seller can release funds" });
      }
      
      // Verify order is in correct state
      if (order.status !== 'payment_sent' && order.status !== 'verifying') {
        return res.status(400).json({ message: "Order cannot be released in current state" });
      }
      
      // Verify TKOIN is locked
      if (!order.tkoinLocked) {
        return res.status(400).json({ message: "TKOIN not locked for this order" });
      }
      
      // Transfer TKOIN from agent to user (unlocks and deducts from agent balance)
      const { EscrowService } = await import('./services/escrow-service');
      const escrowService = new EscrowService(storage);
      
      const transferResult = await escrowService.transferTkoin(
        order.agentId,
        order.userId,
        order.tkoinAmount
      );
      
      if (!transferResult.success) {
        return res.status(500).json({
          message: transferResult.error || "Failed to transfer TKOIN"
        });
      }
      
      // Update order status to completed
      const updated = await storage.updateP2pOrder(id, {
        status: 'completed',
        completedAt: new Date(),
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error releasing funds:", error);
      res.status(500).json({ message: "Failed to release funds" });
    }
  });
  
  // Complete order (simplified for testing - transfers TKOIN and marks as completed)
  app.patch('/api/p2p/orders/:id/complete', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      const order = await storage.getP2pOrder(id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      // Verify TKOIN is locked
      if (!order.tkoinLocked) {
        return res.status(400).json({ message: "TKOIN not locked for this order" });
      }
      
      // Transfer TKOIN from agent to user (unlocks and deducts from agent balance)
      const { EscrowService } = await import('./services/escrow-service');
      const escrowService = new EscrowService(storage);
      
      const transferResult = await escrowService.transferTkoin(
        order.agentId,
        order.userId,
        order.tkoinAmount
      );
      
      if (!transferResult.success) {
        return res.status(500).json({
          message: transferResult.error || "Failed to transfer TKOIN"
        });
      }
      
      // Update order status to completed and mark TKOIN as no longer locked
      const updated = await storage.updateP2pOrder(id, {
        status: 'completed',
        tkoinLocked: false,
        completedAt: new Date(),
      });
      
      console.log(`[P2P] Order ${id} completed - TKOIN transferred from agent to user`);
      
      res.json(updated);
    } catch (error) {
      console.error("Error completing order:", error);
      res.status(500).json({ message: "Failed to complete order" });
    }
  });
  
  // Cancel order
  app.patch('/api/p2p/orders/:id/cancel', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const { reason } = req.body;
      
      const order = await storage.getP2pOrder(id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      // Verify user is participant
      const agent = await storage.getAgentByReplitUserId(userId);
      const isParticipant = order.userId === userId || (agent && order.agentId === agent.id);
      
      if (!isParticipant) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Only allow cancel if order is not completed/disputed
      if (order.status === 'completed' || order.status === 'disputed') {
        return res.status(400).json({ message: "Cannot cancel order in current state" });
      }
      
      // Unlock TKOIN if it was locked
      if (order.tkoinLocked) {
        const { EscrowService } = await import('./services/escrow-service');
        const escrowService = new EscrowService(storage);
        
        const unlockResult = await escrowService.unlockTkoin(order.agentId, order.tkoinAmount);
        if (!unlockResult.success) {
          console.error(`Failed to unlock TKOIN on order cancel: ${unlockResult.error}`);
        }
      }
      
      // Update order status to cancelled and mark TKOIN as no longer locked
      const updated = await storage.updateP2pOrder(id, {
        status: 'cancelled',
        tkoinLocked: false,
      });
      
      console.log(`[P2P] Order ${id} cancelled - TKOIN unlocked`);
      
      res.json(updated);
    } catch (error) {
      console.error("Error cancelling order:", error);
      res.status(500).json({ message: "Failed to cancel order" });
    }
  });
  
  // Order Chat Messages
  
  // Get order chat messages
  app.get('/api/p2p/orders/:orderId/messages', isAuthenticated, async (req: any, res) => {
    try {
      const { orderId } = req.params;
      const userId = req.user.claims.sub;
      
      // Verify user is participant
      const order = await storage.getP2pOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      const agent = await storage.getAgentByReplitUserId(userId);
      const isParticipant = order.userId === userId || (agent && order.agentId === agent.id);
      
      if (!isParticipant) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const messages = await storage.getOrderMessages(orderId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });
  
  // Send chat message
  app.post('/api/p2p/orders/:orderId/messages', isAuthenticated, async (req: any, res) => {
    try {
      const { orderId } = req.params;
      const userId = req.user.claims.sub;
      
      // Validate request body
      const { sendMessageSchema } = await import('../shared/p2p-schemas');
      const validation = sendMessageSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid request data",
          errors: validation.error.errors 
        });
      }
      
      const { content, messageType } = validation.data;
      
      // Verify user is participant
      const order = await storage.getP2pOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      const agent = await storage.getAgentByReplitUserId(userId);
      const isParticipant = order.userId === userId || (agent && order.agentId === agent.id);
      
      if (!isParticipant) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Determine sender type
      const senderType = agent && order.agentId === agent.id ? 'agent' : 'user';
      
      const message = await storage.createOrderMessage({
        orderId,
        senderId: userId,
        senderType,
        messageType,
        content,
        imageUrl: null,
        isRead: false,
      });
      
      res.status(201).json(message);
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });
  
  // Payment Proofs
  
  // Get payment proofs for order
  app.get('/api/p2p/orders/:orderId/payment-proofs', isAuthenticated, async (req: any, res) => {
    try {
      const { orderId } = req.params;
      const userId = req.user.claims.sub;
      
      // Verify user is participant
      const order = await storage.getP2pOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      const agent = await storage.getAgentByReplitUserId(userId);
      const isParticipant = order.userId === userId || (agent && order.agentId === agent.id);
      
      if (!isParticipant) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const proofs = await storage.getPaymentProofs(orderId);
      res.json(proofs);
    } catch (error) {
      console.error("Error fetching payment proofs:", error);
      res.status(500).json({ message: "Failed to fetch payment proofs" });
    }
  });
  
  // Upload payment proof (simplified - URL only for now)
  app.post('/api/p2p/orders/:orderId/payment-proofs', isAuthenticated, async (req: any, res) => {
    try {
      const { orderId } = req.params;
      const userId = req.user.claims.sub;
      
      // Validate request body
      const { uploadPaymentProofSchema } = await import('../shared/p2p-schemas');
      const validation = uploadPaymentProofSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid request data",
          errors: validation.error.errors 
        });
      }
      
      const { fileUrl, fileName } = validation.data;
      
      // Verify user is the buyer
      const order = await storage.getP2pOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      if (order.userId !== userId) {
        return res.status(403).json({ message: "Only buyer can upload payment proof" });
      }
      
      const proof = await storage.createPaymentProof({
        orderId,
        userId,
        proofType: 'image',
        fileUrl,
        fileName: fileName || null,
        fileSize: null,
      });
      
      res.status(201).json(proof);
    } catch (error) {
      console.error("Error uploading payment proof:", error);
      res.status(500).json({ message: "Failed to upload payment proof" });
    }
  });
  
  // ========================================
  // Admin Routes - Agent Slashing
  // ========================================
  
  // Create a pending slashing event (admin only)
  app.post('/api/admin/slashing', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { agentId, violationType, severity, description, evidenceUrl } = req.body;
      const adminId = req.user.claims.sub;
      const { SlashingService } = await import('./services/slashing-service');
      
      if (!agentId || !violationType || !severity || !description) {
        return res.status(400).json({ 
          message: "Missing required fields: agentId, violationType, severity, description" 
        });
      }
      
      if (!['minor', 'major', 'critical'].includes(severity)) {
        return res.status(400).json({ 
          message: "Invalid severity. Must be: minor, major, or critical" 
        });
      }
      
      const slashingEvent = await SlashingService.createSlashingEvent({
        agentId,
        violationType,
        severity,
        description,
        evidenceUrl,
        createdBy: adminId,
      });
      
      res.json(slashingEvent);
    } catch (error: any) {
      console.error("Error creating slashing event:", error);
      res.status(400).json({ 
        message: error.message || "Failed to create slashing event" 
      });
    }
  });
  
  // Execute a pending slash (admin only)
  app.post('/api/admin/slashing/:id/execute', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const adminId = req.user.claims.sub;
      const { SlashingService } = await import('./services/slashing-service');
      
      const result = await SlashingService.executeSlash({
        slashingEventId: id,
        executedBy: adminId,
      });
      
      res.json({
        success: true,
        slashingEvent: result.slashingEvent,
        newTier: result.newTier,
        message: `Slash executed successfully. Agent tier is now ${result.newTier}`,
      });
    } catch (error: any) {
      console.error("Error executing slash:", error);
      res.status(400).json({ 
        message: error.message || "Failed to execute slash" 
      });
    }
  });
  
  // Reverse a slashing event (admin only)
  app.post('/api/admin/slashing/:id/reverse', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { reversalReason } = req.body;
      const adminId = req.user.claims.sub;
      const { SlashingService } = await import('./services/slashing-service');
      
      if (!reversalReason) {
        return res.status(400).json({ 
          message: "Reversal reason is required" 
        });
      }
      
      const slashingEvent = await SlashingService.reverseSlash({
        slashingEventId: id,
        reversalReason,
        executedBy: adminId,
      });
      
      res.json({
        success: true,
        slashingEvent,
        message: "Slash reversed successfully",
      });
    } catch (error: any) {
      console.error("Error reversing slash:", error);
      res.status(400).json({ 
        message: error.message || "Failed to reverse slash" 
      });
    }
  });
  
  // Get all pending slashing events (admin only)
  app.get('/api/admin/slashing/pending', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { SlashingService } = await import('./services/slashing-service');
      const pendingSlashes = await SlashingService.getPendingSlashes();
      res.json(pendingSlashes);
    } catch (error) {
      console.error("Error fetching pending slashes:", error);
      res.status(500).json({ message: "Failed to fetch pending slashes" });
    }
  });
  
  // Get all slashing events with optional limit (admin only)
  app.get('/api/admin/slashing', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const { SlashingService } = await import('./services/slashing-service');
      const slashingEvents = await SlashingService.getAllSlashingEvents(limit);
      res.json(slashingEvents);
    } catch (error) {
      console.error("Error fetching slashing events:", error);
      res.status(500).json({ message: "Failed to fetch slashing events" });
    }
  });
  
  // Get slashing event by ID (admin only)
  app.get('/api/admin/slashing/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { SlashingService } = await import('./services/slashing-service');
      const slashingEvent = await SlashingService.getSlashingEvent(id);
      
      if (!slashingEvent) {
        return res.status(404).json({ message: "Slashing event not found" });
      }
      
      res.json(slashingEvent);
    } catch (error) {
      console.error("Error fetching slashing event:", error);
      res.status(500).json({ message: "Failed to fetch slashing event" });
    }
  });
  
  // Get slashing history for a specific agent (admin only)
  app.get('/api/admin/agents/:agentId/slashing', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { agentId } = req.params;
      const { SlashingService } = await import('./services/slashing-service');
      const history = await SlashingService.getAgentSlashingHistory(agentId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching agent slashing history:", error);
      res.status(500).json({ message: "Failed to fetch slashing history" });
    }
  });
  
  // ========================================
  // Admin Routes - Staking Analytics
  // ========================================
  
  // Get staking overview metrics (admin only)
  app.get('/api/admin/analytics/staking/overview', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { StakingAnalyticsService } = await import('./services/staking-analytics-service');
      const overview = await StakingAnalyticsService.getStakingOverview();
      res.json(overview);
    } catch (error) {
      console.error("Error fetching staking overview:", error);
      res.status(500).json({ message: "Failed to fetch staking overview" });
    }
  });
  
  // Get staking trends over time (admin only)
  app.get('/api/admin/analytics/staking/trends', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { days } = req.query;
      const { StakingAnalyticsService } = await import('./services/staking-analytics-service');
      const trends = await StakingAnalyticsService.getStakingTrends(
        days ? parseInt(days as string) : 30
      );
      res.json(trends);
    } catch (error) {
      console.error("Error fetching staking trends:", error);
      res.status(500).json({ message: "Failed to fetch staking trends" });
    }
  });
  
  // Get agent health metrics (admin only)
  app.get('/api/admin/analytics/staking/health', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { StakingAnalyticsService } = await import('./services/staking-analytics-service');
      const health = await StakingAnalyticsService.getAgentHealthMetrics();
      res.json(health);
    } catch (error) {
      console.error("Error fetching agent health metrics:", error);
      res.status(500).json({ message: "Failed to fetch agent health metrics" });
    }
  });
  
  // Get recent staking activity (admin only)
  app.get('/api/admin/analytics/staking/activity', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { limit } = req.query;
      const { StakingAnalyticsService } = await import('./services/staking-analytics-service');
      const activity = await StakingAnalyticsService.getRecentActivity(
        limit ? parseInt(limit as string) : 20
      );
      res.json(activity);
    } catch (error) {
      console.error("Error fetching staking activity:", error);
      res.status(500).json({ message: "Failed to fetch staking activity" });
    }
  });
  
  // ========================================
  // Admin Routes - Slashing Analytics
  // ========================================
  
  // Get slashing overview (admin only)
  app.get('/api/admin/analytics/slashing/overview', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { slashingAnalyticsService } = await import('./services/slashing-analytics-service');
      const overview = await slashingAnalyticsService.getSlashingOverview();
      res.json(overview);
    } catch (error) {
      console.error("Error fetching slashing overview:", error);
      res.status(500).json({ message: "Failed to fetch slashing overview" });
    }
  });
  
  // Get violation breakdown (admin only)
  app.get('/api/admin/analytics/slashing/violations', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { slashingAnalyticsService } = await import('./services/slashing-analytics-service');
      const breakdown = await slashingAnalyticsService.getViolationBreakdown();
      res.json(breakdown);
    } catch (error) {
      console.error("Error fetching violation breakdown:", error);
      res.status(500).json({ message: "Failed to fetch violation breakdown" });
    }
  });
  
  // Get severity breakdown (admin only)
  app.get('/api/admin/analytics/slashing/severity', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { slashingAnalyticsService } = await import('./services/slashing-analytics-service');
      const breakdown = await slashingAnalyticsService.getSeverityBreakdown();
      res.json(breakdown);
    } catch (error) {
      console.error("Error fetching severity breakdown:", error);
      res.status(500).json({ message: "Failed to fetch severity breakdown" });
    }
  });
  
  // Get slashing trends (admin only)
  app.get('/api/admin/analytics/slashing/trends', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { days } = req.query;
      const { slashingAnalyticsService } = await import('./services/slashing-analytics-service');
      const trends = await slashingAnalyticsService.getSlashingTrends(
        days ? parseInt(days as string) : 30
      );
      res.json(trends);
    } catch (error) {
      console.error("Error fetching slashing trends:", error);
      res.status(500).json({ message: "Failed to fetch slashing trends" });
    }
  });
  
  // Get agent violation history (admin only)
  app.get('/api/admin/analytics/slashing/agents', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { limit } = req.query;
      const { slashingAnalyticsService } = await import('./services/slashing-analytics-service');
      const history = await slashingAnalyticsService.getAgentViolationHistory(
        limit ? parseInt(limit as string) : 20
      );
      res.json(history);
    } catch (error) {
      console.error("Error fetching agent violation history:", error);
      res.status(500).json({ message: "Failed to fetch agent violation history" });
    }
  });
  
  // Get recent slashing events (admin only)
  app.get('/api/admin/analytics/slashing/recent', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { limit } = req.query;
      const { slashingAnalyticsService } = await import('./services/slashing-analytics-service');
      const events = await slashingAnalyticsService.getRecentSlashingEvents(
        limit ? parseInt(limit as string) : 10
      );
      res.json(events);
    } catch (error) {
      console.error("Error fetching recent slashing events:", error);
      res.status(500).json({ message: "Failed to fetch recent slashing events" });
    }
  });
  
  // ========================================
  // Admin Routes - Agent Management
  // ========================================
  
  // Get all agents (admin only)
  app.get('/api/admin/agents', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { status, verificationTier } = req.query;
      const agents = await storage.getAllAgents({
        status: status as string,
        verificationTier: verificationTier as string,
      });
      res.json(agents);
    } catch (error) {
      console.error("Error fetching agents:", error);
      res.status(500).json({ message: "Failed to fetch agents" });
    }
  });
  
  // Approve agent application (admin only)
  app.post('/api/admin/agents/:id/approve', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const adminId = req.user.claims.sub;
      
      const agent = await storage.getAgent(id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      
      const updated = await storage.updateAgent(id, {
        status: 'active',
        approvedAt: new Date(),
        approvedBy: adminId,
      });
      
      // Log approval
      await storage.createAuditLog({
        eventType: 'agent_approved',
        entityType: 'agent',
        entityId: id,
        actorId: adminId,
        actorType: 'admin',
      });
      
      res.json({ agent: updated, message: "Agent approved successfully" });
    } catch (error) {
      console.error("Error approving agent:", error);
      res.status(500).json({ message: "Failed to approve agent" });
    }
  });
  
  // Revoke agent access (admin only)
  app.post('/api/admin/agents/:id/revoke', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const adminId = req.user.claims.sub;
      const { reason } = req.body;
      
      const updated = await storage.updateAgent(id, {
        status: 'revoked',
      });
      
      // Log revocation
      await storage.createAuditLog({
        eventType: 'agent_revoked',
        entityType: 'agent',
        entityId: id,
        actorId: adminId,
        actorType: 'admin',
        metadata: { reason },
      });
      
      res.json({ agent: updated, message: "Agent access revoked" });
    } catch (error) {
      console.error("Error revoking agent:", error);
      res.status(500).json({ message: "Failed to revoke agent" });
    }
  });
  
  // ========================================
  // System Configuration Routes
  // ========================================
  
  // Get system config
  app.get('/api/config', async (req, res) => {
    try {
      const config = await storage.getAllSystemConfig();
      
      // Convert to key-value object
      const configObj: Record<string, any> = {};
      config.forEach(c => {
        configObj[c.key] = c.value;
      });
      
      res.json(configObj);
    } catch (error) {
      console.error("Error fetching config:", error);
      res.status(500).json({ message: "Failed to fetch configuration" });
    }
  });
  
  // Update system config (admin only)
  app.put('/api/admin/config/:key', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { key } = req.params;
      const { value, description } = req.body;
      const adminId = req.user.claims.sub;
      
      // Validate burn_rate specifically
      if (key === 'burn_rate') {
        const burnRate = Number(value);
        if (isNaN(burnRate) || burnRate < 0 || burnRate > 200) {
          return res.status(400).json({ 
            message: "Invalid burn rate. Must be between 0 and 200 basis points (0-2%)" 
          });
        }
      }
      
      const config = await storage.setSystemConfig(key, value, description, adminId);
      
      // Log config change with old value for audit
      await storage.createAuditLog({
        eventType: 'config_changed',
        entityType: 'config',
        entityId: key,
        actorId: adminId,
        actorType: 'admin',
        newValue: value,
        metadata: {
          description: description || config.description,
          timestamp: new Date().toISOString(),
        },
      });
      
      // Special alert for burn_rate changes
      if (key === 'burn_rate') {
        console.log(`🔥 [ALERT] Burn rate changed to ${value} basis points (${value / 100}%) by admin ${adminId}`);
      }
      
      res.json(config);
    } catch (error) {
      console.error("Error updating config:", error);
      res.status(500).json({ message: "Failed to update configuration" });
    }
  });
  
  // ========================================
  // Public Stats Routes
  // ========================================
  
  // Get public tokenomics stats
  app.get('/api/stats/tokenomics', async (req, res) => {
    try {
      // Get current burn rate from system config
      const allConfig = await storage.getAllSystemConfig();
      const burnRateConfig = allConfig.find(c => c.key === 'burn_rate');
      const burnRateValue = typeof burnRateConfig?.value === 'string' ? burnRateConfig.value : '100';
      const burnRateBasisPoints = parseInt(burnRateValue);
      const burnRatePercent = (burnRateBasisPoints / 100).toString();
      
      // Get marketplace metrics
      const activeAgentsList = await storage.getAllAgents({ status: 'active' });
      
      // Calculate total agent liquidity (sum of all agent balances)
      const totalLiquidity = activeAgentsList.reduce((sum, agent) => {
        const balance = parseFloat(agent.tkoinBalance || '0');
        return sum + balance;
      }, 0);
      
      // Get all transactions from the last 24 hours for volume calculation
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const allTransactions = await storage.getAllTransactions({});
      const recentTransactions = allTransactions.filter((tx: typeof allTransactions[0]) => 
        tx.createdAt && new Date(tx.createdAt) >= yesterday
      );
      const volume24h = recentTransactions.reduce((sum: number, tx: typeof recentTransactions[0]) => {
        const amount = parseFloat(tx.tkoinAmount || '0');
        return sum + amount;
      }, 0);
      
      // Count agents by tier (based on totalMinted as a proxy for volume)
      const agentsByTier = {
        bronze: activeAgentsList.filter(a => parseFloat(a.totalMinted || '0') < 25000).length,
        silver: activeAgentsList.filter(a => {
          const total = parseFloat(a.totalMinted || '0');
          return total >= 25000 && total < 100000;
        }).length,
        gold: activeAgentsList.filter(a => parseFloat(a.totalMinted || '0') >= 100000).length,
      };
      
      // TODO: Implement actual stats from blockchain for circulating and burned
      // Always return complete marketplace metrics with defaults to prevent frontend errors
      const stats = {
        maxSupply: "1000000000", // 1 Billion TKOIN
        circulatingSupply: totalLiquidity.toFixed(8),
        totalBurned: "0",
        burnRate: burnRatePercent,
        burnRateBasisPoints: burnRateBasisPoints,
        conversionRate: "100", // 1 TKOIN = 100 Credits
        activeAgents: activeAgentsList.length || 0,
        // New marketplace metrics (always present)
        totalLiquidity: totalLiquidity.toFixed(8),
        volume24h: volume24h.toFixed(8),
        agentsByTier: {
          bronze: agentsByTier.bronze || 0,
          silver: agentsByTier.silver || 0,
          gold: agentsByTier.gold || 0,
        },
        supportedCurrencies: (await storage.getCurrencies(true)).length,
      };
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  // Create agent (Admin only - for testing and manual agent creation)
  app.post('/api/agents', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { 
        replitUserId,
        email,
        username,
        tkoinBalance = '0',
        solanaWallet = 'ADMIN_CREATED',
        verificationTier = 'basic',
        displayName,
        bio
      } = req.body;

      // Validate required fields
      if (!replitUserId || !email || !username) {
        return res.status(400).json({ 
          message: "Missing required fields: replitUserId, email, username" 
        });
      }

      // Check if agent already exists for this user
      const existingAgent = await storage.getAgentByReplitUserId(replitUserId);
      if (existingAgent) {
        return res.status(409).json({ 
          message: "Agent already exists for this user" 
        });
      }

      // Create agent (without auto-managed fields)
      const createdAgent = await storage.createAgent({
        replitUserId,
        email,
        username,
        lockedBalance: '0',
        solanaWallet,
        verificationTier,
        displayName: displayName || username,
        bio: bio || null,
        status: 'active',
        availabilityStatus: 'online',
        commissionTier: 'bronze',
      });

      // Update agent balance if specified (admin override)
      if (tkoinBalance && tkoinBalance !== '0') {
        await storage.updateAgentBalance(createdAgent.id, tkoinBalance);
      }

      // Fetch final agent state
      const agent = await storage.getAgent(createdAgent.id);

      console.log(`[Admin] Created agent ${agent!.id} with ${tkoinBalance} TKOIN balance`);

      res.status(201).json(agent);
    } catch (error) {
      console.error("Error creating agent:", error);
      res.status(500).json({ message: "Failed to create agent" });
    }
  });
  
  // Get agent directory (public)
  app.get('/api/agents', async (req, res) => {
    try {
      const { country, city, status = 'online' } = req.query;
      
      // Get active agents
      const agents = await storage.getAllAgents({ status: 'active' });
      
      // Filter by location if provided
      let filtered = agents;
      if (country) {
        filtered = filtered.filter(a => a.country === country);
      }
      if (city) {
        filtered = filtered.filter(a => a.city === city);
      }
      
      // Filter by availability status if provided
      if (status && status !== 'all') {
        filtered = filtered.filter(a => a.availabilityStatus === status);
      }
      
      // Return public agent info only (no sensitive data)
      const publicAgents = filtered.map(a => ({
        id: a.id,
        displayName: a.displayName,
        bio: a.bio,
        country: a.country,
        city: a.city,
        averageRating: a.averageRating,
        totalRatings: a.totalRatings,
        verificationTier: a.verificationTier,
        availabilityStatus: a.availabilityStatus,
        commissionTier: a.commissionTier,
      }));
      
      res.json(publicAgents);
    } catch (error) {
      console.error("Error fetching agent directory:", error);
      res.status(500).json({ message: "Failed to fetch agent directory" });
    }
  });

  // Get supported currencies (public)
  app.get('/api/currencies', async (req, res) => {
    try {
      const currencies = await storage.getCurrencies(true); // Active only
      res.json(currencies);
    } catch (error) {
      console.error("Error fetching currencies:", error);
      res.status(500).json({ message: "Failed to fetch currencies" });
    }
  });

  // Get on-chain credibility stats (public)
  app.get('/api/stats/on-chain', async (req, res) => {
    try {
      // Mock treasury balance (TODO: fetch from Solana blockchain when configured)
      const treasuryBalance = process.env.SOLANA_TREASURY_WALLET 
        ? "0" // Will be fetched from blockchain when configured
        : "125750.50"; // Mock value for development
      
      // Mock recent burns (TODO: fetch from burn logs table when implemented)
      const recentBurns = [
        {
          id: "burn-5",
          amount: "1250.00",
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
          txSignature: "mock-tx-5...",
        },
        {
          id: "burn-4",
          amount: "890.50",
          timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), // 8 hours ago
          txSignature: "mock-tx-4...",
        },
        {
          id: "burn-3",
          amount: "2100.00",
          timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
          txSignature: "mock-tx-3...",
        },
        {
          id: "burn-2",
          amount: "750.25",
          timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
          txSignature: "mock-tx-2...",
        },
        {
          id: "burn-1",
          amount: "1500.00",
          timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
          txSignature: "mock-tx-1...",
        },
      ];

      // Get agent tier earnings (aggregate commissions by tier)
      const allAgents = await storage.getAllAgents({ status: 'active' });
      
      // Calculate average earnings by tier
      const tierEarnings = {
        bronze: {
          avgMonthlyEarnings: "1250.00", // Mock values for now
          agentCount: allAgents.filter(a => a.commissionTier === 'bronze').length,
          totalVolume: "125000.00",
        },
        silver: {
          avgMonthlyEarnings: "4800.00",
          agentCount: allAgents.filter(a => a.commissionTier === 'silver').length,
          totalVolume: "480000.00",
        },
        gold: {
          avgMonthlyEarnings: "12500.00",
          agentCount: allAgents.filter(a => a.commissionTier === 'gold').length,
          totalVolume: "1250000.00",
        },
      };

      // Token-2022 verification (static metadata)
      const tokenVerification = {
        isVerified: true,
        standard: "SPL Token-2022",
        mintAddress: process.env.SOLANA_MINT_ADDRESS || "mock-mint-address",
        extensions: ["Transfer Fee", "Metadata"],
      };

      res.json({
        treasuryBalance,
        recentBurns,
        tierEarnings,
        tokenVerification,
      });
    } catch (error) {
      console.error("Error fetching on-chain stats:", error);
      res.status(500).json({ message: "Failed to fetch on-chain statistics" });
    }
  });

  // ========================================
  // FX Rate Routes
  // ========================================
  
  // Get all current FX rates (public)
  app.get('/api/fx-rates', async (req, res) => {
    try {
      const { baseCurrency } = req.query;
      const base = typeof baseCurrency === 'string' ? baseCurrency : 'USD';
      
      const rates = await fxRateService.getAllRates(base);
      
      res.json({
        base,
        rates,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching FX rates:", error);
      res.status(500).json({ 
        message: "Failed to fetch FX rates",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  // Get specific FX rate (public)
  app.get('/api/fx-rates/:baseCurrency/:quoteCurrency', async (req, res) => {
    try {
      const { baseCurrency, quoteCurrency } = req.params;
      
      const rate = await fxRateService.getRate(
        baseCurrency.toUpperCase(), 
        quoteCurrency.toUpperCase()
      );
      
      res.json({
        base: baseCurrency.toUpperCase(),
        quote: quoteCurrency.toUpperCase(),
        rate,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching FX rate:", error);
      res.status(500).json({ 
        message: "Failed to fetch FX rate",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  // Warm FX rate cache (admin only)
  app.post('/api/admin/fx-rates/warm-cache', isAuthenticated, isAdmin, async (req, res) => {
    try {
      await fxRateService.warmCache();
      
      res.json({ 
        message: "FX rate cache warmed successfully",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error warming FX cache:", error);
      res.status(500).json({ 
        message: "Failed to warm FX cache",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  // Cleanup old FX rates (admin only)
  app.post('/api/admin/fx-rates/cleanup', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { daysToKeep } = req.body;
      const days = typeof daysToKeep === 'number' ? daysToKeep : 30;
      
      await fxRateService.cleanupOldRates(days);
      
      res.json({ 
        message: `FX rates older than ${days} days cleaned up successfully`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error cleaning up FX rates:", error);
      res.status(500).json({ 
        message: "Failed to cleanup FX rates",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // ========================================
  // Currency Management (Admin)
  // ========================================

  // Get all currencies (admin only - includes inactive)
  app.get('/api/admin/currencies', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const currencies = await storage.getCurrencies(false); // All currencies
      res.json(currencies);
    } catch (error) {
      console.error("Error fetching currencies:", error);
      res.status(500).json({ message: "Failed to fetch currencies" });
    }
  });

  // Create new currency (admin only)
  app.post('/api/admin/currencies', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { code, name, symbol, decimals, isActive, sortOrder } = req.body;

      // Validate required fields
      if (!code || !name || !symbol) {
        return res.status(400).json({ message: "Code, name, and symbol are required" });
      }

      // Validate code format (2-3 uppercase letters)
      if (!/^[A-Z]{2,3}$/.test(code.toUpperCase())) {
        return res.status(400).json({ message: "Currency code must be 2-3 uppercase letters (ISO 4217)" });
      }

      // Check if currency already exists
      const existing = await storage.getCurrency(code);
      if (existing) {
        return res.status(409).json({ message: "Currency with this code already exists" });
      }

      const currency = await storage.createCurrency({
        code: code.toUpperCase(),
        name,
        symbol,
        decimals: decimals ?? 2,
        isActive: isActive ?? true,
        sortOrder: sortOrder ?? 0,
      });

      res.status(201).json(currency);
    } catch (error) {
      console.error("Error creating currency:", error);
      res.status(500).json({ message: "Failed to create currency" });
    }
  });

  // Update currency (admin only - handles all updates including toggling isActive)
  app.patch('/api/admin/currencies/:code', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { code } = req.params;
      const { name, symbol, decimals, isActive, sortOrder } = req.body;

      const existing = await storage.getCurrency(code);
      if (!existing) {
        return res.status(404).json({ message: "Currency not found" });
      }

      const updates: Partial<typeof existing> = {};
      if (name !== undefined) updates.name = name;
      if (symbol !== undefined) updates.symbol = symbol;
      if (decimals !== undefined) updates.decimals = decimals;
      if (isActive !== undefined) updates.isActive = isActive;
      if (sortOrder !== undefined) updates.sortOrder = sortOrder;

      const updated = await storage.updateCurrency(code, updates);
      res.json(updated);
    } catch (error) {
      console.error("Error updating currency:", error);
      res.status(500).json({ message: "Failed to update currency" });
    }
  });

  // ========================================
  // Admin Routes - Tier Limits Configuration
  // ========================================

  // Get all tier limits
  app.get('/api/admin/tier-limits', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const keys = [
        'tier_limits_basic_daily',
        'tier_limits_basic_monthly',
        'tier_limits_verified_daily',
        'tier_limits_verified_monthly',
        'tier_limits_premium_daily',
        'tier_limits_premium_monthly'
      ];

      const configs = await Promise.all(keys.map(key => storage.getSystemConfig(key)));
      
      const tierLimits = {
        basic: {
          daily: configs[0]?.value || 1000,
          monthly: configs[1]?.value || 10000,
        },
        verified: {
          daily: configs[2]?.value || 10000,
          monthly: configs[3]?.value || 100000,
        },
        premium: {
          daily: configs[4]?.value || 50000,
          monthly: configs[5]?.value || 500000,
        },
      };

      res.json(tierLimits);
    } catch (error) {
      console.error("Error fetching tier limits:", error);
      res.status(500).json({ message: "Failed to fetch tier limits" });
    }
  });

  // Update tier limit
  app.patch('/api/admin/tier-limits', isAuthenticated, isAdmin, async (req: any, res) => {
    // Import tier limits service for cache invalidation
    const { invalidateTierLimitsCache } = await import('./services/tier-limits-service');
    
    try {
      const schema = z.object({
        tier: z.enum(['basic', 'verified', 'premium']),
        limitType: z.enum(['daily', 'monthly']),
        value: z.number().positive().min(100, 'Limit must be at least $100'),
      });

      const validation = schema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: validation.error.errors 
        });
      }

      const { tier, limitType, value } = validation.data;
      const key = `tier_limits_${tier}_${limitType}`;
      const updatedBy = req.user?.claims?.email || 'admin';

      // Additional validation: Ensure tier hierarchy is maintained
      const allConfigs = await Promise.all([
        storage.getSystemConfig('tier_limits_basic_daily'),
        storage.getSystemConfig('tier_limits_basic_monthly'),
        storage.getSystemConfig('tier_limits_verified_daily'),
        storage.getSystemConfig('tier_limits_verified_monthly'),
        storage.getSystemConfig('tier_limits_premium_daily'),
        storage.getSystemConfig('tier_limits_premium_monthly'),
      ]);

      const currentLimits = {
        basic: { daily: allConfigs[0]?.value || 1000, monthly: allConfigs[1]?.value || 10000 },
        verified: { daily: allConfigs[2]?.value || 10000, monthly: allConfigs[3]?.value || 100000 },
        premium: { daily: allConfigs[4]?.value || 50000, monthly: allConfigs[5]?.value || 500000 },
      };

      // Update the value being changed
      currentLimits[tier][limitType] = value;

      // Validate hierarchy: verified >= basic, premium >= verified
      if (currentLimits.verified.daily < currentLimits.basic.daily ||
          currentLimits.verified.monthly < currentLimits.basic.monthly) {
        return res.status(400).json({ 
          message: "Verified tier limits must be >= Basic tier limits" 
        });
      }

      if (currentLimits.premium.daily < currentLimits.verified.daily ||
          currentLimits.premium.monthly < currentLimits.verified.monthly) {
        return res.status(400).json({ 
          message: "Premium tier limits must be >= Verified tier limits" 
        });
      }

      await storage.setSystemConfig(key, value, `${tier} tier ${limitType} transaction limit (USD)`, updatedBy);

      // Invalidate tier limits cache so new values take effect immediately
      invalidateTierLimitsCache();

      // Log to audit trail
      await storage.createAuditLog({
        eventType: 'tier_limit_updated',
        entityType: 'system_config',
        entityId: key,
        actorId: req.user.claims.sub,
        actorType: 'admin',
        metadata: { tier, limitType, value, updatedBy },
      });

      res.json({ 
        success: true, 
        tier, 
        limitType, 
        value,
        message: `${tier} tier ${limitType} limit updated to $${value.toLocaleString()}` 
      });
    } catch (error) {
      console.error("Error updating tier limit:", error);
      res.status(500).json({ message: "Failed to update tier limit" });
    }
  });

  // ========================================
  // Admin Routes - Sovereign Platform Management
  // ========================================

  // Helper function to mask webhook secrets
  const maskWebhookSecret = (secret: string | null): string => {
    if (!secret || secret.length < 8) return "••••••••";
    return secret.substring(0, 4) + "•".repeat(secret.length - 8) + secret.substring(secret.length - 4);
  };

  // List all sovereign platforms (admin only)
  app.get('/api/admin/platforms', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const activeOnly = req.query.activeOnly === 'true';
      const platforms = await storage.getAllSovereignPlatforms(activeOnly);
      
      // Mask webhook secrets before sending to frontend (security: never expose raw secrets)
      const maskedPlatforms = platforms.map(platform => ({
        ...platform,
        webhookSecret: maskWebhookSecret(platform.webhookSecret),
      }));
      
      res.json(maskedPlatforms);
    } catch (error) {
      console.error("Error fetching platforms:", error);
      res.status(500).json({ message: "Failed to fetch platforms" });
    }
  });

  // Register a new sovereign platform (admin only)
  app.post('/api/admin/platforms', isAuthenticated, isAdmin, async (req: any, res) => {
    // Validate request body with Zod
    const platformSchema = z.object({
      id: z.string().regex(/^[a-z0-9_-]+$/, "Platform ID must be lowercase alphanumeric with underscores/hyphens only"),
      name: z.string().min(1, "Platform name is required"),
      displayName: z.string().optional().nullable(),
      description: z.string().optional().nullable(),
      webhookUrl: z.string().url().optional().nullable().or(z.literal("")),
      contactEmail: z.string().email().optional().nullable().or(z.literal("")),
      supportUrl: z.string().url().optional().nullable().or(z.literal("")),
      isPublic: z.boolean().default(false),
      metadata: z.any().optional().nullable(),
    });

    const validationResult = platformSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: "Invalid request data", 
        errors: validationResult.error.errors 
      });
    }

    const { id, name, displayName, description, webhookUrl, contactEmail, supportUrl, isPublic, metadata } = validationResult.data;

    try {
      // Generate secure webhook secret (32 bytes = 64 hex chars)
      const crypto = await import('crypto');
      const webhookSecret = crypto.randomBytes(32).toString('hex');

      // Create platform (database unique constraint prevents duplicates)
      const platform = await storage.createSovereignPlatform({
        id,
        name,
        displayName: displayName || null,
        description: description || null,
        webhookUrl: webhookUrl || null,
        webhookSecret,
        isActive: true,
        isPublic: isPublic ?? false,
        contactEmail: contactEmail || null,
        supportUrl: supportUrl || null,
        apiKey: null, // Can be added later if needed
        rateLimit: 1000,
        metadata: metadata || null,
      });

      // Log platform registration (only after successful creation)
      await storage.createAuditLog({
        eventType: 'platform_registered',
        entityType: 'sovereign_platform',
        entityId: platform.id,
        actorId: req.user.claims.sub,
        actorType: 'admin',
        metadata: {
          platformName: platform.name,
          platformId: platform.id,
          webhookUrl: platform.webhookUrl,
        },
      });

      // Mask webhook secret before sending to frontend (security: never expose raw secrets)
      const response = {
        ...platform,
        webhookSecret: maskWebhookSecret(platform.webhookSecret),
      };
      
      res.status(201).json(response);
    } catch (error) {
      // Handle duplicate platform ID (unique constraint violation)
      if (error instanceof Error && 'code' in error && error.code === '23505') {
        return res.status(409).json({ message: "Platform with this ID already exists" });
      }
      console.error("Error registering platform:", error);
      res.status(500).json({ 
        message: "Failed to register platform",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Update platform details (admin only)
  app.patch('/api/admin/platforms/:platformId', isAuthenticated, isAdmin, async (req: any, res) => {
    const { platformId } = req.params;

    // Validate request body with Zod (all fields optional for PATCH)
    const updateSchema = z.object({
      name: z.string().min(1).optional(),
      displayName: z.string().optional().nullable(),
      description: z.string().optional().nullable(),
      webhookUrl: z.string().url().optional().nullable().or(z.literal("")),
      contactEmail: z.string().email().optional().nullable().or(z.literal("")),
      supportUrl: z.string().url().optional().nullable().or(z.literal("")),
      isPublic: z.boolean().optional(),
      metadata: z.any().optional().nullable(),
      rateLimit: z.number().int().positive().optional(),
      apiEnabled: z.boolean().optional(),
      webhookEnabled: z.boolean().optional(),
      tenantSubdomain: z.string().max(100).optional().nullable(),
    });

    const validationResult = updateSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: "Invalid request data", 
        errors: validationResult.error.errors 
      });
    }

    const { name, displayName, description, webhookUrl, contactEmail, supportUrl, isPublic, metadata, rateLimit, apiEnabled, webhookEnabled, tenantSubdomain } = validationResult.data;

    // Build updates object (only include provided fields)
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (displayName !== undefined) updates.displayName = displayName || null;
    if (description !== undefined) updates.description = description || null;
    if (webhookUrl !== undefined) updates.webhookUrl = webhookUrl || null;
    if (contactEmail !== undefined) updates.contactEmail = contactEmail || null;
    if (supportUrl !== undefined) updates.supportUrl = supportUrl || null;
    if (isPublic !== undefined) updates.isPublic = isPublic;
    if (metadata !== undefined) updates.metadata = metadata;
    if (rateLimit !== undefined) updates.rateLimit = rateLimit;
    if (apiEnabled !== undefined) updates.apiEnabled = apiEnabled;
    if (webhookEnabled !== undefined) updates.webhookEnabled = webhookEnabled;
    if (tenantSubdomain !== undefined) updates.tenantSubdomain = tenantSubdomain || null;

    try {
      // Update platform (storage throws NotFoundError if platform doesn't exist)
      const updated = await storage.updateSovereignPlatform(platformId, updates);

      // Log platform update (only after successful mutation)
      await storage.createAuditLog({
        eventType: 'platform_updated',
        entityType: 'sovereign_platform',
        entityId: platformId,
        actorId: req.user.claims.sub,
        actorType: 'admin',
        metadata: {
          platformName: updated.name,
          platformId: updated.id,
          updatedFields: Object.keys(updates),
          changes: updates,
        },
      });

      // Mask webhook secret before sending to frontend (security: never expose raw secrets)
      const response = {
        ...updated,
        webhookSecret: maskWebhookSecret(updated.webhookSecret),
      };

      res.json(response);
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({ message: error.message });
      }
      console.error("Error updating platform:", error);
      res.status(500).json({ 
        message: "Failed to update platform",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Toggle platform active status (admin only)
  app.put('/api/admin/platforms/:platformId/toggle', isAuthenticated, isAdmin, async (req: any, res) => {
    const { platformId } = req.params;
    
    // Validate request body
    const toggleSchema = z.object({
      isActive: z.boolean(),
    });

    const validationResult = toggleSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: "Invalid request data", 
        errors: validationResult.error.errors 
        });
    }

    const { isActive } = validationResult.data;

    try {
      // Toggle status (storage throws NotFoundError if platform doesn't exist)
      const updated = await storage.toggleSovereignPlatformStatus(platformId, isActive);

      // Log platform status change (only after successful mutation)
      await storage.createAuditLog({
        eventType: 'platform_toggled',
        entityType: 'sovereign_platform',
        entityId: platformId,
        actorId: req.user.claims.sub,
        actorType: 'admin',
        metadata: {
          platformName: updated.name,
          platformId: updated.id,
          newStatus: isActive,
        },
      });

      // Mask webhook secret before sending to frontend (security: never expose raw secrets)
      const response = {
        ...updated,
        webhookSecret: maskWebhookSecret(updated.webhookSecret),
      };

      res.json(response);
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({ message: error.message });
      }
      console.error("Error toggling platform status:", error);
      res.status(500).json({ 
        message: "Failed to toggle platform status",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Regenerate webhook secret for a platform (admin only - security sensitive)
  app.post('/api/admin/platforms/:platformId/regenerate-secret', isAuthenticated, isAdmin, async (req: any, res) => {
    const { platformId } = req.params;

    try {
      // Generate new webhook secret (32 bytes = 64 hex chars)
      const crypto = await import('crypto');
      const newWebhookSecret = crypto.randomBytes(32).toString('hex');

      // Update platform with new secret (storage throws NotFoundError if platform doesn't exist)
      const updated = await storage.updateSovereignPlatform(platformId, {
        webhookSecret: newWebhookSecret,
      });

      // Log secret regeneration (security event) - only after successful mutation
      await storage.createAuditLog({
        eventType: 'platform_secret_regenerated',
        entityType: 'sovereign_platform',
        entityId: platformId,
        actorId: req.user.claims.sub,
        actorType: 'admin',
        metadata: {
          platformName: updated.name,
          platformId: updated.id,
          newSecretPrefix: newWebhookSecret.substring(0, 8),
          reason: 'Manual regeneration by admin',
          timestamp: new Date().toISOString(),
        },
      });

      // Return platform with masked secret (security: never expose full secret over wire)
      const secretPreview = newWebhookSecret.substring(0, 4) + "•".repeat(newWebhookSecret.length - 8) + newWebhookSecret.substring(newWebhookSecret.length - 4);
      const { webhookSecret: _, ...platformWithoutSecret } = updated; // Remove secret from response
      res.json({
        ...platformWithoutSecret,
        webhookSecret: secretPreview, // Only masked preview
        secretRegenerated: true,
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({ message: error.message });
      }
      console.error("Error regenerating webhook secret:", error);
      res.status(500).json({ 
        message: "Failed to regenerate webhook secret",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // ========================================
  // Platform API Token Management (Admin Only)
  // ========================================
  
  // Generate a new API token for a platform
  app.post('/api/admin/platforms/:platformId/generate-token', isAuthenticated, isAdmin, async (req: any, res) => {
    const { platformId } = req.params;

    try {
      // Validate platform exists
      const platform = await storage.getSovereignPlatform(platformId);
      if (!platform) {
        return res.status(404).json({ message: `Platform '${platformId}' not found` });
      }

      // Generate random 64-char token (32 bytes)
      const crypto = await import('node:crypto');
      const fullToken = crypto.randomBytes(32).toString('hex');
      
      // Create SHA-256 hash for storage
      const tokenHash = crypto.createHash('sha256').update(fullToken).digest('hex');
      
      // Create masked version for display
      const maskedToken = `${fullToken.slice(0, 4)}${'*'.repeat(56)}${fullToken.slice(-4)}`;
      
      // Store in database
      const createdToken = await storage.createPlatformApiToken({
        platformId,
        tokenHash,
        maskedToken,
        isActive: true,
        createdBy: req.user.claims.email || req.user.claims.sub,
      });

      // Log token generation (security event)
      await storage.createAuditLog({
        eventType: 'platform_token_generated',
        entityType: 'platform_api_token',
        entityId: createdToken.id,
        actorId: req.user.claims.sub,
        actorType: 'admin',
        metadata: {
          platformId,
          platformName: platform.name,
          tokenId: createdToken.id,
          maskedToken: createdToken.maskedToken,
          createdBy: createdToken.createdBy,
        },
      });

      // Return full token ONCE (never stored, never shown again)
      res.status(201).json({
        token: fullToken,
        maskedToken: createdToken.maskedToken,
        createdAt: createdToken.createdAt,
        id: createdToken.id,
      });
    } catch (error) {
      console.error("Error generating API token:", error);
      res.status(500).json({ 
        message: "Failed to generate API token",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // List all tokens for a platform (masked)
  app.get('/api/admin/platforms/:platformId/tokens', isAuthenticated, isAdmin, async (req: any, res) => {
    const { platformId } = req.params;

    try {
      // Validate platform exists
      const platform = await storage.getSovereignPlatform(platformId);
      if (!platform) {
        return res.status(404).json({ message: `Platform '${platformId}' not found` });
      }

      // Get all tokens for this platform
      const tokens = await storage.getPlatformApiTokensByPlatform(platformId);
      
      // Return only safe fields (never return tokenHash or full token)
      const safeTokens = tokens.map(token => ({
        id: token.id,
        maskedToken: token.maskedToken,
        isActive: token.isActive,
        createdAt: token.createdAt,
        lastUsedAt: token.lastUsedAt,
        expiresAt: token.expiresAt,
        createdBy: token.createdBy,
      }));

      res.json(safeTokens);
    } catch (error) {
      console.error("Error fetching API tokens:", error);
      res.status(500).json({ 
        message: "Failed to fetch API tokens",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Revoke a token
  app.delete('/api/admin/platforms/:platformId/tokens/:tokenId', isAuthenticated, isAdmin, async (req: any, res) => {
    const { platformId, tokenId } = req.params;

    try {
      // Validate platform exists
      const platform = await storage.getSovereignPlatform(platformId);
      if (!platform) {
        return res.status(404).json({ message: `Platform '${platformId}' not found` });
      }

      // Get the token to verify it belongs to this platform
      const token = await storage.getPlatformApiToken(tokenId);
      if (!token) {
        return res.status(404).json({ message: `API token '${tokenId}' not found` });
      }

      if (token.platformId !== platformId) {
        return res.status(400).json({ message: `Token '${tokenId}' does not belong to platform '${platformId}'` });
      }

      // Revoke the token (set isActive = false)
      await storage.updatePlatformApiToken(tokenId, { isActive: false });

      // Log token revocation (security event)
      await storage.createAuditLog({
        eventType: 'platform_token_revoked',
        entityType: 'platform_api_token',
        entityId: tokenId,
        actorId: req.user.claims.sub,
        actorType: 'admin',
        metadata: {
          platformId,
          platformName: platform.name,
          tokenId,
          maskedToken: token.maskedToken,
          revokedBy: req.user.claims.email || req.user.claims.sub,
        },
      });

      res.json({ 
        success: true,
        message: "API token revoked successfully",
        tokenId,
        maskedToken: token.maskedToken,
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({ message: error.message });
      }
      console.error("Error revoking API token:", error);
      res.status(500).json({ 
        message: "Failed to revoke API token",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // ========================================
  // Token Management API Routes (Admin Only)
  // ========================================

  // Get current token configuration
  app.get('/api/admin/token/config', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { TokenDeployer } = await import('./solana/token-deployer');
      const deployer = new TokenDeployer();
      const config = await deployer.getTokenConfig();

      if (!config) {
        return res.json({ config: null });
      }

      // Add explorer URLs for convenience
      const explorerUrl = config.mintAddress && config.mintAddress !== 'DEPLOYMENT_FAILED'
        ? `https://explorer.solana.com/address/${config.mintAddress}?cluster=devnet`
        : null;

      const signatureUrl = config.deploymentSignature
        ? `https://explorer.solana.com/tx/${config.deploymentSignature}?cluster=devnet`
        : null;

      res.json({
        config: {
          ...config,
          explorerUrl,
          signatureUrl,
        },
      });
    } catch (error) {
      console.error('Error fetching token config:', error);
      res.status(500).json({
        message: 'Failed to fetch token configuration',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Deploy TKOIN Token-2022
  app.post('/api/admin/token/deploy', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { TokenDeployer } = await import('./solana/token-deployer');
      const { solanaCore } = await import('./solana/solana-core');
      type TokenDeploymentConfig = import('./solana/token-deployer').TokenDeploymentConfig;

      // Validate Solana services are configured
      if (!solanaCore.isReady()) {
        return res.status(503).json({
          success: false,
          errorCode: 'SOLANA_NOT_CONFIGURED',
          message: 'Solana services not configured. Please configure SOLANA_RPC_URL, SOLANA_TREASURY_WALLET, and SOLANA_TREASURY_PRIVATE_KEY.',
        });
      }

      // Validate request body
      const deploySchema = z.object({
        tokenName: z.string().min(1).max(32).default('Tkoin'),
        tokenSymbol: z.string().min(1).max(10).default('TK'),
        decimals: z.number().int().min(0).max(9).default(TOKEN_DECIMALS),
        maxSupply: z.string().regex(/^\d+$/).default(TOKEN_MAX_SUPPLY_TOKENS),
        burnRateBasisPoints: z.number().int().min(0).max(10000).default(100),
        maxBurnRateBasisPoints: z.number().int().min(0).max(10000).default(200),
        description: z.string().optional(),
        forceRedeploy: z.boolean().optional().default(false),
        redeployReason: z.string().optional(),
      });

      const requestConfig = deploySchema.parse(req.body);

      // Load stored deployment configuration with metadata and initial supply
      const { getDeploymentConfig } = await import('./config/token-deployment-config');
      const treasuryWallet = solanaCore.getTreasuryPublicKey().toString();
      
      let storedConfig;
      try {
        storedConfig = getDeploymentConfig(treasuryWallet);
      } catch (error) {
        console.error('Failed to load deployment configuration:', error);
        return res.status(500).json({
          success: false,
          errorCode: 'CONFIG_LOAD_ERROR',
          message: 'Failed to load deployment configuration',
        });
      }

      // Merge stored config with request overrides to create complete deployment config
      // Request params can override stored config, but stored config provides defaults
      const config: TokenDeploymentConfig = {
        tokenName: requestConfig.tokenName || storedConfig.metadata.name,
        tokenSymbol: requestConfig.tokenSymbol || storedConfig.metadata.symbol,
        decimals: requestConfig.decimals ?? storedConfig.supply.decimals,
        maxSupply: requestConfig.maxSupply || storedConfig.supply.maxSupply,
        // Map stored config fees to burnRate parameters
        burnRateBasisPoints: requestConfig.burnRateBasisPoints ?? storedConfig.fees.transferFeeBasisPoints,
        maxBurnRateBasisPoints: requestConfig.maxBurnRateBasisPoints ?? storedConfig.fees.maxFeeBasisPoints,
        // Metadata and supply from stored config with fallbacks
        description: requestConfig.description || storedConfig.metadata?.description || '',
        metadataUri: storedConfig.metadata.uri,
        logoUri: storedConfig.metadata.logoURI,
        initialMintAmount: storedConfig.supply.initialMintAmount,
      };

      // Preserve operational flags for redeploy logic
      const forceRedeploy = requestConfig.forceRedeploy;
      const redeployReason = requestConfig.redeployReason;

      // Check for existing deployment
      const deployer = new TokenDeployer();
      const existing = await deployer.getTokenConfig();

      if (existing && existing.deploymentStatus === 'deployed') {
        if (!forceRedeploy) {
          // Return existing deployment (idempotent)
          return res.json({
            success: true,
            mintAddress: existing.mintAddress,
            signature: existing.deploymentSignature,
            message: 'Token already deployed',
            alreadyDeployed: true,
          });
        }

        // Force redeploy requested - log it
        if (!redeployReason) {
          return res.status(400).json({
            success: false,
            errorCode: 'REDEPLOY_REASON_REQUIRED',
            message: 'Redeployment reason is required when forceRedeploy is true',
          });
        }

        await storage.createAuditLog({
          eventType: 'token_redeploy_requested',
          entityType: 'token_config',
          entityId: existing.id,
          actorId: req.user.claims.sub,
          actorType: 'admin',
          metadata: {
            reason: redeployReason,
            oldMintAddress: existing.mintAddress,
            timestamp: new Date().toISOString(),
          },
        });

        // Delete existing deployment to allow redeploy
        console.log('🔄 Deleting existing deployment for redeploy...');
        await db.delete(tokenConfig).where(eq(tokenConfig.id, existing.id));
        console.log('✅ Existing deployment deleted. Proceeding with redeploy...');
      }

      // Log deployment request
      await storage.createAuditLog({
        eventType: 'token_deploy_requested',
        entityType: 'token_config',
        entityId: 'pending',
        actorId: req.user.claims.sub,
        actorType: 'admin',
        metadata: {
          tokenName: config.tokenName,
          tokenSymbol: config.tokenSymbol,
          burnRateBasisPoints: config.burnRateBasisPoints,
          timestamp: new Date().toISOString(),
        },
      });

      // Deploy token
      const result = await deployer.deployToken(config);

      if (result.success) {
        // Log successful deployment
        await storage.createAuditLog({
          eventType: 'token_deploy_succeeded',
          entityType: 'token_config',
          entityId: result.configId || 'unknown',
          actorId: req.user.claims.sub,
          actorType: 'admin',
          metadata: {
            mintAddress: result.mintAddress,
            signature: result.signature,
            burnRateBasisPoints: config.burnRateBasisPoints,
            timestamp: new Date().toISOString(),
          },
        });

        res.json({
          success: true,
          mintAddress: result.mintAddress,
          signature: result.signature,
          explorerUrl: `https://explorer.solana.com/tx/${result.signature}?cluster=devnet`,
        });
      } else {
        // Log failed deployment
        await storage.createAuditLog({
          eventType: 'token_deploy_failed',
          entityType: 'token_config',
          entityId: 'failed',
          actorId: req.user.claims.sub,
          actorType: 'admin',
          metadata: {
            error: result.error,
            timestamp: new Date().toISOString(),
          },
        });

        res.status(500).json({
          success: false,
          errorCode: 'DEPLOYMENT_FAILED',
          message: result.error,
        });
      }
    } catch (error) {
      console.error('Error deploying token:', error);

      // Log unexpected error
      try {
        await storage.createAuditLog({
          eventType: 'token_deploy_failed',
          entityType: 'token_config',
          entityId: 'error',
          actorId: req.user?.claims?.sub || 'unknown',
          actorType: 'admin',
          metadata: {
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
          },
        });
      } catch (auditError) {
        console.error('Failed to log deployment error:', auditError);
      }

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          errorCode: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          errors: error.errors,
        });
      }

      res.status(500).json({
        success: false,
        errorCode: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Verify token deployment on-chain
  app.get('/api/admin/token/verify/:mintAddress', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { mintAddress } = req.params;
      const { TokenDeployer } = await import('./solana/token-deployer');

      const deployer = new TokenDeployer();
      const verified = await deployer.verifyDeployment(mintAddress);

      res.json({ verified });
    } catch (error) {
      console.error('Error verifying token deployment:', error);
      res.status(500).json({
        verified: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // ========================================
  // Pricing API Routes
  // ========================================
  
  const pricingService = new PricingService();

  // Get agent's pricing for a specific currency
  app.get('/api/agents/me/pricing/:currency', isAuthenticated, isApprovedAgent, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const agent = await storage.getAgentByReplitUserId(userId);
      
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const currency = req.params.currency.toUpperCase();
      const pricing = await pricingService.getAgentPricing(agent.id, currency);
      
      res.json(pricing);
    } catch (error) {
      console.error("Error fetching agent pricing:", error);
      res.status(500).json({ 
        message: "Failed to fetch pricing",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get public exchange rates (no auth required)
  app.get('/api/public/rates', async (req, res) => {
    try {
      const currencies = ['PHP', 'EUR', 'USD', 'SGD', 'GBP', 'JPY'];
      const rates: Record<string, { rate: number; bidPrice: number; askPrice: number }> = {};
      
      for (const currency of currencies) {
        try {
          const pricing = await pricingService.getPublicPricing(currency);
          rates[currency] = {
            rate: pricing.fxRate,
            bidPrice: pricing.bidPricePer1kTkoin,
            askPrice: pricing.askPricePer1kTkoin,
          };
        } catch (error) {
          console.warn(`Failed to fetch pricing for ${currency}:`, error);
        }
      }
      
      res.json({
        rates,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching public rates:", error);
      res.status(500).json({ 
        message: "Failed to fetch public rates",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Create a time-locked quote for buying/selling TKOIN
  app.post('/api/agents/pricing/quote', isAuthenticated, isApprovedAgent, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const agent = await storage.getAgentByReplitUserId(userId);
      
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const { currency, quoteType, fiatAmount, tkoinAmount } = req.body;
      
      if (!currency || !quoteType) {
        return res.status(400).json({ message: "Currency and quoteType are required" });
      }

      if (quoteType !== 'buy_from_agent' && quoteType !== 'sell_to_agent') {
        return res.status(400).json({ message: "Invalid quoteType. Must be 'buy_from_agent' or 'sell_to_agent'" });
      }

      // Validate exactly one amount is provided
      const hasFiat = fiatAmount !== undefined && fiatAmount !== null && fiatAmount !== '';
      const hasTkoin = tkoinAmount !== undefined && tkoinAmount !== null && tkoinAmount !== '';

      if (!hasFiat && !hasTkoin) {
        return res.status(400).json({ message: "Either fiatAmount or tkoinAmount must be provided" });
      }

      if (hasFiat && hasTkoin) {
        return res.status(400).json({ message: "Provide either fiatAmount or tkoinAmount, not both" });
      }

      // Validate numeric and positive
      const parsedFiat = hasFiat ? parseFloat(fiatAmount) : undefined;
      const parsedTkoin = hasTkoin ? parseFloat(tkoinAmount) : undefined;

      if (parsedFiat !== undefined && (isNaN(parsedFiat) || parsedFiat <= 0)) {
        return res.status(400).json({ message: "fiatAmount must be a positive number" });
      }

      if (parsedTkoin !== undefined && (isNaN(parsedTkoin) || parsedTkoin <= 0)) {
        return res.status(400).json({ message: "tkoinAmount must be a positive number" });
      }

      const quote = await pricingService.createQuote({
        agentId: agent.id,
        currency: currency.toUpperCase(),
        quoteType,
        fiatAmount: parsedFiat,
        tkoinAmount: parsedTkoin,
      });
      
      res.json(quote);
    } catch (error) {
      console.error("Error creating quote:", error);
      
      // Business logic errors return 400
      const isBusinessError = error instanceof Error && (
        error.message.includes('Insufficient') ||
        error.message.includes('not active') ||
        error.message.includes('does not support') ||
        error.message.includes('below minimum') ||
        error.message.includes('exceeds maximum') ||
        error.message.includes('exceeds maximum precision')
      );
      
      res.status(isBusinessError ? 400 : 500).json({ 
        message: error instanceof Error ? error.message : "Failed to create quote"
      });
    }
  });

  // Validate an existing quote (check if still active and not expired)
  app.post('/api/agents/pricing/validate-quote', isAuthenticated, isApprovedAgent, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const agent = await storage.getAgentByReplitUserId(userId);
      
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const { quoteId } = req.body;
      
      if (!quoteId) {
        return res.status(400).json({ message: "quoteId is required" });
      }

      const isValid = await pricingService.validateQuote(quoteId);
      
      res.json({ 
        valid: isValid,
        quoteId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error validating quote:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to validate quote"
      });
    }
  });

  // Configure custom spreads for an agent (admin or self-service)
  app.post('/api/agents/pricing/configure', isAuthenticated, isApprovedAgent, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const agent = await storage.getAgentByReplitUserId(userId);
      
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const { currency, bidSpreadBps, askSpreadBps, fxBufferBps, minOrderUsd, maxOrderUsd, dailyLimitUsd, isActive } = req.body;
      
      if (!currency) {
        return res.status(400).json({ message: "Currency is required" });
      }

      // Validate numeric inputs if provided
      if (bidSpreadBps !== undefined && (typeof bidSpreadBps !== 'number' || bidSpreadBps < 50 || bidSpreadBps > 500)) {
        return res.status(400).json({ message: "bidSpreadBps must be between 50 and 500" });
      }

      if (askSpreadBps !== undefined && (typeof askSpreadBps !== 'number' || askSpreadBps < 50 || askSpreadBps > 500)) {
        return res.status(400).json({ message: "askSpreadBps must be between 50 and 500" });
      }

      if (fxBufferBps !== undefined && (typeof fxBufferBps !== 'number' || fxBufferBps < 0 || fxBufferBps > 200)) {
        return res.status(400).json({ message: "fxBufferBps must be between 0 and 200" });
      }

      if (minOrderUsd !== undefined && (typeof minOrderUsd !== 'number' || minOrderUsd <= 0)) {
        return res.status(400).json({ message: "minOrderUsd must be a positive number" });
      }

      if (maxOrderUsd !== undefined && (typeof maxOrderUsd !== 'number' || maxOrderUsd <= 0)) {
        return res.status(400).json({ message: "maxOrderUsd must be a positive number" });
      }

      if (dailyLimitUsd !== undefined && (typeof dailyLimitUsd !== 'number' || dailyLimitUsd <= 0)) {
        return res.status(400).json({ message: "dailyLimitUsd must be a positive number" });
      }

      if (isActive !== undefined && typeof isActive !== 'boolean') {
        return res.status(400).json({ message: "isActive must be a boolean" });
      }

      // Validate min/max order logic
      if (minOrderUsd !== undefined && maxOrderUsd !== undefined && minOrderUsd > maxOrderUsd) {
        return res.status(400).json({ message: "minOrderUsd cannot be greater than maxOrderUsd" });
      }

      // Fetch existing settings to merge with updates
      const existing = await storage.getAgentCurrencySettings(agent.id, currency.toUpperCase());

      // Build settings object with proper defaults and type conversion
      // Note: integer columns (bidSpreadBps, askSpreadBps, fxBufferBps) stay as numbers
      // decimal columns (minOrderUsd, maxOrderUsd, dailyLimitUsd) must be strings
      // Defaults match schema: bidSpreadBps=150 (1.5% discount buying from users), askSpreadBps=250 (2.5% markup selling to users)
      const settings = {
        agentId: agent.id,
        currency: currency.toUpperCase(),
        bidSpreadBps: bidSpreadBps ?? existing?.bidSpreadBps ?? 150,  // 1.5% discount when buying from users
        askSpreadBps: askSpreadBps ?? existing?.askSpreadBps ?? 250,  // 2.5% markup when selling to users
        fxBufferBps: fxBufferBps ?? existing?.fxBufferBps ?? 75,
        minOrderUsd: minOrderUsd !== undefined ? minOrderUsd.toString() : (existing?.minOrderUsd ?? "10"),
        maxOrderUsd: maxOrderUsd !== undefined ? maxOrderUsd.toString() : (existing?.maxOrderUsd ?? "5000"),
        dailyLimitUsd: dailyLimitUsd !== undefined ? dailyLimitUsd.toString() : (existing?.dailyLimitUsd ?? "10000"),
        isActive: isActive ?? existing?.isActive ?? true,
      };

      const result = await storage.upsertAgentCurrencySettings(settings);
      
      res.json({
        message: "Pricing configuration updated successfully",
        settings: result
      });
    } catch (error) {
      console.error("Error configuring pricing:", error);
      res.status(500).json({ 
        message: "Failed to configure pricing",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // ========================================
  // Payment Request Routes
  // ========================================

  // Get agent's payment requests
  app.get('/api/payment-requests/me', isAuthenticated, isApprovedAgent, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const agent = await storage.getAgentByReplitUserId(userId);
      
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const requests = await storage.getPaymentRequestsByAgent(agent.id);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching payment requests:", error);
      res.status(500).json({ 
        message: "Failed to fetch payment requests",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Create payment request
  app.post('/api/payment-requests', isAuthenticated, isApprovedAgent, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const agent = await storage.getAgentByReplitUserId(userId);
      
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      // Validate request body
      const bodySchema = z.object({
        fiatAmount: z.number().positive(),
        currency: z.string().length(3).toUpperCase(), // Exactly 3-character ISO code
      });

      const validationResult = bodySchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request body", 
          errors: validationResult.error.errors 
        });
      }

      const { fiatAmount, currency } = validationResult.data;

      // Get pricing for this currency (with proper error handling)
      let pricing;
      try {
        pricing = await pricingService.getAgentPricing(agent.id, currency.toUpperCase());
      } catch (error) {
        return res.status(400).json({ 
          message: `No pricing configuration found for ${currency.toUpperCase()}. Please configure pricing for this currency first.`,
        });
      }
      
      // Calculate Tkoin amount using ask price (agent selling to user)
      const tkoinAmount = (fiatAmount / pricing.askPricePer1kTkoin) * 1000;

      // Generate QR code data (simplified - in production would be Solana wallet address + metadata)
      const qrCodeData = JSON.stringify({
        agent: agent.id,
        fiatAmount,
        currency: currency.toUpperCase(),
        tkoinAmount,
        rate: pricing.askPricePer1kTkoin,
        timestamp: Date.now(),
      });

      // Set expiry (5 minutes default)
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      // Validate against insertPaymentRequestSchema
      const paymentData = {
        agentId: agent.id,
        tkoinAmount: tkoinAmount.toString(),
        fiatAmount: fiatAmount.toString(),
        fiatCurrency: currency.toUpperCase(),
        exchangeRate: pricing.askPricePer1kTkoin.toString(),
        qrCodeData,
        status: "pending" as const,
        expiresAt,
      };

      const paymentRequest = await storage.createPaymentRequest(paymentData);

      res.json(paymentRequest);
    } catch (error) {
      console.error("Error creating payment request:", error);
      res.status(500).json({ 
        message: "Failed to create payment request",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // ========================================
  // Webhook Routes (Platform-Agnostic)
  // ========================================

  // Send credit notification to sovereign platform (for testing/manual triggering - admin only)
  app.post('/api/webhooks/platform/:platformId/credit', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { platformId } = req.params;
      const { userId, depositId, tkoinAmount, creditsAmount, burnAmount, solanaSignature, memo } = req.body;

      if (!userId || !depositId || !tkoinAmount || !creditsAmount) {
        return res.status(400).json({ 
          message: "Missing required fields: userId, depositId, tkoinAmount, creditsAmount" 
        });
      }

      // Get platform configuration
      const platform = await storage.getSovereignPlatform(platformId);

      if (!platform) {
        return res.status(404).json({ 
          message: `Platform '${platformId}' not found` 
        });
      }

      if (!platform.isActive) {
        return res.status(403).json({ 
          message: `Platform '${platformId}' is inactive` 
        });
      }

      if (!platform.webhookUrl) {
        return res.status(500).json({ 
          message: `Platform '${platformId}' has no webhook URL configured` 
        });
      }

      // Import webhook service
      const { WebhookService } = await import('./services/webhook-service');

      // Send webhook
      const result = await WebhookService.sendCreditNotification(
        platform.webhookUrl,
        platform.webhookSecret,
        {
          userId,
          depositId,
          tkoinAmount,
          creditsAmount,
          burnAmount: burnAmount || '0',
          solanaSignature: solanaSignature || '',
          memo,
        }
      );

      // Update deposit webhook status in database
      await storage.updateDepositWebhookStatus(
        depositId,
        result.success,
        platform.webhookUrl,
        {
          attempts: result.attempts,
          statusCode: result.statusCode,
          response: result.response,
          error: result.error,
          deliveredAt: result.deliveredAt,
        }
      );

      // Log audit trail
      await storage.createAuditLog({
        eventType: 'webhook_sent',
        entityType: 'deposit',
        entityId: depositId,
        actorId: req.user.claims.sub,
        actorType: 'admin',
        metadata: {
          platformId,
          webhookUrl: platform.webhookUrl,
          success: result.success,
          attempts: result.attempts,
          statusCode: result.statusCode,
          error: result.error,
        },
      });

      res.json({
        success: result.success,
        message: result.success ? 'Webhook delivered successfully' : 'Webhook delivery failed',
        result,
      });
    } catch (error) {
      console.error("Error sending webhook:", error);
      res.status(500).json({ 
        message: "Failed to send webhook",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Import rate limiting middleware
  const { platformRateLimiter } = await import('./middleware/rate-limit');

  // Receive withdrawal request from sovereign platform
  app.post('/api/webhooks/platform/:platformId/withdrawal', platformRateLimiter, async (req, res) => {
    try {
      const { platformId } = req.params;
      const signature = req.headers['x-tkoin-signature'];
      const timestamp = req.headers['x-tkoin-timestamp'];

      // Get platform configuration
      const platform = await storage.getSovereignPlatform(platformId);

      if (!platform) {
        console.error(`[Webhook] Platform '${platformId}' not found`);
        return res.status(404).json({ message: "Platform not found" });
      }

      if (!platform.isActive) {
        console.error(`[Webhook] Platform '${platformId}' is inactive`);
        return res.status(403).json({ message: "Platform is inactive" });
      }

      if (!signature || typeof signature !== 'string') {
        return res.status(401).json({ message: "Missing or invalid signature" });
      }

      // Verify timestamp format and freshness (prevent replay attacks)
      if (!timestamp || typeof timestamp !== 'string') {
        return res.status(401).json({ message: "Missing or invalid timestamp" });
      }

      const requestTime = parseInt(timestamp);
      if (isNaN(requestTime)) {
        return res.status(401).json({ message: "Invalid timestamp format" });
      }

      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      
      if (Math.abs(now - requestTime) > fiveMinutes) {
        return res.status(401).json({ message: "Request timestamp expired" });
      }

      // Verify signature using platform-specific secret
      const { WebhookService } = await import('./services/webhook-service');
      const payloadString = JSON.stringify(req.body);
      
      const isValid = WebhookService.verifySignature(
        payloadString,
        requestTime,
        signature,
        platform.webhookSecret
      );

      if (!isValid) {
        console.warn(`[Webhook] Invalid signature for ${platformId} withdrawal request`);
        return res.status(401).json({ message: "Invalid signature" });
      }

      // Check for nonce (replay attack prevention within 5-minute window)
      const nonce = req.headers['x-tkoin-nonce'];
      if (!nonce || typeof nonce !== 'string') {
        return res.status(401).json({ message: "Missing or invalid nonce" });
      }

      // SECURITY: Use server-side timestamp for nonce expiry, not client-provided timestamp
      // This prevents attackers from extending the replay window by sending future timestamps
      const serverNow = Date.now();
      const nonceExpiresAt = new Date(serverNow + 5 * 60 * 1000);
      
      const nonceCheck = await storage.checkAndRecordNonce({
        nonce,
        platformId,
        requestPath: req.path,
        requestTimestamp: new Date(serverNow), // Use server timestamp, not requestTime
        expiresAt: nonceExpiresAt,
      });

      if (nonceCheck.exists) {
        console.warn(`[Webhook] Replay attack detected - nonce already used: ${nonce}`);
        return res.status(401).json({ message: "Nonce already used - potential replay attack" });
      }

      const { event, data } = req.body;

      if (event !== 'casino.withdrawal.request') {
        return res.status(400).json({ message: "Invalid event type" });
      }

      const { user_id, withdrawal_id, credits_amount, user_wallet } = data;

      if (!user_id || !withdrawal_id || !credits_amount || !user_wallet) {
        return res.status(400).json({ 
          message: "Missing required fields: user_id, withdrawal_id, credits_amount, user_wallet" 
        });
      }

      // Get conversion rate from system config
      const conversionConfig = await storage.getSystemConfig('conversion_rate');
      const conversionRate = conversionConfig?.value ? Number(conversionConfig.value) : 100;

      // Calculate Tkoin amount (credits / 100)
      const tkoinAmount = (parseFloat(credits_amount) / conversionRate).toFixed(8);

      // Create withdrawal request (no fee for now - can be configured later)
      const withdrawal = await storage.createWithdrawal({
        userId: user_id,
        userWallet: user_wallet,
        creditsAmount: credits_amount,
        tkoinAmount,
        feeAmount: '0',
        status: 'pending',
        // 24-hour cooldown
        cooldownEnd: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      // Log the webhook receipt
      await storage.createAuditLog({
        eventType: 'webhook_received',
        entityType: 'withdrawal',
        entityId: withdrawal.id,
        actorId: user_id,
        actorType: 'system',
        metadata: {
          event,
          withdrawal_id,
          credits_amount,
          tkoin_amount: tkoinAmount,
          platformId,
        },
      });

      res.json({
        success: true,
        withdrawal_id: withdrawal.id,
        tkoin_amount: tkoinAmount,
        status: 'pending',
        cooldown_end: withdrawal.cooldownEnd,
        message: 'Withdrawal request created. 24-hour cooldown applies.',
      });
    } catch (error) {
      console.error("Error processing withdrawal webhook:", error);
      res.status(500).json({ 
        message: "Failed to process withdrawal request",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Backward compatibility: Old 1-Stake webhook endpoint
  // This maintains compatibility with existing BetWin integration
  app.post('/api/webhooks/1stake/withdrawal', platformRateLimiter, async (req, res) => {
    // Call platform-agnostic withdrawal handler with hardcoded platformId
    try {
      const platformId = 'platform_betwin';
      const signature = req.headers['x-tkoin-signature'];
      const timestamp = req.headers['x-tkoin-timestamp'];

      const platform = await storage.getSovereignPlatform(platformId);

      if (!platform) {
        console.error(`[Webhook] Platform '${platformId}' not found`);
        return res.status(404).json({ message: "Platform not found" });
      }

      if (!platform.isActive) {
        console.error(`[Webhook] Platform '${platformId}' is inactive`);
        return res.status(403).json({ message: "Platform is inactive" });
      }

      if (!signature || typeof signature !== 'string') {
        return res.status(401).json({ message: "Missing or invalid signature" });
      }

      if (!timestamp || typeof timestamp !== 'string') {
        return res.status(401).json({ message: "Missing or invalid timestamp" });
      }

      const requestTime = parseInt(timestamp);
      if (isNaN(requestTime)) {
        return res.status(401).json({ message: "Invalid timestamp format" });
      }

      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      
      if (Math.abs(now - requestTime) > fiveMinutes) {
        return res.status(401).json({ message: "Request timestamp expired" });
      }

      const { WebhookService } = await import('./services/webhook-service');
      const payloadString = JSON.stringify(req.body);
      
      const isValid = WebhookService.verifySignature(
        payloadString,
        requestTime,
        signature,
        platform.webhookSecret
      );

      if (!isValid) {
        console.warn(`[Webhook] Invalid signature for ${platformId} withdrawal request`);
        return res.status(401).json({ message: "Invalid signature" });
      }

      // Check for nonce (replay attack prevention within 5-minute window)
      const nonce = req.headers['x-tkoin-nonce'];
      if (!nonce || typeof nonce !== 'string') {
        return res.status(401).json({ message: "Missing or invalid nonce" });
      }

      // SECURITY: Use server-side timestamp for nonce expiry, not client-provided timestamp
      // This prevents attackers from extending the replay window by sending future timestamps
      const serverNow = Date.now();
      const nonceExpiresAt = new Date(serverNow + 5 * 60 * 1000);
      
      const nonceCheck = await storage.checkAndRecordNonce({
        nonce,
        platformId,
        requestPath: req.path,
        requestTimestamp: new Date(serverNow), // Use server timestamp, not requestTime
        expiresAt: nonceExpiresAt,
      });

      if (nonceCheck.exists) {
        console.warn(`[Webhook] Replay attack detected - nonce already used: ${nonce}`);
        return res.status(401).json({ message: "Nonce already used - potential replay attack" });
      }

      const { event, data } = req.body;

      if (event !== 'casino.withdrawal.request') {
        return res.status(400).json({ message: "Invalid event type" });
      }

      const { user_id, withdrawal_id, credits_amount, user_wallet } = data;

      if (!user_id || !withdrawal_id || !credits_amount || !user_wallet) {
        return res.status(400).json({ 
          message: "Missing required fields: user_id, withdrawal_id, credits_amount, user_wallet" 
        });
      }

      const conversionConfig = await storage.getSystemConfig('conversion_rate');
      const conversionRate = conversionConfig?.value ? Number(conversionConfig.value) : 100;

      const tkoinAmount = (parseFloat(credits_amount) / conversionRate).toFixed(8);

      const withdrawal = await storage.createWithdrawal({
        userId: user_id,
        userWallet: user_wallet,
        creditsAmount: credits_amount,
        tkoinAmount,
        feeAmount: '0',
        status: 'pending',
        cooldownEnd: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      await storage.createAuditLog({
        eventType: 'webhook_received',
        entityType: 'withdrawal',
        entityId: withdrawal.id,
        actorId: user_id,
        actorType: 'system',
        metadata: {
          event,
          withdrawal_id,
          credits_amount,
          tkoin_amount: tkoinAmount,
          platformId: 'platform_betwin', // Legacy endpoint
          legacyRoute: true,
        },
      });

      res.json({
        success: true,
        withdrawal_id: withdrawal.id,
        tkoin_amount: tkoinAmount,
        status: 'pending',
        cooldown_end: withdrawal.cooldownEnd,
        message: 'Withdrawal request created. 24-hour cooldown applies.',
      });
    } catch (error) {
      console.error("Error processing withdrawal webhook (legacy route):", error);
      res.status(500).json({ 
        message: "Failed to process withdrawal request",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // ========================================
  // User Settlement Routes (BetWin Integration)
  // ========================================

  // Get user's balance on a platform
  app.get('/api/user/balance/:platformId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { platformId } = req.params;
      
      const balance = await storage.getUserSettlementBalance(userId, platformId);
      res.json({ balance, platformId, userId });
    } catch (error) {
      console.error("Error fetching settlement balance:", error);
      res.status(500).json({ message: "Failed to fetch balance" });
    }
  });

  // List user's deposit transactions
  app.get('/api/user/deposits', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { platformId } = req.query;
      
      const settlements = await storage.getUserSettlements(userId, platformId);
      const deposits = settlements.filter(s => s.type === 'deposit');
      res.json(deposits);
    } catch (error) {
      console.error("Error fetching deposits:", error);
      res.status(500).json({ message: "Failed to fetch deposits" });
    }
  });

  // Initiate a deposit (user requests TKOIN from marketplace)
  app.post('/api/user/deposits/request', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { platformId, tkoinAmount } = req.body;
      
      if (!platformId || !tkoinAmount) {
        return res.status(400).json({ message: "platformId and tkoinAmount required" });
      }
      
      // Create settlement record (status: pending until P2P order completes)
      const settlement = await storage.createUserSettlement({
        userId,
        platformId,
        type: 'deposit',
        tkoinAmount: tkoinAmount.toString(),
        status: 'pending',
      });
      
      res.status(201).json(settlement);
    } catch (error) {
      console.error("Error creating deposit request:", error);
      res.status(500).json({ message: "Failed to create deposit request" });
    }
  });

  // List user's withdrawal transactions
  app.get('/api/user/withdrawals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { platformId } = req.query;
      
      const settlements = await storage.getUserSettlements(userId, platformId);
      const withdrawals = settlements.filter(s => s.type === 'withdrawal');
      res.json(withdrawals);
    } catch (error) {
      console.error("Error fetching withdrawals:", error);
      res.status(500).json({ message: "Failed to fetch withdrawals" });
    }
  });

  // Initiate a withdrawal (user requests to convert TKOIN back)
  app.post('/api/user/withdrawals/request', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { platformId, tkoinAmount } = req.body;
      
      if (!platformId || !tkoinAmount) {
        return res.status(400).json({ message: "platformId and tkoinAmount required" });
      }
      
      // Create settlement record (status: pending until verified on-chain)
      const settlement = await storage.createUserSettlement({
        userId,
        platformId,
        type: 'withdrawal',
        tkoinAmount: tkoinAmount.toString(),
        status: 'pending',
      });
      
      res.status(201).json(settlement);
    } catch (error) {
      console.error("Error creating withdrawal request:", error);
      res.status(500).json({ message: "Failed to create withdrawal request" });
    }
  });

  // ========================================
  // BetWin Wallet Integration Endpoints
  // ========================================

  // Get user's TKOIN/CREDIT balance (for BetWin wallet widget)
  app.get('/api/user/tkoin/balance', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Get user's total TKOIN and CREDIT balances from transactions
      const transactions = await storage.getTransactionsByUser(userId);
      
      let totalTkoin = 0;
      let totalCredits = 0;
      
      transactions.forEach((tx: Transaction) => {
        if (tx.type === 'deposit' || tx.type === 'agent_transfer') {
          totalTkoin += parseFloat(tx.tkoinAmount?.toString() || '0');
          totalCredits += parseFloat(tx.creditsAmount?.toString() || '0');
        } else if (tx.type === 'withdrawal') {
          totalTkoin -= parseFloat(tx.tkoinAmount?.toString() || '0');
          totalCredits -= parseFloat(tx.creditsAmount?.toString() || '0');
        }
      });

      res.json({
        userId,
        tkoin_balance: parseFloat(totalTkoin.toFixed(8)),
        credit_balance: parseFloat(totalCredits.toFixed(2)),
        total_transactions: transactions.length,
      });
    } catch (error) {
      console.error("Error fetching TKOIN balance:", error);
      res.status(500).json({ message: "Failed to fetch balance" });
    }
  });

  // Get user's TKOIN transaction history (for BetWin wallet widget)
  app.get('/api/user/tkoin/history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const transactions = await storage.getTransactionsByUser(userId);
      
      // Format for BetWin wallet
      const history = transactions
        .filter((tx: Transaction) => ['deposit', 'withdrawal', 'agent_transfer'].includes(tx.type))
        .map((tx: Transaction) => ({
          id: tx.id,
          type: tx.type === 'agent_transfer' ? 'deposit' : tx.type,
          amount: parseFloat(tx.creditsAmount || tx.tkoinAmount || '0'),
          status: tx.status || 'completed',
          date: tx.createdAt,
          description: `${tx.type === 'agent_transfer' ? 'Deposit' : tx.type === 'deposit' ? 'Direct Deposit' : 'Withdrawal'} of ${parseFloat(tx.tkoinAmount || '0').toFixed(4)} TKOIN`,
        }))
        .slice(0, limit);

      res.json(history);
    } catch (error) {
      console.error("Error fetching TKOIN history:", error);
      res.status(500).json({ message: "Failed to fetch history" });
    }
  });

  // Initiate TKOIN deposit from P2P marketplace (BetWin endpoint)
  app.post('/api/user/tkoin/deposit', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { amount, method } = req.body;

      if (!amount || parseFloat(amount) <= 0) {
        return res.status(400).json({ message: "Invalid deposit amount" });
      }

      // Create transaction record for tracking
      const transaction = await storage.createTransaction({
        type: 'deposit',
        userId,
        tkoinAmount: amount.toString(),
        creditsAmount: (parseFloat(amount) * 100).toString(),
        conversionRate: '100',
        status: 'pending',
        metadata: {
          method: method || 'marketplace',
          initiatedAt: new Date().toISOString(),
        },
      });

      res.status(201).json({
        success: true,
        transaction_id: transaction.id,
        amount: parseFloat(amount),
        credits: parseFloat(amount) * 100,
        status: 'pending',
        message: 'Deposit initiated. Complete via P2P marketplace.',
      });
    } catch (error) {
      console.error("Error initiating deposit:", error);
      res.status(500).json({ message: "Failed to initiate deposit" });
    }
  });

  // Initiate TKOIN withdrawal (BetWin endpoint)
  app.post('/api/user/tkoin/withdrawal', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { amount, destination_wallet } = req.body;

      if (!amount || parseFloat(amount) <= 0) {
        return res.status(400).json({ message: "Invalid withdrawal amount" });
      }

      // Verify user has sufficient balance
      const transactions = await storage.getTransactionsByUser(userId);
      let balance = 0;
      transactions.forEach((tx: Transaction) => {
        if (tx.type === 'deposit' || tx.type === 'agent_transfer') {
          balance += parseFloat(tx.creditsAmount || '0');
        } else if (tx.type === 'withdrawal') {
          balance -= parseFloat(tx.creditsAmount || '0');
        }
      });

      const withdrawalAmount = parseFloat(amount);
      if (balance < withdrawalAmount) {
        return res.status(400).json({
          message: "Insufficient balance",
          balance: balance,
          requested: withdrawalAmount,
        });
      }

      // Create withdrawal record
      const withdrawal = await storage.createWithdrawal({
        userId,
        userWallet: destination_wallet || '',
        creditsAmount: amount.toString(),
        tkoinAmount: (withdrawalAmount / 100).toString(),
        feeAmount: '0',
        status: 'pending',
      });

      res.status(201).json({
        success: true,
        withdrawal_id: withdrawal.id,
        amount: parseFloat(amount),
        tkoin_amount: withdrawalAmount / 100,
        status: 'pending',
        message: 'Withdrawal initiated. Processing will take 24 hours.',
      });
    } catch (error) {
      console.error("Error initiating withdrawal:", error);
      res.status(500).json({ message: "Failed to initiate withdrawal" });
    }
  });

  // ========================================
  // Agent Application Routes
  // ========================================

  // Submit agent application (authenticated users)
  app.post('/api/applications/submit', isAuthenticated, async (req: any, res) => {
    try {
      const applicationSchema = z.object({
        email: z.string().email("Valid email address is required"),
        businessName: z.string().min(1, "Business name is required"),
        businessType: z.enum(["individual", "llc", "corporation", "partnership"], {
          errorMap: () => ({ message: "Invalid business type" })
        }),
        country: z.string().min(2, "Country is required"),
        city: z.string().min(1, "City is required"),
        address: z.string().min(5, "Valid address is required"),
        phoneNumber: z.string().min(10, "Valid phone number is required"),
        requestedTier: z.enum(["basic", "verified", "premium"]).default("basic"),
        kycDocuments: z.array(z.any()).optional(),
      });

      const validationResult = applicationSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: validationResult.error.errors 
        });
      }

      const userId = req.user.claims.sub;
      
      // Backend fallback: if email is empty but user session has email, use that
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const email = validationResult.data.email || user.email || "";
      if (!email) {
        return res.status(400).json({ 
          message: "Email is required. Please ensure your account has a valid email address." 
        });
      }

      // Strip email from data before passing to ApplicationService (it expects Omit<..., "email">)
      const { email: _email, ...applicationData } = validationResult.data;

      const application = await applicationService.createApplication(
        applicationData,
        userId,
        email
      );

      res.json(application);
    } catch (error) {
      console.error("Error creating application:", error);
      if (error instanceof Error && error.message.includes("already have a pending")) {
        return res.status(409).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to create application" });
    }
  });

  // Get my application (authenticated users)
  app.get('/api/applications/me', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const application = await applicationService.getApplicationByUserId(userId);
      
      if (!application) {
        return res.status(404).json({ message: "No application found" });
      }

      res.json(application);
    } catch (error) {
      console.error("Error fetching application:", error);
      res.status(500).json({ message: "Failed to fetch application" });
    }
  });

  // Get all applications (admin only)
  app.get('/api/admin/applications', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { status } = req.query;
      const applications = await applicationService.getApplications({ status: status as string });
      res.json(applications);
    } catch (error) {
      console.error("Error fetching applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  // Get application statistics (admin only)
  app.get('/api/admin/applications/stats', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const stats = await applicationService.getApplicationStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching application stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Get single application (admin only)
  app.get('/api/admin/applications/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const application = await applicationService.getApplicationById(id);
      
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      res.json(application);
    } catch (error) {
      console.error("Error fetching application:", error);
      res.status(500).json({ message: "Failed to fetch application" });
    }
  });

  // Approve application (admin only)
  app.post('/api/admin/applications/:id/approve', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { reviewNotes } = req.body;
      const adminUserId = req.user.claims.sub;

      const result = await applicationService.approveApplication(id, adminUserId, reviewNotes);
      res.json(result);
    } catch (error) {
      console.error("Error approving application:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to approve application" 
      });
    }
  });

  // Reject application (admin only)
  app.post('/api/admin/applications/:id/reject', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { rejectionReason } = req.body;
      const adminUserId = req.user.claims.sub;

      if (!rejectionReason) {
        return res.status(400).json({ message: "Rejection reason is required" });
      }

      const application = await applicationService.rejectApplication(id, adminUserId, rejectionReason);
      res.json(application);
    } catch (error) {
      console.error("Error rejecting application:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to reject application" 
      });
    }
  });

  // ========================================
  // Burn Proposal Routes
  // ========================================

  // Initialize burn proposal service
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const burnProposalService = new BurnProposalService(new Connection(rpcUrl, 'confirmed'));

  // Get burn configuration (admin only)
  app.get('/api/admin/burn/config', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const config = await burnProposalService.getConfig();
      res.json(config);
    } catch (error) {
      console.error("Error fetching burn config:", error);
      res.status(500).json({ message: "Failed to fetch burn configuration" });
    }
  });

  // Update burn configuration (admin only)
  app.patch('/api/admin/burn/config', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const adminUserId = req.user.claims.sub;
      const config = await burnProposalService.updateConfig(req.body, adminUserId);
      res.json(config);
    } catch (error) {
      console.error("Error updating burn config:", error);
      res.status(500).json({ message: "Failed to update burn configuration" });
    }
  });

  // Calculate proposed burn (admin only)
  app.post('/api/admin/burn/calculate', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const calculateSchema = z.object({
        treasuryWallet: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "Invalid Solana wallet address"),
      });

      const validationResult = calculateSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: validationResult.error.errors 
        });
      }

      const calculation = await burnProposalService.calculateProposedBurn(validationResult.data.treasuryWallet);
      res.json(calculation);
    } catch (error) {
      console.error("Error calculating burn:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to calculate burn proposal" 
      });
    }
  });

  // Create burn proposal (admin only)
  app.post('/api/admin/burn/proposals', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const proposalSchema = z.object({
        reason: z.string().min(10, "Reason must be at least 10 characters"),
        treasuryWallet: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "Invalid Solana wallet address"),
      });

      const validationResult = proposalSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: validationResult.error.errors 
        });
      }

      const adminUserId = req.user.claims.sub;
      const proposal = await burnProposalService.createProposal(
        adminUserId, 
        validationResult.data.reason, 
        validationResult.data.treasuryWallet
      );
      res.json(proposal);
    } catch (error) {
      console.error("Error creating burn proposal:", error);
      if (error instanceof Error && error.message.includes("safety limits")) {
        return res.status(422).json({ 
          message: error.message,
          type: "safety_violation"
        });
      }
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to create burn proposal" 
      });
    }
  });

  // Get all burn proposals (admin only)
  app.get('/api/admin/burn/proposals', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { status } = req.query;
      const proposals = await burnProposalService.getProposals(status as string);
      res.json(proposals);
    } catch (error) {
      console.error("Error fetching burn proposals:", error);
      res.status(500).json({ message: "Failed to fetch burn proposals" });
    }
  });

  // Get single burn proposal (admin only)
  app.get('/api/admin/burn/proposals/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const proposal = await burnProposalService.getProposalById(id);
      
      if (!proposal) {
        return res.status(404).json({ message: "Proposal not found" });
      }

      res.json(proposal);
    } catch (error) {
      console.error("Error fetching burn proposal:", error);
      res.status(500).json({ message: "Failed to fetch burn proposal" });
    }
  });

  // Approve burn proposal (admin only)
  app.post('/api/admin/burn/proposals/:id/approve', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const adminUserId = req.user.claims.sub;

      const proposal = await burnProposalService.approveProposal(id, adminUserId);
      res.json(proposal);
    } catch (error) {
      console.error("Error approving burn proposal:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to approve burn proposal" 
      });
    }
  });

  // Reject burn proposal (admin only)
  app.post('/api/admin/burn/proposals/:id/reject', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { rejectionReason } = req.body;
      const adminUserId = req.user.claims.sub;

      if (!rejectionReason) {
        return res.status(400).json({ message: "Rejection reason is required" });
      }

      const proposal = await burnProposalService.rejectProposal(id, adminUserId, rejectionReason);
      res.json(proposal);
    } catch (error) {
      console.error("Error rejecting burn proposal:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to reject burn proposal" 
      });
    }
  });

  // Get burn history (admin only)
  app.get('/api/admin/burn/history', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const history = await burnProposalService.getBurnHistory(limit);
      res.json(history);
    } catch (error) {
      console.error("Error fetching burn history:", error);
      res.status(500).json({ message: "Failed to fetch burn history" });
    }
  });

  // Get burn statistics (admin only)
  app.get('/api/admin/burn/stats', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const stats = await burnProposalService.getBurnStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching burn stats:", error);
      res.status(500).json({ message: "Failed to fetch burn statistics" });
    }
  });

  // ========================================
  // Direct Deposit (Solana Wallet -> BetWin)
  // ========================================

  // Direct deposit - User sends TKOIN from Solana wallet to treasury
  app.post('/api/user/direct-deposit', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { solanaSignature, userWallet, tkoinAmount } = req.body;

      // Validate required fields
      if (!solanaSignature || !userWallet || !tkoinAmount) {
        return res.status(400).json({ 
          message: "Missing required fields: solanaSignature, userWallet, tkoinAmount" 
        });
      }

      // Validate Solana signature format (44 char base58)
      if (!/^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(solanaSignature)) {
        return res.status(400).json({ message: "Invalid Solana signature format" });
      }

      // Validate wallet address
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(userWallet)) {
        return res.status(400).json({ message: "Invalid Solana wallet address" });
      }

      const amount = parseFloat(tkoinAmount);
      if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: "Invalid TKOIN amount" });
      }

      // Check if deposit already exists (prevent duplicates)
      const existingDeposit = await storage.getDepositBySignature(solanaSignature);
      if (existingDeposit) {
        return res.status(400).json({ 
          message: "Deposit already processed",
          depositId: existingDeposit.id 
        });
      }

      // Create deposit record (status: detected)
      const deposit = await storage.createDeposit({
        solanaSignature,
        fromWallet: userWallet,
        toWallet: process.env.SOLANA_TREASURY_WALLET || 'unknown',
        tkoinAmount: tkoinAmount,
        burnAmount: '0', // No burn on direct deposits
        creditsAmount: (amount * 100).toString(), // 1 TKOIN = 100 CREDIT
        userId,
        memo: `Direct deposit from ${userWallet}`,
        status: 'processing',
      });

      // Create transaction record for tracking
      await storage.createTransaction({
        type: 'deposit',
        userId,
        userWallet,
        tkoinAmount: tkoinAmount,
        creditsAmount: (amount * 100).toString(),
        conversionRate: '100', // 1 TKOIN = 100 CREDIT
        status: 'completed',
        solanaSignature,
        metadata: {
          depositId: deposit.id,
          depositType: 'direct_solana',
          timestamp: new Date().toISOString(),
        },
      });

      logger.info('Direct deposit processed', {
        userId,
        depositId: deposit.id,
        tkoinAmount,
        signature: solanaSignature,
      });

      res.status(201).json({
        success: true,
        deposit,
        creditsAmount: (amount * 100).toFixed(2),
        message: `${tkoinAmount} TKOIN deposited successfully. You received ${(amount * 100).toFixed(0)} CREDIT.`,
      });
    } catch (error) {
      console.error("Error processing direct deposit:", error);
      res.status(500).json({ 
        message: "Failed to process deposit",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get direct deposit status
  app.get('/api/user/direct-deposit/:signature', isAuthenticated, async (req: any, res) => {
    try {
      const { signature } = req.params;
      const userId = req.user.claims.sub;

      const deposit = await storage.getDepositBySignature(signature);
      if (!deposit) {
        return res.status(404).json({ message: "Deposit not found" });
      }

      // Verify user owns this deposit
      if (deposit.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(deposit);
    } catch (error) {
      console.error("Error fetching deposit:", error);
      res.status(500).json({ message: "Failed to fetch deposit" });
    }
  });

  // ========================================
  // Platform API Endpoints (Server-to-Server)
  // ========================================

  // Get user balance (Platform API)
  app.get('/api/platforms/:platformId/users/:userId/balance', verifyPlatformSignature, async (req: any, res) => {
    try {
      const { platformId, userId } = req.params;
      const platform = getPlatformFromRequest(req);
      
      // Verify platform ID matches authenticated platform
      if (platform.id !== platformId) {
        return res.status(403).json({ error: 'Platform ID mismatch' });
      }
      
      // Get user's COMPLETED settlements for this platform (ledger of record)
      const allSettlements = await storage.getUserSettlements(userId, platformId);
      const completedSettlements = allSettlements.filter(s => s.status === 'completed');
      
      // Calculate balance from completed settlements only
      let tkoinBalance = 0;
      let creditsBalance = 0;
      
      completedSettlements.forEach((settlement: UserSettlement) => {
        const amount = parseFloat(settlement.tkoinAmount || '0');
        if (settlement.type === 'deposit') {
          tkoinBalance += amount;
          creditsBalance += amount * 100; // 1 TKOIN = 100 CREDITS
        } else if (settlement.type === 'withdrawal') {
          tkoinBalance -= amount;
          creditsBalance -= amount * 100;
        }
      });
      
      logger.info('Platform balance request', {
        platformId,
        userId,
        tkoinBalance,
        creditsBalance,
      });
      
      res.json({
        userId,
        platformId,
        tkoinBalance: tkoinBalance.toFixed(8),
        creditsBalance: creditsBalance.toFixed(2),
        exchangeRate: "100.00",
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Platform balance request error', {
        platformId: req.params.platformId,
        userId: req.params.userId,
        error,
      });
      res.status(500).json({ error: "Failed to fetch balance" });
    }
  });

  // Initiate deposit (Platform API)
  app.post('/api/platforms/:platformId/deposits', verifyPlatformSignature, async (req: any, res) => {
    try {
      const { platformId } = req.params;
      const { userId, amount, method } = req.body;
      const platform = getPlatformFromRequest(req);
      
      // Verify platform ID matches authenticated platform
      if (platform.id !== platformId) {
        return res.status(403).json({ error: 'Platform ID mismatch' });
      }
      
      // Validate input
      if (!userId || !amount || !method) {
        return res.status(400).json({ 
          error: 'Missing required fields',
          required: ['userId', 'amount', 'method']
        });
      }
      
      const depositAmount = parseFloat(amount);
      if (isNaN(depositAmount) || depositAmount <= 0) {
        return res.status(400).json({ error: 'Invalid deposit amount' });
      }
      
      // Create transaction record for tracking
      const transaction = await storage.createTransaction({
        type: 'deposit',
        userId,
        tkoinAmount: depositAmount.toString(),
        creditsAmount: (depositAmount * 100).toString(),
        conversionRate: '100',
        status: 'pending',
        metadata: {
          platformId,
          method,
          initiatedAt: new Date().toISOString(),
        },
      });
      
      // Return deposit initiation response
      const redirectUrl = method === 'p2p_marketplace' 
        ? `https://${req.headers.host}/marketplace`
        : null;
      
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      
      logger.info('Platform deposit initiated', {
        platformId,
        userId,
        amount: depositAmount,
        method,
        transactionId: transaction.id,
      });
      
      res.json({
        depositId: transaction.id,
        status: 'pending',
        tkoinAmount: depositAmount.toFixed(8),
        creditsAmount: (depositAmount * 100).toFixed(2),
        method,
        redirectUrl,
        expiresAt: expiresAt.toISOString(),
      });
    } catch (error) {
      logger.error('Platform deposit initiation error', {
        platformId: req.params.platformId,
        userId: req.body.userId,
        error,
      });
      res.status(500).json({ error: "Failed to initiate deposit" });
    }
  });

  // Initiate withdrawal (Platform API)
  app.post('/api/platforms/:platformId/withdrawals', verifyPlatformSignature, async (req: any, res) => {
    try {
      const { platformId } = req.params;
      const { userId, amount, solanaWallet } = req.body;
      const platform = getPlatformFromRequest(req);
      
      // Verify platform ID matches authenticated platform
      if (platform.id !== platformId) {
        return res.status(403).json({ error: 'Platform ID mismatch' });
      }
      
      // Validate input
      if (!userId || !amount) {
        return res.status(400).json({ 
          error: 'Missing required fields',
          required: ['userId', 'amount']
        });
      }
      
      const withdrawalAmount = parseFloat(amount);
      if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
        return res.status(400).json({ error: 'Invalid withdrawal amount' });
      }
      
      // Check user balance (only count COMPLETED settlements)
      const allSettlements = await storage.getUserSettlements(userId, platformId);
      const completedSettlements = allSettlements.filter(s => s.status === 'completed');
      let balance = 0;
      completedSettlements.forEach((settlement: UserSettlement) => {
        const settleAmount = parseFloat(settlement.tkoinAmount || '0');
        if (settlement.type === 'deposit') {
          balance += settleAmount;
        } else if (settlement.type === 'withdrawal') {
          balance -= settleAmount;
        }
      });
      
      if (balance < withdrawalAmount) {
        return res.status(400).json({
          error: 'Insufficient balance',
          availableBalance: balance.toFixed(8),
          requestedAmount: withdrawalAmount.toFixed(8),
        });
      }
      
      // Create withdrawal transaction
      const transaction = await storage.createTransaction({
        type: 'withdrawal',
        userId,
        userWallet: solanaWallet,
        tkoinAmount: withdrawalAmount.toString(),
        creditsAmount: (withdrawalAmount * 100).toString(),
        conversionRate: '100',
        status: 'pending',
        metadata: {
          platformId,
          initiatedAt: new Date().toISOString(),
        },
      });
      
      logger.info('Platform withdrawal initiated', {
        platformId,
        userId,
        amount: withdrawalAmount,
        destination: solanaWallet || 'p2p_marketplace',
        transactionId: transaction.id,
      });
      
      res.json({
        withdrawalId: transaction.id,
        status: 'pending',
        tkoinAmount: withdrawalAmount.toFixed(8),
        creditsDeducted: (withdrawalAmount * 100).toFixed(2),
        destination: solanaWallet || 'p2p_marketplace',
        estimatedCompletion: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
      });
    } catch (error) {
      logger.error('Platform withdrawal initiation error', {
        platformId: req.params.platformId,
        userId: req.body.userId,
        error,
      });
      res.status(500).json({ error: "Failed to initiate withdrawal" });
    }
  });

  // Get user transaction history (Platform API)
  app.get('/api/platforms/:platformId/users/:userId/transactions', verifyPlatformSignature, async (req: any, res) => {
    try {
      const { platformId, userId } = req.params;
      const platform = getPlatformFromRequest(req);
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      // Verify platform ID matches authenticated platform
      if (platform.id !== platformId) {
        return res.status(403).json({ error: 'Platform ID mismatch' });
      }
      
      // Get user transactions
      const allTransactions = await storage.getTransactionsByUser(userId);
      
      // Filter and format
      const filtered = allTransactions
        .filter((tx: Transaction) => ['deposit', 'withdrawal', 'agent_transfer'].includes(tx.type))
        .map((tx: Transaction) => ({
          id: tx.id,
          type: tx.type === 'agent_transfer' ? 'deposit' : tx.type,
          tkoinAmount: parseFloat(tx.tkoinAmount || '0').toFixed(8),
          creditsAmount: parseFloat(tx.creditsAmount || '0').toFixed(2),
          status: tx.status || 'completed',
          timestamp: tx.createdAt.toISOString(),
        }));
      
      const paginated = filtered.slice(offset, offset + limit);
      
      logger.info('Platform transaction history request', {
        platformId,
        userId,
        limit,
        offset,
        total: filtered.length,
      });
      
      res.json({
        transactions: paginated,
        pagination: {
          total: filtered.length,
          limit,
          offset,
          hasMore: offset + limit < filtered.length,
        },
      });
    } catch (error) {
      logger.error('Platform transaction history error', {
        platformId: req.params.platformId,
        userId: req.params.userId,
        error,
      });
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });
  
  // Warm cache on server startup
  console.log("[FX] Initializing FX rate service...");
  fxRateService.warmCache().catch((error) => {
    console.warn("[FX] Failed to warm cache on startup, will retry on first request:", error.message);
  });

  const httpServer = createServer(app);
  return httpServer;
}
