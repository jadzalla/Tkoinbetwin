# BetWin Tkoin Wallet - Architecture Explained

## Your Question: .env Integration Values vs JavaScript Base URLs

### Short Answer:
**.env values are used by PHP backend (TkoinService), NOT by JavaScript frontend!**

---

## Complete Architecture Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     BROWSER (User's Computer)                        │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ tkoin-wallet-FINAL.js                                          │ │
│  │ this.apiBaseUrl = '/tkoin'                                     │ │
│  │                                                                 │ │
│  │ • Calls RELATIVE paths (not external URLs)                     │ │
│  │ • GET  /tkoin/balance                                          │ │
│  │ • GET  /tkoin/history                                          │ │
│  │ • POST /tkoin/deposit                                          │ │
│  │ • POST /tkoin/withdrawal                                       │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
                         HTTP Request to BetWin
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│              BETWIN LARAVEL SERVER (Your Server)                    │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ TkoinController.php                                            │ │
│  │                                                                 │ │
│  │ • Route: /tkoin/balance  → balance()                           │ │
│  │ • Route: /tkoin/history  → history()                           │ │
│  │ • Route: /tkoin/deposit  → deposit()                           │ │
│  │ • Route: /tkoin/withdrawal → withdrawal()                      │ │
│  │                                                                 │ │
│  │ Each method calls ↓ TkoinService                               │ │
│  └────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ TkoinService.php                                               │ │
│  │                                                                 │ │
│  │ Uses .env values:                                              │ │
│  │ • TKOIN_API_URL (Platform API full endpoint)                   │ │
│  │ • TKOIN_API_BASE (Base URL for Tkoin Protocol)                 │ │
│  │ • TKOIN_API_TOKEN (Authentication)                             │ │
│  │ • TKOIN_API_SECRET (HMAC signing)                              │ │
│  │                                                                 │ │
│  │ Methods:                                                        │ │
│  │ • getUserBalance()      → Queries BetWin DB                    │ │
│  │ • getUserTransactions() → Queries BetWin DB                    │ │
│  │ • initiateDeposit()     → Calls Tkoin Platform API ↓           │ │
│  │ • initiateWithdrawal()  → Calls Tkoin Platform API ↓           │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
            HTTP Request with HMAC signature to Tkoin Protocol
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│           TKOIN PROTOCOL (External Replit Service)                  │
│  https://1f1f76cb-d6d6-4e8e-b41b-5cb7e3d7fc0f...replit.dev         │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Platform API Endpoints                                         │ │
│  │                                                                 │ │
│  │ • POST /api/platforms/platform_betwin/deposits                 │ │
│  │ • POST /api/platforms/platform_betwin/withdrawals              │ │
│  │ • GET  /api/platforms/platform_betwin/balance                  │ │
│  │ • GET  /api/platforms/platform_betwin/transactions             │ │
│  │                                                                 │ │
│  │ Processes request, updates ledger, sends webhook back to       │ │
│  │ BetWin when transaction completes                              │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Key Points

### 1. JavaScript NEVER calls Tkoin Protocol directly
- ❌ **WRONG:** `fetch('https://...replit.dev/api/platforms/...')`
- ✅ **CORRECT:** `fetch('/tkoin/balance')` (relative path to BetWin)

### 2. .env values are PHP-side only
The .env configuration is loaded by Laravel and used inside `TkoinService.php`:

```php
// TkoinService.php
class TkoinService {
    protected $apiUrl;      // From TKOIN_API_URL
    protected $apiToken;    // From TKOIN_API_TOKEN
    protected $apiSecret;   // From TKOIN_API_SECRET
    
    public function initiateDeposit($user, $account, $amount) {
        // Build HMAC signature
        $signature = $this->generateSignature($payload);
        
        // Call external Tkoin Protocol API
        $response = Http::withHeaders([
            'X-Platform-Token' => $this->apiToken,
            'X-Signature' => $signature,
        ])->post($this->apiUrl . '/deposits', $payload);
        
        return $response->json();
    }
}
```

### 3. Why this architecture?

**Security:**
- API secrets stay on server (never exposed to browser)
- HMAC signatures generated server-side
- BetWin controls all external API calls

**Performance:**
- Frontend doesn't need CORS configuration
- BetWin can cache/optimize responses
- Simpler frontend code

**Flexibility:**
- Can switch Tkoin Protocol endpoints without changing frontend
- Can add middleware/logging/rate limiting
- BetWin remains the source of truth

---

## .env Values Explained

### Used by TkoinService (Platform API calls):
```bash
TKOIN_API_URL=https://...replit.dev/api/platforms/platform_betwin
# Full endpoint for Platform API operations
# Used when calling: deposits, withdrawals, balance, transactions

TKOIN_PLATFORM_ID=platform_betwin
# Your platform identifier in Tkoin Protocol

TKOIN_API_TOKEN=ptk_xNm2aoTy8AY1QcD-F9wTwMwdzyZjA97JS1h8wa1i_8A
# Platform token for authentication (sent in X-Platform-Token header)

TKOIN_API_SECRET=ab0d6715b594c415d4e354c03024ef6e
# Secret for HMAC signature generation (never sent, used to sign requests)

TKOIN_WEBHOOK_SECRET=cb650dc316eeb4c5ccb1aa4614da70f52144fbb794695320adf4d31b5a38d820
# Secret for validating incoming webhooks from Tkoin Protocol
```

### Used by TkoinController (Wallet operations):
```bash
TKOIN_API_BASE=https://...replit.dev
# Base URL for general Tkoin Protocol operations

TKOIN_TREASURY_WALLET=953CKYH169xXxaNKVwLT9z9s38TEg1d2pQsY7d1Lv6dD
# Solana wallet address for direct deposits

TKOIN_MINT_ADDRESS=BVUrPwnZTRwnZgw1JmM43mZf8K7WVoDejgJ2X11Evs6i
# TKOIN SPL token mint address

TKOIN_MARKETPLACE_URL=https://...replit.dev/marketplace
# URL for P2P marketplace redirects
```

---

## Request Examples

### Example 1: User Clicks "Refresh Balance"

**Step 1:** JavaScript calls BetWin
```javascript
fetch('/tkoin/balance')
```

**Step 2:** Laravel TkoinController receives request
```php
public function balance() {
    $user = Auth::user();
    $balance = $this->tkoinService->getUserBalance($user);
    return response()->json(['balance' => $balance]);
}
```

**Step 3:** TkoinService queries BetWin's local database
```php
public function getUserBalance($user) {
    // Query BetWin's local account table (authoritative)
    return $user->account->balance ?? 0;
}
```

**Step 4:** Response back to JavaScript
```json
{
  "success": true,
  "balance": 1461.73,
  "currency": "CREDIT",
  "account_id": "12345"
}
```

**Note:** Balance query does NOT call Tkoin Protocol - it uses BetWin's local DB as the authoritative source!

---

### Example 2: User Initiates Withdrawal

**Step 1:** JavaScript calls BetWin
```javascript
fetch('/tkoin/withdrawal', {
  method: 'POST',
  body: JSON.stringify({
    amount: 50.00,
    solana_wallet: '7xKXtg2CW...'
  })
})
```

**Step 2:** Laravel TkoinController validates and calls service
```php
public function withdrawal(Request $request) {
    $amount = $request->input('amount');
    $wallet = $request->input('solana_wallet');
    
    $result = $this->tkoinService->initiateWithdrawal(
        $user, $account, $amount, $wallet
    );
    
    return response()->json($result);
}
```

**Step 3:** TkoinService calls Tkoin Protocol Platform API
```php
public function initiateWithdrawal($user, $account, $amount, $wallet) {
    $payload = [
        'userId' => $user->id,
        'amount' => $amount,
        'solanaWallet' => $wallet
    ];
    
    // Generate HMAC signature using TKOIN_API_SECRET
    $signature = $this->generateSignature($payload);
    
    // Call external API using TKOIN_API_URL
    $response = Http::withHeaders([
        'X-Platform-Token' => env('TKOIN_API_TOKEN'),
        'X-Signature' => $signature,
        'X-Timestamp' => time(),
    ])->post(env('TKOIN_API_URL') . '/withdrawals', $payload);
    
    return $response->json();
}
```

**Step 4:** Tkoin Protocol processes withdrawal and responds
```json
{
  "withdrawalId": "wdl_xyz789",
  "status": "pending",
  "tkoinAmount": "50.00000000",
  "creditsDeducted": "5000.00",
  "destination": "7xKXtg2CW...",
  "estimatedCompletion": "2025-11-24T08:15:00Z"
}
```

**Step 5:** BetWin sends response back to JavaScript
```json
{
  "success": true,
  "message": "Withdrawal initiated successfully",
  "transaction": { ... }
}
```

**Step 6 (Later):** Tkoin Protocol sends webhook to BetWin when withdrawal completes
```
POST /webhooks/tkoin
{
  "event": "withdrawal.completed",
  "transactionId": "wdl_xyz789",
  ...
}
```

---

## Summary

| Layer | Component | Uses | Calls |
|-------|-----------|------|-------|
| **Frontend** | `tkoin-wallet-FINAL.js` | `/tkoin/*` relative paths | BetWin Laravel |
| **Backend** | `TkoinController.php` | Routes requests | TkoinService |
| **Service** | `TkoinService.php` | .env values (TKOIN_API_*) | Tkoin Protocol Platform API |
| **External** | Tkoin Protocol | Platform API | Processes transactions |

**The .env values and JavaScript base URLs are in completely different layers and never directly interact!**

---

## Why This Matters

If you were to change the Tkoin Protocol URL (e.g., deploy to production), you would:

1. ✅ **Update .env file** (server-side)
   ```bash
   TKOIN_API_URL=https://production.tkoin.com/api/platforms/platform_betwin
   ```

2. ❌ **DO NOT touch JavaScript** - Frontend code stays the same!
   ```javascript
   this.apiBaseUrl = '/tkoin'; // Never changes!
   ```

The frontend only knows about `/tkoin/*` - it has no idea where Tkoin Protocol actually is. That's the whole point!
