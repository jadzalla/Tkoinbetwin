# Phase 2: Complementary Deflationary Mechanisms

This document outlines the supplementary token sink mechanisms to be implemented after the core burn rate optimization (Phase 1).

## Overview

Phase 1 established a configurable 1% burn rate on treasury deposits. Phase 2 adds multiple deflationary levers that work together to manage token velocity and long-term value without heavily taxing core user flows.

## Strategic Goals

1. **Fine-tune token velocity** without increasing friction on deposits
2. **Create demand** through buyback programs
3. **Lock liquidity** via agent staking
4. **Generate marketing** through promotional burn events
5. **Maintain flexibility** with multiple adjustable levers

---

## 1. Buyback-and-Burn Program

### Concept
Use a percentage of platform rake (house edge) to periodically buy Tkoin from the market and burn it.

### Implementation

**Revenue Collection:**
- Allocate 5-15% of casino house edge to buyback fund
- Accumulate in dedicated wallet (multisig recommended)
- Set minimum threshold (e.g., $10,000) before executing buyback

**Execution Cadence:**
- Weekly or bi-weekly purchases
- Use DEX aggregator (Jupiter) for best rates
- Burn immediately after purchase
- Transparent on-chain records

**Benefits:**
- Creates consistent buy pressure
- Reduces supply without taxing users
- Demonstrates platform commitment to tokenomics
- Marketing opportunity ("We burned $X this month")

**Database Schema:**
```typescript
export const buybackEvents = pgTable('buyback_events', {
  id: serial('id').primaryKey(),
  executedAt: timestamp('executed_at').defaultNow().notNull(),
  amountUsd: integer('amount_usd').notNull(), // Dollars used
  amountTkoin: bigint('amount_tkoin', { mode: 'bigint' }).notNull(), // Tkoin purchased
  averagePrice: integer('average_price').notNull(), // Price in cents
  burnSignature: varchar('burn_signature', { length: 88 }).notNull(),
  executedBy: varchar('executed_by', { length: 255 }).notNull(),
});
```

**API Routes:**
```typescript
// Admin triggers manual buyback
POST /api/admin/buyback/execute
Body: { amountUsd: number }

// Public stats
GET /api/stats/buyback
Response: {
  totalBuybackUsd: string,
  totalBurnedViaBuyback: string,
  lastBuyback: timestamp,
  nextScheduledBuyback: timestamp
}
```

---

## 2. Agent Staking System

### Concept
Agents lock a portion of their inventory to earn fee rebates and higher commission tiers.

### Implementation

**Staking Tiers:**
```typescript
const STAKING_TIERS = {
  bronze: {
    minStake: 1_000,      // 1,000 TKOIN
    lockPeriod: 30,       // days
    feeRebate: 0.1,      // 10% burn fee rebate
    commissionBonus: 0,   // No bonus
  },
  silver: {
    minStake: 10_000,
    lockPeriod: 90,
    feeRebate: 0.25,     // 25% burn fee rebate
    commissionBonus: 0.05, // +0.5% commission
  },
  gold: {
    minStake: 50_000,
    lockPeriod: 180,
    feeRebate: 0.5,      // 50% burn fee rebate
    commissionBonus: 0.1,  // +1% commission
  },
};
```

**Benefits:**
- Reduces circulating supply (locked inventory)
- Incentivizes long-term agent participation
- Creates tier progression beyond just volume
- Agents benefit from reduced costs

**Database Schema:**
```typescript
export const agentStakes = pgTable('agent_stakes', {
  id: serial('id').primaryKey(),
  agentId: varchar('agent_id', { length: 255 }).notNull(),
  amount: bigint('amount', { mode: 'bigint' }).notNull(),
  tier: varchar('tier', { length: 50 }).notNull(),
  stakedAt: timestamp('staked_at').defaultNow().notNull(),
  unlocksAt: timestamp('unlocks_at').notNull(),
  status: varchar('status', { length: 50 }).default('active').notNull(),
  // active | unlocked | withdrawn
});
```

**API Routes:**
```typescript
// Agent stakes inventory
POST /api/agents/stake
Body: { amount: number, tier: 'bronze' | 'silver' | 'gold' }

// Agent unstakes (after lock period)
POST /api/agents/unstake/:stakeId

// Get agent's stakes
GET /api/agents/me/stakes
```

---

## 3. Promotional Burn Events

### Concept
Time-limited campaigns that temporarily increase burn rates or add special burn mechanics for marketing and scarcity events.

### Event Types

**Double Burn Week:**
- 2x burn rate for 7 days
- Marketing campaign: "Play more, burn more!"
- Typically during slow periods

**Tournament Burns:**
- Winner's deposits burn extra 0.5-1%
- Creates competitive engagement
- "Burn to Win" promotions

**Milestone Burns:**
- One-time burns at platform milestones
- "We hit 1M transactions! Burning 10,000 TKOIN"
- Community celebration events

**Database Schema:**
```typescript
export const promotionalEvents = pgTable('promotional_events', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  // double_burn | tournament_burn | milestone_burn | custom
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  burnMultiplier: integer('burn_multiplier').default(1).notNull(),
  // 1 = normal, 2 = double, etc.
  isActive: boolean('is_active').default(false).notNull(),
  totalBurned: bigint('total_burned', { mode: 'bigint' }).default(0).notNull(),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
});
```

**API Routes:**
```typescript
// Admin creates promotional event
POST /api/admin/events/promotional
Body: {
  name: string,
  eventType: string,
  startDate: timestamp,
  endDate: timestamp,
  burnMultiplier: number
}

// Get active promotional events
GET /api/events/active

// Public stats for event
GET /api/events/:id/stats
```

---

## Implementation Priority

### Phase 2.1 (Immediate Next)
1. **Buyback-and-Burn Infrastructure**
   - Database schema
   - Admin execution endpoint
   - Jupiter integration for TKOIN purchases
   - Public stats display

### Phase 2.2 (Medium Term)
2. **Agent Staking System**
   - Database schema
   - Staking/unstaking logic
   - Fee rebate calculation
   - UI for agent staking dashboard

### Phase 2.3 (Long Term)
3. **Promotional Events Framework**
   - Event management system
   - Dynamic burn rate modifiers
   - Marketing automation
   - Analytics dashboard

---

## Monitoring & Analytics

**Key Metrics to Track:**
- Total supply reduction over time
- Burn sources breakdown (deposits vs buyback vs events)
- Agent staking participation rate
- Locked liquidity percentage
- Buyback ROI (price impact vs cost)
- Event effectiveness (engagement vs burns)

**Dashboard Requirements:**
- Real-time burn rate visualization
- Staking tier distribution
- Buyback execution history
- Event calendar with impact metrics
- Projected supply reduction curves

---

## Risk Management

**Buyback Risks:**
- Market manipulation concerns → Use DEX aggregators, public execution
- Front-running → Randomize exact timing, use TWAP
- Budget overruns → Set maximum percentage of rake

**Staking Risks:**
- Agent liquidity locked → Multiple tier options, shorter lock periods
- Unstaking rush → Gradual unlocks, cooldown periods
- Tier gaming → Require sustained balance, not just snapshot

**Event Risks:**
- Unsustainable burn rates → Hard caps on multipliers (max 3x)
- User confusion → Clear communication, in-app notifications
- Platform liability → Terms clearly state promotional nature

---

## Success Criteria

**Phase 2 is successful when:**
1. Multiple deflationary levers are operational and adjustable
2. Buybacks occur regularly with transparent reporting
3. >30% of agent inventory is staked
4. Promotional events drive measurable engagement spikes
5. Combined mechanisms create 1.5-2.5% effective annual burn rate
6. Token velocity is controlled without harming user experience

---

## Next Steps (Post Phase 1)

1. Design Jupiter integration for buyback purchases
2. Build staking smart contracts or custody solution
3. Create promotional event scheduling system
4. Develop comprehensive analytics dashboard
5. Write agent documentation for staking benefits
6. Plan Q1 promotional event calendar

---

## Notes

- All burn mechanisms must be auditable on-chain
- Maintain user trust through transparency
- Avoid aggressive deflation that creates liquidity crisis
- Balance long-term value with short-term usability
- Monitor market conditions and adjust levers accordingly
