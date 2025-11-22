# BetWin → Tkoin Protocol Integration Guide

**Status:** Production-Ready  
**Architecture:** Server-to-Server (Laravel Backend ↔ Tkoin Protocol Backend)  
**Last Updated:** 2025-11-22

---

## 🎯 Quick Start

This guide shows BetWin's backend team how to integrate with Tkoin Protocol using our server-to-server API. **No frontend changes to Replit endpoints required** - all integration happens in your Laravel backend.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  BetWin Frontend (Blade Templates)                      │
│      ↓ AJAX calls (Laravel routes)                      │
│  BetWin Backend (Laravel Controller)                    │
│      ↓ Server-to-server API calls                       │
│  Tkoin Protocol API (Authenticated with API Token)      │
│      ↓ Processes deposit/withdrawal                     │
│  Tkoin Protocol (Updates ledger)                        │
│      ↓ Sends webhook to BetWin                          │
│  BetWin Backend (Receives balance update webhook)       │
│      ↓ Updates local cache                              │
│  BetWin Frontend (Shows updated balance)                │
└─────────────────────────────────────────────────────────┘
```

**Key Points:**
- ✅ **BetWin owns**: Frontend UI, user experience, session management
- ✅ **Tkoin owns**: TKOIN ledger, blockchain operations, P2P marketplace
- ✅ **No CORS issues**: BetWin frontend never calls Tkoin directly
- ✅ **No auth conflicts**: Server-to-server uses API tokens, not user sessions
- ✅ **Webhooks**: Tkoin pushes balance updates to BetWin asynchronously

---

## 📋 Prerequisites

1. **BetWin Laravel Backend** - Your existing Laravel application
2. **Tkoin API Token** - Provided by Tkoin Protocol team
3. **Webhook Endpoint** - BetWin must expose an endpoint to receive webhooks
4. **HTTPS** - Required for production (API token security)

---

## 🔑 Step 1: Get Your API Credentials

Contact the Tkoin Protocol team to receive:

```env
# Add to your .env file
TKOIN_API_BASE_URL=https://[deployment-url]/api/platforms
TKOIN_API_TOKEN=ptk_abc123xyz...
TKOIN_WEBHOOK_SECRET=whsec_betwin_secret123...
TKOIN_PLATFORM_ID=platform_betwin
```

**Security:**
- ⚠️ **Never commit these to Git**
- ⚠️ **Never expose API token in frontend**
- ✅ Store in `.env` file (add to `.gitignore`)
- ✅ Use Laravel's `config('services.tkoin.api_token')`

---

## 🛠️ Step 2: Install Dependencies & Create Config

### Install HTTP Client (if needed)

```bash
composer require guzzlehttp/guzzle
```

### Create Tkoin Config File

Create `config/tkoin.php`:

```php
<?php

return [
    'api_base_url' => env('TKOIN_API_BASE_URL'),
    'api_token' => env('TKOIN_API_TOKEN'),
    'webhook_secret' => env('TKOIN_WEBHOOK_SECRET'),
    'platform_id' => env('TKOIN_PLATFORM_ID', 'platform_betwin'),
];
```

---

## 📦 Step 3: Create TkoinService

Create `app/Services/TkoinService.php`:

```php
<?php

namespace App\Services;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use Illuminate\Support\Facades\Log;

class TkoinService
{
    private Client $client;
    private string $baseUrl;
    private string $apiToken;
    private string $webhookSecret;
    private string $platformId;

    public function __construct()
    {
        $this->baseUrl = config('tkoin.api_base_url');
        $this->apiToken = config('tkoin.api_token');
        $this->webhookSecret = config('tkoin.webhook_secret');
        $this->platformId = config('tkoin.platform_id');

        $this->client = new Client([
            'base_uri' => $this->baseUrl,
            'timeout' => 30,
        ]);
    }

    /**
     * Generate HMAC signature for API request
     */
    private function generateSignature(array $body): array
    {
        $timestamp = time();
        $bodyJson = json_encode($body);
        $payload = "{$timestamp}.{$bodyJson}";
        $signature = hash_hmac('sha256', $payload, $this->webhookSecret);

        return [
            'X-Platform-Token' => $this->apiToken,
            'X-Timestamp' => (string) $timestamp,
            'X-Signature' => "sha256={$signature}",
            'Content-Type' => 'application/json',
        ];
    }

    /**
     * Get user's TKOIN and CREDIT balance
     */
    public function getUserBalance(string $userId): ?array
    {
        try {
            $url = "/{$this->platformId}/users/{$userId}/balance";
            
            // GET requests still need signature (empty body)
            $headers = $this->generateSignature([]);
            
            $response = $this->client->get($url, [
                'headers' => $headers,
            ]);

            $data = json_decode($response->getBody(), true);
            
            return [
                'tkoin_balance' => (float) $data['tkoinBalance'],
                'credits_balance' => (float) $data['creditsBalance'],
                'last_updated' => $data['lastUpdated'],
            ];
        } catch (GuzzleException $e) {
            Log::error('Tkoin balance fetch failed', [
                'userId' => $userId,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Initiate TKOIN deposit
     */
    public function initiateDeposit(string $userId, float $amount, string $method = 'p2p_marketplace'): ?array
    {
        try {
            $url = "/{$this->platformId}/deposits";
            
            $body = [
                'userId' => $userId,
                'amount' => (string) $amount,
                'method' => $method,
            ];
            
            $headers = $this->generateSignature($body);
            
            $response = $this->client->post($url, [
                'headers' => $headers,
                'json' => $body,
            ]);

            return json_decode($response->getBody(), true);
        } catch (GuzzleException $e) {
            Log::error('Tkoin deposit initiation failed', [
                'userId' => $userId,
                'amount' => $amount,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Initiate TKOIN withdrawal
     */
    public function initiateWithdrawal(string $userId, float $amount, ?string $solanaWallet = null): ?array
    {
        try {
            $url = "/{$this->platformId}/withdrawals";
            
            $body = [
                'userId' => $userId,
                'amount' => (string) $amount,
            ];
            
            if ($solanaWallet) {
                $body['solanaWallet'] = $solanaWallet;
            }
            
            $headers = $this->generateSignature($body);
            
            $response = $this->client->post($url, [
                'headers' => $headers,
                'json' => $body,
            ]);

            return json_decode($response->getBody(), true);
        } catch (GuzzleException $e) {
            Log::error('Tkoin withdrawal initiation failed', [
                'userId' => $userId,
                'amount' => $amount,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Get user transaction history
     */
    public function getTransactionHistory(string $userId, int $limit = 20): ?array
    {
        try {
            $url = "/{$this->platformId}/users/{$userId}/transactions?limit={$limit}";
            
            $headers = $this->generateSignature([]);
            
            $response = $this->client->get($url, [
                'headers' => $headers,
            ]);

            return json_decode($response->getBody(), true);
        } catch (GuzzleException $e) {
            Log::error('Tkoin transaction history fetch failed', [
                'userId' => $userId,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }
}
```

---

## 🎮 Step 4: Create Laravel Controller

Create `app/Http/Controllers/TkoinWalletController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Services\TkoinService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class TkoinWalletController extends Controller
{
    private TkoinService $tkoinService;

    public function __construct(TkoinService $tkoinService)
    {
        $this->middleware('auth');
        $this->tkoinService = $tkoinService;
    }

    /**
     * Get user's balance
     */
    public function balance(Request $request)
    {
        $userId = Auth::id();
        $balance = $this->tkoinService->getUserBalance((string) $userId);
        
        if (!$balance) {
            return response()->json(['error' => 'Failed to fetch balance'], 500);
        }
        
        return response()->json($balance);
    }

    /**
     * Initiate deposit
     */
    public function deposit(Request $request)
    {
        $request->validate([
            'amount' => 'required|numeric|min:10|max:10000',
            'method' => 'nullable|string|in:p2p_marketplace,direct_deposit',
        ]);

        $userId = Auth::id();
        $amount = $request->input('amount');
        $method = $request->input('method', 'p2p_marketplace');

        $result = $this->tkoinService->initiateDeposit((string) $userId, (float) $amount, $method);
        
        if (!$result) {
            return response()->json(['error' => 'Failed to initiate deposit'], 500);
        }
        
        return response()->json($result);
    }

    /**
     * Initiate withdrawal
     */
    public function withdrawal(Request $request)
    {
        $request->validate([
            'amount' => 'required|numeric|min:10',
            'solana_wallet' => 'nullable|string|regex:/^[1-9A-HJ-NP-Za-km-z]{32,44}$/',
        ]);

        $userId = Auth::id();
        $amount = $request->input('amount');
        $solanaWallet = $request->input('solana_wallet');

        $result = $this->tkoinService->initiateWithdrawal(
            (string) $userId,
            (float) $amount,
            $solanaWallet
        );
        
        if (!$result) {
            return response()->json(['error' => 'Failed to initiate withdrawal'], 500);
        }
        
        return response()->json($result);
    }

    /**
     * Get transaction history
     */
    public function history(Request $request)
    {
        $userId = Auth::id();
        $limit = (int) $request->input('limit', 20);
        
        $history = $this->tkoinService->getTransactionHistory((string) $userId, $limit);
        
        if (!$history) {
            return response()->json(['error' => 'Failed to fetch history'], 500);
        }
        
        return response()->json($history);
    }
}
```

---

## 🛣️ Step 5: Add Laravel Routes

Add to `routes/api.php`:

```php
<?php

use App\Http\Controllers\TkoinWalletController;
use App\Http\Controllers\TkoinWebhookController;

Route::middleware('auth:sanctum')->prefix('tkoin')->group(function () {
    Route::get('/balance', [TkoinWalletController::class, 'balance']);
    Route::post('/deposit', [TkoinWalletController::class, 'deposit']);
    Route::post('/withdrawal', [TkoinWalletController::class, 'withdrawal']);
    Route::get('/history', [TkoinWalletController::class, 'history']);
});

// Webhook endpoint (no auth - verified by HMAC signature)
Route::post('/webhooks/tkoin', [TkoinWebhookController::class, 'handle']);
```

---

## 🪝 Step 6: Create Webhook Handler

Create `app/Http/Controllers/TkoinWebhookController.php`:

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class TkoinWebhookController extends Controller
{
    /**
     * Handle Tkoin webhook
     */
    public function handle(Request $request)
    {
        // Verify webhook signature
        if (!$this->verifySignature($request)) {
            Log::warning('Invalid Tkoin webhook signature');
            return response()->json(['error' => 'Invalid signature'], 401);
        }

        $event = $request->input('event');
        $userId = $request->input('userId');
        $data = $request->input('data');

        Log::info('Tkoin webhook received', [
            'event' => $event,
            'userId' => $userId,
        ]);

        switch ($event) {
            case 'balance.updated':
                $this->handleBalanceUpdate($userId, $data);
                break;
            case 'deposit.completed':
                $this->handleDepositCompleted($userId, $data);
                break;
            case 'withdrawal.completed':
                $this->handleWithdrawalCompleted($userId, $data);
                break;
            default:
                Log::warning('Unknown webhook event', ['event' => $event]);
        }

        return response()->json(['status' => 'ok']);
    }

    /**
     * Verify HMAC signature
     */
    private function verifySignature(Request $request): bool
    {
        $signature = $request->header('X-Tkoin-Signature');
        $timestamp = $request->header('X-Tkoin-Timestamp');

        if (!$signature || !$timestamp) {
            return false;
        }

        // Verify timestamp (within 5 minutes)
        if (abs(time() - (int) $timestamp) > 300) {
            return false;
        }

        // Calculate expected signature
        $payload = $timestamp . '.' . $request->getContent();
        $expectedSignature = 'sha256=' . hash_hmac('sha256', $payload, config('tkoin.webhook_secret'));

        return hash_equals($expectedSignature, $signature);
    }

    /**
     * Handle balance update webhook
     */
    private function handleBalanceUpdate(string $userId, array $data): void
    {
        // Update user's balance in your local cache/database
        // Example: Update user model or cache
        \Cache::put("user.{$userId}.tkoin_balance", $data['tkoinBalance'], 3600);
        \Cache::put("user.{$userId}.credits_balance", $data['creditsBalance'], 3600);

        Log::info('User balance updated', [
            'userId' => $userId,
            'tkoinBalance' => $data['tkoinBalance'],
            'creditsBalance' => $data['creditsBalance'],
        ]);
    }

    /**
     * Handle deposit completed webhook
     */
    private function handleDepositCompleted(string $userId, array $data): void
    {
        // Handle successful deposit
        Log::info('Deposit completed', [
            'userId' => $userId,
            'depositId' => $data['depositId'],
            'tkoinAmount' => $data['tkoinAmount'],
        ]);

        // Notify user, update UI, etc.
    }

    /**
     * Handle withdrawal completed webhook
     */
    private function handleWithdrawalCompleted(string $userId, array $data): void
    {
        // Handle successful withdrawal
        Log::info('Withdrawal completed', [
            'userId' => $userId,
            'withdrawalId' => $data['withdrawalId'],
            'tkoinAmount' => $data['tkoinAmount'],
        ]);

        // Notify user, update UI, etc.
    }
}
```

---

## 🎨 Step 7: Update Frontend (Blade Template)

**Remove old broken wallet component:**

```bash
# Back up old files
cd /home/tkoin-betwin/htdocs/betwin.tkoin.finance
mv resources/views/components/tkoin-wallet.blade.php resources/views/components/tkoin-wallet.blade.php.DEPRECATED
mv public/js/tkoin-wallet.js public/js/tkoin-wallet.js.DEPRECATED
```

**Create new wallet component that calls Laravel APIs:**

Create `resources/views/components/tkoin-wallet-v2.blade.php`:

```blade
<div id="tkoin-wallet" class="tkoin-wallet-widget">
  <div class="wallet-header">
    <h3>Tkoin Wallet</h3>
    <button id="refresh-balance" class="btn-refresh">Refresh</button>
  </div>

  <div class="wallet-balance">
    <div class="balance-item">
      <span class="label">TKOIN Balance:</span>
      <span id="tkoin-balance" class="value">--</span>
    </div>
    <div class="balance-item">
      <span class="label">CREDIT Balance:</span>
      <span id="credit-balance" class="value">--</span>
    </div>
  </div>

  <div class="wallet-actions">
    <button id="deposit-btn" class="btn-primary">Deposit</button>
    <button id="withdrawal-btn" class="btn-secondary">Withdraw</button>
  </div>
</div>

<script>
// Wallet widget JavaScript
class TkoinWallet {
  constructor() {
    this.init();
  }

  init() {
    this.loadBalance();
    document.getElementById('refresh-balance').addEventListener('click', () => this.loadBalance());
    document.getElementById('deposit-btn').addEventListener('click', () => this.showDepositModal());
    document.getElementById('withdrawal-btn').addEventListener('click', () => this.showWithdrawalModal());
  }

  async loadBalance() {
    try {
      const response = await fetch('/api/tkoin/balance', {
        headers: {
          'Authorization': 'Bearer ' + document.querySelector('meta[name="api-token"]').content,
          'Accept': 'application/json',
        },
      });

      const data = await response.json();
      document.getElementById('tkoin-balance').textContent = data.tkoin_balance.toFixed(2);
      document.getElementById('credit-balance').textContent = data.credits_balance.toFixed(0);
    } catch (error) {
      console.error('Failed to load balance:', error);
    }
  }

  async showDepositModal() {
    const amount = prompt('Enter TKOIN amount to deposit:');
    if (!amount) return;

    try {
      const response = await fetch('/api/tkoin/deposit', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + document.querySelector('meta[name="api-token"]').content,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ amount: parseFloat(amount), method: 'p2p_marketplace' }),
      });

      const data = await response.json();
      
      if (data.redirectUrl) {
        // Redirect to P2P marketplace
        window.location.href = data.redirectUrl;
      } else {
        alert('Deposit initiated successfully!');
        this.loadBalance();
      }
    } catch (error) {
      console.error('Deposit failed:', error);
      alert('Failed to initiate deposit');
    }
  }

  async showWithdrawalModal() {
    const amount = prompt('Enter TKOIN amount to withdraw:');
    if (!amount) return;

    try {
      const response = await fetch('/api/tkoin/withdrawal', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + document.querySelector('meta[name="api-token"]').content,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ amount: parseFloat(amount) }),
      });

      const data = await response.json();
      alert('Withdrawal initiated successfully!');
      this.loadBalance();
    } catch (error) {
      console.error('Withdrawal failed:', error);
      alert('Failed to initiate withdrawal');
    }
  }
}

// Initialize wallet
new TkoinWallet();
</script>
```

---

## ✅ Step 8: Test Integration

### Test Balance Fetch

```bash
curl -X GET http://betwin.tkoin.finance/api/tkoin/balance \
  -H "Authorization: Bearer YOUR_SANCTUM_TOKEN"
```

### Test Deposit Initiation

```bash
curl -X POST http://betwin.tkoin.finance/api/tkoin/deposit \
  -H "Authorization: Bearer YOUR_SANCTUM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": "50", "method": "p2p_marketplace"}'
```

### Test Withdrawal Initiation

```bash
curl -X POST http://betwin.tkoin.finance/api/tkoin/withdrawal \
  -H "Authorization: Bearer YOUR_SANCTUM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": "25"}'
```

---

## 🚀 Deployment Checklist

- [ ] Add Tkoin credentials to production `.env`
- [ ] Deploy TkoinService, Controllers, and Routes
- [ ] Configure webhook endpoint URL with Tkoin team
- [ ] Test end-to-end deposit flow in production
- [ ] Test end-to-end withdrawal flow in production
- [ ] Monitor Laravel logs for webhook deliveries
- [ ] Set up alerts for failed API calls
- [ ] Document internal procedures for support team

---

## 📞 Support

**Questions?**
- Email: dev@tkoin.finance
- Discord: https://discord.gg/tkoin
- API Documentation: `docs/BETWIN_INTEGRATION_API.md`

---

## 🔧 Troubleshooting

### "Invalid signature" error
- ✅ Verify `TKOIN_WEBHOOK_SECRET` matches value from Tkoin team
- ✅ Ensure timestamp is current (within 5 minutes)
- ✅ Check that request body is exactly as sent (no modifications)

### "Platform ID mismatch" error
- ✅ Verify `TKOIN_PLATFORM_ID` is `platform_betwin`
- ✅ Ensure API token belongs to correct platform

### Balance not updating after deposit
- ✅ Check webhook endpoint is publicly accessible
- ✅ Verify webhook signature validation logic
- ✅ Check Laravel logs for webhook delivery errors

---

## 📊 Migration Path

**Current (Broken):**
```
BetWin Frontend → (CORS fail) → Replit Backend
```

**New (Working):**
```
BetWin Frontend → BetWin Backend → Tkoin Protocol Backend
```

**Migration Steps:**
1. Deploy new Laravel controllers and routes
2. Test thoroughly in staging
3. Update frontend to call new Laravel APIs
4. Remove old direct Replit calls
5. Monitor production for 24 hours
6. Delete deprecated blade components

---

**Ready to integrate? Contact Tkoin Protocol team to get your API credentials!**
