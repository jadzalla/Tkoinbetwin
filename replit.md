# Tkoin Ecosystem

## Overview
Tkoin is a comprehensive Solana Token-2022 ecosystem designed to integrate with the 1-Stake/BetWin gaming platform. Its primary purpose is to facilitate the conversion between cryptocurrency and casino credits through a network of approved agents who serve as liquidity providers and money service operators. The project aims to create a robust, deflationary token economy with a focus on seamless user experience, agent-driven liquidity, and secure blockchain integration.

## User Preferences
- Use TypeScript for type safety
- Follow fullstack_js development guidelines
- Maintain clean crypto-themed UI
- Prioritize security for blockchain operations
- Comprehensive audit logging for compliance

## System Architecture
The Tkoin ecosystem comprises a Solana SPL Token-2022 with a transfer fee extension (1% burn on deposits, configurable), an Agent Exchange System for liquidity provision, a Blockchain Monitor for deposit detection, and various web interfaces including a Public Homepage, Agent Portal, and Admin Panel. Integration with the 1-Stake platform is handled via webhooks for credit synchronization.

### UI/UX Decisions
The frontend utilizes React, TypeScript, Vite, Tailwind CSS, and shadcn/ui. The design adheres to professional cryptocurrency exchange aesthetics with purple branding and a comprehensive component library. The Agent Portal features a Shadcn Sidebar navigation for intuitive access to dashboards, pricing configurations, transactions, commissions, analytics, inventory, and settings.

### Technical Implementations
- **Token Economics**: Max supply of 1,000,000,000 TKOIN (1 Billion) with a soft-peg of 1 TKOIN = 100 Credits. It features a configurable 0-2% burn on deposits to a treasury wallet and adjustable transfer fees. Deflationary levers include the base burn rate, future buyback programs, agent staking, and promotional events.
- **Agent System**: Agents are tiered (Basic, Verified, Premium) with varying daily/monthly transaction limits and commission structures. They manage Tkoin inventory by buying from users (redemptions) and selling to users (purchases), earning commissions on both.
- **Payment Flows**: Supports bidirectional exchange through agents, including user purchases of Tkoin from agents, user deposits to the 1-Stake platform, user withdrawals from 1-Stake, and user sales of Tkoin to agents. QR code payments facilitate transactions.
- **Webhook Infrastructure**: A robust webhook delivery system for secure communication with the 1-Stake platform, featuring HMAC-SHA256 signatures, timestamp binding, DoS protection, and exponential backoff retry logic.
- **Authentication & Authorization**: Replit Auth (OpenID Connect) with session management and a three-tier access control system (user, agent, admin).
- **Burn Service**: Automated harvest, withdraw, and burn cycle for token management.

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
- **1-Stake/BetWin Platform**: Integrated via webhooks for credit synchronization.
- **Replit Auth**: For user authentication and authorization.
- **PostgreSQL (Neon)**: As the primary database for persistence.
- **Jupiter**: Planned integration for stablecoin swap engine (USDT/USDC/EURt to Tkoin).