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
- **Agent Slashing System**: ✅ **PRODUCTION-READY** - Admin penalty enforcement for agent violations:
    - **Penalty Tiers**: Minor (10% slash), Major (25% slash), Critical (50% slash) - configurable in SLASHING_PENALTIES.
    - **Slashing Mechanics**: Admin creates pending slash → Reviews → Executes (reduces stake, downgrades tier, updates limits) → Optional reversal if error.
    - **Database Schema**: `slashing_events` table tracks violation type, severity, slashed amount, remaining stake, status (pending/executed/reversed), complete audit trail.
    - **Backend Service**: `SlashingService` with atomic database transactions for stake reduction, tier recalculation, limit updates, history tracking. Verified BigInt arithmetic: `(stakedAmount * percentage) / 100n` for precise 10%/25%/50% penalties.
    - **Admin API Endpoints**: POST /api/admin/slashing (create), POST /api/admin/slashing/:id/execute, POST /api/admin/slashing/:id/reverse, GET /api/admin/slashing/pending, GET /api/admin/slashing (history), GET /api/admin/slashing/:id, GET /api/admin/agents/:agentId/slashing (all protected by isAdmin middleware).
    - **Admin UI** (/admin/slashing): Pending slashes queue with execute/reject actions, create slash form with violation type/severity/description/evidence fields, complete history table with reversal capability, comprehensive data-testid coverage.
    - **Tier Downgrade Logic**: Automatic tier recalculation after slash execution based on remaining stake, with corresponding daily/monthly limit adjustments.
    - **Audit Trail**: Complete history in `slashing_events` + `stake_history` tables for compliance and transparency.
    - **Future Enhancements**: Automated violation detection triggers, on-chain slashing when migrating to token escrow, rate limiting for slash creation.
- **Agent Onboarding System**: ✅ **PRODUCTION-READY** - Complete application and KYC workflow for new agent registration:
    - **Database Schema**: `agent_applications` table tracks business info, KYC documents, review status, and created agent reference.
    - **Application Flow**: User submits application → Admin reviews KYC → Approves (creates agent account) or Rejects.
    - **Backend Service**: `ApplicationService` with atomic transactions for agent account creation, user role upgrade, application tracking, duplicate prevention.
    - **API Endpoints**: POST /api/applications/submit, GET /api/applications/me, GET /api/admin/applications (list/stats), POST /api/admin/applications/:id/approve|reject (all with Zod validation, proper auth).
    - **Legacy Route**: /api/agents/apply returns 410 Gone to force clients to use validated endpoint.
    - **KYC Fields**: Business name/type, country/city/address, phone number, email (pre-filled from auth), requested tier, KYC document storage (JSONB).
    - **Application Form** (/apply): Complete public form with all required fields, email pre-fill from Replit Auth, read-only email field, react-hook-form + zodResolver validation, comprehensive data-testid coverage, E2E tested.
    - **Admin Review Dashboard** (/admin/applications): Status filtering (All/Pending/Approved/Rejected), approve/reject dialogs, tuple-based TanStack Query keys with prefix-matching cache invalidation, business info display, status/tier badges, toast notifications, E2E tested.
    - **Agent Creation**: Approval creates agent account with placeholder wallet ("WALLET_NOT_CONFIGURED"), status='pending' (awaiting wallet setup), tier-based daily/monthly limits, role upgrade to 'agent'.
    - **Testing**: Complete E2E coverage for submit flow (form validation, email pre-fill, duplicate prevention) and admin review flow (filtering, approval, rejection, agent account creation).
    - **Future Enhancements**: Document upload integration, automated KYC verification, stake setup wizard post-approval.
- **Burn Proposal System**: ✅ **BACKEND-COMPLETE** - Manual approval workflow for token burns with maximum safety:
    - **Database Schema**: `burn_config` (system settings), `burn_proposals` (pending burns), `burn_history` (completed burns with verification).
    - **Safety Features**: Network detection (devnet/mainnet), configurable limits (min/max amounts, treasury percentage), cooldown periods, multi-gate approval.
    - **Backend Service**: `BurnProposalService` with safety calculations, treasury balance verification, limit enforcement.
    - **API Endpoints**: GET/PATCH /api/admin/burn/config, POST /api/admin/burn/calculate, POST /api/admin/burn/proposals, GET /api/admin/burn/proposals (list/history), POST /api/admin/burn/proposals/:id/approve|reject.
    - **Approval Workflow**: Admin calculates burn → Creates proposal → Reviews → Approves → Executes (separate from automated burn service).
    - **Frontend UI**: Pending - Burn configuration (/admin/burn/config), Proposals dashboard (/admin/burn/proposals), History & analytics.
    - **Coexistence**: Works alongside existing automated `BurnService` - manual approval for controlled burns vs automated fee harvesting.
    - **Future Enhancements**: On-chain burn execution, burn analytics dashboard, treasury visualization.
- **Analytics Dashboards**: ✅ **PRODUCTION-READY** - Comprehensive admin analytics for staking and slashing:
    - **Staking Analytics** (/admin/analytics/staking): Overview metrics, 30-day trends, tier distribution, agent health monitoring, activity feed.
    - **Slashing Analytics** (/admin/analytics/slashing): Violation frequency, severity distribution, penalty trends, agent behavior tracking.

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