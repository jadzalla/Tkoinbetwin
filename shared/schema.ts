import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, integer, boolean, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (Required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => ({
    expireIdx: index("IDX_session_expire").on(table.expire),
  })
);

// User storage table (Required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

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
  
  // Cost Tracking (Phase 2)
  burnAmountTkoin: decimal("burn_amount_tkoin", { precision: 20, scale: 8 }).default("0"), // 1% burn on mints
  effectiveCostPerTkoin: decimal("effective_cost_per_tkoin", { precision: 20, scale: 8 }), // Actual cost after burn
  burnRebateAmountTkoin: decimal("burn_rebate_amount_tkoin", { precision: 20, scale: 8 }).default("0"), // Staking rebate
  netCostPerTkoin: decimal("net_cost_per_tkoin", { precision: 20, scale: 8 }), // Cost after rebate
  
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

// Agent Currency Settings (Pricing Configuration)
export const agentCurrencySettings = pgTable("agent_currency_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  currency: text("currency").notNull(), // USD, EUR, PHP, etc.
  
  // Spread Configuration (in basis points)
  askSpreadBps: integer("ask_spread_bps").notNull().default(250), // Default 2.5% markup when selling to users
  bidSpreadBps: integer("bid_spread_bps").notNull().default(150), // Default 1.5% discount when buying from users
  fxBufferBps: integer("fx_buffer_bps").notNull().default(75), // Default 0.75% FX safety buffer
  
  // Quote Settings
  quoteTtlSeconds: integer("quote_ttl_seconds").notNull().default(300), // 5 minutes default
  
  // Status
  isActive: boolean("is_active").notNull().default(true),
  
  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  agentCurrencyUniqueIdx: uniqueIndex("agent_currency_settings_unique_idx").on(table.agentId, table.currency),
  agentIdIdx: index("agent_currency_settings_agent_id_idx").on(table.agentId),
}));

// FX Rates (Daily Exchange Rates)
export const fxRates = pgTable("fx_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  baseCurrency: text("base_currency").notNull().default("USD"),
  quoteCurrency: text("quote_currency").notNull(), // EUR, PHP, GBP, etc.
  
  // Rate Details
  rate: decimal("rate", { precision: 20, scale: 8 }).notNull(), // e.g., 56.50 for USD/PHP
  source: text("source").notNull(), // exchangerate-api, manual, etc.
  
  // Metadata
  effectiveDate: timestamp("effective_date").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  currencyDateIdx: index("fx_rates_currency_date_idx").on(table.baseCurrency, table.quoteCurrency, table.effectiveDate),
  effectiveDateIdx: index("fx_rates_effective_date_idx").on(table.effectiveDate),
}));

// Agent Quotes (Time-Locked Pricing)
export const agentQuotes = pgTable("agent_quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  
  // Quote Details
  currency: text("currency").notNull(),
  tkoinAmount: decimal("tkoin_amount", { precision: 20, scale: 8 }).notNull(),
  fiatAmount: decimal("fiat_amount", { precision: 20, scale: 2 }).notNull(),
  exchangeRate: decimal("exchange_rate", { precision: 20, scale: 8 }).notNull(),
  
  // Pricing Breakdown
  spotRate: decimal("spot_rate", { precision: 20, scale: 8 }).notNull(), // USD base rate
  fxRate: decimal("fx_rate", { precision: 20, scale: 8 }), // USD to local currency
  askSpreadBps: integer("ask_spread_bps").notNull(),
  bidSpreadBps: integer("bid_spread_bps").notNull(),
  
  // Type & Status
  quoteType: text("quote_type").notNull(), // buy_from_agent, sell_to_agent
  status: text("status").notNull().default("active"), // active, used, expired
  
  // Expiry
  expiresAt: timestamp("expires_at").notNull(),
  
  // Fulfillment
  transactionId: varchar("transaction_id").references(() => transactions.id),
  usedAt: timestamp("used_at"),
  
  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  agentIdIdx: index("agent_quotes_agent_id_idx").on(table.agentId),
  statusIdx: index("agent_quotes_status_idx").on(table.status),
  expiresAtIdx: index("agent_quotes_expires_at_idx").on(table.expiresAt),
}));

// Monthly Agent Metrics (Volume Tracking for Tiers)
export const monthlyAgentMetrics = pgTable("monthly_agent_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  
  // Time Period
  year: integer("year").notNull(),
  month: integer("month").notNull(), // 1-12
  
  // Volume Metrics (in USD equivalent)
  totalBuyVolumeUsd: decimal("total_buy_volume_usd", { precision: 20, scale: 2 }).notNull().default("0"), // User buys from agent
  totalSellVolumeUsd: decimal("total_sell_volume_usd", { precision: 20, scale: 2 }).notNull().default("0"), // User sells to agent
  totalMintVolumeUsd: decimal("total_mint_volume_usd", { precision: 20, scale: 2 }).notNull().default("0"), // Agent mints inventory
  grossVolumeUsd: decimal("gross_volume_usd", { precision: 20, scale: 2 }).notNull().default("0"), // Total user-facing volume
  
  // Transaction Counts
  buyTransactionCount: integer("buy_transaction_count").notNull().default(0),
  sellTransactionCount: integer("sell_transaction_count").notNull().default(0),
  mintTransactionCount: integer("mint_transaction_count").notNull().default(0),
  
  // Commission & Earnings (in USD)
  spreadIncomeUsd: decimal("spread_income_usd", { precision: 20, scale: 2 }).notNull().default("0"),
  tierCommissionUsd: decimal("tier_commission_usd", { precision: 20, scale: 2 }).notNull().default("0"),
  houseEdgeShareUsd: decimal("house_edge_share_usd", { precision: 20, scale: 2 }).notNull().default("0"),
  burnRebateUsd: decimal("burn_rebate_usd", { precision: 20, scale: 2 }).notNull().default("0"),
  totalEarningsUsd: decimal("total_earnings_usd", { precision: 20, scale: 2 }).notNull().default("0"),
  
  // Tier Assignment
  commissionTier: text("commission_tier").notNull(), // bronze, silver, gold
  commissionRateBps: integer("commission_rate_bps").notNull(), // 50, 75, 100 (0.5%, 0.75%, 1.0%)
  
  // Settlement
  settlementStatus: text("settlement_status").notNull().default("pending"), // pending, processed, paid
  settlementId: varchar("settlement_id"),
  
  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  agentPeriodUniqueIdx: uniqueIndex("monthly_agent_metrics_unique_idx").on(table.agentId, table.year, table.month),
  agentIdIdx: index("monthly_agent_metrics_agent_id_idx").on(table.agentId),
  periodIdx: index("monthly_agent_metrics_period_idx").on(table.year, table.month),
  settlementIdx: index("monthly_agent_metrics_settlement_idx").on(table.settlementStatus),
}));

// Commission Ledger (Payout Records)
export const commissionLedger = pgTable("commission_ledger", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  metricsId: varchar("metrics_id").notNull().references(() => monthlyAgentMetrics.id),
  
  // Payout Details
  payoutType: text("payout_type").notNull(), // monthly_commission, burn_rebate, house_edge_share, bonus
  amountUsd: decimal("amount_usd", { precision: 20, scale: 2 }).notNull(),
  amountUsdc: decimal("amount_usdc", { precision: 20, scale: 8 }), // USDC payout amount
  
  // Settlement
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  solanaSignature: text("solana_signature"),
  recipientWallet: text("recipient_wallet"),
  
  // Period Reference
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  
  // Metadata
  notes: text("notes"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"),
}, (table) => ({
  agentIdIdx: index("commission_ledger_agent_id_idx").on(table.agentId),
  metricsIdIdx: index("commission_ledger_metrics_id_idx").on(table.metricsId),
  statusIdx: index("commission_ledger_status_idx").on(table.status),
  periodIdx: index("commission_ledger_period_idx").on(table.year, table.month),
}));

// Burn Rebate Credits (Staking Tier Benefits)
export const burnRebateCredits = pgTable("burn_rebate_credits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  exchangeOrderId: varchar("exchange_order_id").references(() => exchangeOrders.id),
  
  // Rebate Details
  stakingTier: text("staking_tier").notNull(), // bronze, silver, gold
  rebatePercentage: integer("rebate_percentage").notNull(), // 10, 25, 50
  
  // Amounts
  burnAmountTkoin: decimal("burn_amount_tkoin", { precision: 20, scale: 8 }).notNull(),
  rebateAmountTkoin: decimal("rebate_amount_tkoin", { precision: 20, scale: 8 }).notNull(),
  rebateAmountUsd: decimal("rebate_amount_usd", { precision: 20, scale: 2 }).notNull(),
  
  // Status
  status: text("status").notNull().default("credited"), // credited, reversed
  
  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  agentIdIdx: index("burn_rebate_credits_agent_id_idx").on(table.agentId),
  orderIdIdx: index("burn_rebate_credits_order_id_idx").on(table.exchangeOrderId),
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

// Agent Currency Settings
export const insertAgentCurrencySettingsSchema = createInsertSchema(agentCurrencySettings).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true,
});
export type InsertAgentCurrencySettings = z.infer<typeof insertAgentCurrencySettingsSchema>;
export type AgentCurrencySettings = typeof agentCurrencySettings.$inferSelect;

// FX Rates
export const insertFxRateSchema = createInsertSchema(fxRates).omit({ 
  id: true, 
  createdAt: true,
  effectiveDate: true,
});
export type InsertFxRate = z.infer<typeof insertFxRateSchema>;
export type FxRate = typeof fxRates.$inferSelect;

// Agent Quotes
export const insertAgentQuoteSchema = createInsertSchema(agentQuotes).omit({ 
  id: true, 
  createdAt: true,
  usedAt: true,
});
export type InsertAgentQuote = z.infer<typeof insertAgentQuoteSchema>;
export type AgentQuote = typeof agentQuotes.$inferSelect;

// Monthly Agent Metrics
export const insertMonthlyAgentMetricsSchema = createInsertSchema(monthlyAgentMetrics).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true,
});
export type InsertMonthlyAgentMetrics = z.infer<typeof insertMonthlyAgentMetricsSchema>;
export type MonthlyAgentMetrics = typeof monthlyAgentMetrics.$inferSelect;

// Commission Ledger
export const insertCommissionLedgerSchema = createInsertSchema(commissionLedger).omit({ 
  id: true, 
  createdAt: true,
  processedAt: true,
});
export type InsertCommissionLedger = z.infer<typeof insertCommissionLedgerSchema>;
export type CommissionLedger = typeof commissionLedger.$inferSelect;

// Burn Rebate Credits
export const insertBurnRebateCreditSchema = createInsertSchema(burnRebateCredits).omit({ 
  id: true, 
  createdAt: true,
});
export type InsertBurnRebateCredit = z.infer<typeof insertBurnRebateCreditSchema>;
export type BurnRebateCredit = typeof burnRebateCredits.$inferSelect;
