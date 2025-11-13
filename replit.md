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
- **Token Economics**: Max supply of 100,000,000 TKOIN with a soft-peg of 1 TKOIN = 100 Credits. It features a configurable 0-2% burn on deposits to a treasury wallet and adjustable transfer fees. Deflationary levers include the base burn rate, future buyback programs, agent staking, and promotional events.
- **Agent System**: Agents are tiered (Basic, Verified, Premium) with varying daily/monthly transaction limits and commission structures. They manage Tkoin inventory by buying from users (redemptions) and selling to users (purchases), earning commissions on both.
- **Payment Flows**: Supports bidirectional exchange through agents, including user purchases of Tkoin from agents, user deposits to the 1-Stake platform, user withdrawals from 1-Stake, and user sales of Tkoin to agents. QR code payments facilitate transactions.
- **Webhook Infrastructure**: A robust webhook delivery system for secure communication with the 1-Stake platform, featuring HMAC-SHA256 signatures, timestamp binding, DoS protection, and exponential backoff retry logic.
- **Authentication & Authorization**: Replit Auth (OpenID Connect) with session management and a three-tier access control system (user, agent, admin).
- **Burn Service**: Automated harvest, withdraw, and burn cycle for token management.

### Feature Specifications
- **Pricing Configurator**: Agents can configure bid/ask spreads, FX buffers, and view live pricing previews and order limits.
- **Homepage**: Displays live marketplace metrics (total liquidity, 24h volume, agents by tier, supported currencies).
- **Admin Panel**: Provides controls for system configuration, including burn rate adjustment.

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