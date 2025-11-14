import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { NotFoundError } from "./errors";
import { setupAuth, isAuthenticated, isApprovedAgent, isAdmin } from "./replitAuth";
import { fxRateService } from "./services/fx-rate-service";
import { PricingService } from "./services/pricing-service";
import { TOKEN_DECIMALS, TOKEN_MAX_SUPPLY_TOKENS } from "@shared/token-constants";

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
  
  // Apply to become an agent
  app.post('/api/agents/apply', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if already an agent
      const existingAgent = await storage.getAgentByReplitUserId(userId);
      if (existingAgent) {
        return res.status(400).json({ 
          message: "Already registered as an agent",
          agent: existingAgent
        });
      }
      
      const { solanaWallet, country, city, displayName, bio } = req.body;
      
      if (!solanaWallet) {
        return res.status(400).json({ message: "Solana wallet address required" });
      }
      
      // Create agent application (status: pending)
      const agent = await storage.createAgent({
        replitUserId: userId,
        email: user.email || '',
        username: user.email?.split('@')[0] || 'user',
        solanaWallet,
        country,
        city,
        displayName: displayName || `${user.firstName} ${user.lastName}`.trim(),
        bio,
        verificationTier: 'basic',
        status: 'pending',
      });
      
      // Log agent application
      await storage.createAuditLog({
        eventType: 'agent_applied',
        entityType: 'agent',
        entityId: agent.id,
        actorId: userId,
        actorType: 'user',
        metadata: {
          solanaWallet,
          country,
          city,
        },
      });
      
      res.json({ agent, message: "Agent application submitted successfully" });
    } catch (error) {
      console.error("Error creating agent:", error);
      res.status(500).json({ message: "Failed to create agent application" });
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
    });

    const validationResult = updateSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: "Invalid request data", 
        errors: validationResult.error.errors 
      });
    }

    const { name, displayName, description, webhookUrl, contactEmail, supportUrl, isPublic, metadata, rateLimit } = validationResult.data;

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

      const config = deploySchema.parse(req.body);

      // Check for existing deployment
      const deployer = new TokenDeployer();
      const existing = await deployer.getTokenConfig();

      if (existing && existing.deploymentStatus === 'deployed') {
        if (!config.forceRedeploy) {
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
        if (!config.redeployReason) {
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
            reason: config.redeployReason,
            oldMintAddress: existing.mintAddress,
            timestamp: new Date().toISOString(),
          },
        });
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
  
  // Warm cache on server startup
  console.log("[FX] Initializing FX rate service...");
  fxRateService.warmCache().catch((error) => {
    console.warn("[FX] Failed to warm cache on startup, will retry on first request:", error.message);
  });

  const httpServer = createServer(app);
  return httpServer;
}
