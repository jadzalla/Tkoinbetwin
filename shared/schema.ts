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
  role: text("role").notNull().default("user"), // user, agent, admin
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
  registrationType: text("registration_type").notNull().default("permissioned"), // permissionless, permissioned
  walletSignature: text("wallet_signature"), // Signature proof for permissionless registration
  
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
  
  // Order Limits (in USD equivalent)
  minOrderUsd: decimal("min_order_usd", { precision: 20, scale: 2 }).notNull().default("10"),
  maxOrderUsd: decimal("max_order_usd", { precision: 20, scale: 2 }).notNull().default("5000"),
  dailyLimitUsd: decimal("daily_limit_usd", { precision: 20, scale: 2 }).notNull().default("10000"),
  
  // Status
  isActive: boolean("is_active").notNull().default(true),
  
  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  agentCurrencyUniqueIdx: uniqueIndex("agent_currency_settings_unique_idx").on(table.agentId, table.currency),
  agentIdIdx: index("agent_currency_settings_agent_id_idx").on(table.agentId),
}));

// Currencies (Admin-managed supported currencies)
export const currencies = pgTable("currencies", {
  code: varchar("code", { length: 3 }).primaryKey(), // ISO 4217 (USD, EUR, etc.)
  name: text("name").notNull(), // Full name (US Dollar, Euro)
  symbol: text("symbol").notNull(), // Symbol ($, €, ¥)
  decimals: integer("decimals").notNull().default(2), // Decimal places (usually 2)
  isActive: boolean("is_active").notNull().default(true), // Admin can enable/disable
  sortOrder: integer("sort_order").notNull().default(0), // Display order
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  codeIdx: index("currencies_code_idx").on(table.code),
  activeIdx: index("currencies_active_idx").on(table.isActive),
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

// Sovereign Platforms (Multi-Tenant Platform Management)
export const sovereignPlatforms = pgTable("sovereign_platforms", {
  id: text("id").primaryKey(), // e.g., 'platform_betwin', 'platform_metaverse_x'
  
  // Platform Details
  name: text("name").notNull(), // Human-readable name
  displayName: text("display_name"), // Optional display name
  description: text("description"),
  
  // Webhook Configuration
  webhookUrl: text("webhook_url"), // Platform's webhook endpoint
  webhookSecret: text("webhook_secret").notNull(), // HMAC secret for signature verification
  
  // Status & Visibility
  isActive: boolean("is_active").notNull().default(true),
  isPublic: boolean("is_public").notNull().default(false), // Show in public platform directory
  
  // Contact & Support
  contactEmail: text("contact_email"),
  supportUrl: text("support_url"),
  
  // API Configuration
  apiKey: text("api_key"), // Optional API key for platform-to-Tkoin requests (deprecated - use platformApiTokens)
  rateLimit: integer("rate_limit").default(1000), // Requests per hour
  apiEnabled: boolean("api_enabled").notNull().default(false), // Enable API access
  webhookEnabled: boolean("webhook_enabled").notNull().default(false), // Enable webhook access
  tenantSubdomain: varchar("tenant_subdomain", { length: 100 }), // Tenant subdomain for API endpoints
  
  // Metadata
  metadata: jsonb("metadata"), // Additional platform-specific configuration (now includes webhook permissions)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  idIdx: index("sovereign_platforms_id_idx").on(table.id),
  activeIdx: index("sovereign_platforms_active_idx").on(table.isActive),
  publicIdx: index("sovereign_platforms_public_idx").on(table.isPublic),
}));

// Platform API Tokens
export const platformApiTokens = pgTable("platform_api_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Platform Reference
  platformId: text("platform_id").notNull().references(() => sovereignPlatforms.id, { onDelete: 'cascade' }),
  
  // Token Data
  tokenHash: text("token_hash").notNull().unique(), // SHA-256 hash of the full token
  maskedToken: text("masked_token").notNull(), // First 4 and last 4 chars for display
  
  // Token Management
  isActive: boolean("is_active").notNull().default(true),
  expiresAt: timestamp("expires_at"), // Optional expiration date
  lastUsedAt: timestamp("last_used_at"),
  
  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: text("created_by"), // Admin who created the token
}, (table) => ({
  platformIdIdx: index("platform_api_tokens_platform_id_idx").on(table.platformId),
  tokenHashIdx: uniqueIndex("platform_api_tokens_token_hash_idx").on(table.tokenHash),
}));

// Token Configuration (Solana Token-2022 - TKOIN)
export const tokenConfig = pgTable("token_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Token Identity
  mintAddress: text("mint_address").notNull().unique(),
  tokenName: text("token_name").notNull().default("Tkoin"),
  tokenSymbol: text("token_symbol").notNull().default("TK"),
  decimals: integer("decimals").notNull().default(9), // Solana standard: 9 decimals
  
  // Supply Management (ALL VALUES STORED IN BASE UNITS / LAMPORTS as STRINGS)
  // Example: 1 TKOIN (9 decimals) = 1,000,000,000 base units
  // Example: 1B TKOIN = "1000000000000000000" (stored as string for BigInt compatibility)
  maxSupply: varchar("max_supply", { length: 30 }).notNull(), // Base units as string
  currentSupply: varchar("current_supply", { length: 30 }).notNull().default("0"), // Base units as string
  circulatingSupply: varchar("circulating_supply", { length: 30 }).notNull().default("0"), // Base units as string
  
  // Burn Configuration
  burnRateBasisPoints: integer("burn_rate_basis_points").notNull().default(100), // 1% (100 basis points)
  maxBurnRateBasisPoints: integer("max_burn_rate_basis_points").notNull().default(200), // 2% max
  treasuryWallet: text("treasury_wallet").notNull(),
  
  // Authorities (Solana Public Keys)
  mintAuthority: text("mint_authority"), // Can mint new tokens
  freezeAuthority: text("freeze_authority"), // Can freeze accounts
  transferFeeConfigAuthority: text("transfer_fee_config_authority"), // Can update transfer fees
  
  // Deployment Status
  deploymentStatus: text("deployment_status").notNull().default("pending"), // pending, deployed, failed
  deployedAt: timestamp("deployed_at"),
  deploymentSignature: text("deployment_signature"), // Solana transaction signature
  deploymentError: text("deployment_error"), // Error message if deployment failed
  
  // Metadata
  metadataUri: text("metadata_uri"), // IPFS/Arweave URI for token metadata
  description: text("description"),
  logoUrl: text("logo_url"),
  
  // Configuration Versioning
  configVersion: integer("config_version").notNull().default(1),
  notes: jsonb("notes"), // Additional configuration notes
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  mintAddressIdx: uniqueIndex("token_config_mint_address_idx").on(table.mintAddress),
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

// Currencies
export const insertCurrencySchema = createInsertSchema(currencies).omit({ 
  createdAt: true,
  updatedAt: true,
});
export type InsertCurrency = z.infer<typeof insertCurrencySchema>;
export type Currency = typeof currencies.$inferSelect;

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

// Sovereign Platforms
export const insertSovereignPlatformSchema = createInsertSchema(sovereignPlatforms).omit({ 
  createdAt: true,
  updatedAt: true,
});
export type InsertSovereignPlatform = z.infer<typeof insertSovereignPlatformSchema>;
export type SovereignPlatform = typeof sovereignPlatforms.$inferSelect;

// Token Configuration
export const insertTokenConfigSchema = createInsertSchema(tokenConfig).omit({ 
  id: true,
  createdAt: true,
  updatedAt: true,
  currentSupply: true,
  circulatingSupply: true,
  deployedAt: true,
  deploymentSignature: true,
  deploymentError: true,
});
export type InsertTokenConfig = z.infer<typeof insertTokenConfigSchema>;
export type TokenConfig = typeof tokenConfig.$inferSelect;

// Agent Stakes - On-chain staking tracking
export const agentStakes = pgTable("agent_stakes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Agent & Wallet
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  solanaWallet: text("solana_wallet").notNull(),
  
  // Stake Amount (in base units - lamports with 9 decimals)
  stakedAmount: varchar("staked_amount", { length: 30 }).notNull().default("0"),
  
  // Tier Based on Stake
  currentTier: text("current_tier").notNull().default("basic"), // basic (0), verified (10K), premium (50K)
  
  // Lock-up Period
  lockupPeriodDays: integer("lockup_period_days").notNull().default(30),
  lockedUntil: timestamp("locked_until"),
  
  // On-chain State
  stakePda: text("stake_pda"), // Solana PDA address for stake account
  lastSyncedAt: timestamp("last_synced_at"),
  onChainBalance: varchar("on_chain_balance", { length: 30 }).default("0"),
  
  // Status
  status: text("status").notNull().default("active"), // active, unstaking, slashed
  
  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  agentIdIdx: index("agent_stakes_agent_id_idx").on(table.agentId),
  walletIdx: index("agent_stakes_wallet_idx").on(table.solanaWallet),
  tierIdx: index("agent_stakes_tier_idx").on(table.currentTier),
}));

// Stake History - Audit trail for all stake operations
export const stakeHistory = pgTable("stake_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Agent & Stake Reference
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  stakeId: varchar("stake_id").references(() => agentStakes.id),
  
  // Operation Details
  operationType: text("operation_type").notNull(), // stake, unstake, slash, sync
  amount: varchar("amount", { length: 30 }).notNull(),
  previousBalance: varchar("previous_balance", { length: 30 }),
  newBalance: varchar("new_balance", { length: 30 }),
  
  // Tier Changes
  previousTier: text("previous_tier"),
  newTier: text("new_tier"),
  
  // Transaction Details
  solanaSignature: text("solana_signature"),
  stakePda: text("stake_pda"),
  
  // Metadata
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  agentIdIdx: index("stake_history_agent_id_idx").on(table.agentId),
  operationTypeIdx: index("stake_history_operation_type_idx").on(table.operationType),
  createdAtIdx: index("stake_history_created_at_idx").on(table.createdAt),
}));

// Slashing Events - Penalties for violations
export const slashingEvents = pgTable("slashing_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Agent & Stake
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  stakeId: varchar("stake_id").notNull().references(() => agentStakes.id),
  
  // Violation Details
  violationType: text("violation_type").notNull(), // fraud, failed_delivery, kyc_breach, policy_violation
  severity: text("severity").notNull(), // minor, major, critical
  description: text("description").notNull(),
  evidenceUrl: text("evidence_url"),
  
  // Slashing Details
  slashPercentage: decimal("slash_percentage", { precision: 5, scale: 2 }).notNull(), // e.g., 10.00 = 10%
  slashedAmount: varchar("slashed_amount", { length: 30 }).notNull(),
  remainingStake: varchar("remaining_stake", { length: 30 }).notNull(),
  
  // Disposition
  slashedTokensDestination: text("slashed_tokens_destination").notNull().default("treasury"), // treasury, burn
  
  // Transaction
  solanaSignature: text("solana_signature"),
  
  // Status & Review
  status: text("status").notNull().default("pending"), // pending, executed, reversed
  executedAt: timestamp("executed_at"),
  executedBy: text("executed_by"),
  reversalReason: text("reversal_reason"),
  
  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: text("created_by").notNull(),
}, (table) => ({
  agentIdIdx: index("slashing_events_agent_id_idx").on(table.agentId),
  statusIdx: index("slashing_events_status_idx").on(table.status),
  violationTypeIdx: index("slashing_events_violation_type_idx").on(table.violationType),
}));

// Agent Applications - KYC and onboarding flow
export const agentApplications = pgTable("agent_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Applicant Identity (pre-agent)
  replitUserId: text("replit_user_id").notNull(),
  email: text("email").notNull(),
  
  // Business Information
  businessName: text("business_name").notNull(),
  businessType: text("business_type").notNull(), // individual, llc, corporation, partnership
  country: text("country").notNull(),
  city: text("city").notNull(),
  address: text("address").notNull(),
  phoneNumber: text("phone_number").notNull(),
  
  // Requested Tier
  requestedTier: text("requested_tier").notNull().default("basic"), // basic, verified, premium
  
  // KYC Documents
  kycDocuments: jsonb("kyc_documents").default([]), // [{type: "id_front", url: "...", uploadedAt: "..."}]
  kycStatus: text("kyc_status").notNull().default("pending"), // pending, under_review, approved, rejected
  kycNotes: text("kyc_notes"),
  
  // Application Status
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  
  // Admin Review
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: text("reviewed_by"),
  reviewNotes: text("review_notes"),
  rejectionReason: text("rejection_reason"),
  
  // Created Agent (if approved)
  agentId: varchar("agent_id").references(() => agents.id),
  
  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  replitUserIdIdx: index("agent_applications_replit_user_id_idx").on(table.replitUserId),
  statusIdx: index("agent_applications_status_idx").on(table.status),
  kycStatusIdx: index("agent_applications_kyc_status_idx").on(table.kycStatus),
}));

// Burn Configuration - System settings for burn service
export const burnConfig = pgTable("burn_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Service Control
  enabled: boolean("enabled").notNull().default(false),
  network: text("network").notNull().default("devnet"), // devnet, mainnet
  
  // Burn Parameters
  burnRatePercentage: decimal("burn_rate_percentage", { precision: 5, scale: 2 }).notNull().default("1.00"), // % of treasury to burn
  minBurnAmount: varchar("min_burn_amount", { length: 30 }).notNull().default("1000000000"), // 1 TKOIN in base units
  maxBurnAmount: varchar("max_burn_amount", { length: 30 }).notNull().default("100000000000000"), // 100K TKOIN in base units
  
  // Safety Limits
  maxTreasuryBurnPercentage: decimal("max_treasury_burn_percentage", { precision: 5, scale: 2 }).notNull().default("5.00"), // Never burn >5% of treasury
  cooldownPeriodHours: integer("cooldown_period_hours").notNull().default(24), // Min time between burns
  requiresApproval: boolean("requires_approval").notNull().default(true),
  
  // Fee Harvesting
  feeVaultAddress: text("fee_vault_address"),
  lastHarvestAt: timestamp("last_harvest_at"),
  totalFeesHarvested: varchar("total_fees_harvested", { length: 30 }).default("0"),
  
  // Metadata
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: text("updated_by"),
});

// Burn Proposals - Pending burns requiring approval
export const burnProposals = pgTable("burn_proposals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Proposal Details
  proposedAmount: varchar("proposed_amount", { length: 30 }).notNull(),
  treasuryBalanceAtProposal: varchar("treasury_balance_at_proposal", { length: 30 }).notNull(),
  burnPercentageOfTreasury: decimal("burn_percentage_of_treasury", { precision: 5, scale: 2 }).notNull(),
  
  // Fee Harvesting
  harvestedFeesAmount: varchar("harvested_fees_amount", { length: 30 }).default("0"),
  feeVaultBalanceAtHarvest: varchar("fee_vault_balance_at_harvest", { length: 30 }),
  
  // Justification
  reason: text("reason").notNull(),
  proposedBy: text("proposed_by").notNull(),
  
  // Status & Approval
  status: text("status").notNull().default("pending"), // pending, approved, rejected, executed
  approvedAt: timestamp("approved_at"),
  approvedBy: text("approved_by"),
  rejectedAt: timestamp("rejected_at"),
  rejectedBy: text("rejected_by"),
  rejectionReason: text("rejection_reason"),
  
  // Execution
  executedAt: timestamp("executed_at"),
  executedBy: text("executed_by"),
  solanaSignature: text("solana_signature"),
  executionError: text("execution_error"),
  
  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  statusIdx: index("burn_proposals_status_idx").on(table.status),
  createdAtIdx: index("burn_proposals_created_at_idx").on(table.createdAt),
}));

// Burn History - Completed burns with verification
export const burnHistory = pgTable("burn_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Burn Details
  burnedAmount: varchar("burned_amount", { length: 30 }).notNull(),
  treasuryBalanceBefore: varchar("treasury_balance_before", { length: 30 }).notNull(),
  treasuryBalanceAfter: varchar("treasury_balance_after", { length: 30 }).notNull(),
  
  // On-chain Verification
  solanaSignature: text("solana_signature").notNull(),
  blockHeight: integer("block_height"),
  blockTime: timestamp("block_time"),
  verified: boolean("verified").notNull().default(false),
  
  // Reference
  proposalId: varchar("proposal_id").references(() => burnProposals.id),
  
  // Metadata
  executedBy: text("executed_by").notNull(),
  executedAt: timestamp("executed_at").notNull().defaultNow(),
  notes: text("notes"),
}, (table) => ({
  executedAtIdx: index("burn_history_executed_at_idx").on(table.executedAt),
  signatureIdx: index("burn_history_signature_idx").on(table.solanaSignature),
}));

// Agent Stakes Types
export const insertAgentStakeSchema = createInsertSchema(agentStakes).omit({ 
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAgentStake = z.infer<typeof insertAgentStakeSchema>;
export type AgentStake = typeof agentStakes.$inferSelect;

// Stake History Types
export const insertStakeHistorySchema = createInsertSchema(stakeHistory).omit({ 
  id: true,
  createdAt: true,
});
export type InsertStakeHistory = z.infer<typeof insertStakeHistorySchema>;
export type StakeHistory = typeof stakeHistory.$inferSelect;

// Slashing Events Types
export const insertSlashingEventSchema = createInsertSchema(slashingEvents).omit({ 
  id: true,
  createdAt: true,
});
export type InsertSlashingEvent = z.infer<typeof insertSlashingEventSchema>;
export type SlashingEvent = typeof slashingEvents.$inferSelect;

// Agent Applications Types
export const insertAgentApplicationSchema = createInsertSchema(agentApplications).omit({ 
  id: true,
  createdAt: true,
  updatedAt: true,
  reviewedAt: true,
  agentId: true,
});
export type InsertAgentApplication = z.infer<typeof insertAgentApplicationSchema>;
export type AgentApplication = typeof agentApplications.$inferSelect;

// Burn Config Types
export const insertBurnConfigSchema = createInsertSchema(burnConfig).omit({ 
  id: true,
  updatedAt: true,
  lastHarvestAt: true,
});
export type InsertBurnConfig = z.infer<typeof insertBurnConfigSchema>;
export type BurnConfig = typeof burnConfig.$inferSelect;

// Burn Proposals Types
export const insertBurnProposalSchema = createInsertSchema(burnProposals).omit({ 
  id: true,
  createdAt: true,
  approvedAt: true,
  rejectedAt: true,
  executedAt: true,
});
export type InsertBurnProposal = z.infer<typeof insertBurnProposalSchema>;
export type BurnProposal = typeof burnProposals.$inferSelect;

// Burn History Types
export const insertBurnHistorySchema = createInsertSchema(burnHistory).omit({ 
  id: true,
  executedAt: true,
});
export type InsertBurnHistory = z.infer<typeof insertBurnHistorySchema>;
export type BurnHistory = typeof burnHistory.$inferSelect;

// Platform API Tokens Types
export const insertPlatformApiTokenSchema = createInsertSchema(platformApiTokens).omit({ 
  id: true,
  createdAt: true,
  lastUsedAt: true,
});
export type InsertPlatformApiToken = z.infer<typeof insertPlatformApiTokenSchema>;
export type PlatformApiToken = typeof platformApiTokens.$inferSelect;
