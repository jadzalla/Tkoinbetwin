<?php
namespace App\Services;

use App\Models\Account;
use App\Models\TkoinSettlement;
use App\Models\User;
use App\Repositories\TkoinSettlementRepository;
use GuzzleHttp\Client;
use Illuminate\Support\Facades\DB;
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
     * Get user balance from BetWin's local database
     * 
     * FIXED: Query BetWin DB directly (Option A - local system of record)
     * NOT the Tkoin Protocol API
     */
    public function getUserBalance(User $user): ?array
    {
        try {
            $account = $user->account;
            
            if (!$account) {
                Log::warning('User has no account', ['user_id' => $user->id]);
                return [
                    'balance' => 0,
                    'currency' => 'CREDIT',
                    'account_id' => 'N/A',
                    'tkoin_equivalent' => 0
                ];
            }

            $balance = $account->balance ?? 0;
            
            // Return balance from BetWin's local database
            return [
                'balance' => $balance,
                'currency' => 'CREDIT',
                'account_id' => $account->id ?? $user->id,
                'tkoin_equivalent' => $balance / 100
            ];
        } catch (\Exception $e) {
            Log::error('Failed to fetch user balance from local DB', [
                'user_id' => $user->id,
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }

    /**
     * Get user transaction history from local database
     * FIXED: Returns ALL fields including id, solana_signature, completed_at
     * Returns both deposits AND withdrawals from tkoin_settlements table
     */
    public function getUserTransactions(User $user, int $limit = 20): array
    {
        try {
            // Query directly from tkoin_settlements table to get all transaction types
            // Using DB facade to ensure we get all fields without model filtering
            $settlements = DB::table('tkoin_settlements')
                ->where('user_id', $user->id)
                ->orderBy('created_at', 'desc')
                ->limit($limit)
                ->get();

            return $settlements->map(function ($settlement) {
                return [
                    'id' => $settlement->id,
                    'type' => $settlement->type,
                    'amount' => (float)$settlement->amount,
                    'status' => $settlement->status,
                    'solana_signature' => $settlement->solana_signature,
                    'created_at' => $settlement->created_at,
                    'completed_at' => $settlement->completed_at,
                ];
            })->toArray();
        } catch (\Exception $e) {
            Log::error('Failed to fetch user transactions', [
                'user_id' => $user->id,
                'error' => $e->getMessage()
            ]);
            return [];
        }
    }

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

    public function verifyWebhookSignature(string $payload, string $signature): bool
    {
        $expectedSignature = hash_hmac('sha256', $payload, $this->webhookSecret);
        return hash_equals($expectedSignature, $signature);
    }

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
