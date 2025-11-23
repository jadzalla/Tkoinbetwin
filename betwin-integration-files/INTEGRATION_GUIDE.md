# BetWin Casino - Tkoin Protocol Integration Guide

Complete guide for integrating Tkoin Protocol into BetWin Casino, enabling three user scenarios:

1. **Phantom Wallet Direct Deposits** - Instant TKOIN → Credits conversion
2. **P2P Marketplace Purchases** - Buy TKOIN from agents using fiat payment methods
3. **Withdrawals** - Convert Credits → TKOIN → Optional fiat via P2P

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Installation Steps](#installation-steps)
4. [Scenario 1: Phantom Wallet Deposits](#scenario-1-phantom-wallet-deposits)
5. [Scenario 2: P2P Marketplace Purchases](#scenario-2-p2p-marketplace-purchases)
6. [Scenario 3: Withdrawals](#scenario-3-withdrawals)
7. [Configuration](#configuration)
8. [Database Setup](#database-setup)
9. [Testing](#testing)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **Laravel 11.0** (BetWin's current version)
- **PHP 8.1+**
- **PostgreSQL** (recommended) or MySQL
- **Tkoin Protocol Platform API credentials**:
  - Platform Token: `ptk_xNm2aoTy8AY1QcD-F9wTwMwdzyZjA97JS1h8wa1i_8A`
  - API Secret: `ab0d6715b594c415d4e354c03024ef6e`
- **Solana Configuration**:
  - Treasury Wallet Address (provided by Tkoin)
  - TKOIN Mint Address (provided by Tkoin)
  - Solana RPC endpoint (Devnet or Mainnet)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                       BetWin Casino                         │
│                                                             │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ Phantom Wallet │  │ P2P Marketplace │  │ Withdrawals  │ │
│  │ Direct Deposit │  │ (Fiat → TKOIN)  │  │ (Credits →   │ │
│  │                │  │                 │  │  TKOIN/Fiat) │ │
│  └───────┬────────┘  └────────┬────────┘  └──────┬───────┘ │
│          │                    │                   │         │
│          └────────────────────┴───────────────────┘         │
│                             │                               │
│                   ┌─────────▼────────┐                      │
│                   │ TkoinService.php │                      │
│                   │ (Platform API)   │                      │
│                   └─────────┬────────┘                      │
└─────────────────────────────┼───────────────────────────────┘
                              │
                              │ HMAC-SHA256
                              │ Authentication
                              ▼
                   ┌──────────────────────┐
                   │  Tkoin Protocol API  │
                   │                      │
                   │  - Platform API      │
                   │  - Verify Deposit    │
                   │  - P2P Marketplace   │
                   └──────────────────────┘
```

### Key Design Decisions

1. **Platform API Integration**: All deposits/withdrawals use Tkoin's Platform API for atomic balance updates
2. **Client-Side Wallet Integration**: Phantom wallet operations happen in browser (BetWin never sees private keys)
3. **P2P Marketplace Access**: Users are redirected to Tkoin's marketplace (not embedded iframe) to avoid breaking BetWin's existing functionality

---

## Installation Steps

### Step 1: Add Files to BetWin Project

Copy the provided files to your Laravel project:

```bash
# Copy PHP controller
cp TkoinController.php app/Http/Controllers/

# Copy JavaScript file
cp phantom-deposit.js public/js/

# Copy Blade template
cp tkoin-wallet.blade.php resources/views/tkoin/
```

### Step 2: Create TkoinService (Platform API Wrapper)

Create `app/Services/TkoinService.php`:

```php
<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TkoinService
{
    protected $apiBase;
    protected $platformToken;
    protected $apiSecret;

    public function __construct()
    {
        $this->apiBase = config('services.tkoin.api_base');
        $this->platformToken = config('services.tkoin.platform_token');
        $this->apiSecret = config('services.tkoin.api_secret');
    }

    /**
     * Generate HMAC-SHA256 signature for Platform API requests
     */
    protected function generateSignature($body, $timestamp)
    {
        $payload = json_encode($body);
        return hash_hmac('sha256', $timestamp . '.' . $payload, $this->apiSecret);
    }

    /**
     * Generate unique nonce for request
     */
    protected function generateNonce()
    {
        return bin2hex(random_bytes(16));
    }

    /**
     * Make authenticated request to Platform API
     */
    protected function makeRequest($method, $endpoint, $body = [])
    {
        $timestamp = (string)time();
        $nonce = $this->generateNonce();
        $signature = $this->generateSignature($body, $timestamp);

        $response = Http::withHeaders([
            'X-Platform-Token' => $this->platformToken,
            'X-Timestamp' => $timestamp,
            'X-Nonce' => $nonce,
            'X-Signature' => $signature,
            'Content-Type' => 'application/json',
        ])->{strtolower($method)}($this->apiBase . $endpoint, $body);

        return $response->json();
    }

    /**
     * Get user's balance
     */
    public function getBalance($platformUserId)
    {
        return $this->makeRequest('GET', "/api/platform/balance/{$platformUserId}");
    }

    /**
     * Get user's transaction history
     */
    public function getTransactions($platformUserId, $limit = 50)
    {
        return $this->makeRequest('GET', "/api/platform/transactions/{$platformUserId}?limit={$limit}");
    }

    /**
     * Create deposit (called after Phantom verification)
     */
    public function createDeposit($platformUserId, $tkoinAmount, $settlementId, $metadata = [])
    {
        // Convert TKOIN to credits (1 TKOIN = 100 Credits)
        $creditsAmount = $tkoinAmount * 100;

        $response = $this->makeRequest('POST', '/api/platform/deposits', [
            'platform_user_id' => $platformUserId,
            'credits_amount' => $creditsAmount,
            'platform_settlement_id' => $settlementId,
            'metadata' => $metadata,
        ]);

        return $response;
    }

    /**
     * Create withdrawal
     */
    public function createWithdrawal($platformUserId, $creditsAmount, $destinationWallet, $metadata = [])
    {
        $response = $this->makeRequest('POST', '/api/platform/withdrawals', [
            'platform_user_id' => $platformUserId,
            'credits_amount' => $creditsAmount,
            'destination_wallet' => $destinationWallet,
            'metadata' => $metadata,
        ]);

        return $response;
    }
}
```

### Step 3: Update Configuration

Add to `config/services.php`:

```php
'tkoin' => [
    'api_base' => env('TKOIN_API_BASE', 'https://your-tkoin-protocol-domain.com'),
    'platform_token' => env('TKOIN_PLATFORM_TOKEN'),
    'api_secret' => env('TKOIN_API_SECRET'),
    'treasury_wallet' => env('TKOIN_TREASURY_WALLET'),
    'mint_address' => env('TKOIN_MINT_ADDRESS'),
    'marketplace_url' => env('TKOIN_MARKETPLACE_URL'),
    'burn_rate' => env('TKOIN_BURN_RATE', 1), // Default 1%
],
```

Add to `.env`:

```env
TKOIN_API_BASE=https://your-tkoin-protocol-domain.com
TKOIN_PLATFORM_TOKEN=ptk_xNm2aoTy8AY1QcD-F9wTwMwdzyZjA97JS1h8wa1i_8A
TKOIN_API_SECRET=ab0d6715b594c415d4e354c03024ef6e
TKOIN_TREASURY_WALLET=YOUR_TREASURY_WALLET_ADDRESS
TKOIN_MINT_ADDRESS=YOUR_TKOIN_MINT_ADDRESS
TKOIN_MARKETPLACE_URL=https://your-tkoin-protocol-domain.com/marketplace
TKOIN_BURN_RATE=1
```

### Step 4: Add Routes

Add to `routes/web.php`:

```php
use App\Http\Controllers\TkoinController;

Route::middleware(['auth'])->group(function () {
    // Wallet UI
    Route::get('/tkoin/wallet', [TkoinController::class, 'showWallet'])->name('tkoin.wallet');
    
    // Phantom deposit verification
    Route::post('/tkoin/verify-deposit', [TkoinController::class, 'verifyDeposit'])->name('tkoin.verify');
    
    // Withdrawal
    Route::post('/tkoin/withdraw', [TkoinController::class, 'withdraw'])->name('tkoin.withdraw');
    
    // P2P Marketplace redirect
    Route::get('/tkoin/marketplace', [TkoinController::class, 'redirectToMarketplace'])->name('tkoin.marketplace');
});
```

---

## Scenario 1: Phantom Wallet Deposits

### User Flow

1. User navigates to `/tkoin/wallet`
2. Clicks "Connect Phantom Wallet"
3. Approves connection in Phantom extension
4. Enters TKOIN amount to deposit
5. Clicks "Deposit Now"
6. Signs transaction in Phantom
7. BetWin verifies transaction on-chain
8. Credits are instantly added to user's account

### Technical Flow

```
User Browser                BetWin Backend              Tkoin Protocol
     │                            │                           │
     ├─1. Connect Phantom         │                           │
     │   (client-side)            │                           │
     │                            │                           │
     ├─2. Sign transaction        │                           │
     │   (Phantom wallet)          │                           │
     │                            │                           │
     ├─3. POST /tkoin/verify────►│                           │
     │   {signature, amount}      │                           │
     │                            │                           │
     │                            ├─4. POST /api/verify────►│
     │                            │   deposit                 │
     │                            │                           │
     │                            │◄─5. {success, amount}────┤
     │                            │                           │
     │                            ├─6. POST /api/platform/─►│
     │                            │   deposits                │
     │                            │                           │
     │                            │◄─7. {credits_amount}─────┤
     │                            │                           │
     │◄─8. {success, credits}────┤                           │
     │                            │                           │
```

### Implementation Notes

- **Security**: BetWin never handles private keys (all signing happens in Phantom)
- **Verification**: Two-step verification (on-chain + duplicate check)
- **Atomicity**: Platform API handles balance updates atomically
- **Burn Rate**: Automatically applied by Platform API (configurable 0-2%)

---

## Scenario 2: P2P Marketplace Purchases

### User Flow

1. User clicks "P2P Marketplace" tab
2. Redirected to Tkoin's public marketplace
3. Browses agents and payment methods
4. Creates order with agent
5. Completes fiat payment outside platform
6. Uploads payment proof
7. Agent releases TKOIN to user's wallet
8. User can deposit TKOIN to BetWin via Phantom

### Technical Flow

```
User                  BetWin              Tkoin Marketplace
 │                      │                        │
 ├─1. Click P2P tab────►│                        │
 │                      │                        │
 │                      ├─2. Redirect to────────►│
 │                      │   /marketplace         │
 │                      │                        │
 │◄─────────────────────┴────────────────────────┤
 │                                               │
 ├─3. Browse agents & create order──────────────►│
 │                                               │
 ├─4. Pay agent via Bank/PayPal/M-Pesa          │
 │   (external to platform)                      │
 │                                               │
 ├─5. Upload payment proof──────────────────────►│
 │                                               │
 │◄─6. Agent releases TKOIN to user wallet──────┤
 │                                               │
 ├─7. Return to BetWin                           │
 │                                               │
 ├─8. Deposit TKOIN via Phantom──────────────────┤
 │   (See Scenario 1)                            │
```

### Implementation Notes

- **No Backend Integration Required**: Users are redirected to external marketplace
- **Payment Methods**: Bank Transfer, PayPal, M-Pesa, and more (configured by agents)
- **Escrow Protection**: TKOIN is locked in escrow until payment confirmed
- **No Fees**: 0% on-chain transfer fees (agents set their own spreads)

---

## Scenario 3: Withdrawals

### User Flow

1. User enters credits to withdraw
2. Provides Solana wallet address
3. Clicks "Withdraw to TKOIN"
4. Platform API converts credits → TKOIN
5. TKOIN sent to user's wallet
6. **(Optional)** User can sell TKOIN on P2P marketplace for fiat

### Technical Flow

```
User Browser            BetWin Backend          Tkoin Protocol
     │                        │                       │
     ├─1. POST /tkoin/────►│                       │
     │   withdraw             │                       │
     │   {credits, wallet}    │                       │
     │                        │                       │
     │                        ├─2. POST /api/───────►│
     │                        │   platform/           │
     │                        │   withdrawals         │
     │                        │                       │
     │                        │◄─3. {tkoin_amount}───┤
     │                        │                       │
     │                        │   (Tkoin Protocol     │
     │                        │    sends TKOIN to     │
     │                        │    user's wallet)     │
     │                        │                       │
     │◄─4. {success}─────────┤                       │
     │                        │                       │
     ├─5. (Optional) Sell────┴───────────────────────►│
     │   TKOIN on P2P for                            │
     │   fiat                                        │
```

### Implementation Notes

- **Two-Step Process**: 
  1. Credits → TKOIN (automatic)
  2. TKOIN → Fiat (optional, via P2P marketplace)
- **Conversion Rate**: 100 Credits = 1 TKOIN
- **Settlement Time**: TKOIN transfer typically completes within 1-2 minutes

---

## Database Setup

### Create Migration

```bash
php artisan make:migration create_tkoin_deposits_table
```

Migration file:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tkoin_deposits', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('solana_signature')->unique();
            $table->string('sender_wallet');
            $table->decimal('tkoin_amount', 18, 8);
            $table->decimal('credits_amount', 18, 2);
            $table->decimal('burn_amount', 18, 8)->default(0);
            $table->string('status')->default('pending');
            $table->string('platform_transaction_id')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->index(['user_id', 'status']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tkoin_deposits');
    }
};
```

Run migration:

```bash
php artisan migrate
```

---

## Testing

### Test Phantom Deposit (Scenario 1)

1. **Install Phantom Wallet**:
   - Visit https://phantom.app
   - Install browser extension
   - Create or import wallet
   - Switch to Devnet (Settings → Developer Settings)

2. **Get Test TKOIN**:
   - Request test TKOIN from Tkoin team
   - Or use faucet if available

3. **Test Deposit**:
   - Navigate to `/tkoin/wallet`
   - Connect Phantom
   - Enter amount (min: 10 TKOIN)
   - Click "Deposit Now"
   - Approve in Phantom
   - Verify credits added

### Test P2P Marketplace (Scenario 2)

1. Visit `/tkoin/marketplace` or click P2P tab
2. Verify redirect to Tkoin's marketplace
3. Browse available agents
4. Verify payment methods displayed
5. (Optional) Create test order

### Test Withdrawal (Scenario 3)

1. Navigate to Withdraw tab
2. Enter credits amount
3. Provide Solana wallet address
4. Submit withdrawal
5. Verify TKOIN received in wallet (check Phantom)

---

## Configuration Reference

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `TKOIN_API_BASE` | Tkoin Protocol API base URL | `https://tkoin-protocol.com` |
| `TKOIN_PLATFORM_TOKEN` | Platform API authentication token | `ptk_xNm2aoTy...` |
| `TKOIN_API_SECRET` | HMAC signing secret | `ab0d6715b594...` |
| `TKOIN_TREASURY_WALLET` | Treasury wallet address | `GmxY9...` |
| `TKOIN_MINT_ADDRESS` | TKOIN token mint address | `4zMMC9...` |
| `TKOIN_MARKETPLACE_URL` | P2P marketplace URL | `https://tkoin-protocol.com/marketplace` |
| `TKOIN_BURN_RATE` | Burn rate percentage (0-2%) | `1` |

### Token Economics

- **Conversion Rate**: 1 TKOIN = 100 Credits (configurable)
- **Burn Rate**: 0-2% on deposits (default: 1%)
- **Transfer Fees**: 0% on-chain (agents may set P2P spreads)
- **Minimum Deposit**: 10 TKOIN
- **Minimum Withdrawal**: 100 Credits (1 TKOIN)

---

## Troubleshooting

### Phantom Connection Issues

**Problem**: "Phantom wallet not detected"

**Solutions**:
- Ensure Phantom extension is installed
- Refresh the page
- Check browser console for errors
- Try in different browser

---

### Transaction Verification Fails

**Problem**: "Transaction verification failed"

**Solutions**:
1. Check transaction signature is correct
2. Verify transaction was sent to correct treasury wallet
3. Ensure transaction is confirmed (not pending)
4. Check Tkoin Protocol API is accessible
5. Verify Platform API credentials are correct

**Debug**:
```bash
# Check Laravel logs
tail -f storage/logs/laravel.log

# Check transaction on Solscan
https://solscan.io/tx/{SIGNATURE}?cluster=devnet
```

---

### Platform API Authentication Errors

**Problem**: "Invalid signature" or "401 Unauthorized"

**Solutions**:
1. Verify `TKOIN_PLATFORM_TOKEN` matches provided token
2. Check `TKOIN_API_SECRET` is correct
3. Ensure system time is accurate (timestamp validation)
4. Verify HMAC signature generation matches spec

**Test Authentication**:
```php
// Test Platform API connection
Route::get('/test-tkoin-api', function() {
    $service = new \App\Services\TkoinService();
    $response = $service->makeRequest('GET', '/api/health');
    return response()->json($response);
});
```

---

### Balance Not Updating

**Problem**: Deposit succeeds but balance doesn't update

**Solutions**:
1. Check Platform API response for errors
2. Verify webhook delivery (if configured)
3. Check database transaction logs
4. Ensure atomic transactions completed
5. Refresh balance display

---

## Security Best Practices

1. **Never Log Secrets**: Ensure API secret is never logged
2. **Verify Signatures**: Always verify transaction signatures on-chain
3. **Check Duplicates**: Prevent duplicate deposit processing
4. **Use HTTPS**: All API communication must use HTTPS
5. **Validate Amounts**: Always verify amounts match between frontend and blockchain
6. **Rate Limiting**: Implement rate limiting on verification endpoint
7. **User Authorization**: Verify user owns the transaction before crediting

---

## Support

For technical support or questions:

- **Tkoin Protocol Documentation**: [Link to docs]
- **Platform API Reference**: [Link to API docs]
- **Email**: support@tkoin.finance
- **Discord**: [Link to Discord]

---

## Appendix: API Endpoints

### BetWin Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/tkoin/wallet` | GET | Show wallet UI |
| `/tkoin/verify-deposit` | POST | Verify Phantom deposit |
| `/tkoin/withdraw` | POST | Initiate withdrawal |
| `/tkoin/marketplace` | GET | Redirect to P2P marketplace |

### Tkoin Protocol Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/verify-deposit` | POST | Verify on-chain transaction |
| `/api/platform/deposits` | POST | Create deposit (Platform API) |
| `/api/platform/withdrawals` | POST | Create withdrawal (Platform API) |
| `/api/platform/balance/{userId}` | GET | Get user balance (Platform API) |
| `/api/platform/transactions/{userId}` | GET | Get transaction history (Platform API) |
| `/marketplace` | GET | Public P2P marketplace |

---

## Changelog

### Version 1.0 (Current)
- Initial BetWin integration
- Phantom wallet deposits
- P2P marketplace redirect
- Withdrawal functionality
- Platform API integration

---

*Last Updated: November 23, 2025*
