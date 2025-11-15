# Tkoin Protocol - Sovereignty Stack

## Overview
Tkoin Protocol is **the foundational liquidity layer for sovereign digital economies**. Built on Solana Token-2022, it provides the infrastructure for any platform to offer seamless fiat-to-token conversion through a decentralized network of liquidity agents. Our flagship application is the **BetWin casino integration**, demonstrating how sovereign platforms can leverage Tkoin's agent network for instant deposits and withdrawals without traditional payment processors. The protocol enables multiple platforms (gaming, metaverses, DAOs, social economies) to share a common liquidity pool while maintaining complete sovereignty over their user experience and economics.

## User Preferences
- Use TypeScript for type safety
- Follow fullstack_js development guidelines
- Maintain clean crypto-themed UI
- Prioritize security for blockchain operations
- Comprehensive audit logging for compliance

## System Architecture
The Tkoin Protocol is a **multi-tenant liquidity infrastructure** comprising:
- **Token Layer**: Solana SPL Token-2022 with transfer fee extension (configurable burn mechanism)
- **Agent Network**: Decentralized liquidity providers operating across all integrated platforms
- **Platform Connector**: Webhook-based integration system supporting multiple sovereign platforms
- **Web Interfaces**: Public Homepage, Agent Portal, Admin Panel for platform management
- **Flagship App**: BetWin casino (formerly 1-Stake) serves as the reference implementation

Each sovereign platform registers via the admin panel, receives webhook credentials, and can immediately tap into the existing agent liquidity network.

### UI/UX Decisions
The frontend utilizes React, TypeScript, Vite, Tailwind CSS, and shadcn/ui. The design adheres to professional cryptocurrency exchange aesthetics with purple branding and a comprehensive component library. The Agent Portal features a Shadcn Sidebar navigation for intuitive access to dashboards, pricing configurations, transactions, commissions, analytics, inventory, and settings.

### Technical Implementations
- **Token Economics**: Max supply of 1,000,000,000 TKOIN (1 Billion) with a soft-peg of 1 TKOIN = 100 Credits. It features a configurable 0-2% burn on deposits to a treasury wallet and adjustable transfer fees. Deflationary levers include the base burn rate, future buyback programs, agent staking, and promotional events.
- **Agent System**: Agents are tiered (Basic, Verified, Premium) with varying daily/monthly transaction limits and commission structures. They manage Tkoin inventory by buying from users (redemptions) and selling to users (purchases), earning commissions on both.
- **Payment Flows**: Supports bidirectional exchange through agents, including user purchases of Tkoin from agents, user deposits to sovereign platforms, user withdrawals from platforms, and user sales of Tkoin to agents. QR code payments facilitate transactions.
- **Webhook Infrastructure**: A robust, platform-agnostic webhook delivery system for secure communication with sovereign platforms, featuring per-platform webhook secrets, HMAC-SHA256 signatures, timestamp binding, DoS protection, and exponential backoff retry logic.
- **Sovereign Platform Management**: Admin interface to register new platforms, manage webhook credentials, and monitor platform-specific transaction volumes. **Security Update (Nov 2025)**: Webhook secrets are permanently masked in all API responses (backend maskWebhookSecret) and UI (no reveal/copy functionality) to prevent secret exposure. Secrets must be securely captured during creation/regeneration.
- **Authentication & Authorization**: Replit Auth (OpenID Connect) with session management and role-based access control. **Updated (Nov 2025)**: Users table now includes `role` enum ('user', 'agent', 'admin'). Admin privileges determined by `user.role === 'admin'` instead of agent status, providing proper separation of concerns. Test admin: admin@tkoin.protocol (role='admin').
- **Token Deployment System** (**Implemented Nov 2025**): Complete Solana Token-2022 deployment infrastructure with advanced extension support:
  - **Token-2022 Extensions**:
    - **Transfer Fee Extension**: Configurable 0-2% burn mechanism (currently 1%) with maximum fee calculation proportional to max supply and burn rate
    - **Metadata Extension**: On-chain metadata storage using MetadataPointer pointing to mint address (self-referential, optimal). Stores name, symbol, description, and metadata URI directly on-chain
  - **Technical Specifications**:
    - Max Supply: 1,000,000,000 TKOIN (1 billion tokens)
    - Decimals: 9 (Solana standard for SPL tokens)
    - Burn Rate: 100 basis points (1%, adjustable 0-200 BP)
    - Maximum Fee: Calculated as `(maxSupply * burnRateBasisPoints) / 10,000` to ensure fee cap is proportional to supply
    - Initial Supply: Minted to treasury wallet upon deployment
  - **Authorities** (all set to treasury wallet):
    - Mint Authority: Can mint new tokens within max supply
    - Freeze Authority: Can freeze token accounts
    - Transfer Fee Config Authority: Can update burn rate (0-2% range)
    - Metadata Update Authority: Can update on-chain metadata
  - **Deployment Process**:
    - Two-phase commit pattern (pending → deployed/failed)
    - Idempotent deployment endpoints (prevents duplicate deployments)
    - Real-time status polling (5-second intervals)
    - Comprehensive blockchain verification using `getMetadataPointerState` to validate extensions
    - Strict authority validation (ensures all authorities match treasury wallet)
    - **Account Space Allocation** (Critical Fix - Nov 2025): Mint account created with `space: mintLen` (extensions only) while paying rent for full size including metadata. Metadata initialization uses `realloc()` to expand account, following Solana Token-2022 official pattern for self-referential MetadataPointer. This prevents "InvalidAccountData" errors during InitializeMint instruction.
    - **Editable Deployment Configuration** (Nov 2025): Admin UI with react-hook-form + Zod validation for all token parameters (maxSupply, initialMint, burnRate, decimals, metadata URIs), unified Review & Deploy dialog with read-only summary, mandatory redeploy reason enforcement, proper base units ↔ tokens conversion using `baseUnitsToTokens()` and `tokensToBaseUnits()` utilities
  - **Admin UI** (`/admin/token`): 
    - Deployment button with status badges (pending/deployed/failed)
    - Mint address display with Solana Explorer links
    - Token-2022 Extensions & Metadata card showing active extensions, all authorities (mint, freeze, transfer fee), and on-chain metadata
    - Deployment timestamp and transaction signature links
    - Real-time refresh capability
  - **Infrastructure**:
    - `server/solana/token-deployer.ts`: Main deployment class with Token-2022 extension initialization
    - `server/config/token-deployment-config.ts`: Centralized configuration with metadata and validation
    - `server/solana/deployment-utils.ts`: Helper utilities for formatting and URL generation
    - `shared/token-constants.ts`: Centralized token constants (decimals, supply, burn rates)
    - `shared/token-utils.ts`: Utility functions for base unit conversions
  - **Treasury Wallet**: 953CKYH169xXxaNKVwLT9z9s38TEg1d2pQsY7d1Lv6dD (19.94 SOL on devnet)
  - **Database Schema**: All supply values stored as VARCHAR strings in base units (e.g., 1B TKOIN = "1000000000000000000")
  - **Verification**: Deployment verification validates mint account, Token-2022 program ownership, both extensions (TransferFee + MetadataPointer), metadata pointer configuration, authority matches, and supply consistency
- **Agent Staking System** (**Implemented Nov 2025**): Tier-based access control requiring TKOIN staking for agent privileges:
  - **Tier Structure**: Basic (0-9,999 TK), Verified (10K-49,999 TK), Premium (50K+ TK) with increasing daily/monthly limits and commission rates
  - **Staking Mechanics**: 30-day lock-up period, 10K TKOIN minimum stake, 10% early withdrawal penalty
  - **Hybrid Architecture**: Database tracking with PDA infrastructure for future on-chain migration
  - **Database Schema**:
    - `agent_stakes`: Tracks staked amounts, tiers, lock-up periods, PDA addresses
    - `stake_history`: Complete audit trail of all stake/unstake operations
    - `slashing_events`: Violation tracking and penalty enforcement
  - **Backend Services**:
    - `StakingService` (server/services/staking-service.ts): Core business logic with atomic database transactions
    - PDA utilities (server/solana/staking-pda.ts): Derive stake accounts, check balances, prepare for on-chain integration
    - Staking constants (shared/staking-constants.ts): Centralized configuration for thresholds, penalties, limits
  - **API Endpoints**:
    - `POST /api/agents/stake`: Stake TKOIN with balance verification
    - `POST /api/agents/unstake`: Unstake with lock-up enforcement and penalty calculation
    - `GET /api/agents/me/staking`: Get stake status, tier, and progression
    - `GET /api/agents/me/stake-history`: Historical stake operations
    - `POST /api/agents/me/sync-stake`: Manual on-chain balance synchronization
  - **Validation & Safety**:
    - Pre-stake balance checks prevent double-counting (requires wallet balance >= total staked + new amount)
    - Atomic transactions ensure stake/tier/limit updates are consistent
    - Tier limits automatically update with stake changes
  - **Known Limitations**: Current implementation uses database tracking without actual on-chain token transfers. Future enhancement requires Solana staking program deployment for true token escrow and on-chain enforcement.
  - **Frontend (Pending)**: Wallet adapter integration, staking dashboard UI, tier progression tracker
- **Burn Service**: Automated harvest, withdraw, and burn cycle for token management (pending implementation).

### Feature Specifications
- **Pricing Configurator**: Agents can configure bid/ask spreads, FX buffers, and view live pricing previews and order limits.
- **Homepage**: Displays live marketplace metrics (total liquidity, 24h volume, agents by tier, supported currencies).
- **Admin Panel**: Provides controls for system configuration, including burn rate adjustment.

#### Agent Portal Features (Implemented - November 2025)
- **Transactions Page** (`/dashboard/transactions`): Comprehensive transaction history with pagination (10/page), date-range filters (today/7d/30d/90d), transaction type/status filters, search by ID/wallet, detailed transaction cards showing customer info, amounts, rates, commissions earned, and safe decimal formatting for all monetary values.

- **Commissions Page** (`/dashboard/commissions`): Complete commission tracking with breakdown by transaction type, tier progression tracker with visual progress bar and monthly volume calculation, interactive monthly earnings chart (last 6 months) using recharts LineChart with YYYY-MM format for reliable sorting, sortable commission history table, and CSV export with proper escaping for commas/quotes/newlines.

- **Analytics Page** (`/dashboard/analytics`): Advanced analytics dashboard with transaction volume trends (dual-axis LineChart showing daily TKOIN volume and transaction count with chronological YYYY-MM-DD sorting), currency distribution (PieChart using actual fiatCurrency from payment requests via backend join), customer retention metrics (new vs returning customers with repeat rate calculation), and commission analysis by transaction type (BarChart showing volume vs commission). Backend extended with `/api/agents/me/analytics` endpoint that left-joins transactions with paymentRequests to provide enriched data including fiatCurrency and fiatAmount. Time-range filtering (7d/30d/90d/all) implemented on frontend.

- **Inventory & Funding Page** (`/dashboard/inventory`): Complete payment flow UI with agent balance/limits dashboard, payment request creation form (fiat amount + multi-currency selection), QR code generation using qrcode.react library (QRCodeSVG component), payment request history with status badges (pending/completed/expired/cancelled), collapsible raw JSON data viewer for debugging. Backend endpoints: GET `/api/payment-requests/me` for agent's payment requests, POST `/api/payment-requests` with Zod validation, PricingService integration for automatic Tkoin amount calculation, user-friendly 400 errors for missing pricing configurations, proper decimal handling (.toString() for storage), 5-minute expiry, and comprehensive NaN prevention (frontend isNaN() validation, backend z.number().positive()).

### System Design Choices
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Node.js + Express + PostgreSQL + Drizzle ORM
- **Blockchain**: Solana (Token-2022) + @solana/web3.js
- **Auth**: Replit Auth (OpenID Connect)
- **Database**: PostgreSQL (Neon-backed)

## External Dependencies
- **Solana Blockchain**: For Token-2022 smart contracts and blockchain operations.
- **Sovereign Platforms** (multi-tenant):
  - **BetWin Casino** (flagship): Integrated via webhooks for credit synchronization
  - Future platforms: Metaverses, DAOs, social economies, other gaming platforms
- **Replit Auth**: For user authentication and authorization.
- **PostgreSQL (Neon)**: As the primary database for persistence.
- **Jupiter**: Planned integration for stablecoin swap engine (USDT/USDC/EURt to Tkoin).

## Protocol Positioning
Tkoin Protocol operates as **infrastructure-as-a-service** for sovereign digital economies:
- **Not a Platform**: We don't compete with casinos, metaverses, or social apps
- **Liquidity Layer**: We provide the agent network and token rails
- **Revenue Model**: Transaction fees + API licensing to sovereign platforms
- **Network Effect**: More platforms = deeper liquidity = better rates for all users