# BetWin Integration - Deployment Guide

## Overview
This guide provides the updated TkoinService.php implementation that integrates BetWin casino with the Tkoin Protocol P2P Marketplace.

## Prerequisites
- BetWin production server access
- Platform credentials: `platform_betwin`, token: `ptk_fDMa...CtlW`
- Tkoin Protocol API URL: `https://1f1f76cb-d6d6-4e8e-b41b-5cb7e3d7fc0f-00-1icgdawm3o9xv.picard.replit.dev/api/`

## Deployment Steps

### 1. Update TkoinService.php

Replace `/home/tkoin-betwin/htdocs/betwin.tkoin.finance/app/Services/TkoinService.php` with the implementation below.

### 2. Updated TkoinService.php Implementation

```php
<?php

namespace App\Services;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Illuminate\Support\Facades\Log;

class TkoinService
{
    private Client $client;
    private string $platformId;
    private string $apiToken;
    private string $apiSecret;

    public function __construct()
    {
        $this->platformId = config('tkoin.platform_id');
        $this->apiToken = config('tkoin.api_token');
        $this->apiSecret = config('tkoin.api_secret');

        $this->client = new Client([
            'base_uri' => config('tkoin.api_url'), // Must end with trailing slash!
            'timeout' => 30,
            'verify' => false, // For devnet only - ENABLE IN PRODUCTION
        ]);
    }

    /**
     * Generate HMAC signature for request authentication
     */
    private function generateSignature(string $timestamp, string $body = ''): string
    {
        $message = $timestamp . $this->platformId . $body;
        return hash_hmac('sha256', $message, $this->apiSecret);
    }

    /**
     * Make authenticated API request to Tkoin Protocol
     */
    private function makeRequest(string $method, string $endpoint, array $data = []): array
    {
        try {
            $timestamp = now()->toIso8601String();
            $body = !empty($data) ? json_encode($data) : '';
            $signature = $this->generateSignature($timestamp, $body);

            $headers = [
                'Content-Type' => 'application/json',
                'Authorization' => 'Bearer ' . $this->apiToken,
                'X-Platform-ID' => $this->platformId,
                'X-Signature' => $signature,
                'X-Timestamp' => $timestamp,
            ];

            Log::info('Tkoin API Request', [
                'method' => $method,
                'endpoint' => $endpoint,
                'headers' => $headers,
                'data' => $data,
            ]);

            $options = ['headers' => $headers];
            if (!empty($data)) {
                $options['json'] = $data;
            }

            $response = $this->client->request($method, $endpoint, $options);
            $responseBody = json_decode($response->getBody()->getContents(), true);

            Log::info('Tkoin API Response', [
                'status' => $response->getStatusCode(),
                'body' => $responseBody,
            ]);

            return [
                'success' => true,
                'data' => $responseBody,
                'status' => $response->getStatusCode(),
            ];
        } catch (RequestException $e) {
            Log::error('Tkoin API Request Failed', [
                'endpoint' => $endpoint,
                'error' => $e->getMessage(),
                'response' => $e->hasResponse() ? $e->getResponse()->getBody()->getContents() : null,
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
                'status' => $e->getCode(),
            ];
        }
    }

    /**
     * Get user's TKOIN balance
     */
    public function getUserBalance(string $userId): array
    {
        $endpoint = "platforms/{$this->platformId}/users/{$userId}/balance";
        return $this->makeRequest('GET', $endpoint);
    }

    /**
     * Initiate deposit transaction
     */
    public function initiateDeposit(string $userId, float $amount, string $method = 'p2p_marketplace', ?int $settlementId = null): array
    {
        $endpoint = "platforms/{$this->platformId}/deposits";
        $data = [
            'userId' => $userId,
            'amount' => $amount,
            'method' => $method,
            'settlementId' => $settlementId,
        ];

        return $this->makeRequest('POST', $endpoint, $data);
    }

    /**
     * Initiate withdrawal transaction
     */
    public function initiateWithdrawal(string $userId, float $amount, ?string $solanaWallet = null, ?int $settlementId = null): array
    {
        $endpoint = "platforms/{$this->platformId}/withdrawals";
        $data = [
            'userId' => $userId,
            'amount' => $amount,
            'solanaWallet' => $solanaWallet,
            'settlementId' => $settlementId,
        ];

        return $this->makeRequest('POST', $endpoint, $data);
    }

    /**
     * Get user transaction history
     */
    public function getUserTransactions(string $userId, int $limit = 50, int $offset = 0): array
    {
        $endpoint = "platforms/{$this->platformId}/users/{$userId}/transactions?limit={$limit}&offset={$offset}";
        return $this->makeRequest('GET', $endpoint);
    }
}
```

### 3. Update TkoinController.php

Update the controller methods to handle the new API response format:

```php
public function getBalance(Request $request)
{
    $user = auth()->user();
    
    $response = $this->tkoinService->getUserBalance($user->id);
    
    if (!$response['success']) {
        return response()->json([
            'error' => 'Failed to fetch balance',
            'message' => $response['error'] ?? 'Unknown error'
        ], 500);
    }
    
    return response()->json($response['data']);
}

public function initiateDeposit(Request $request)
{
    $validated = $request->validate([
        'amount' => 'required|numeric|min:0.01',
        'method' => 'string|in:p2p_marketplace,wallet',
    ]);
    
    $user = auth()->user();
    
    // Create local settlement record FIRST
    $settlement = UserSettlement::create([
        'user_id' => $user->id,
        'type' => 'deposit',
        'tkoin_amount' => $validated['amount'],
        'credits_amount' => $validated['amount'] * 100,
        'status' => 'pending',
    ]);
    
    // Call Tkoin Protocol API
    $response = $this->tkoinService->initiateDeposit(
        (string) $user->id,
        (float) $validated['amount'],
        $validated['method'] ?? 'p2p_marketplace',
        $settlement->id
    );
    
    if (!$response['success']) {
        // Mark settlement as failed
        $settlement->update(['status' => 'failed']);
        
        return response()->json([
            'error' => 'Failed to initiate deposit',
            'message' => $response['error'] ?? 'Unknown error'
        ], 500);
    }
    
    // Update settlement with Tkoin transaction ID
    $settlement->update([
        'tkoin_transaction_id' => $response['data']['depositId'] ?? null,
        'status' => $response['data']['status'] ?? 'pending',
    ]);
    
    return response()->json([
        'success' => true,
        'settlement' => $settlement,
        'tkoin_response' => $response['data'],
    ]);
}

public function initiateWithdrawal(Request $request)
{
    $validated = $request->validate([
        'amount' => 'required|numeric|min:0.01',
        'solana_address' => 'nullable|string',
    ]);
    
    $user = auth()->user();
    
    // Create local settlement record FIRST
    $settlement = UserSettlement::create([
        'user_id' => $user->id,
        'type' => 'withdrawal',
        'tkoin_amount' => $validated['amount'],
        'credits_amount' => $validated['amount'] * 100,
        'status' => 'pending',
        'metadata' => ['solana_address' => $validated['solana_address'] ?? null],
    ]);
    
    // Call Tkoin Protocol API
    $response = $this->tkoinService->initiateWithdrawal(
        (string) $user->id,
        (float) $validated['amount'],
        $validated['solana_address'] ?? null,
        $settlement->id
    );
    
    if (!$response['success']) {
        // Mark settlement as failed
        $settlement->update(['status' => 'failed']);
        
        return response()->json([
            'error' => 'Failed to initiate withdrawal',
            'message' => $response['error'] ?? 'Unknown error'
        ], 500);
    }
    
    // Update settlement with Tkoin transaction ID
    $settlement->update([
        'tkoin_transaction_id' => $response['data']['withdrawalId'] ?? null,
        'status' => $response['data']['status'] ?? 'pending',
    ]);
    
    return response()->json([
        'success' => true,
        'settlement' => $settlement,
        'tkoin_response' => $response['data'],
    ]);
}
```

### 4. Update Webhook Handler

The Tkoin Protocol will send webhooks when transactions complete. Update the webhook handler:

```php
public function handleWebhook(Request $request)
{
    // Verify webhook signature
    $signature = $request->header('X-Tkoin-Signature');
    $timestamp = $request->header('X-Tkoin-Timestamp');
    $body = $request->getContent();
    
    $expectedSignature = hash_hmac('sha256', $body, config('tkoin.webhook_secret'));
    
    if (!hash_equals($expectedSignature, $signature)) {
        Log::warning('Invalid webhook signature');
        return response()->json(['error' => 'Invalid signature'], 401);
    }
    
    // Parse webhook payload
    $payload = $request->json()->all();
    $event = $payload['event'] ?? null;
    $data = $payload['data'] ?? [];
    
    Log::info('Tkoin Webhook Received', ['event' => $event, 'data' => $data]);
    
    if ($event === 'settlement.completed') {
        $settlementId = $data['settlement_id'] ?? null;
        
        if ($settlementId) {
            // Update local settlement record
            $settlement = UserSettlement::find($settlementId);
            if ($settlement) {
                $settlement->update([
                    'status' => 'completed',
                    'completed_at' => now(),
                ]);
                
                Log::info('Settlement updated via webhook', [
                    'settlement_id' => $settlementId,
                    'type' => $settlement->type,
                ]);
            }
        }
    }
    
    return response()->json(['success' => true]);
}
```

### 5. Add Migration for Settlement Tracking

Create a new migration to add the `tkoin_transaction_id` field:

```php
Schema::table('user_settlements', function (Blueprint $table) {
    $table->string('tkoin_transaction_id')->nullable()->after('id');
});
```

### 6. Configuration

Update `.env`:

```env
TKOIN_API_URL=https://1f1f76cb-d6d6-4e8e-b41b-5cb7e3d7fc0f-00-1icgdawm3o9xv.picard.replit.dev/api/
TKOIN_PLATFORM_ID=platform_betwin
TKOIN_API_TOKEN=ptk_fDMa...CtlW
TKOIN_API_SECRET=[from sovereign_platforms.api_secret]
TKOIN_WEBHOOK_SECRET=[from sovereign_platforms.webhook_secret]
```

Update `config/tkoin.php`:

```php
return [
    'api_url' => env('TKOIN_API_URL'),
    'platform_id' => env('TKOIN_PLATFORM_ID'),
    'api_token' => env('TKOIN_API_TOKEN'),
    'api_secret' => env('TKOIN_API_SECRET'),
    'webhook_secret' => env('TKOIN_WEBHOOK_SECRET'),
];
```

### 7. Testing

Test the integration:

```bash
# 1. Test balance endpoint
curl -X GET https://betwin.tkoin.finance/api/user/tkoin/balance \
  -H "Authorization: Bearer {sanctum_token}"

# 2. Test deposit
curl -X POST https://betwin.tkoin.finance/api/user/tkoin/deposit \
  -H "Authorization: Bearer {sanctum_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1.0,
    "method": "p2p_marketplace"
  }'

# 3. Test withdrawal
curl -X POST https://betwin.tkoin.finance/api/user/tkoin/withdrawal \
  -H "Authorization: Bearer {sanctum_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 0.5
  }'
```

### 8. Clear Cache

After deployment:

```bash
cd /home/tkoin-betwin/htdocs/betwin.tkoin.finance
php artisan config:clear
php artisan cache:clear
php artisan view:clear
```

## Architecture Flow

### Deposit Flow
1. **User initiates deposit** → BetWin frontend calls `/api/user/tkoin/deposit`
2. **BetWin creates local settlement** → Status: `pending`
3. **BetWin calls Tkoin API** → POST `/api/platforms/platform_betwin/deposits`
4. **Tkoin Protocol processes** → Creates platformTransaction, updates platformUserBalance
5. **Tkoin sends webhook** → POST to BetWin webhook URL
6. **BetWin updates settlement** → Status: `completed`

### Withdrawal Flow
1. **User initiates withdrawal** → BetWin frontend calls `/api/user/tkoin/withdrawal`
2. **BetWin creates local settlement** → Status: `pending`
3. **BetWin calls Tkoin API** → POST `/api/platforms/platform_betwin/withdrawals`
4. **Tkoin Protocol validates balance** → Checks platformUserBalance
5. **Tkoin processes withdrawal** → Deducts from platformUserBalance
6. **Tkoin sends webhook** → POST to BetWin webhook URL
7. **BetWin updates settlement** → Status: `completed`

## Security Notes

1. **HMAC Signature** - All requests are signed with platform API secret
2. **Timestamp Validation** - Requests must be within 5-minute window
3. **Nonce Tracking** - Replay attack prevention on Tkoin side
4. **Webhook Verification** - Incoming webhooks verified with webhook secret
5. **SSL/TLS** - Use `verify => true` in production Guzzle client

## Troubleshooting

### Common Issues

**1. "Platform ID mismatch"**
- Verify `TKOIN_PLATFORM_ID=platform_betwin` in .env
- Check signature is being generated correctly

**2. "Invalid signature"**
- Ensure `TKOIN_API_SECRET` matches database value
- Verify timestamp format is ISO 8601
- Check Guzzle base_uri ends with `/`

**3. "Insufficient balance"**
- Check user has enough credits in platformUserBalances table
- Verify deposits have completed before attempting withdrawal

**4. "Webhook not received"**
- Check webhook URL is publicly accessible
- Verify webhook secret matches configuration
- Check Laravel logs for incoming requests

## Database Schema Reference

### Tkoin Protocol Tables

**platformUserBalances**
- Platform-specific user balances
- Tracks credits balance per user per platform
- Updated atomically during deposits/withdrawals

**platformTransactions**
- All deposit/withdrawal transactions
- Status tracking: pending → processing → completed
- Links to BetWin settlement via `platformSettlementId`

### BetWin Tables

**user_settlements**
- Local settlement records
- Links to Tkoin via `tkoin_transaction_id`
- Status synced via webhooks
