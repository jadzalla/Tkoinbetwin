# Tkoin Protocol - Sovereignty Stack

## Overview
Tkoin Protocol is a foundational liquidity layer for sovereign digital economies built on Solana Token-2022. It facilitates fiat-to-token conversion via a decentralized network of liquidity agents, allowing various platforms (gaming, metaverses, DAOs) to share a common liquidity pool while maintaining their distinct user experiences and economics. The protocol aims to establish an interconnected ecosystem of sovereign digital economies, demonstrated by its flagship application, BetWin casino, which features instant deposits and withdrawals bypassing traditional payment processors.

## User Preferences
- Use TypeScript for type safety
- Follow fullstack_js development guidelines
- Maintain clean crypto-themed UI
- Prioritize security for blockchain operations
- Comprehensive audit logging for compliance

## System Architecture
The Tkoin Protocol is a multi-tenant liquidity infrastructure comprising a Token Layer (Solana SPL Token-2022), an Agent Network, a Platform Connector, Web Interfaces (Public Homepage, Agent Portal, Admin Panel), and a flagship application (BetWin casino).

### UI/UX Decisions
The frontend utilizes React, TypeScript, Vite, Tailwind CSS, and shadcn/ui, characterized by a professional cryptocurrency exchange aesthetic with purple branding. The Agent Portal includes a Shadcn Sidebar for navigation.

### Technical Implementations
- **Token Economics**: Max supply of 1 billion TKOIN, 9 decimals, soft-pegged at 1 TKOIN = 100 Credits, with configurable burn on deposits (0-2%) and adjustable transfer fees.
- **Agent System**: Tiered agents (Basic, Verified, Premium) manage Tkoin inventory for user transactions with varying limits and commissions. Features include a staking system for tier access (30-day lock-up, 10,000 TKOIN minimum, 10% early withdrawal penalty) and a slashing system for violations (Minor: 10%, Major: 25%, Critical: 50% slash). Hybrid registration supports both permissionless basic tier and KYC-based higher tiers.
- **Payment Flows**: Supports bidirectional exchange (purchases, deposits, withdrawals, sales) through agents, including QR code payments.
- **Webhook Infrastructure**: Robust, platform-agnostic system with HMAC-SHA256 signatures, timestamp binding, DoS protection, and exponential backoff retry.
- **Sovereign Platform Management**: Admin interface for platform registration and webhook credential management.
- **Authentication & Authorization**: Replit Auth (OpenID Connect) with session management and role-based access control ('user', 'agent', 'admin').
- **Token Deployment System**: Solana Token-2022 deployment infrastructure with Transfer Fee and Metadata extensions, configurable via Admin UI.
- **P2P Marketplace**: Features an atomic escrow system, defined order states, multiple payment methods, in-app chat, payment proofs, and timed transactions, operating with 0% on-chain transfer fees and agent spreads.
- **Burn Proposal System**: Manual approval workflow for token burns with safety features like network detection, configurable limits, cooldown periods, and multi-gate approval.
- **Analytics Dashboards**: Comprehensive admin dashboards for staking and slashing metrics and trends.
- **Security Hardening**: Includes webhook nonce tracking, platform rate limiting, IP-based rate limiting, trust proxy configuration, graceful shutdown, and admin endpoint protection.
- **Observability & Monitoring**: Structured logging with correlation IDs, health check endpoints (`/api/health/live`, `/api/health/ready`, `/api/health`).
- **BetWin Platform API Integration**: Fully integrated for real-time balance tracking, atomic deposits/withdrawals, and transaction history using HMAC-SHA256 authentication.
- **BetWin v7.0 Enhancements** (Nov 2025):
  - Transaction filtering: Filter by type (deposit/withdrawal), status (completed/pending/failed), and date range
  - Export functionality: Download transaction history as CSV or JSON with filter support
  - Pagination: Server-side pagination with offset-based navigation
  - P2P Marketplace integration: BetWin users can purchase TKOIN from liquidity agents with fiat
  - Debounced filter controls for optimal UX

### Feature Specifications
- **Pricing Configurator**: Agents can set bid/ask spreads and FX buffers.
- **Homepage**: Displays live marketplace metrics (liquidity, volume).
- **Admin Panel**: Central control for system configuration, including burn rate.
- **Agent Portal**: Includes transaction history, commission tracking, analytics, and inventory/funding management.

### System Design Choices
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Node.js + Express + PostgreSQL + Drizzle ORM
- **Blockchain**: Solana (Token-2022) + @solana/web3.js
- **Auth**: Replit Auth (OpenID Connect)
- **Database**: PostgreSQL (Neon-backed)

## External Dependencies
- **Solana Blockchain**: For Token-2022 smart contracts and blockchain operations.
- **Sovereign Platforms**: BetWin Casino (integrated with Tkoin wallet widget), with future integrations planned for metaverses, DAOs, and other gaming platforms.
- **Replit Auth**: For user authentication and authorization.
- **PostgreSQL (Neon)**: Primary database.
- **Jupiter**: Planned for stablecoin swap engine integration.