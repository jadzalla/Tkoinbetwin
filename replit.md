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
- **Burn Mechanism**: 2% burn on all deposits to treasury wallet
- **Transfer Fees**: Configurable via Token-2022 extension
- **Commission Tiers**:
  - Bronze: < 1,000 TKOIN minted
  - Silver: 1,000 - 5,000 TKOIN
  - Gold: > 5,000 TKOIN

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

### Payment Flows

1. **Deposit (User → 1Stake Credits)**:
   - User sends Tkoin to treasury wallet with memo (user ID)
   - Blockchain monitor detects deposit
   - 2% burn applied, credits calculated
   - Webhook sent to Laravel platform
   - Credits added to user's 1Stake account

2. **Agent Inventory Purchase**:
   - Agent deposits USDT/USDC/EURt to smart contract
   - SPL token swap executed
   - Tkoin credited to agent's inventory
   - Transaction recorded

3. **Agent-to-User Transfer**:
   - User pays agent (cash or stablecoin)
   - Agent transfers Tkoin from dashboard
   - Commission calculated and recorded
   - User can deposit to 1Stake or hold

4. **QR Code Payment**:
   - Agent generates QR code with amount and rate
   - User scans and confirms
   - Payment locked for 5 minutes
   - Agent transfers Tkoin upon cash receipt

5. **Withdrawal (1Stake Credits → Tkoin)**:
   - User requests withdrawal from 1Stake
   - 24hr cooldown enforced
   - Daily cap validated
   - Agent fulfills request
   - Tkoin sent to user's wallet

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

## Next Steps

1. ✅ Database schema created and migrated
2. 🔄 Build Solana Token-2022 smart contract
3. ⏳ Implement blockchain monitoring service
4. ⏳ Create agent management and authentication
5. ⏳ Build frontend applications
6. ⏳ Deploy and test end-to-end flows
