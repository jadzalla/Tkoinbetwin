<?php
/**
 *   BetWin - Tkoin Protocol Integration
 *   ------------------------------------
 *   TkoinService.php (UPDATED for Platform API)
 * 
 *   @copyright  Copyright (c) BetWin, All rights reserved
 *   @author     BetWin <dev@betwin.tkoin.finance>
 *   @see        https://betwin.tkoin.finance
*/

namespace App\Services;

use App\Models\Account;
use App\Models\TkoinSettlement;
use App\Models\User;
use App\Repositories\TkoinSettlementRepository;
use GuzzleHttp\Client;
use Illuminate\Support\Facades\Log;

class TkoinService
{
    protected Client $client;
    protected string $baseUrl;
    protected string $platformId;
    protected string $apiToken;
    protected string $apiSecret;
    protected string $webhookSecret;

    public function __construct()
    {
        $this->baseUrl = rtrim(env('TKOIN_API_URL', 'https://tkoin.replit.dev/api/platforms/platform_betwin'), '/');
        $this->platformId = env('TKOIN_PLATFORM_ID', 'platform_betwin');
        $this->apiToken = env('TKOIN_API_TOKEN');
        $this->apiSecret = env('TKOIN_API_SECRET');
        $this->webhookSecret = env('TKOIN_WEBHOOK_SECRET');
        $this->client = new Client(['base_uri' => $this->baseUrl]);
    }

    /**
     * Generate HMAC signature for Platform API requests
     */
    protected function generateSignature(string $timestamp, string $body): string
    {
        $message = $timestamp . '.' . $body;
        return 'sha256=' . hash_hmac('sha256', $message, $this->apiSecret);
    }

    /**
     * Make authenticated request to Tkoin Platform API
     */
    protected function makeRequest(string $method, string $path, array $data = null): array
    {
        $timestamp = (string)time();
        $nonce = sprintf('%s-%d', uniqid(), rand(1000, 9999));
        $body = $data ? json_encode($data) : '';
        $signature = $this->generateSignature($timestamp, $body);

        $options = [
            'headers' => [
                'Content-Type' => 'application/json',
                'X-Platform-Token' => $this->apiToken,
                'X-Timestamp' => $timestamp,
                'X-Signature' => $signature,
                'X-Nonce' => $nonce,
            ],
        ];

        if ($data) {
            $options['json'] = $data;
        }

        try {
            $response = $this->client->request($method, $path, $options);
            return json_decode($response->getBody(), true);
        } catch (\Exception $e) {
            Log::error('Tkoin API request failed', [
                'method' => $method,
                'path' => $path,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Initiate a deposit request to Tkoin
     * 
     * @param User $user
     * @param Account $account
     * @param float $amount Amount in Credits
     * @return array Deposit response from Tkoin API
     */
    public function initiateDeposit(User $user, Account $account, float $amount): array
    {
        // Convert credits to TKOIN (1 TKOIN = 100 CREDITS)
        $tkoinAmount = $amount / 100;

        // Create settlement record
        $settlement = TkoinSettlementRepository::createDeposit(
            $user,
            $account,
            $amount,
            [
                'platform' => 'betwin',
                'user_name' => $user->name,
                'initiated_at' => now()->toIso8601String(),
            ]
        );

        try {
            // Call Tkoin Platform API
            $response = $this->makeRequest('POST', '/deposits', [
                'userId' => (string)$user->id,
                'amount' => $tkoinAmount,
                'method' => 'betwin_deposit',
                'settlementId' => (string)$settlement->id,
            ]);

            // Mark settlement as processing
            TkoinSettlementRepository::markProcessing($settlement);

            Log::info('Tkoin deposit initiated', [
                'settlement_id' => $settlement->id,
                'user_id' => $user->id,
                'amount' => $amount,
                'response' => $response,
            ]);

            return $response;
        } catch (\Exception $e) {
            // Mark settlement as failed
            TkoinSettlementRepository::failSettlement($settlement, $e->getMessage());
            throw $e;
        }
    }

    /**
     * Initiate a withdrawal request to Tkoin
     * 
     * @param User $user
     * @param Account $account
     * @param float $amount Amount in Credits
     * @param string $solanaAddress Optional: target Solana address
     * @return array Withdrawal response from Tkoin API
     */
    public function initiateWithdrawal(User $user, Account $account, float $amount, string $solanaAddress = null): array
    {
        // Check balance
        if ($account->balance < $amount) {
            throw new \Exception('Insufficient balance for withdrawal');
        }

        // Convert credits to TKOIN (1 TKOIN = 100 CREDITS)
        $tkoinAmount = $amount / 100;

        // Create settlement record
        $settlement = TkoinSettlementRepository::createWithdrawal(
            $user,
            $account,
            $amount,
            [
                'platform' => 'betwin',
                'user_name' => $user->name,
                'solana_address' => $solanaAddress,
                'initiated_at' => now()->toIso8601String(),
            ]
        );

        try {
            // Call Tkoin Platform API
            $data = [
                'userId' => (string)$user->id,
                'amount' => $tkoinAmount,
                'settlementId' => (string)$settlement->id,
            ];

            if ($solanaAddress) {
                $data['solanaWallet'] = $solanaAddress;
            }

            $response = $this->makeRequest('POST', '/withdrawals', $data);

            // Mark settlement as processing
            TkoinSettlementRepository::markProcessing($settlement);

            Log::info('Tkoin withdrawal initiated', [
                'settlement_id' => $settlement->id,
                'user_id' => $user->id,
                'amount' => $amount,
                'response' => $response,
            ]);

            return $response;
        } catch (\Exception $e) {
            // Mark settlement as failed
            TkoinSettlementRepository::failSettlement($settlement, $e->getMessage());
            throw $e;
        }
    }

    /**
     * Check user balance from Tkoin Platform API
     * 
     * @param User $user
     * @return array|null Balance information (tkoinBalance, creditsBalance, etc.)
     */
    public function getUserBalance(User $user): ?array
    {
        try {
            $response = $this->makeRequest('GET', "/users/{$user->id}/balance");
            
            Log::info('Fetched Tkoin balance', [
                'user_id' => $user->id,
                'balance' => $response,
            ]);

            return $response;
        } catch (\Exception $e) {
            Log::error('Failed to fetch Tkoin balance', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Get user transaction history from Tkoin Platform API
     * 
     * @param User $user
     * @param int $limit Number of transactions to fetch
     * @return array Transaction list with pagination
     */
    public function getUserTransactions(User $user, int $limit = 10): array
    {
        try {
            $response = $this->makeRequest('GET', "/users/{$user->id}/transactions?limit={$limit}");
            
            Log::info('Fetched user transactions', [
                'user_id' => $user->id,
                'count' => count($response['transactions'] ?? []),
            ]);

            return $response['transactions'] ?? [];
        } catch (\Exception $e) {
            Log::error('Failed to fetch user transactions', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
            return [];
        }
    }

    /**
     * Verify webhook signature from Tkoin
     */
    public function verifyWebhookSignature(string $payload, string $signature): bool
    {
        $expectedSignature = hash_hmac('sha256', $payload, $this->webhookSecret);
        return hash_equals($expectedSignature, $signature);
    }

    /**
     * Handle settlement completed webhook
     */
    public function handleSettlementCompleted(array $data): void
    {
        $settlement = TkoinSettlementRepository::findById($data['settlement_id']);

        if (!$settlement) {
            Log::warning('Settlement not found for webhook', $data);
            return;
        }

        if ($settlement->isCompleted()) {
            Log::info('Settlement already completed', ['settlement_id' => $settlement->id]);
            return;
        }

        try {
            // Complete the settlement and apply to balance
            TkoinSettlementRepository::completeSettlement(
                $settlement,
                $data['solana_signature'] ?? null,
                true
            );

            Log::info('Settlement completed via webhook', [
                'settlement_id' => $settlement->id,
                'type' => $settlement->type,
                'amount' => $settlement->amount,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to complete settlement', [
                'settlement_id' => $settlement->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Handle settlement failed webhook
     */
    public function handleSettlementFailed(array $data): void
    {
        $settlement = TkoinSettlementRepository::findById($data['settlement_id']);

        if (!$settlement) {
            Log::warning('Settlement not found for failed webhook', $data);
            return;
        }

        try {
            TkoinSettlementRepository::failSettlement(
                $settlement,
                $data['failure_reason'] ?? 'Unknown error'
            );

            Log::info('Settlement failed via webhook', [
                'settlement_id' => $settlement->id,
                'reason' => $data['failure_reason'] ?? null,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to mark settlement as failed', [
                'settlement_id' => $settlement->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
