import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, isApprovedAgent, isAdmin } from "./replitAuth";

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
      
      const config = await storage.setSystemConfig(key, value, description, adminId);
      
      // Log config change
      await storage.createAuditLog({
        eventType: 'config_changed',
        entityType: 'config',
        entityId: key,
        actorId: adminId,
        actorType: 'admin',
        newValue: value,
      });
      
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
      // TODO: Implement actual stats from blockchain
      // For now, return mock data structure
      const stats = {
        maxSupply: "100000000",
        circulatingSupply: "0",
        totalBurned: "0",
        burnRate: "2",
        conversionRate: "100",
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

  const httpServer = createServer(app);
  return httpServer;
}
