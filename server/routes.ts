import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
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
      
      // Check if user is an admin (for now, all active agents are admins)
      // TODO: Add dedicated isAdmin field to agents table for proper role management
      const isAdmin = agent?.status === 'active';
      
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
        maxSupply: "100000000",
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
  // Webhook Routes (1Stake Integration)
  // ========================================

  // Send credit notification to 1Stake (for testing/manual triggering - admin only)
  app.post('/api/webhooks/send/credit', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { userId, depositId, tkoinAmount, creditsAmount, burnAmount, solanaSignature, memo } = req.body;

      if (!userId || !depositId || !tkoinAmount || !creditsAmount) {
        return res.status(400).json({ 
          message: "Missing required fields: userId, depositId, tkoinAmount, creditsAmount" 
        });
      }

      // Get webhook configuration
      const webhookUrlConfig = await storage.getSystemConfig('1stake_webhook_url');
      const webhookSecret = process.env.TKOIN_WEBHOOK_SECRET;

      if (!webhookUrlConfig?.value || !webhookSecret) {
        return res.status(500).json({ 
          message: "Webhook not configured. Set 1stake_webhook_url in system config and TKOIN_WEBHOOK_SECRET env var" 
        });
      }

      const webhookUrl = String(webhookUrlConfig.value);

      // Import webhook service
      const { WebhookService } = await import('./services/webhook-service');

      // Send webhook
      const result = await WebhookService.sendCreditNotification(
        webhookUrl,
        webhookSecret,
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
        webhookUrl,
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
          webhookUrl,
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

  // Receive withdrawal request from 1Stake platform
  app.post('/api/webhooks/1stake/withdrawal', async (req, res) => {
    try {
      const signature = req.headers['x-tkoin-signature'];
      const timestamp = req.headers['x-tkoin-timestamp'];
      const webhookSecret = process.env.TKOIN_WEBHOOK_SECRET;

      if (!webhookSecret) {
        console.error("[Webhook] TKOIN_WEBHOOK_SECRET not configured");
        return res.status(500).json({ message: "Webhook secret not configured" });
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

      // Verify signature (includes timestamp to prevent tampering)
      const { WebhookService } = await import('./services/webhook-service');
      const payloadString = JSON.stringify(req.body);
      
      const isValid = WebhookService.verifySignature(
        payloadString,
        requestTime,
        signature,
        webhookSecret
      );

      if (!isValid) {
        console.warn("[Webhook] Invalid signature for withdrawal request");
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
          source: '1stake',
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
  
  // Warm cache on server startup
  console.log("[FX] Initializing FX rate service...");
  fxRateService.warmCache().catch((error) => {
    console.warn("[FX] Failed to warm cache on startup, will retry on first request:", error.message);
  });

  const httpServer = createServer(app);
  return httpServer;
}
