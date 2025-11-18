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
import { TOKEN_DECIMALS, TOKEN_MAX_SUPPLY_TOKENS } from "@shared/token-constants";
import { db } from "./db";
import { tokenConfig } from "@shared/schema";
import { eq } from "drizzle-orm";
import { Connection } from "@solana/web3.js";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  await setupAuth(app);

  // ========================================
  // Authentication Routes
  // ========================================
  
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
  
  // Permissionless agent registration (requires wallet signature + on-chain TKOIN balance)
  app.post('/api/agents/register-permissionless', isAuthenticated, async (req: any, res) => {
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

  // Receive withdrawal request from sovereign platform
  app.post('/api/webhooks/platform/:platformId/withdrawal', async (req, res) => {
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
  app.post('/api/webhooks/1stake/withdrawal', async (req, res) => {
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
  
  // Warm cache on server startup
  console.log("[FX] Initializing FX rate service...");
  fxRateService.warmCache().catch((error) => {
    console.warn("[FX] Failed to warm cache on startup, will retry on first request:", error.message);
  });

  const httpServer = createServer(app);
  return httpServer;
}
