import { db } from './db';
import { NotFoundError } from './errors';
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
  AgentCurrencySettings,
  InsertAgentCurrencySettings,
  Currency,
  InsertCurrency,
  SovereignPlatform,
  InsertSovereignPlatform,
  PlatformApiToken,
  InsertPlatformApiToken,
  WebhookNonce,
  InsertWebhookNonce,
  PaymentMethod,
  InsertPaymentMethod,
  P2pOrder,
  InsertP2pOrder,
  OrderMessage,
  InsertOrderMessage,
  PaymentProof,
  InsertPaymentProof,
  UserSettlement,
  InsertUserSettlement,
  SolanaDeposit,
  InsertSolanaDeposit,
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
  agentCurrencySettings,
  currencies,
  sovereignPlatforms,
  platformApiTokens,
  webhookNonces,
  paymentMethods,
  p2pOrders,
  orderMessages,
  paymentProofs,
  userSettlements,
  solanaDeposits,
} from '@shared/schema';

// Storage Interface
export interface IStorage {
  // User Operations (Required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserRole(userId: string, role: 'user' | 'agent' | 'admin'): Promise<void>;
  
  // Agent Operations
  getAgent(id: string): Promise<Agent | undefined>;
  getAgentByReplitUserId(replitUserId: string): Promise<Agent | undefined>;
  getAgentBySolanaWallet(solanaWallet: string): Promise<Agent | undefined>;
  getAllAgents(filters?: { status?: string; verificationTier?: string }): Promise<Agent[]>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: string, updates: Partial<Agent>): Promise<Agent | undefined>;
  updateAgentBalance(id: string, newBalance: string): Promise<void>;
  lockAgentTkoin(agentId: string, amount: string): Promise<{ success: boolean; error?: string; availableBalance?: string }>;
  unlockAgentTkoin(agentId: string, amount: string): Promise<{ success: boolean; error?: string }>;
  transferAgentTkoin(fromAgentId: string, toUserId: string, amount: string): Promise<{ success: boolean; error?: string }>;
  
  // Agent Currency Settings Operations
  getAgentCurrencySettings(agentId: string, currency: string): Promise<AgentCurrencySettings | undefined>;
  getAllAgentCurrencySettings(agentId: string): Promise<AgentCurrencySettings[]>;
  upsertAgentCurrencySettings(settings: InsertAgentCurrencySettings): Promise<AgentCurrencySettings>;
  
  // Exchange Order Operations
  getExchangeOrder(id: string): Promise<ExchangeOrder | undefined>;
  getExchangeOrdersByAgent(agentId: string): Promise<ExchangeOrder[]>;
  createExchangeOrder(order: InsertExchangeOrder): Promise<ExchangeOrder>;
  updateExchangeOrder(id: string, updates: Partial<ExchangeOrder>): Promise<ExchangeOrder | undefined>;
  
  // Transaction Operations
  getTransaction(id: string): Promise<Transaction | undefined>;
  getAllTransactions(filters?: Record<string, any>): Promise<Transaction[]>;
  getTransactionsByAgent(agentId: string): Promise<Transaction[]>;
  getTransactionsByUser(userId: string): Promise<Transaction[]>;
  getTransactionBySignature(signature: string): Promise<Transaction | undefined>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction | undefined>;
  recordTransactionWebhookAttempt(id: string, delivered: boolean): Promise<void>;
  
  // Get agent analytics (joins transactions with payment requests for currency data)
  getAgentAnalyticsData(agentId: string): Promise<Array<Transaction & { fiatCurrency?: string | null; fiatAmount?: string | null }>>;
  
  // Deposit Operations
  getDeposit(id: string): Promise<Deposit | undefined>;
  getDepositBySignature(signature: string): Promise<Deposit | undefined>;
  getDepositsByUser(userId: string): Promise<Deposit[]>;
  getPendingDeposits(): Promise<Deposit[]>;
  createDeposit(deposit: InsertDeposit): Promise<Deposit>;
  updateDeposit(id: string, updates: Partial<Deposit>): Promise<Deposit | undefined>;
  updateDepositWebhookStatus(id: string, delivered: boolean, webhookUrl?: string, response?: any): Promise<void>;
  
  // Solana Deposit Operations (for Phantom wallet verification)
  getSolanaDepositBySignature(signature: string): Promise<SolanaDeposit | undefined>;
  createSolanaDeposit(deposit: InsertSolanaDeposit): Promise<SolanaDeposit>;
  updateSolanaDeposit(id: string, updates: Partial<SolanaDeposit>): Promise<SolanaDeposit | undefined>;
  
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
  
  // Currency Operations
  getCurrencies(activeOnly?: boolean): Promise<Currency[]>;
  getCurrency(code: string): Promise<Currency | undefined>;
  createCurrency(currency: InsertCurrency): Promise<Currency>;
  updateCurrency(code: string, updates: Partial<Currency>): Promise<Currency | undefined>;
  
  // Sovereign Platform Operations
  getSovereignPlatform(id: string): Promise<SovereignPlatform | undefined>;
  getAllSovereignPlatforms(activeOnly?: boolean): Promise<SovereignPlatform[]>;
  createSovereignPlatform(platform: InsertSovereignPlatform): Promise<SovereignPlatform>;
  updateSovereignPlatform(id: string, updates: Partial<SovereignPlatform>): Promise<SovereignPlatform>;
  toggleSovereignPlatformStatus(id: string, isActive: boolean): Promise<SovereignPlatform>;
  
  // Platform API Token Operations
  getPlatformApiToken(id: string): Promise<PlatformApiToken | undefined>;
  getPlatformApiTokensByPlatform(platformId: string): Promise<PlatformApiToken[]>;
  createPlatformApiToken(token: InsertPlatformApiToken): Promise<PlatformApiToken>;
  updatePlatformApiToken(id: string, updates: Partial<PlatformApiToken>): Promise<PlatformApiToken>;

  // Webhook Nonce Operations (Replay Attack Prevention)
  checkAndRecordNonce(nonce: InsertWebhookNonce): Promise<{ exists: boolean; recorded: boolean }>;
  cleanupExpiredNonces(): Promise<number>;
  
  // Payment Method Operations (P2P Marketplace)
  getPaymentMethod(id: string): Promise<PaymentMethod | undefined>;
  getPaymentMethodsByAgent(agentId: string): Promise<PaymentMethod[]>;
  getActivePaymentMethodsByAgent(agentId: string): Promise<PaymentMethod[]>;
  createPaymentMethod(method: InsertPaymentMethod): Promise<PaymentMethod>;
  updatePaymentMethod(id: string, updates: Partial<PaymentMethod>): Promise<PaymentMethod | undefined>;
  deletePaymentMethod(id: string): Promise<void>;
  
  // P2P Order Operations
  getP2pOrder(id: string): Promise<P2pOrder | undefined>;
  getP2pOrdersByAgent(agentId: string): Promise<P2pOrder[]>;
  getP2pOrdersByUser(userId: string): Promise<P2pOrder[]>;
  getActiveP2pOrders(agentId?: string): Promise<P2pOrder[]>;
  createP2pOrder(order: InsertP2pOrder): Promise<P2pOrder>;
  updateP2pOrder(id: string, updates: Partial<P2pOrder>): Promise<P2pOrder | undefined>;
  expireP2pOrders(): Promise<{ count: number; expiredOrders: P2pOrder[] }>;
  
  // Order Message Operations (In-App Chat)
  getOrderMessages(orderId: string): Promise<OrderMessage[]>;
  createOrderMessage(message: InsertOrderMessage): Promise<OrderMessage>;
  markMessagesAsRead(orderId: string, userId: string): Promise<void>;
  
  // Payment Proof Operations
  getPaymentProofs(orderId: string): Promise<PaymentProof[]>;
  createPaymentProof(proof: InsertPaymentProof): Promise<PaymentProof>;
  verifyPaymentProof(id: string, verifiedBy: string, notes?: string): Promise<PaymentProof | undefined>;
  
  // User Settlement Operations (BetWin Integration)
  createUserSettlement(settlement: InsertUserSettlement): Promise<UserSettlement>;
  getUserSettlements(userId: string, platformId?: string): Promise<UserSettlement[]>;
  getUserSettlementBalance(userId: string, platformId: string): Promise<string>;
  updateUserSettlement(id: string, updates: Partial<UserSettlement>): Promise<UserSettlement | undefined>;
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
        target: users.email,
        set: {
          id: userData.id,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          role: userData.role,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result[0];
  }

  async updateUserRole(userId: string, role: 'user' | 'agent' | 'admin'): Promise<void> {
    await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, userId));
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

  /**
   * Atomically lock TKOIN for an order
   * Uses database-side increment to prevent race conditions
   * Returns success=false if insufficient balance
   */
  async lockAgentTkoin(agentId: string, amount: string): Promise<{
    success: boolean;
    error?: string;
    availableBalance?: string;
  }> {
    const { default: Decimal } = await import('decimal.js');
    
    // First, get current balances for validation
    const agent = await this.getAgent(agentId);
    if (!agent) {
      return { success: false, error: "Agent not found" };
    }

    const totalBalance = new Decimal(agent.tkoinBalance || '0');
    const lockedBalance = new Decimal(agent.lockedBalance || '0');
    const availableBalance = totalBalance.minus(lockedBalance);
    const requiredAmount = new Decimal(amount);

    // Check if sufficient balance
    if (availableBalance.lessThan(requiredAmount)) {
      return {
        success: false,
        error: "Insufficient TKOIN balance",
        availableBalance: availableBalance.toString(),
      };
    }

    // Atomic SQL update with database-side increment to prevent race conditions
    // Using locked_balance = locked_balance + amount ensures concurrent requests accumulate instead of overwriting
    const result = await db.update(agents)
      .set({
        lockedBalance: sql`${agents.lockedBalance}::numeric + ${amount}::numeric`,
        updatedAt: new Date(),
      })
      .where(and(
        eq(agents.id, agentId),
        // Ensure balance is still sufficient after any concurrent updates
        sql`${agents.tkoinBalance}::numeric - ${agents.lockedBalance}::numeric >= ${amount}::numeric`
      ))
      .returning();

    if (result.length === 0) {
      // Update failed - concurrent request consumed the balance
      return {
        success: false,
        error: "Concurrent order creation detected - insufficient balance",
        availableBalance: availableBalance.toString(),
      };
    }

    return { success: true };
  }

  /**
   * Atomically unlock TKOIN from a cancelled or expired order
   * Uses database-side decrement to prevent race conditions
   */
  async unlockAgentTkoin(agentId: string, amount: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    const { default: Decimal } = await import('decimal.js');
    
    // Validate agent exists
    const agent = await this.getAgent(agentId);
    if (!agent) {
      return { success: false, error: "Agent not found" };
    }

    const requiredAmount = new Decimal(amount);
    const lockedBalance = new Decimal(agent.lockedBalance || '0');

    // Check if sufficient locked balance to unlock
    if (lockedBalance.lessThan(requiredAmount)) {
      return {
        success: false,
        error: `Cannot unlock ${amount} TKOIN - only ${lockedBalance.toString()} TKOIN is locked`,
      };
    }

    // Atomic SQL update with database-side decrement
    // Using locked_balance = locked_balance - amount ensures concurrent unlocks accumulate
    const result = await db.update(agents)
      .set({
        lockedBalance: sql`${agents.lockedBalance}::numeric - ${amount}::numeric`,
        updatedAt: new Date(),
      })
      .where(and(
        eq(agents.id, agentId),
        // Ensure locked balance is still sufficient after any concurrent updates
        sql`${agents.lockedBalance}::numeric >= ${amount}::numeric`
      ))
      .returning();

    if (result.length === 0) {
      return {
        success: false,
        error: "Concurrent unlock detected - insufficient locked balance",
      };
    }

    return { success: true };
  }

  /**
   * Atomically transfer TKOIN from agent to user on order completion
   * Uses database-side decrements to prevent race conditions
   */
  async transferAgentTkoin(fromAgentId: string, toUserId: string, amount: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    const { default: Decimal } = await import('decimal.js');
    
    // Validate agent exists
    const agent = await this.getAgent(fromAgentId);
    if (!agent) {
      return { success: false, error: "Agent not found" };
    }

    const requiredAmount = new Decimal(amount);
    const totalBalance = new Decimal(agent.tkoinBalance || '0');
    const lockedBalance = new Decimal(agent.lockedBalance || '0');

    // Validate balances
    if (totalBalance.lessThan(requiredAmount)) {
      return {
        success: false,
        error: `Cannot transfer ${amount} TKOIN - agent only has ${totalBalance.toString()} TKOIN`,
      };
    }

    if (lockedBalance.lessThan(requiredAmount)) {
      return {
        success: false,
        error: `Cannot transfer ${amount} TKOIN - only ${lockedBalance.toString()} TKOIN is locked`,
      };
    }

    // Atomic SQL update with database-side decrements for both balances
    // Decrements both tkoin_balance AND locked_balance atomically
    const result = await db.update(agents)
      .set({
        tkoinBalance: sql`${agents.tkoinBalance}::numeric - ${amount}::numeric`,
        lockedBalance: sql`${agents.lockedBalance}::numeric - ${amount}::numeric`,
        updatedAt: new Date(),
      })
      .where(and(
        eq(agents.id, fromAgentId),
        // Ensure both balances are still sufficient after any concurrent updates
        sql`${agents.tkoinBalance}::numeric >= ${amount}::numeric`,
        sql`${agents.lockedBalance}::numeric >= ${amount}::numeric`
      ))
      .returning();

    if (result.length === 0) {
      return {
        success: false,
        error: "Concurrent transfer detected - insufficient balance",
      };
    }

    // TODO: Add TKOIN to user's balance (currently database-level tracking only)
    // In future, this will trigger an on-chain SPL token transfer to user's wallet

    return { success: true };
  }

  // Agent Currency Settings Operations
  async getAgentCurrencySettings(agentId: string, currency: string): Promise<AgentCurrencySettings | undefined> {
    const result = await db
      .select()
      .from(agentCurrencySettings)
      .where(and(
        eq(agentCurrencySettings.agentId, agentId),
        eq(agentCurrencySettings.currency, currency)
      ))
      .limit(1);
    return result[0];
  }

  async getAllAgentCurrencySettings(agentId: string): Promise<AgentCurrencySettings[]> {
    return db
      .select()
      .from(agentCurrencySettings)
      .where(eq(agentCurrencySettings.agentId, agentId))
      .orderBy(agentCurrencySettings.currency);
  }

  async upsertAgentCurrencySettings(settings: InsertAgentCurrencySettings): Promise<AgentCurrencySettings> {
    const result = await db
      .insert(agentCurrencySettings)
      .values({ ...settings, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [agentCurrencySettings.agentId, agentCurrencySettings.currency],
        set: { 
          ...settings, 
          updatedAt: new Date() 
        }
      })
      .returning();
    return result[0];
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

  async getAllTransactions(_filters?: Record<string, any>): Promise<Transaction[]> {
    return db.select().from(transactions).orderBy(desc(transactions.createdAt));
  }

  async getTransactionsByAgent(agentId: string): Promise<Transaction[]> {
    return db.select().from(transactions)
      .where(eq(transactions.agentId, agentId))
      .orderBy(desc(transactions.createdAt));
  }

  async getAgentAnalyticsData(agentId: string): Promise<Array<Transaction & { fiatCurrency?: string | null; fiatAmount?: string | null }>> {
    // Join transactions with payment requests to get currency data
    const results = await db
      .select({
        // Explicitly enumerate all transaction fields
        id: transactions.id,
        type: transactions.type,
        agentId: transactions.agentId,
        userId: transactions.userId,
        userWallet: transactions.userWallet,
        tkoinAmount: transactions.tkoinAmount,
        creditsAmount: transactions.creditsAmount,
        feeAmount: transactions.feeAmount,
        commissionAmount: transactions.commissionAmount,
        burnAmount: transactions.burnAmount,
        conversionRate: transactions.conversionRate,
        status: transactions.status,
        solanaSignature: transactions.solanaSignature,
        webhookDelivered: transactions.webhookDelivered,
        webhookAttempts: transactions.webhookAttempts,
        paymentRequestId: transactions.paymentRequestId,
        memo: transactions.memo,
        metadata: transactions.metadata,
        errorMessage: transactions.errorMessage,
        createdAt: transactions.createdAt,
        completedAt: transactions.completedAt,
        // Additional fields from payment requests
        fiatCurrency: paymentRequests.fiatCurrency,
        fiatAmount: paymentRequests.fiatAmount,
      })
      .from(transactions)
      .leftJoin(
        paymentRequests,
        eq(transactions.paymentRequestId, paymentRequests.id)
      )
      .where(eq(transactions.agentId, agentId))
      .orderBy(desc(transactions.createdAt));

    return results as Array<Transaction & { fiatCurrency?: string | null; fiatAmount?: string | null }>;
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

  async recordTransactionWebhookAttempt(id: string, delivered: boolean): Promise<void> {
    await db.update(transactions)
      .set({
        webhookAttempts: sql`${transactions.webhookAttempts} + 1`,
        webhookDelivered: delivered,
      })
      .where(eq(transactions.id, id));
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

  async updateDepositWebhookStatus(id: string, delivered: boolean, webhookUrl?: string, response?: any): Promise<void> {
    await db.update(deposits)
      .set({
        webhookDelivered: delivered,
        webhookUrl: webhookUrl || null,
        webhookResponse: response || null,
      })
      .where(eq(deposits.id, id));
  }

  // Solana Deposit Operations (for Phantom wallet verification)
  async getSolanaDepositBySignature(signature: string): Promise<SolanaDeposit | undefined> {
    const result = await db.select().from(solanaDeposits)
      .where(eq(solanaDeposits.signature, signature))
      .limit(1);
    return result[0];
  }

  async createSolanaDeposit(deposit: InsertSolanaDeposit): Promise<SolanaDeposit> {
    const result = await db.insert(solanaDeposits).values(deposit).returning();
    return result[0];
  }

  async updateSolanaDeposit(id: string, updates: Partial<SolanaDeposit>): Promise<SolanaDeposit | undefined> {
    const result = await db.update(solanaDeposits)
      .set(updates)
      .where(eq(solanaDeposits.id, id))
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

  // Currency Operations
  async getCurrencies(activeOnly = false): Promise<Currency[]> {
    if (activeOnly) {
      return db.select()
        .from(currencies)
        .where(eq(currencies.isActive, true))
        .orderBy(currencies.sortOrder, currencies.code);
    }
    
    return db.select()
      .from(currencies)
      .orderBy(currencies.sortOrder, currencies.code);
  }

  async getCurrency(code: string): Promise<Currency | undefined> {
    const result = await db.select().from(currencies).where(eq(currencies.code, code.toUpperCase())).limit(1);
    return result[0];
  }

  async createCurrency(currency: InsertCurrency): Promise<Currency> {
    const result = await db.insert(currencies).values({
      ...currency,
      code: currency.code.toUpperCase(),
    }).returning();
    return result[0];
  }

  async updateCurrency(code: string, updates: Partial<Currency>): Promise<Currency | undefined> {
    const result = await db.update(currencies)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(currencies.code, code.toUpperCase()))
      .returning();
    return result[0];
  }

  // Sovereign Platform Operations
  async getSovereignPlatform(id: string): Promise<SovereignPlatform | undefined> {
    const result = await db.select()
      .from(sovereignPlatforms)
      .where(eq(sovereignPlatforms.id, id))
      .limit(1);
    return result[0];
  }

  async getAllSovereignPlatforms(activeOnly = false): Promise<SovereignPlatform[]> {
    if (activeOnly) {
      return db.select()
        .from(sovereignPlatforms)
        .where(eq(sovereignPlatforms.isActive, true))
        .orderBy(desc(sovereignPlatforms.createdAt));
    }
    
    return db.select()
      .from(sovereignPlatforms)
      .orderBy(desc(sovereignPlatforms.createdAt));
  }

  async createSovereignPlatform(platform: InsertSovereignPlatform): Promise<SovereignPlatform> {
    const result = await db.insert(sovereignPlatforms)
      .values(platform)
      .returning();
    
    if (!result[0]) {
      throw new Error(`Failed to create platform '${platform.id}'`);
    }
    
    return result[0];
  }

  async updateSovereignPlatform(id: string, updates: Partial<SovereignPlatform>): Promise<SovereignPlatform> {
    const result = await db.update(sovereignPlatforms)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(sovereignPlatforms.id, id))
      .returning();
    
    if (!result[0]) {
      throw new NotFoundError(`Platform '${id}' not found`);
    }
    
    return result[0];
  }

  async toggleSovereignPlatformStatus(id: string, isActive: boolean): Promise<SovereignPlatform> {
    const result = await db.update(sovereignPlatforms)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(sovereignPlatforms.id, id))
      .returning();
    
    if (!result[0]) {
      throw new NotFoundError(`Platform '${id}' not found`);
    }
    
    return result[0];
  }

  async getPlatformApiToken(id: string): Promise<PlatformApiToken | undefined> {
    const result = await db.select().from(platformApiTokens).where(eq(platformApiTokens.id, id)).limit(1);
    return result[0];
  }

  async getPlatformApiTokensByPlatform(platformId: string): Promise<PlatformApiToken[]> {
    return await db.select()
      .from(platformApiTokens)
      .where(eq(platformApiTokens.platformId, platformId))
      .orderBy(desc(platformApiTokens.createdAt));
  }

  async createPlatformApiToken(token: InsertPlatformApiToken): Promise<PlatformApiToken> {
    const result = await db.insert(platformApiTokens).values(token).returning();
    return result[0];
  }

  async updatePlatformApiToken(id: string, updates: Partial<PlatformApiToken>): Promise<PlatformApiToken> {
    const result = await db.update(platformApiTokens)
      .set(updates)
      .where(eq(platformApiTokens.id, id))
      .returning();
    
    if (!result[0]) {
      throw new NotFoundError(`API token '${id}' not found`);
    }
    
    return result[0];
  }

  async checkAndRecordNonce(nonce: InsertWebhookNonce): Promise<{ exists: boolean; recorded: boolean }> {
    try {
      const existing = await db.select()
        .from(webhookNonces)
        .where(eq(webhookNonces.nonce, nonce.nonce))
        .limit(1);

      if (existing.length > 0) {
        return { exists: true, recorded: false };
      }

      await db.insert(webhookNonces).values(nonce);
      return { exists: false, recorded: true };
    } catch (error) {
      if ((error as any).code === '23505') {
        return { exists: true, recorded: false };
      }
      throw error;
    }
  }

  async cleanupExpiredNonces(): Promise<number> {
    const now = new Date();
    const result = await db.delete(webhookNonces)
      .where(lte(webhookNonces.expiresAt, now))
      .returning();
    
    return result.length;
  }

  // Payment Method Operations (P2P Marketplace)
  async getPaymentMethod(id: string): Promise<PaymentMethod | undefined> {
    const result = await db.select().from(paymentMethods).where(eq(paymentMethods.id, id)).limit(1);
    return result[0];
  }

  async getPaymentMethodsByAgent(agentId: string): Promise<PaymentMethod[]> {
    return await db.select()
      .from(paymentMethods)
      .where(eq(paymentMethods.agentId, agentId))
      .orderBy(desc(paymentMethods.createdAt));
  }

  async getActivePaymentMethodsByAgent(agentId: string): Promise<PaymentMethod[]> {
    return await db.select()
      .from(paymentMethods)
      .where(and(
        eq(paymentMethods.agentId, agentId),
        eq(paymentMethods.isActive, true)
      ))
      .orderBy(desc(paymentMethods.createdAt));
  }

  async createPaymentMethod(method: InsertPaymentMethod): Promise<PaymentMethod> {
    const result = await db.insert(paymentMethods).values(method).returning();
    return result[0];
  }

  async updatePaymentMethod(id: string, updates: Partial<PaymentMethod>): Promise<PaymentMethod | undefined> {
    const result = await db.update(paymentMethods)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(paymentMethods.id, id))
      .returning();
    return result[0];
  }

  async deletePaymentMethod(id: string): Promise<void> {
    await db.delete(paymentMethods).where(eq(paymentMethods.id, id));
  }

  // P2P Order Operations
  async getP2pOrder(id: string): Promise<P2pOrder | undefined> {
    const result = await db.select().from(p2pOrders).where(eq(p2pOrders.id, id)).limit(1);
    return result[0];
  }

  async getP2pOrdersByAgent(agentId: string): Promise<P2pOrder[]> {
    return await db.select()
      .from(p2pOrders)
      .where(eq(p2pOrders.agentId, agentId))
      .orderBy(desc(p2pOrders.createdAt));
  }

  async getP2pOrdersByUser(userId: string): Promise<P2pOrder[]> {
    return await db.select()
      .from(p2pOrders)
      .where(eq(p2pOrders.userId, userId))
      .orderBy(desc(p2pOrders.createdAt));
  }

  async getActiveP2pOrders(agentId?: string): Promise<P2pOrder[]> {
    const conditions = [
      inArray(p2pOrders.status, ['created', 'payment_pending', 'payment_sent', 'verifying'])
    ];
    
    if (agentId) {
      conditions.push(eq(p2pOrders.agentId, agentId));
    }
    
    return await db.select()
      .from(p2pOrders)
      .where(and(...conditions))
      .orderBy(desc(p2pOrders.createdAt));
  }

  async createP2pOrder(order: InsertP2pOrder): Promise<P2pOrder> {
    const result = await db.insert(p2pOrders).values(order).returning();
    return result[0];
  }

  async updateP2pOrder(id: string, updates: Partial<P2pOrder>): Promise<P2pOrder | undefined> {
    const result = await db.update(p2pOrders)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(p2pOrders.id, id))
      .returning();
    return result[0];
  }

  async expireP2pOrders(): Promise<{ count: number; expiredOrders: P2pOrder[] }> {
    const now = new Date();
    const result = await db.update(p2pOrders)
      .set({ status: 'expired' })
      .where(and(
        inArray(p2pOrders.status, ['created', 'payment_pending', 'payment_sent']),
        lte(p2pOrders.expiresAt, now)
      ))
      .returning();
    
    return {
      count: result.length,
      expiredOrders: result,
    };
  }

  // Order Message Operations (In-App Chat)
  async getOrderMessages(orderId: string): Promise<OrderMessage[]> {
    return await db.select()
      .from(orderMessages)
      .where(eq(orderMessages.orderId, orderId))
      .orderBy(orderMessages.createdAt);
  }

  async createOrderMessage(message: InsertOrderMessage): Promise<OrderMessage> {
    const result = await db.insert(orderMessages).values(message).returning();
    return result[0];
  }

  async markMessagesAsRead(orderId: string, userId: string): Promise<void> {
    await db.update(orderMessages)
      .set({ isRead: true })
      .where(and(
        eq(orderMessages.orderId, orderId),
        sql`${orderMessages.senderId} != ${userId}` // Mark messages from others as read
      ));
  }

  // Payment Proof Operations
  async getPaymentProofs(orderId: string): Promise<PaymentProof[]> {
    return await db.select()
      .from(paymentProofs)
      .where(eq(paymentProofs.orderId, orderId))
      .orderBy(desc(paymentProofs.createdAt));
  }

  async createPaymentProof(proof: InsertPaymentProof): Promise<PaymentProof> {
    const result = await db.insert(paymentProofs).values(proof).returning();
    return result[0];
  }

  async verifyPaymentProof(id: string, verifiedBy: string, notes?: string): Promise<PaymentProof | undefined> {
    const result = await db.update(paymentProofs)
      .set({
        verifiedBy,
        verifiedAt: new Date(),
        verificationNotes: notes,
      })
      .where(eq(paymentProofs.id, id))
      .returning();
    return result[0];
  }
  
  // User Settlement Operations (BetWin Integration)
  async createUserSettlement(settlement: InsertUserSettlement): Promise<UserSettlement> {
    const result = await db.insert(userSettlements).values(settlement).returning();
    return result[0];
  }

  async getUserSettlements(userId: string, platformId?: string): Promise<UserSettlement[]> {
    const conditions = [eq(userSettlements.userId, userId)];
    if (platformId) {
      conditions.push(eq(userSettlements.platformId, platformId));
    }
    return await db.select().from(userSettlements)
      .where(and(...conditions))
      .orderBy(desc(userSettlements.createdAt));
  }

  async getUserSettlementBalance(userId: string, platformId: string): Promise<string> {
    const result = await db.select({
      total: sql<string>`COALESCE(SUM(${userSettlements.tkoinAmount}), '0')`.mapWith(String)
    })
    .from(userSettlements)
    .where(and(
      eq(userSettlements.userId, userId),
      eq(userSettlements.platformId, platformId),
      eq(userSettlements.type, 'deposit'),
      eq(userSettlements.status, 'completed')
    ));
    return result[0]?.total || '0';
  }

  async updateUserSettlement(id: string, updates: Partial<UserSettlement>): Promise<UserSettlement | undefined> {
    const result = await db.update(userSettlements)
      .set(updates)
      .where(eq(userSettlements.id, id))
      .returning();
    return result[0];
  }
}

// Export singleton instance
// Note: This project uses PostgreSQL via Drizzle ORM exclusively.
// MemStorage is not supported as the schema requires Drizzle-specific features.
export const storage = new PostgresStorage();
