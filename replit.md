# Tkoin Ecosystem

## Project Overview

A complete Solana Token-2022 ecosystem integrating with the 1-Stake/BetWin gaming platform. Tkoin enables players to convert between cryptocurrency and casino credits through approved agents who act as liquidity providers and money service operators.

## System Architecture

### Components

1. **Token-2022 Smart Contract** - Solana SPL Token-2022 with transfer fee extension (2% burn on deposits)
2. **Agent Exchange System** - Liquidity providers who buy/sell Tkoin using stablecoins (USDT/USDC/EURt)
3. **Blockchain Monitor** - Real-time deposit detection and processing
4. **Public Homepage** - tkoin.finance with live stats and agent directory
5. **Agent Portal** - Inventory management and customer service interface
6. **Admin Panel** - System configuration and agent management
7. **Laravel Integration** - Webhook-based credit synchronization with 1-Stake platform

### Token Economics

- **Max Supply**: 100,000,000 TKOIN
- **Soft-Peg**: 1 TKOIN = 100 Credits (configurable)
- **Burn Mechanism**: 1% burn on all deposits to treasury wallet (configurable 0-2% via system_config)
- **Transfer Fees**: Implemented via Token-2022 extension, adjustable by admins
- **Commission Tiers**:
  - Bronze: < 1,000 TKOIN minted
  - Silver: 1,000 - 5,000 TKOIN
  - Gold: > 5,000 TKOIN
- **Deflationary Levers**: Base burn rate + future buyback program + agent staking + promotional events

### Agent System

**Agent Types:**
- Basic: New agents with limited daily/monthly caps
- Verified: KYC-verified agents with higher limits
- Premium: Top-tier agents with maximum limits and best rates

**Agent Operations:**
1. **Buy Inventory**: Deposit USDT/USDC/EURt to acquire Tkoin
2. **Serve Customers**:
   - Cash → Tkoin (via QR code)
   - Tkoin → Cash/Stablecoins
   - Tkoin → 1Stake Credits
3. **Earn Commissions**: Percentage of each transaction based on tier

### Payment Flows - Complete Bidirectional Exchange

#### 1. User Buys Tkoin (Agent → User)
**Agent sells from inventory:**
- User contacts agent (cash/bank/stablecoins)
- Agent transfers Tkoin from inventory to user wallet
- User pays agent via chosen method
- Agent earns commission on sale
- User can now play (1 TKOIN = 100 Credits)

**Agent replenishes inventory:**
- Agent deposits USDT/USDC/EURt to treasury
- 1% burn applied automatically (configurable)
- Tkoin credited to agent inventory
- Transaction recorded

#### 2. User Plays & Wins
- User deposits Tkoin to 1Stake platform
- Blockchain monitor detects treasury deposit
- 1% burn applied (configurable), credits calculated  
- Webhook sent to Laravel platform
- Credits added to user's account
- User plays and (hopefully) wins

#### 3. User Redeems Tkoin (User → Agent)
**User withdraws winnings:**
- User requests withdrawal from 1Stake
- 24hr cooldown enforced
- Daily cap validated
- Tkoin sent to user's wallet

**User sells to agent:**
- User contacts agent for redemption
- User transfers Tkoin to agent wallet
- Agent pays user (cash/bank/stablecoins)
- Agent earns commission on redemption
- Agent now has more inventory

#### 4. QR Code Payments (Both Directions)
**User Buying:**
- Agent generates QR code with rate
- User scans, confirms amount
- User pays cash
- Agent transfers Tkoin

**User Redeeming:**
- User generates QR code showing Tkoin amount
- Agent scans, confirms
- User transfers Tkoin
- Agent pays cash

### Key Points
- **Agents act as market makers**: Buy from users (redemptions) AND sell to users (purchases)
- **Inventory balancing**: Agents must manage inventory between buying and selling
- **Commissions on both sides**: Agents earn on purchases AND redemptions
- **1% burn only on deposits**: When Tkoin enters the treasury wallet (agent inventory purchases + user game deposits)
- **Configurable burn rate**: Admins can adjust from 0-2% based on market conditions via system_config
- **Future deflationary mechanisms**: Buyback-and-burn program, agent staking, promotional burn events

## Database Schema

### Core Tables

- **agents**: Agent profiles, inventory balances, verification tiers, limits
- **exchange_orders**: Agent stablecoin purchases (USDT/USDC/EURt → Tkoin)
- **transactions**: All token operations (transfers, mints, burns)
- **deposits**: Treasury wallet monitoring and credit conversions
- **withdrawals**: User withdrawal requests with cooldowns
- **payment_requests**: QR code payment tracking
- **agent_ratings**: Reviews and ratings for agents
- **audit_logs**: Comprehensive event logging
- **agent_inventory_history**: Balance change tracking
- **promotional_events**: Bonus rates and special offers
- **system_config**: System-wide settings and tokenomics parameters

## Technology Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Node.js + Express + PostgreSQL + Drizzle ORM
- **Blockchain**: Solana (Token-2022) + @solana/web3.js
- **Auth**: Replit Auth (OpenID Connect)
- **Database**: PostgreSQL (Neon-backed)

## Environment Variables

### Required Secrets

- `SOLANA_RPC_URL`: Solana RPC endpoint (devnet/mainnet)
- `SOLANA_TREASURY_WALLET`: Treasury wallet public address
- `SOLANA_TREASURY_PRIVATE_KEY`: Treasury wallet private key (base58)
- `TKOIN_WEBHOOK_SECRET`: HMAC secret for Laravel webhooks
- `DATABASE_URL`: PostgreSQL connection string (auto-configured)
- `SESSION_SECRET`: Express session secret (auto-configured)

## Recent Changes

**2024-01-13**: Initial project setup
- Created comprehensive PostgreSQL schema for all entities
- Established database relationships and indexes
- Configured Drizzle ORM with Neon serverless adapter

## User Preferences

- Use TypeScript for type safety
- Follow fullstack_js development guidelines
- Maintain clean crypto-themed UI
- Prioritize security for blockchain operations
- Comprehensive audit logging for compliance

## Project Structure

```
├── client/               # Frontend React application
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Page components
│   │   ├── lib/         # Utilities and query client
│   │   └── App.tsx      # Main app with routing
├── server/              # Backend Express server
│   ├── db.ts           # Database connection
│   ├── routes.ts       # API routes
│   ├── storage.ts      # Data access layer
│   └── index.ts        # Server entry point
├── shared/              # Shared types and schemas
│   └── schema.ts       # Drizzle schema definitions
├── solana/             # Solana smart contracts (to be created)
└── design_guidelines.md # UI/UX design system
```

## Implementation Status

### Completed
1. ✅ **Database Schema** - Complete PostgreSQL schema with 11 tables for agents, transactions, deposits, withdrawals, exchange orders, ratings, audit logs, promotional events, and system config
2. ✅ **Solana Token-2022 Infrastructure** - Complete deployment scripts, wallet generation, automated burn service, and Token-2022 with 2% transfer fee
3. ✅ **Storage Layer** - Full PostgreSQL storage implementation with CRUD operations for all entities
4. ✅ **Authentication System** - Replit Auth integration with user sessions, agent middleware, admin access control (all critical OAuth issues resolved)
5. ✅ **Core API Routes** - Agent registration, approval workflows, system configuration, public stats, and agent directory
6. ✅ **Design Guidelines** - Professional cryptocurrency exchange design system with purple branding, comprehensive component library
7. ✅ **Frontend Pages** - Public homepage with tokenomics stats, agent dashboard with KPI cards, agent application form with validation

### In Progress
8. 🔄 **Frontend Enhancements** - Additional homepage sections (live chart, featured agents, trust badges, activity feed)
9. 🔄 **Blockchain Monitoring Service** - Real-time deposit detection and processing
10. 🔄 **Stablecoin Swap Engine** - Jupiter integration for USDT/USDC/EURt to Tkoin exchanges
11. 🔄 **Webhook System** - Laravel integration for credit synchronization

### Planned
10. ⏳ Agent-to-user transfer interface
11. ⏳ QR code payment system
12. ⏳ Withdrawal processing with cooldowns
13. ⏳ Solana wallet adapter integration
14. ⏳ Analytics dashboard
15. ⏳ Agent discovery and ratings
16. ⏳ Risk management features
17. ⏳ Promotional events system

## Architecture Implemented

### Backend Services
- **Authentication**: Replit Auth (OpenID Connect) with session management
- **Authorization**: Three-tier access control (user, agent, admin)
- **Storage**: PostgreSQL with Drizzle ORM
- **Burn Service**: Automated harvest + withdraw + burn cycle (60-minute intervals)

### Database Design
- **Users**: Authentication and profile data
- **Agents**: Extended user profiles with inventory, limits, verification tiers
- **Transactions**: All token operations with commission tracking
- **Deposits**: Treasury wallet monitoring with webhook delivery
- **Withdrawals**: User requests with cooldown enforcement
- **Exchange Orders**: Agent stablecoin purchases
- **Payment Requests**: QR code payments with expiry
- **Audit Logs**: Comprehensive event logging
- **System Config**: Tokenomics parameters and feature flags

### Solana Integration
- **Token-2022**: Deployed with transfer fee extension
- **Burn Mechanism**: Harvest → Withdraw → Burn cycle
- **Deployment Scripts**: Wallet generation, token deployment, fee harvesting
- **Utilities**: Token operations, wallet management, SPL integration

## Next Steps

1. Build blockchain monitoring service for deposit detection
2. Create public homepage and agent portal frontend
3. Implement stablecoin swap engine with Jupiter
4. Build webhook delivery system for Laravel integration
5. Add agent-to-user transfer functionality
6. Create QR code payment system
7. Implement withdrawal processing
8. Add analytics and reporting features
