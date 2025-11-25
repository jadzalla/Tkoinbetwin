<?php
/**
 *   BetWin - Tkoin Protocol Integration
 *   ------------------------------------
 *   TkoinService.php - CORRECTED VERSION
 * 
 *   FIXES:
 *   - getUserBalance() now queries BetWin local DB (not Tkoin Protocol API)
 *   - getUserTransactions() now queries local tkoin_settlements table
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
        $this->baseUrl = rtrim(env('TKOIN_API_URL'), '/');
        $this->platformId = env('TKOIN_PLATFORM_ID', 'platform_betwin');
        $this->apiToken = env('TKOIN_API_TOKEN');
        $this->apiSecret = env('TKOIN_API_SECRET');
        $this->webhookSecret = env('TKOIN_WEBHOOK_SECRET');
        
        $this->client = new Client();
    }

    protected function generateSignature(string $timestamp, string $body): string
    {
        return 'sha256=' . hash_hmac('sha256', $timestamp . '.' . $body, $this->apiSecret);
    }

    protected function makeRequest(string $method, string $path, array $data = null): array
    {
        $timestamp = (string)time();
        $nonce = sprintf('%s-%d', uniqid(), rand(1000, 9999));
        $body = $data ? json_encode($data) : '';
        $signature = $this->generateSignature($timestamp, $body);

        $url = $this->baseUrl . '/' . ltrim($path, '/');

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
            $response = $this->client->request($method, $url, $options);
            return json_decode($response->getBody(), true);
        } catch (\Exception $e) {
            Log::error('Tkoin API request failed', [
                'method' => $method,
                'url' => $url,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Get user balance from BetWin's LOCAL DATABASE
     * 
     * FIXED: Query BetWin DB directly (system of record)
     * NOT the external Tkoin Protocol API
     * 
     * @param User $user
     * @return array|null
     */
    public function getUserBalance(User $user): ?array
    {
        try {
            // Get account from BetWin's local database
            $account = $user->account;
            
            if (!$account) {
                Log::warning('User has no account', ['user_id' => $user->id]);
                return [
                    'balance' => 0,
                    'credits' => 0,
                    'tkoin' => 0,
                    'currency' => 'CREDIT',
                    'account_id' => null,
                ];
            }

            $balance = (float) ($account->balance ?? 0);
            $tkoinEquivalent = $balance / 100; // 100 CREDIT = 1 TKOIN

            Log::info('Fetched user balance from local DB', [
                'user_id' => $user->id,
                'account_id' => $account->id,
                'balance' => $balance,
            ]);

            return [
                'balance' => $balance,
                'credits' => $balance,
                'tkoin' => $tkoinEquivalent,
                'currency' => $account->currency_code ?? 'CREDIT',
                'account_id' => $account->id,
            ];
        } catch (\Exception $e) {
            Log::error('Failed to fetch user balance from local DB', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Get user transaction history from BetWin's LOCAL DATABASE
     * 
     * FIXED: Query local tkoin_settlements table
     * NOT the external Tkoin Protocol API
     * 
     * @param User $user
     * @param int $limit
     * @return array
     */
    public function getUserTransactions(User $user, int $limit = 10): array
    {
        try {
            $settlements = TkoinSettlement::where('user_id', $user->id)
                ->orderBy('created_at', 'desc')
                ->limit($limit)
                ->get();

            return $settlements->map(function ($settlement) {
                return [
                    'id' => $settlement->id,
                    'type' => $settlement->type,
                    'amount' => $settlement->amount,
                    'status' => $settlement->status,
                    'solana_signature' => $settlement->solana_signature,
                    'created_at' => $settlement->created_at ? $settlement->created_at->toIso8601String() : null,
                    'completed_at' => $settlement->completed_at ? $settlement->completed_at->toIso8601String() : null,
                ];
            })->toArray();
        } catch (\Exception $e) {
            Log::error('Failed to fetch user transactions from local DB', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
            return [];
        }
    }

    /**
     * Initiate deposit via Tkoin Protocol API
     */
    public function initiateDeposit(User $user, Account $account, float $amount): array
    {
        $tkoinAmount = $amount / 100;

        $settlement = TkoinSettlementRepository::createDeposit($user, $account, $amount, [
            'platform' => 'betwin',
            'user_name' => $user->name,
            'initiated_at' => now()->toIso8601String(),
        ]);

        try {
            $response = $this->makeRequest('POST', 'deposits', [
                'userId' => (string)$user->id,
                'amount' => $tkoinAmount,
                'method' => 'betwin_deposit',
                'settlementId' => (string)$settlement->id,
            ]);

            TkoinSettlementRepository::markProcessing($settlement);
            Log::info('Tkoin deposit initiated', ['settlement_id' => $settlement->id]);
            return $response;
        } catch (\Exception $e) {
            TkoinSettlementRepository::failSettlement($settlement, $e->getMessage());
            throw $e;
        }
    }

    /**
     * Initiate withdrawal via Tkoin Protocol API
     */
    public function initiateWithdrawal(User $user, Account $account, float $amount, string $solanaAddress = null): array
    {
        if ($account->balance < $amount) {
            throw new \Exception('Insufficient balance for withdrawal');
        }

        $tkoinAmount = $amount / 100;

        $settlement = TkoinSettlementRepository::createWithdrawal($user, $account, $amount, [
            'platform' => 'betwin',
            'user_name' => $user->name,
            'solana_address' => $solanaAddress,
            'initiated_at' => now()->toIso8601String(),
        ]);

        try {
            $data = [
                'userId' => (string)$user->id,
                'amount' => $tkoinAmount,
                'settlementId' => (string)$settlement->id,
            ];

            if ($solanaAddress) {
                $data['solanaWallet'] = $solanaAddress;
            }

            $response = $this->makeRequest('POST', 'withdrawals', $data);
            TkoinSettlementRepository::markProcessing($settlement);
            Log::info('Tkoin withdrawal initiated', ['settlement_id' => $settlement->id]);
            return $response;
        } catch (\Exception $e) {
            TkoinSettlementRepository::failSettlement($settlement, $e->getMessage());
            throw $e;
        }
    }

    /**
     * Verify webhook signature
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
        if (!$settlement || $settlement->isCompleted()) return;

        try {
            TkoinSettlementRepository::completeSettlement($settlement, $data['solana_signature'] ?? null, true);
            Log::info('Settlement completed via webhook', ['settlement_id' => $settlement->id]);
        } catch (\Exception $e) {
            Log::error('Failed to complete settlement', ['settlement_id' => $settlement->id, 'error' => $e->getMessage()]);
        }
    }

    /**
     * Handle settlement failed webhook
     */
    public function handleSettlementFailed(array $data): void
    {
        $settlement = TkoinSettlementRepository::findById($data['settlement_id']);
        if (!$settlement) return;

        try {
            TkoinSettlementRepository::failSettlement($settlement, $data['failure_reason'] ?? 'Unknown error');
            Log::info('Settlement failed via webhook', ['settlement_id' => $settlement->id]);
        } catch (\Exception $e) {
            Log::error('Failed to mark settlement as failed', ['settlement_id' => $settlement->id, 'error' => $e->getMessage()]);
        }
    }
}
