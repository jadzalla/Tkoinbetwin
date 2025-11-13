import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, integer, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// System Configuration
export const systemConfig = pgTable("system_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: jsonb("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: text("updated_by"),
});

// Agents (Liquidity Providers / Money Service Operators)
export const agents = pgTable("agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Auth & Identity
  replitUserId: text("replit_user_id").notNull().unique(),
  email: text("email").notNull(),
  username: text("username").notNull(),
  
  // Verification & Status
  verificationTier: text("verification_tier").notNull().default("basic"), // basic, verified, premium
  status: text("status").notNull().default("pending"), // pending, active, suspended, revoked
  
  // Wallet & Inventory
  solanaWallet: text("solana_wallet").notNull(),
  tkoinBalance: decimal("tkoin_balance", { precision: 20, scale: 8 }).notNull().default("0"),
  
  // Limits & Settings
  dailyLimit: decimal("daily_limit", { precision: 20, scale: 2 }).notNull().default("10000"),
  monthlyLimit: decimal("monthly_limit", { precision: 20, scale: 2 }).notNull().default("100000"),
  markup: decimal("markup", { precision: 5, scale: 2 }).notNull().default("0.5"), // percentage
  
  // Commission Tracking
  totalMinted: decimal("total_minted", { precision: 20, scale: 8 }).notNull().default("0"),
  totalCommissionEarned: decimal("total_commission_earned", { precision: 20, scale: 8 }).notNull().default("0"),
  commissionTier: text("commission_tier").notNull().default("bronze"), // bronze, silver, gold
  
  // Location & Availability
  country: text("country"),
  city: text("city"),
  location: jsonb("location"), // { lat, lng }
  availabilityStatus: text("availability_status").notNull().default("offline"), // online, offline, busy
  
  // Profile
  displayName: text("display_name"),
  bio: text("bio"),
  profileImage: text("profile_image"),
  
  // Ratings
  averageRating: decimal("average_rating", { precision: 3, scale: 2 }).default("0"),
  totalRatings: integer("total_ratings").notNull().default(0),
  
  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  approvedAt: timestamp("approved_at"),
  approvedBy: text("approved_by"),
}, (table) => ({
  replitUserIdIdx: index("agents_replit_user_id_idx").on(table.replitUserId),
  statusIdx: index("agents_status_idx").on(table.status),
  locationIdx: index("agents_location_idx").on(table.country, table.city),
}));

// Exchange Orders (Agent Stablecoin Purchases)
export const exchangeOrders = pgTable("exchange_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  
  // Order Details
  orderType: text("order_type").notNull(), // buy_tkoin, sell_tkoin
  fromToken: text("from_token").notNull(), // USDT, USDC, EURt, TKOIN
  toToken: text("to_token").notNull(), // TKOIN, USDT, USDC, EURt
  fromAmount: decimal("from_amount", { precision: 20, scale: 8 }).notNull(),
  toAmount: decimal("to_amount", { precision: 20, scale: 8 }).notNull(),
  exchangeRate: decimal("exchange_rate", { precision: 20, scale: 8 }).notNull(),
  
  // Transaction Details
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  solanaSignature: text("solana_signature"),
  errorMessage: text("error_message"),
  
  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  agentIdIdx: index("exchange_orders_agent_id_idx").on(table.agentId),
  statusIdx: index("exchange_orders_status_idx").on(table.status),
  createdAtIdx: index("exchange_orders_created_at_idx").on(table.createdAt),
}));

// Transactions (Agent-to-User Transfers & All Token Operations)
export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Transaction Type
  type: text("type").notNull(), // agent_transfer, deposit, withdrawal, mint, burn
  
  // Parties
  agentId: varchar("agent_id").references(() => agents.id),
  userId: text("user_id"), // 1Stake user ID or wallet address
  userWallet: text("user_wallet"),
  
  // Amounts
  tkoinAmount: decimal("tkoin_amount", { precision: 20, scale: 8 }).notNull(),
  creditsAmount: decimal("credits_amount", { precision: 20, scale: 2 }),
  feeAmount: decimal("fee_amount", { precision: 20, scale: 8 }).default("0"),
  commissionAmount: decimal("commission_amount", { precision: 20, scale: 8 }).default("0"),
  burnAmount: decimal("burn_amount", { precision: 20, scale: 8 }).default("0"),
  
  // Conversion
  conversionRate: decimal("conversion_rate", { precision: 10, scale: 2 }).default("100"), // TKOIN to Credits
  
  // Status & Blockchain
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  solanaSignature: text("solana_signature"),
  webhookDelivered: boolean("webhook_delivered").default(false),
  webhookAttempts: integer("webhook_attempts").default(0),
  
  // Payment Request Reference
  paymentRequestId: varchar("payment_request_id"),
  
  // Metadata
  memo: text("memo"),
  metadata: jsonb("metadata"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  agentIdIdx: index("transactions_agent_id_idx").on(table.agentId),
  userIdIdx: index("transactions_user_id_idx").on(table.userId),
  typeIdx: index("transactions_type_idx").on(table.type),
  statusIdx: index("transactions_status_idx").on(table.status),
  createdAtIdx: index("transactions_created_at_idx").on(table.createdAt),
  signatureIdx: index("transactions_signature_idx").on(table.solanaSignature),
}));

// Deposits (Treasury Wallet Monitoring)
export const deposits = pgTable("deposits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Blockchain Details
  solanaSignature: text("solana_signature").notNull().unique(),
  fromWallet: text("from_wallet").notNull(),
  toWallet: text("to_wallet").notNull(),
  
  // Amounts
  tkoinAmount: decimal("tkoin_amount", { precision: 20, scale: 8 }).notNull(),
  burnAmount: decimal("burn_amount", { precision: 20, scale: 8 }).notNull(),
  creditsAmount: decimal("credits_amount", { precision: 20, scale: 2 }).notNull(),
  
  // User Identification
  userId: text("user_id"), // Parsed from memo or metadata
  memo: text("memo"),
  
  // Processing
  status: text("status").notNull().default("detected"), // detected, processing, completed, failed
  webhookDelivered: boolean("webhook_delivered").default(false),
  webhookUrl: text("webhook_url"),
  webhookResponse: jsonb("webhook_response"),
  
  // Associated Transaction
  transactionId: varchar("transaction_id").references(() => transactions.id),
  
  // Metadata
  blockTime: timestamp("block_time"),
  detectedAt: timestamp("detected_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"),
}, (table) => ({
  signatureIdx: index("deposits_signature_idx").on(table.solanaSignature),
  userIdIdx: index("deposits_user_id_idx").on(table.userId),
  statusIdx: index("deposits_status_idx").on(table.status),
  detectedAtIdx: index("deposits_detected_at_idx").on(table.detectedAt),
}));

// Withdrawals (User Credit → Tkoin Requests)
export const withdrawals = pgTable("withdrawals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // User Details
  userId: text("user_id").notNull(),
  userWallet: text("user_wallet").notNull(),
  
  // Amounts
  creditsAmount: decimal("credits_amount", { precision: 20, scale: 2 }).notNull(),
  tkoinAmount: decimal("tkoin_amount", { precision: 20, scale: 8 }).notNull(),
  feeAmount: decimal("fee_amount", { precision: 20, scale: 8 }).notNull(),
  
  // Fulfillment
  status: text("status").notNull().default("pending"), // pending, approved, processing, completed, rejected
  agentId: varchar("agent_id").references(() => agents.id),
  solanaSignature: text("solana_signature"),
  
  // Cooldown & Limits
  cooldownEnd: timestamp("cooldown_end"),
  dailyCapUsed: decimal("daily_cap_used", { precision: 20, scale: 2 }),
  
  // Metadata
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  approvedAt: timestamp("approved_at"),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  userIdIdx: index("withdrawals_user_id_idx").on(table.userId),
  agentIdIdx: index("withdrawals_agent_id_idx").on(table.agentId),
  statusIdx: index("withdrawals_status_idx").on(table.status),
  createdAtIdx: index("withdrawals_created_at_idx").on(table.createdAt),
}));

// Payment Requests (QR Code Payments)
export const paymentRequests = pgTable("payment_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  
  // Request Details
  tkoinAmount: decimal("tkoin_amount", { precision: 20, scale: 8 }).notNull(),
  fiatAmount: decimal("fiat_amount", { precision: 20, scale: 2 }),
  fiatCurrency: text("fiat_currency").default("USD"), // USD, EUR, etc
  exchangeRate: decimal("exchange_rate", { precision: 20, scale: 8 }),
  
  // QR Code Data
  qrCodeData: text("qr_code_data").notNull(),
  
  // Status & Expiry
  status: text("status").notNull().default("pending"), // pending, completed, expired, cancelled
  expiresAt: timestamp("expires_at").notNull(),
  
  // Fulfillment
  userId: text("user_id"),
  userWallet: text("user_wallet"),
  transactionId: varchar("transaction_id").references(() => transactions.id),
  
  // Metadata
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  agentIdIdx: index("payment_requests_agent_id_idx").on(table.agentId),
  statusIdx: index("payment_requests_status_idx").on(table.status),
  expiresAtIdx: index("payment_requests_expires_at_idx").on(table.expiresAt),
}));

// Agent Ratings & Reviews
export const agentRatings = pgTable("agent_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  userId: text("user_id").notNull(),
  transactionId: varchar("transaction_id").references(() => transactions.id),
  
  // Rating
  rating: integer("rating").notNull(), // 1-5
  review: text("review"),
  
  // Response
  agentResponse: text("agent_response"),
  respondedAt: timestamp("responded_at"),
  
  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  agentIdIdx: index("agent_ratings_agent_id_idx").on(table.agentId),
  userIdIdx: index("agent_ratings_user_id_idx").on(table.userId),
}));

// Audit Logs
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Event Details
  eventType: text("event_type").notNull(), // agent_approved, config_changed, transaction_created, etc
  entityType: text("entity_type").notNull(), // agent, transaction, config, etc
  entityId: text("entity_id"),
  
  // Actor
  actorId: text("actor_id"),
  actorType: text("actor_type"), // agent, admin, system
  
  // Changes
  changes: jsonb("changes"),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  
  // Context
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  
  // Metadata
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  eventTypeIdx: index("audit_logs_event_type_idx").on(table.eventType),
  entityIdx: index("audit_logs_entity_idx").on(table.entityType, table.entityId),
  actorIdx: index("audit_logs_actor_idx").on(table.actorId),
  createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
}));

// Agent Inventory History
export const agentInventoryHistory = pgTable("agent_inventory_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  
  // Change Details
  changeType: text("change_type").notNull(), // purchase, transfer, refund, adjustment
  amount: decimal("amount", { precision: 20, scale: 8 }).notNull(),
  balanceBefore: decimal("balance_before", { precision: 20, scale: 8 }).notNull(),
  balanceAfter: decimal("balance_after", { precision: 20, scale: 8 }).notNull(),
  
  // Reference
  referenceType: text("reference_type"), // exchange_order, transaction, etc
  referenceId: text("reference_id"),
  
  // Metadata
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  agentIdIdx: index("agent_inventory_history_agent_id_idx").on(table.agentId),
  createdAtIdx: index("agent_inventory_history_created_at_idx").on(table.createdAt),
}));

// Promotional Events
export const promotionalEvents = pgTable("promotional_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Event Details
  name: text("name").notNull(),
  description: text("description"),
  eventType: text("event_type").notNull(), // bonus_rate, reduced_fees, agent_incentive
  
  // Rate Adjustment
  bonusRate: decimal("bonus_rate", { precision: 10, scale: 2 }), // e.g., 120 for 1 TKOIN = 120 Credits
  feeDiscount: decimal("fee_discount", { precision: 5, scale: 2 }), // percentage discount
  
  // Schedule
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  
  // Status
  status: text("status").notNull().default("scheduled"), // scheduled, active, completed, cancelled
  
  // Targeting
  targetAgents: jsonb("target_agents"), // Array of agent IDs or null for all
  targetUsers: jsonb("target_users"), // Array of user IDs or null for all
  
  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: text("created_by"),
}, (table) => ({
  statusIdx: index("promotional_events_status_idx").on(table.status),
  timeIdx: index("promotional_events_time_idx").on(table.startTime, table.endTime),
}));

// Zod Schemas for Validation

// System Config
export const insertSystemConfigSchema = createInsertSchema(systemConfig).omit({ id: true, updatedAt: true });
export type InsertSystemConfig = z.infer<typeof insertSystemConfigSchema>;
export type SystemConfig = typeof systemConfig.$inferSelect;

// Agents
export const insertAgentSchema = createInsertSchema(agents).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  tkoinBalance: true,
  totalMinted: true,
  totalCommissionEarned: true,
  averageRating: true,
  totalRatings: true,
});
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = typeof agents.$inferSelect;

// Exchange Orders
export const insertExchangeOrderSchema = createInsertSchema(exchangeOrders).omit({ 
  id: true, 
  createdAt: true, 
  completedAt: true,
});
export type InsertExchangeOrder = z.infer<typeof insertExchangeOrderSchema>;
export type ExchangeOrder = typeof exchangeOrders.$inferSelect;

// Transactions
export const insertTransactionSchema = createInsertSchema(transactions).omit({ 
  id: true, 
  createdAt: true, 
  completedAt: true,
});
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

// Deposits
export const insertDepositSchema = createInsertSchema(deposits).omit({ 
  id: true, 
  detectedAt: true, 
  processedAt: true,
});
export type InsertDeposit = z.infer<typeof insertDepositSchema>;
export type Deposit = typeof deposits.$inferSelect;

// Withdrawals
export const insertWithdrawalSchema = createInsertSchema(withdrawals).omit({ 
  id: true, 
  createdAt: true, 
  approvedAt: true, 
  completedAt: true,
});
export type InsertWithdrawal = z.infer<typeof insertWithdrawalSchema>;
export type Withdrawal = typeof withdrawals.$inferSelect;

// Payment Requests
export const insertPaymentRequestSchema = createInsertSchema(paymentRequests).omit({ 
  id: true, 
  createdAt: true, 
  completedAt: true,
});
export type InsertPaymentRequest = z.infer<typeof insertPaymentRequestSchema>;
export type PaymentRequest = typeof paymentRequests.$inferSelect;

// Agent Ratings
export const insertAgentRatingSchema = createInsertSchema(agentRatings).omit({ 
  id: true, 
  createdAt: true,
  respondedAt: true,
});
export type InsertAgentRating = z.infer<typeof insertAgentRatingSchema>;
export type AgentRating = typeof agentRatings.$inferSelect;

// Audit Logs
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ 
  id: true, 
  createdAt: true,
});
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// Agent Inventory History
export const insertAgentInventoryHistorySchema = createInsertSchema(agentInventoryHistory).omit({ 
  id: true, 
  createdAt: true,
});
export type InsertAgentInventoryHistory = z.infer<typeof insertAgentInventoryHistorySchema>;
export type AgentInventoryHistoryRecord = typeof agentInventoryHistory.$inferSelect;

// Promotional Events
export const insertPromotionalEventSchema = createInsertSchema(promotionalEvents).omit({ 
  id: true, 
  createdAt: true,
});
export type InsertPromotionalEvent = z.infer<typeof insertPromotionalEventSchema>;
export type PromotionalEvent = typeof promotionalEvents.$inferSelect;
