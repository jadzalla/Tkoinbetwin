# Tkoin Protocol - Sovereignty Stack

## Overview
Tkoin Protocol is the foundational liquidity layer for sovereign digital economies. It provides infrastructure for seamless fiat-to-token conversion via a decentralized network of liquidity agents, built on Solana Token-2022. The flagship application, BetWin casino, demonstrates instant deposits and withdrawals without traditional payment processors. The protocol enables multiple platforms (gaming, metaverses, DAOs, social economies) to share a common liquidity pool while maintaining sovereignty over user experience and economics.

## User Preferences
- Use TypeScript for type safety
- Follow fullstack_js development guidelines
- Maintain clean crypto-themed UI
- Prioritize security for blockchain operations
- Comprehensive audit logging for compliance

## System Architecture
The Tkoin Protocol is a multi-tenant liquidity infrastructure featuring:
- **Token Layer**: Solana SPL Token-2022 with transfer fee extension.
- **Agent Network**: Decentralized liquidity providers across integrated platforms.
- **Platform Connector**: Webhook-based integration system for sovereign platforms.
- **Web Interfaces**: Public Homepage, Agent Portal, and Admin Panel.
- **Flagship App**: BetWin casino serves as the reference implementation.

Sovereign platforms register via the admin panel, receiving webhook credentials to access the agent liquidity network.

### UI/UX Decisions
The frontend uses React, TypeScript, Vite, Tailwind CSS, and shadcn/ui, adhering to professional cryptocurrency exchange aesthetics with purple branding. The Agent Portal features a Shadcn Sidebar for navigation to dashboards, pricing, transactions, commissions, analytics, inventory, and settings.

### Technical Implementations
- **Token Economics**: Max supply of 1,000,000,000 TKOIN with a soft-peg of 1 TKOIN = 100 Credits, featuring configurable 0-2% burn on deposits and adjustable transfer fees.
- **Agent System**: Tiered agents (Basic, Verified, Premium) with varying transaction limits and commission structures. Agents manage Tkoin inventory by facilitating user purchases and redemptions, earning commissions.
- **Payment Flows**: Supports bidirectional exchange through agents, including user purchases, platform deposits, platform withdrawals, and user sales of Tkoin to agents. QR code payments are facilitated.
- **Webhook Infrastructure**: Robust, platform-agnostic webhook delivery system with per-platform secrets, HMAC-SHA256 signatures, timestamp binding, DoS protection, and exponential backoff retry.
- **Sovereign Platform Management**: Admin interface for platform registration, webhook credential management, and transaction monitoring. Webhook secrets are masked in API responses and UI for security.
- **Authentication & Authorization**: Replit Auth (OpenID Connect) with session management and role-based access control, using a `role` enum ('user', 'agent', 'admin') for user management.
- **Token Deployment System**: Solana Token-2022 deployment infrastructure with advanced extensions:
    - **Transfer Fee Extension**: Configurable 0-2% burn mechanism (default 1%).
    - **Metadata Extension**: On-chain metadata storage using MetadataPointer.
    - **Technical Specifications**: Max Supply: 1 billion TKOIN, 9 decimals, burn rate 100 basis points.
    - **Authorities**: Mint, Freeze, Transfer Fee Config, and Metadata Update authorities all set to the treasury wallet.
    - **Deployment Process**: Two-phase commit, idempotent endpoints, real-time status polling, and comprehensive blockchain verification. Account space allocation handles metadata initialization correctly to prevent errors. Editable deployment configurations are available in the Admin UI.
- **Agent Staking System**: ✅ **PRODUCTION-READY (Database-Tracking Phase)** - Tier-based access control requiring TKOIN staking:
    - **Tier Structure**: Basic (0-9,999 TK), Verified (10K-49,999 TK), Premium (50K+ TK) with increasing limits and rates.
    - **Staking Mechanics**: 30-day lock-up, 10,000 TKOIN minimum (enforced backend + frontend), 10% early withdrawal penalty.
    - **Architecture**: Hybrid database tracking with PDA infrastructure for future on-chain migration.
    - **Database Schema**: `agent_stakes` (current stakes), `stake_history` (audit trail), `slashing_events` (violation framework).
    - **Backend Service**: `StakingService` with atomic transactions, database balance validation (tokensToBaseUnits() decimal parsing), tier calculations, lock-up enforcement, penalty logic.
    - **API Endpoints**: POST /api/agents/stake, POST /api/agents/unstake, GET /api/agents/me/staking, GET /api/agents/me/stake-history (all require agent.status='active').
    - **Frontend Dashboard** (/dashboard/staking): react-hook-form + zodResolver validation, comprehensive data-testid coverage, Shadcn components, tier progression UI, stake history table.
    - **Testing**: Complete E2E coverage (stake/unstake flows, tier upgrades, penalty enforcement, history display) + regression tests (API minimum validation).
    - **Critical Fix Applied**: Backend STAKING_PARAMS.minStakeAmount corrected from 1,000 → 10,000 to match frontend and product spec.
    - **Future Enhancements**: On-chain token escrow via Solana program, rate limiting, CI test integration.
- **Burn Service**: Automated harvest, withdraw, and burn cycle for token management (pending).

### Feature Specifications
- **Pricing Configurator**: Agents can configure bid/ask spreads, FX buffers, and view pricing previews.
- **Homepage**: Displays live marketplace metrics (liquidity, volume, agents, currencies).
- **Admin Panel**: Controls for system configuration, including burn rate adjustment.
- **Agent Portal**:
    - **Transactions Page**: Comprehensive transaction history with filters and search.
    - **Commissions Page**: Commission tracking, tier progression, monthly earnings chart, and history table.
    - **Analytics Page**: Advanced dashboard with transaction volume trends, currency distribution, customer retention, and commission analysis.
    - **Inventory & Funding Page**: Agent balance/limits, payment request creation (with QR codes), and history.

### System Design Choices
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Node.js + Express + PostgreSQL + Drizzle ORM
- **Blockchain**: Solana (Token-2022) + @solana/web3.js
- **Auth**: Replit Auth (OpenID Connect)
- **Database**: PostgreSQL (Neon-backed)

## External Dependencies
- **Solana Blockchain**: For Token-2022 smart contracts and blockchain operations.
- **Sovereign Platforms**:
    - **BetWin Casino**: Integrated via webhooks.
    - Future platforms: Metaverses, DAOs, social economies, other gaming platforms.
- **Replit Auth**: For user authentication and authorization.
- **PostgreSQL (Neon)**: Primary database.
- **Jupiter**: Planned integration for stablecoin swap engine.