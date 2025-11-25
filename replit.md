# Tkoin Protocol - Sovereignty Stack

## Overview
Tkoin Protocol is a foundational liquidity layer for sovereign digital economies, built on Solana Token-2022. It enables seamless fiat-to-token conversion through a decentralized network of liquidity agents. The protocol allows multiple platforms (e.g., gaming, metaverses, DAOs) to share a common liquidity pool while maintaining their unique user experiences and economics. Its flagship application, BetWin casino, demonstrates instant deposits and withdrawals, bypassing traditional payment processors, aiming to create an interconnected ecosystem of sovereign digital economies.

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
- **Agent Staking System**: Tier-based access control requiring TKOIN staking (30-day lock-up, 10,000 TKOIN minimum, 10% early withdrawal penalty).
- **Agent Slashing System**: Admin-enforced penalty system for agent violations (Minor: 10%, Major: 25%, Critical: 50% slash), with an approval workflow and audit trail.
- **Hybrid Agent Registration System**: Dual-path onboarding: Permissionless Instant Registration for Basic Tier (no KYC) and Traditional KYC Application for Verified/Premium Tiers.
- **P2P Marketplace**: Features an atomic escrow system, defined order states, multiple payment methods, in-app chat, payment proofs, and timed transactions. It operates with 0% on-chain transfer fees and agent spreads for revenue.
- **Burn Proposal System**: Manual approval workflow for token burns with safety features like network detection, configurable limits, cooldown periods, and multi-gate approval.
- **Analytics Dashboards**: Comprehensive admin dashboards for staking and slashing metrics and trends.
- **Security Hardening**: Includes webhook nonce tracking, platform rate limiting, IP-based rate limiting, trust proxy configuration, graceful shutdown, and admin endpoint protection.
- **Observability & Monitoring**: Structured logging with correlation IDs, health check endpoints (`/api/health/live`, `/api/health/ready`, `/api/health`) for comprehensive status.
- **BetWin Platform API Integration**: Fully integrated for real-time balance tracking, atomic deposits/withdrawals, and transaction history using HMAC-SHA256 authentication.

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

## BetWin Casino Integration (Completed)

### Production Status
- **Version:** v6.5 (Production Ready)
- **Last Updated:** November 25, 2025
- **Status:** All critical bugs resolved

### Token Configuration
| Parameter | Value |
|-----------|-------|
| Network | Solana Devnet |
| Mint Address | `9XPD1ZcAtNZgc1pGYYL3Z4W3mNqHKmqKDsUtsKKzAJE5` |
| Treasury Wallet | `953CKYH169xXxaNKVwLT9z9s38TEg1d2pQsY7d1Lv6dD` |
| Token Program | Token-2022 (`TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`) |
| Decimals | 9 |
| Conversion | 100 CREDIT = 1 TKOIN |

### Version History
| Version | Key Fixes |
|---------|-----------|
| v6.1 | Correct Token-2022 mint address (was using treasury) |
| v6.3 | Dual element ID support (hyphenated + camelCase) |
| v6.4 | Phantom auto-connect prevention with forced popup |
| v6.5 | Account ID + Transaction history display fixes |
| v6.6 | Buffer polyfill fix - deposits now work |

### Deployment Files
All files for BetWin deployment are in `attached_assets/BETWIN_FIXES/`:
- `tkoin-wallet-v6.6-FIXED.js` - Current production JavaScript
- `tkoin-wallet.blade.php` - Laravel blade template
- `TkoinController.php` - API controller
- `web.php` - Route definitions
- `COMPLETE_INTEGRATION_HISTORY.md` - Full documentation

### Favicon Fix
Add to layout template head:
```html
<link rel="icon" type="image/png" href="/images/favicon/favicon.png">
```