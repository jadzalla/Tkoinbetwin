import { db } from './db';
import { eq, and, desc, sql, gte, lte, inArray } from 'drizzle-orm';
import type {
  User,
  UpsertUser,
  Agent,
  InsertAgent,
  ExchangeOrder,
  InsertExchangeOrder,
  Transaction,
  InsertTransaction,
  Deposit,
  InsertDeposit,
  Withdrawal,
  InsertWithdrawal,
  PaymentRequest,
  InsertPaymentRequest,
  AgentRating,
  InsertAgentRating,
  AuditLog,
  InsertAuditLog,
  AgentInventoryHistoryRecord,
  InsertAgentInventoryHistory,
  PromotionalEvent,
  InsertPromotionalEvent,
  SystemConfig,
  InsertSystemConfig,
} from '@shared/schema';
import {
  users,
  agents,
  exchangeOrders,
  transactions,
  deposits,
  withdrawals,
  paymentRequests,
  agentRatings,
  auditLogs,
  agentInventoryHistory,
  promotionalEvents,
  systemConfig,
} from '@shared/schema';

// Storage Interface
export interface IStorage {
  // User Operations (Required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Agent Operations
  getAgent(id: string): Promise<Agent | undefined>;
  getAgentByReplitUserId(replitUserId: string): Promise<Agent | undefined>;
  getAgentBySolanaWallet(solanaWallet: string): Promise<Agent | undefined>;
  getAllAgents(filters?: { status?: string; verificationTier?: string }): Promise<Agent[]>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: string, updates: Partial<Agent>): Promise<Agent | undefined>;
  updateAgentBalance(id: string, newBalance: string): Promise<void>;
  
  // Exchange Order Operations
  getExchangeOrder(id: string): Promise<ExchangeOrder | undefined>;
  getExchangeOrdersByAgent(agentId: string): Promise<ExchangeOrder[]>;
  createExchangeOrder(order: InsertExchangeOrder): Promise<ExchangeOrder>;
  updateExchangeOrder(id: string, updates: Partial<ExchangeOrder>): Promise<ExchangeOrder | undefined>;
  
  // Transaction Operations
  getTransaction(id: string): Promise<Transaction | undefined>;
  getTransactionsByAgent(agentId: string): Promise<Transaction[]>;
  getTransactionsByUser(userId: string): Promise<Transaction[]>;
  getTransactionBySignature(signature: string): Promise<Transaction | undefined>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction | undefined>;
  
  // Deposit Operations
  getDeposit(id: string): Promise<Deposit | undefined>;
  getDepositBySignature(signature: string): Promise<Deposit | undefined>;
  getDepositsByUser(userId: string): Promise<Deposit[]>;
  getPendingDeposits(): Promise<Deposit[]>;
  createDeposit(deposit: InsertDeposit): Promise<Deposit>;
  updateDeposit(id: string, updates: Partial<Deposit>): Promise<Deposit | undefined>;
  
  // Withdrawal Operations
  getWithdrawal(id: string): Promise<Withdrawal | undefined>;
  getWithdrawalsByUser(userId: string): Promise<Withdrawal[]>;
  getPendingWithdrawals(): Promise<Withdrawal[]>;
  createWithdrawal(withdrawal: InsertWithdrawal): Promise<Withdrawal>;
  updateWithdrawal(id: string, updates: Partial<Withdrawal>): Promise<Withdrawal | undefined>;
  
  // Payment Request Operations
  getPaymentRequest(id: string): Promise<PaymentRequest | undefined>;
  getPaymentRequestsByAgent(agentId: string): Promise<PaymentRequest[]>;
  getActivePaymentRequests(agentId: string): Promise<PaymentRequest[]>;
  createPaymentRequest(request: InsertPaymentRequest): Promise<PaymentRequest>;
  updatePaymentRequest(id: string, updates: Partial<PaymentRequest>): Promise<PaymentRequest | undefined>;
  expireOldPaymentRequests(): Promise<number>;
  
  // Agent Rating Operations
  getAgentRatings(agentId: string): Promise<AgentRating[]>;
  createAgentRating(rating: InsertAgentRating): Promise<AgentRating>;
  updateAgentRating(id: string, updates: Partial<AgentRating>): Promise<AgentRating | undefined>;
  
  // Audit Log Operations
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(filters?: { eventType?: string; entityType?: string; entityId?: string }): Promise<AuditLog[]>;
  
  // Agent Inventory History
  getAgentInventoryHistory(agentId: string, limit?: number): Promise<AgentInventoryHistoryRecord[]>;
  createInventoryHistoryRecord(record: InsertAgentInventoryHistory): Promise<AgentInventoryHistoryRecord>;
  
  // Promotional Events
  getPromotionalEvent(id: string): Promise<PromotionalEvent | undefined>;
  getActivePromotionalEvents(): Promise<PromotionalEvent[]>;
  createPromotionalEvent(event: InsertPromotionalEvent): Promise<PromotionalEvent>;
  updatePromotionalEvent(id: string, updates: Partial<PromotionalEvent>): Promise<PromotionalEvent | undefined>;
  
  // System Config
  getSystemConfig(key: string): Promise<SystemConfig | undefined>;
  getAllSystemConfig(): Promise<SystemConfig[]>;
  setSystemConfig(key: string, value: any, description?: string, updatedBy?: string): Promise<SystemConfig>;
}

// PostgreSQL Implementation
export class PostgresStorage implements IStorage {
  // User Operations (Required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const result = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result[0];
  }

  // Agent Operations
  async getAgent(id: string): Promise<Agent | undefined> {
    const result = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
    return result[0];
  }

  async getAgentByReplitUserId(replitUserId: string): Promise<Agent | undefined> {
    const result = await db.select().from(agents).where(eq(agents.replitUserId, replitUserId)).limit(1);
    return result[0];
  }

  async getAgentBySolanaWallet(solanaWallet: string): Promise<Agent | undefined> {
    const result = await db.select().from(agents).where(eq(agents.solanaWallet, solanaWallet)).limit(1);
    return result[0];
  }

  async getAllAgents(filters?: { status?: string; verificationTier?: string }): Promise<Agent[]> {
    let query = db.select().from(agents);
    
    const conditions = [];
    if (filters?.status) {
      conditions.push(eq(agents.status, filters.status));
    }
    if (filters?.verificationTier) {
      conditions.push(eq(agents.verificationTier, filters.verificationTier));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    return query.orderBy(desc(agents.createdAt));
  }

  async createAgent(agent: InsertAgent): Promise<Agent> {
    const result = await db.insert(agents).values(agent).returning();
    return result[0];
  }

  async updateAgent(id: string, updates: Partial<Agent>): Promise<Agent | undefined> {
    const result = await db.update(agents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(agents.id, id))
      .returning();
    return result[0];
  }

  async updateAgentBalance(id: string, newBalance: string): Promise<void> {
    await db.update(agents)
      .set({ tkoinBalance: newBalance, updatedAt: new Date() })
      .where(eq(agents.id, id));
  }

  // Exchange Order Operations
  async getExchangeOrder(id: string): Promise<ExchangeOrder | undefined> {
    const result = await db.select().from(exchangeOrders).where(eq(exchangeOrders.id, id)).limit(1);
    return result[0];
  }

  async getExchangeOrdersByAgent(agentId: string): Promise<ExchangeOrder[]> {
    return db.select().from(exchangeOrders)
      .where(eq(exchangeOrders.agentId, agentId))
      .orderBy(desc(exchangeOrders.createdAt));
  }

  async createExchangeOrder(order: InsertExchangeOrder): Promise<ExchangeOrder> {
    const result = await db.insert(exchangeOrders).values(order).returning();
    return result[0];
  }

  async updateExchangeOrder(id: string, updates: Partial<ExchangeOrder>): Promise<ExchangeOrder | undefined> {
    const result = await db.update(exchangeOrders)
      .set(updates)
      .where(eq(exchangeOrders.id, id))
      .returning();
    return result[0];
  }

  // Transaction Operations
  async getTransaction(id: string): Promise<Transaction | undefined> {
    const result = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
    return result[0];
  }

  async getTransactionsByAgent(agentId: string): Promise<Transaction[]> {
    return db.select().from(transactions)
      .where(eq(transactions.agentId, agentId))
      .orderBy(desc(transactions.createdAt));
  }

  async getTransactionsByUser(userId: string): Promise<Transaction[]> {
    return db.select().from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt));
  }

  async getTransactionBySignature(signature: string): Promise<Transaction | undefined> {
    const result = await db.select().from(transactions)
      .where(eq(transactions.solanaSignature, signature))
      .limit(1);
    return result[0];
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const result = await db.insert(transactions).values(transaction).returning();
    return result[0];
  }

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction | undefined> {
    const result = await db.update(transactions)
      .set(updates)
      .where(eq(transactions.id, id))
      .returning();
    return result[0];
  }

  // Deposit Operations
  async getDeposit(id: string): Promise<Deposit | undefined> {
    const result = await db.select().from(deposits).where(eq(deposits.id, id)).limit(1);
    return result[0];
  }

  async getDepositBySignature(signature: string): Promise<Deposit | undefined> {
    const result = await db.select().from(deposits)
      .where(eq(deposits.solanaSignature, signature))
      .limit(1);
    return result[0];
  }

  async getDepositsByUser(userId: string): Promise<Deposit[]> {
    return db.select().from(deposits)
      .where(eq(deposits.userId, userId))
      .orderBy(desc(deposits.detectedAt));
  }

  async getPendingDeposits(): Promise<Deposit[]> {
    return db.select().from(deposits)
      .where(inArray(deposits.status, ['detected', 'processing']))
      .orderBy(deposits.detectedAt);
  }

  async createDeposit(deposit: InsertDeposit): Promise<Deposit> {
    const result = await db.insert(deposits).values(deposit).returning();
    return result[0];
  }

  async updateDeposit(id: string, updates: Partial<Deposit>): Promise<Deposit | undefined> {
    const result = await db.update(deposits)
      .set(updates)
      .where(eq(deposits.id, id))
      .returning();
    return result[0];
  }

  // Withdrawal Operations
  async getWithdrawal(id: string): Promise<Withdrawal | undefined> {
    const result = await db.select().from(withdrawals).where(eq(withdrawals.id, id)).limit(1);
    return result[0];
  }

  async getWithdrawalsByUser(userId: string): Promise<Withdrawal[]> {
    return db.select().from(withdrawals)
      .where(eq(withdrawals.userId, userId))
      .orderBy(desc(withdrawals.createdAt));
  }

  async getPendingWithdrawals(): Promise<Withdrawal[]> {
    return db.select().from(withdrawals)
      .where(inArray(withdrawals.status, ['pending', 'approved']))
      .orderBy(withdrawals.createdAt);
  }

  async createWithdrawal(withdrawal: InsertWithdrawal): Promise<Withdrawal> {
    const result = await db.insert(withdrawals).values(withdrawal).returning();
    return result[0];
  }

  async updateWithdrawal(id: string, updates: Partial<Withdrawal>): Promise<Withdrawal | undefined> {
    const result = await db.update(withdrawals)
      .set(updates)
      .where(eq(withdrawals.id, id))
      .returning();
    return result[0];
  }

  // Payment Request Operations
  async getPaymentRequest(id: string): Promise<PaymentRequest | undefined> {
    const result = await db.select().from(paymentRequests).where(eq(paymentRequests.id, id)).limit(1);
    return result[0];
  }

  async getPaymentRequestsByAgent(agentId: string): Promise<PaymentRequest[]> {
    return db.select().from(paymentRequests)
      .where(eq(paymentRequests.agentId, agentId))
      .orderBy(desc(paymentRequests.createdAt));
  }

  async getActivePaymentRequests(agentId: string): Promise<PaymentRequest[]> {
    return db.select().from(paymentRequests)
      .where(and(
        eq(paymentRequests.agentId, agentId),
        eq(paymentRequests.status, 'pending'),
        gte(paymentRequests.expiresAt, new Date())
      ))
      .orderBy(desc(paymentRequests.createdAt));
  }

  async createPaymentRequest(request: InsertPaymentRequest): Promise<PaymentRequest> {
    const result = await db.insert(paymentRequests).values(request).returning();
    return result[0];
  }

  async updatePaymentRequest(id: string, updates: Partial<PaymentRequest>): Promise<PaymentRequest | undefined> {
    const result = await db.update(paymentRequests)
      .set(updates)
      .where(eq(paymentRequests.id, id))
      .returning();
    return result[0];
  }

  async expireOldPaymentRequests(): Promise<number> {
    const result = await db.update(paymentRequests)
      .set({ status: 'expired' })
      .where(and(
        eq(paymentRequests.status, 'pending'),
        lte(paymentRequests.expiresAt, new Date())
      ))
      .returning();
    return result.length;
  }

  // Agent Rating Operations
  async getAgentRatings(agentId: string): Promise<AgentRating[]> {
    return db.select().from(agentRatings)
      .where(eq(agentRatings.agentId, agentId))
      .orderBy(desc(agentRatings.createdAt));
  }

  async createAgentRating(rating: InsertAgentRating): Promise<AgentRating> {
    const result = await db.insert(agentRatings).values(rating).returning();
    
    // Update agent's average rating
    const allRatings = await this.getAgentRatings(rating.agentId);
    const avgRating = allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length;
    await this.updateAgent(rating.agentId, {
      averageRating: avgRating.toFixed(2),
      totalRatings: allRatings.length,
    });
    
    return result[0];
  }

  async updateAgentRating(id: string, updates: Partial<AgentRating>): Promise<AgentRating | undefined> {
    const result = await db.update(agentRatings)
      .set(updates)
      .where(eq(agentRatings.id, id))
      .returning();
    return result[0];
  }

  // Audit Log Operations
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const result = await db.insert(auditLogs).values(log).returning();
    return result[0];
  }

  async getAuditLogs(filters?: { eventType?: string; entityType?: string; entityId?: string }): Promise<AuditLog[]> {
    let query = db.select().from(auditLogs);
    
    const conditions = [];
    if (filters?.eventType) {
      conditions.push(eq(auditLogs.eventType, filters.eventType));
    }
    if (filters?.entityType) {
      conditions.push(eq(auditLogs.entityType, filters.entityType));
    }
    if (filters?.entityId) {
      conditions.push(eq(auditLogs.entityId, filters.entityId));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    return query.orderBy(desc(auditLogs.createdAt)).limit(100);
  }

  // Agent Inventory History
  async getAgentInventoryHistory(agentId: string, limit: number = 50): Promise<AgentInventoryHistoryRecord[]> {
    return db.select().from(agentInventoryHistory)
      .where(eq(agentInventoryHistory.agentId, agentId))
      .orderBy(desc(agentInventoryHistory.createdAt))
      .limit(limit);
  }

  async createInventoryHistoryRecord(record: InsertAgentInventoryHistory): Promise<AgentInventoryHistoryRecord> {
    const result = await db.insert(agentInventoryHistory).values(record).returning();
    return result[0];
  }

  // Promotional Events
  async getPromotionalEvent(id: string): Promise<PromotionalEvent | undefined> {
    const result = await db.select().from(promotionalEvents).where(eq(promotionalEvents.id, id)).limit(1);
    return result[0];
  }

  async getActivePromotionalEvents(): Promise<PromotionalEvent[]> {
    const now = new Date();
    return db.select().from(promotionalEvents)
      .where(and(
        eq(promotionalEvents.status, 'active'),
        lte(promotionalEvents.startTime, now),
        gte(promotionalEvents.endTime, now)
      ))
      .orderBy(promotionalEvents.startTime);
  }

  async createPromotionalEvent(event: InsertPromotionalEvent): Promise<PromotionalEvent> {
    const result = await db.insert(promotionalEvents).values(event).returning();
    return result[0];
  }

  async updatePromotionalEvent(id: string, updates: Partial<PromotionalEvent>): Promise<PromotionalEvent | undefined> {
    const result = await db.update(promotionalEvents)
      .set(updates)
      .where(eq(promotionalEvents.id, id))
      .returning();
    return result[0];
  }

  // System Config
  async getSystemConfig(key: string): Promise<SystemConfig | undefined> {
    const result = await db.select().from(systemConfig).where(eq(systemConfig.key, key)).limit(1);
    return result[0];
  }

  async getAllSystemConfig(): Promise<SystemConfig[]> {
    return db.select().from(systemConfig).orderBy(systemConfig.key);
  }

  async setSystemConfig(key: string, value: any, description?: string, updatedBy?: string): Promise<SystemConfig> {
    const existing = await this.getSystemConfig(key);
    
    if (existing) {
      const result = await db.update(systemConfig)
        .set({
          value,
          description: description || existing.description,
          updatedBy: updatedBy || existing.updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(systemConfig.key, key))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(systemConfig).values({
        key,
        value,
        description,
        updatedBy,
      }).returning();
      return result[0];
    }
  }
}

// Export singleton instance
export const storage = new PostgresStorage();
