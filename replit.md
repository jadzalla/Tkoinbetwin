# Tkoin Protocol - Sovereignty Stack

## Overview
Tkoin Protocol is a foundational liquidity layer for sovereign digital economies, built on Solana Token-2022. It enables seamless fiat-to-token conversion through a decentralized network of liquidity agents. The protocol allows multiple platforms (e.g., gaming, metaverses, DAOs) to share a common liquidity pool while maintaining their unique user experiences and economics. Its flagship application, BetWin casino, demonstrates instant deposits and withdrawals, bypassing traditional payment processors.

## User Preferences
- Use TypeScript for type safety
- Follow fullstack_js development guidelines
- Maintain clean crypto-themed UI
- Prioritize security for blockchain operations
- Comprehensive audit logging for compliance

## System Architecture
The Tkoin Protocol is a multi-tenant liquidity infrastructure comprising:
- **Token Layer**: Solana SPL Token-2022 with transfer fee extension.
- **Agent Network**: Decentralized liquidity providers across integrated platforms.
- **Platform Connector**: Webhook-based integration for sovereign platforms.
- **Web Interfaces**: Public Homepage, Agent Portal, and Admin Panel.
- **Flagship App**: BetWin casino as the reference implementation.

### UI/UX Decisions
The frontend uses React, TypeScript, Vite, Tailwind CSS, and shadcn/ui, adopting a professional cryptocurrency exchange aesthetic with purple branding. The Agent Portal features a Shadcn Sidebar for navigation.

### Technical Implementations
- **Token Economics**: Max supply of 1 billion TKOIN, 9 decimals, with a soft-peg of 1 TKOIN = 100 Credits, featuring configurable burn on deposits (0-2%) and adjustable transfer fees.
- **Agent System**: Tiered agents (Basic, Verified, Premium) with varying transaction limits and commission structures, managing Tkoin inventory for user purchases and redemptions.
- **Payment Flows**: Supports bidirectional exchange (purchases, deposits, withdrawals, sales) through agents, including QR code payments.
- **Webhook Infrastructure**: Robust, platform-agnostic system with HMAC-SHA256 signatures, timestamp binding, DoS protection, and exponential backoff retry.
- **Sovereign Platform Management**: Admin interface for platform registration and webhook credential management.
- **Authentication & Authorization**: Replit Auth (OpenID Connect) with session management and role-based access control ('user', 'agent', 'admin').
- **Token Deployment System**: Solana Token-2022 deployment infrastructure with Transfer Fee and Metadata extensions, configurable via Admin UI.
- **Agent Staking System**: Tier-based access control requiring TKOIN staking (30-day lock-up, 10,000 TKOIN minimum, 10% early withdrawal penalty). Implemented with hybrid database tracking for future on-chain migration.
- **Agent Slashing System**: Admin-enforced penalty system for agent violations (Minor: 10%, Major: 25%, Critical: 50% slash), with an approval workflow and audit trail.
- **Hybrid Agent Registration System**: Dual-path onboarding:
    - **Permissionless Instant Registration**: For Basic Tier, requires 10,000+ TKOIN in Solana wallet (no KYC).
    - **Traditional KYC Application**: For Verified/Premium Tiers, involves admin review and approval of submitted KYC documents.
- **Burn Proposal System**: Manual approval workflow for token burns with safety features like network detection, configurable limits, cooldown periods, and multi-gate approval.
- **Analytics Dashboards**: Comprehensive admin dashboards for staking and slashing metrics and trends.
- **Security Hardening (Production-Ready)**:
    - **Webhook Nonce Tracking**: Server-side timestamp validation prevents replay attacks within 5-minute window.
    - **Platform Rate Limiting**: Per-platform API throttling with strict enforcement (missing/zero limits = blocked).
    - **IP-Based Rate Limiting**: Public endpoints protected (100 req/15min), auth endpoints (20 req/15min).
    - **Trust Proxy Configuration**: Single trusted hop (Replit load balancer) prevents IP spoofing.
    - **Graceful Shutdown**: SIGTERM/SIGINT/SIGQUIT handlers ensure cleanup of interval timers.
    - **Admin Endpoint Protection**: All 50+ admin routes secured with isAuthenticated + isAdmin middleware.
- **Observability & Monitoring (Production-Ready)**:
    - **Structured Logging**: JSON-formatted logs with correlation IDs (UUIDs) for distributed tracing, consistent log levels (INFO/WARN/ERROR), structured context (timestamp, method, path, statusCode, duration).
    - **Health Check Endpoints**:
        - `/api/health/live`: Liveness probe (200 if server running).
        - `/api/health/ready`: Readiness probe (checks database + Solana RPC connectivity, returns 503 if unhealthy).
        - `/api/health`: Comprehensive health status with uptime, version, and detailed service checks.
    - **Correlation IDs**: Every HTTP request tagged with unique UUID for end-to-end request tracing across logs.

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
- **Sovereign Platforms**: BetWin Casino (integrated), with future integrations planned for metaverses, DAOs, and other gaming platforms.
- **Replit Auth**: For user authentication and authorization.
- **PostgreSQL (Neon)**: Primary database.
- **Jupiter**: Planned for stablecoin swap engine integration.