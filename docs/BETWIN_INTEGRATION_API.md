# BetWin ↔ Tkoin Protocol Integration API

**Version:** 1.0  
**Last Updated:** 2025-11-22  
**Architecture:** Server-to-Server (Laravel ↔ Node.js Express)

---

## Overview

This document defines the API contract between BetWin Casino (Laravel backend) and Tkoin Protocol (Replit backend). BetWin is a **sovereign platform** that owns its user experience while Tkoin Protocol manages the TKOIN ledger and blockchain operations.

### Architecture Principles

```
┌─────────────────────────────────────────────────────────────┐
│  BetWin Frontend (Blade Templates)                          │
│      ↓ AJAX calls to own Laravel APIs                       │
│  BetWin Backend (Laravel + Sanctum Auth)                    │
│      ↓ Server-to-server (API Key + HMAC)                    │
│  Tkoin Protocol Backend (Node.js + Express)                 │
│      ↓ Webhooks for async updates                           │
│  BetWin Backend (webhook handler)                           │
│      ↓ Update local balance cache                           │
│  BetWin Frontend (display updated balance)                  │
└─────────────────────────────────────────────────────────────┘
```

**Key Points:**
- ✅ **BetWin owns UX**: All frontend, modals, buttons served by Laravel
- ✅ **Tkoin owns ledger**: Balance tracking, settlements, blockchain operations
- ✅ **No browser-to-Replit calls**: BetWin frontend never calls Tkoin directly
- ✅ **Server-to-server only**: BetWin backend authenticates using platform API credentials
- ✅ **Webhooks for updates**: Tkoin pushes balance changes to BetWin

---

## Authentication

### Platform API Credentials

Tkoin issues platform-specific API credentials:

```json
{
  "platformId": "platform_betwin",
  "apiKey": "pk_betwin_live_abc123...",
  "apiSecret": "sk_betwin_live_xyz789..."
}
```

**Storage:**
- `apiKey`: Include in `X-Platform-Key` header (public identifier)
- `apiSecret`: Use to sign requests with HMAC-SHA256 (never expose)

### HMAC Request Signature

All requests from BetWin → Tkoin must include HMAC-SHA256 signature:

**Headers:**
```
X-Platform-Key: pk_betwin_live_abc123...
X-Timestamp: 1700000000
X-Signature: sha256=a1b2c3d4e5f6...
```

**Signature Generation (PHP):**
```php
$timestamp = time();
$body = json_encode($requestData);
$payload = $timestamp . '.' . $body;
$signature = hash_hmac('sha256', $payload, $apiSecret);

$headers = [
    'X-Platform-Key' => $apiKey,
    'X-Timestamp' => $timestamp,
    'X-Signature' => 'sha256=' . $signature,
    'Content-Type' => 'application/json'
];
```

**Signature Verification (Node.js):**
```typescript
const timestamp = req.headers['x-timestamp'];
const signature = req.headers['x-signature']?.replace('sha256=', '');
const body = JSON.stringify(req.body);
const payload = `${timestamp}.${body}`;
const expectedSignature = crypto
  .createHmac('sha256', apiSecret)
  .update(payload)
  .digest('hex');

if (signature !== expectedSignature) {
  return res.status(401).json({ error: 'Invalid signature' });
}
```

**Security:**
- Timestamp must be within 5 minutes of server time (prevents replay attacks)
- Nonce tracking prevents duplicate requests
- HTTPS required in production

---

## API Endpoints

### Base URL
- **Production:** `https://[replit-deployment-url]/api/platforms`
- **Development:** `http://localhost:5000/api/platforms`

---

### 1. Get User Balance

**Endpoint:** `GET /api/platforms/:platformId/users/:userId/balance`

**Description:** Fetch a user's TKOIN and CREDIT balance.

**Request:**
```http
GET /api/platforms/platform_betwin/users/user_12345/balance HTTP/1.1
Host: localhost:5000
X-Platform-Key: pk_betwin_live_abc123...
X-Timestamp: 1700000000
X-Signature: sha256=a1b2c3d4e5f6...
```

**Response (200 OK):**
```json
{
  "userId": "user_12345",
  "platformId": "platform_betwin",
  "tkoinBalance": "150.50000000",
  "creditsBalance": "15050.00",
  "exchangeRate": "100.00",
  "lastUpdated": "2025-11-22T07:30:00.000Z"
}
```

**Response (404 Not Found):**
```json
{
  "error": "User not found",
  "userId": "user_12345"
}
```

---

### 2. Initiate Deposit (User Buys TKOIN)

**Endpoint:** `POST /api/platforms/:platformId/deposits`

**Description:** User initiates a TKOIN deposit (buying from P2P marketplace or direct deposit).

**Request:**
```http
POST /api/platforms/platform_betwin/deposits HTTP/1.1
Host: localhost:5000
X-Platform-Key: pk_betwin_live_abc123...
X-Timestamp: 1700000000
X-Signature: sha256=a1b2c3d4e5f6...
Content-Type: application/json

{
  "userId": "user_12345",
  "amount": "50.00",
  "method": "p2p_marketplace"
}
```

**Parameters:**
- `userId` (string, required): BetWin user ID
- `amount` (string, required): TKOIN amount to deposit
- `method` (string, required): `p2p_marketplace` | `direct_deposit`

**Response (200 OK):**
```json
{
  "depositId": "dep_abc123xyz",
  "status": "pending",
  "tkoinAmount": "50.00000000",
  "creditsAmount": "5000.00",
  "method": "p2p_marketplace",
  "redirectUrl": "https://tkoin-marketplace.repl.co/orders/ord_xyz123",
  "expiresAt": "2025-11-22T08:00:00.000Z"
}
```

**Response (400 Bad Request):**
```json
{
  "error": "Invalid deposit amount",
  "minAmount": "10.00",
  "maxAmount": "10000.00"
}
```

---

### 3. Initiate Withdrawal (User Sells TKOIN)

**Endpoint:** `POST /api/platforms/:platformId/withdrawals`

**Description:** User initiates a TKOIN withdrawal (selling to P2P marketplace or sending to Solana wallet).

**Request:**
```http
POST /api/platforms/platform_betwin/withdrawals HTTP/1.1
Host: localhost:5000
X-Platform-Key: pk_betwin_live_abc123...
X-Timestamp: 1700000000
X-Signature: sha256=a1b2c3d4e5f6...
Content-Type: application/json

{
  "userId": "user_12345",
  "amount": "25.00",
  "solanaWallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
}
```

**Parameters:**
- `userId` (string, required): BetWin user ID
- `amount` (string, required): TKOIN amount to withdraw
- `solanaWallet` (string, optional): Destination Solana wallet (if null, uses P2P marketplace)

**Response (200 OK):**
```json
{
  "withdrawalId": "wdl_xyz789abc",
  "status": "pending",
  "tkoinAmount": "25.00000000",
  "creditsDeducted": "2500.00",
  "destination": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "estimatedCompletion": "2025-11-22T08:15:00.000Z"
}
```

**Response (400 Bad Request):**
```json
{
  "error": "Insufficient balance",
  "availableBalance": "10.50000000",
  "requestedAmount": "25.00000000"
}
```

---

### 4. Get Transaction History

**Endpoint:** `GET /api/platforms/:platformId/users/:userId/transactions`

**Description:** Fetch user's TKOIN transaction history.

**Request:**
```http
GET /api/platforms/platform_betwin/users/user_12345/transactions?limit=20 HTTP/1.1
Host: localhost:5000
X-Platform-Key: pk_betwin_live_abc123...
X-Timestamp: 1700000000
X-Signature: sha256=a1b2c3d4e5f6...
```

**Query Parameters:**
- `limit` (integer, optional): Number of transactions (default: 50, max: 100)
- `offset` (integer, optional): Pagination offset (default: 0)

**Response (200 OK):**
```json
{
  "transactions": [
    {
      "id": "tx_abc123",
      "type": "deposit",
      "tkoinAmount": "50.00000000",
      "creditsAmount": "5000.00",
      "status": "completed",
      "timestamp": "2025-11-22T07:00:00.000Z"
    },
    {
      "id": "tx_xyz789",
      "type": "withdrawal",
      "tkoinAmount": "25.00000000",
      "creditsAmount": "2500.00",
      "status": "pending",
      "timestamp": "2025-11-22T07:15:00.000Z"
    }
  ],
  "pagination": {
    "total": 45,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

---

## Webhooks (Tkoin → BetWin)

Tkoin sends webhooks to BetWin for async balance updates.

### Webhook Configuration

**BetWin must provide:**
- Webhook URL: `https://betwin.tkoin.finance/api/webhooks/tkoin`
- Webhook secret: `whsec_betwin_xyz123...` (for signature verification)

### Webhook Payload

**Headers:**
```
X-Tkoin-Signature: sha256=a1b2c3d4e5f6...
X-Tkoin-Timestamp: 1700000000
Content-Type: application/json
```

**Body (Balance Update):**
```json
{
  "event": "balance.updated",
  "platformId": "platform_betwin",
  "userId": "user_12345",
  "data": {
    "tkoinBalance": "175.50000000",
    "creditsBalance": "17550.00",
    "changeType": "deposit",
    "changeAmount": "25.00000000",
    "transactionId": "tx_abc123"
  },
  "timestamp": "2025-11-22T07:30:00.000Z"
}
```

**Body (Deposit Completed):**
```json
{
  "event": "deposit.completed",
  "platformId": "platform_betwin",
  "userId": "user_12345",
  "data": {
    "depositId": "dep_abc123xyz",
    "tkoinAmount": "50.00000000",
    "creditsAmount": "5000.00",
    "newBalance": "175.50000000"
  },
  "timestamp": "2025-11-22T07:30:00.000Z"
}
```

**Body (Withdrawal Completed):**
```json
{
  "event": "withdrawal.completed",
  "platformId": "platform_betwin",
  "userId": "user_12345",
  "data": {
    "withdrawalId": "wdl_xyz789abc",
    "tkoinAmount": "25.00000000",
    "creditsDeducted": "2500.00",
    "newBalance": "150.50000000"
  },
  "timestamp": "2025-11-22T07:35:00.000Z"
}
```

### Webhook Signature Verification (PHP)

```php
public function handleTkoinWebhook(Request $request) {
    $signature = $request->header('X-Tkoin-Signature');
    $timestamp = $request->header('X-Tkoin-Timestamp');
    $payload = $timestamp . '.' . $request->getContent();
    
    $expectedSignature = 'sha256=' . hash_hmac(
        'sha256',
        $payload,
        config('tkoin.webhook_secret')
    );
    
    if (!hash_equals($expectedSignature, $signature)) {
        return response()->json(['error' => 'Invalid signature'], 401);
    }
    
    // Verify timestamp (within 5 minutes)
    if (abs(time() - $timestamp) > 300) {
        return response()->json(['error' => 'Expired timestamp'], 401);
    }
    
    $event = $request->input('event');
    $userId = $request->input('userId');
    $data = $request->input('data');
    
    switch ($event) {
        case 'balance.updated':
            $this->updateUserBalance($userId, $data['tkoinBalance'], $data['creditsBalance']);
            break;
        case 'deposit.completed':
            $this->handleDepositCompleted($userId, $data);
            break;
        case 'withdrawal.completed':
            $this->handleWithdrawalCompleted($userId, $data);
            break;
    }
    
    return response()->json(['status' => 'ok']);
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| 200 | OK | Request successful |
| 400 | Bad Request | Invalid parameters, insufficient balance |
| 401 | Unauthorized | Invalid API key or signature |
| 404 | Not Found | User or resource not found |
| 422 | Unprocessable Entity | Business logic error (e.g., deposit limits exceeded) |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server-side error |

### Error Response Format

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "additionalContext"
  }
}
```

---

## Rate Limiting

**Per-Platform Limits:**
- **Standard:** 100 requests per 15 minutes
- **Burst:** 20 requests per minute

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1700001200
```

**429 Response:**
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 120
}
```

---

## Integration Checklist

### Tkoin Protocol (Replit) Side
- [ ] Add `apiKey` and `apiSecret` columns to `platforms` table
- [ ] Implement HMAC signature verification middleware
- [ ] Update platform endpoints to use API key auth
- [ ] Generate API credentials for `platform_betwin`
- [ ] Implement webhook sender for balance updates
- [ ] Test with BetWin staging environment

### BetWin (Laravel) Side
- [ ] Store Tkoin API credentials securely (`.env` file)
- [ ] Implement HMAC request signing
- [ ] Create Laravel API routes: `/api/tkoin/balance`, `/api/tkoin/deposit`, `/api/tkoin/withdrawal`
- [ ] Create webhook handler route: `/api/webhooks/tkoin`
- [ ] Update Blade templates to call Laravel APIs (remove Replit calls)
- [ ] Implement local balance caching
- [ ] Test integration end-to-end

---

## Example: Complete Deposit Flow

```
1. User clicks "Deposit" in BetWin frontend
   ↓
2. BetWin frontend → POST /api/tkoin/deposit (Laravel API)
   ↓
3. BetWin backend → POST /api/platforms/platform_betwin/deposits (Tkoin API)
   ↓
4. Tkoin creates deposit order, returns redirectUrl
   ↓
5. BetWin backend → returns redirectUrl to frontend
   ↓
6. BetWin frontend → redirects user to P2P marketplace
   ↓
7. User completes TKOIN purchase on marketplace
   ↓
8. Tkoin → Webhook to BetWin: deposit.completed
   ↓
9. BetWin backend → updates local balance cache
   ↓
10. BetWin frontend → auto-refreshes balance display
```

---

## Support

**Questions?** Contact Tkoin Protocol integration team:
- Email: dev@tkoin.finance
- Discord: https://discord.gg/tkoin
- Docs: https://docs.tkoin.finance

**API Status:** https://status.tkoin.finance
