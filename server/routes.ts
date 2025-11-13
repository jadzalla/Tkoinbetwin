import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, isApprovedAgent, isAdmin } from "./replitAuth";
import { fxRateService } from "./services/fx-rate-service";
import { PricingService } from "./services/pricing-service";

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
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
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
      
      // TODO: Implement actual stats from blockchain
      // For now, return mock data structure
      const stats = {
        maxSupply: "100000000",
        circulatingSupply: "0",
        totalBurned: "0",
        burnRate: burnRatePercent, // Now uses configurable rate
        burnRateBasisPoints: burnRateBasisPoints,
        conversionRate: "100", // 1 TKOIN = 100 Credits
        activeAgents: await storage.getAllAgents({ status: 'active' }).then(a => a.length),
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
  
  // Warm cache on server startup
  console.log("[FX] Initializing FX rate service...");
  fxRateService.warmCache().catch((error) => {
    console.warn("[FX] Failed to warm cache on startup, will retry on first request:", error.message);
  });

  const httpServer = createServer(app);
  return httpServer;
}
