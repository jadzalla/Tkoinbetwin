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
     * 
     * v7.0: Added filtering support for type, status, date range
     * BACKWARD COMPATIBLE: Accepts either (User, int) or (User, array, int, int)
     * 
     * @param User $user The authenticated user
     * @param array|int $filtersOrLimit Filters array OR limit integer (for backward compatibility)
     * @param int $limit Max results to return
     * @param int $offset Pagination offset
     * @return array
     */
    public function getUserTransactions(User $user, array|int $filtersOrLimit = [], int $limit = 20, int $offset = 0): array
    {
        try {
            // v7.0: Backward compatibility - handle old signature (User, int)
            $filters = [];
            $isLegacyCall = false;
            if (is_int($filtersOrLimit)) {
                // Old call style: getUserTransactions($user, 20)
                $limit = $filtersOrLimit;
                $filters = [];
                $isLegacyCall = true;
            } else {
                // New call style: getUserTransactions($user, ['type' => 'deposit'], 20, 0)
                $filters = $filtersOrLimit;
            }
            
            $query = DB::table('tkoin_settlements')
                ->where('user_id', $user->id);
            
            // Filter by transaction type (deposit, withdrawal)
            if (!empty($filters['type']) && $filters['type'] !== 'all') {
                $query->where('type', $filters['type']);
            }
            
            // Filter by status (completed, pending, failed)
            if (!empty($filters['status']) && $filters['status'] !== 'all') {
                $query->where('status', $filters['status']);
            }
            
            // Filter by date range
            if (!empty($filters['date_from'])) {
                $query->where('created_at', '>=', $filters['date_from']);
            }
            if (!empty($filters['date_to'])) {
                $query->where('created_at', '<=', $filters['date_to'] . ' 23:59:59');
            }
            
            // Filter by amount range
            if (!empty($filters['min_amount'])) {
                $query->where('amount', '>=', (float)$filters['min_amount']);
            }
            if (!empty($filters['max_amount'])) {
                $query->where('amount', '<=', (float)$filters['max_amount']);
            }
            
            // Get total count for pagination
            $total = $query->count();
            
            // Apply ordering and pagination
            $settlements = $query
                ->orderBy('created_at', 'desc')
                ->offset($offset)
                ->limit($limit)
                ->get();

            $transactions = $settlements->map(function ($settlement) {
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
            
            // v7.0: Return format depends on call style
            if ($isLegacyCall) {
                // Old call style expects just the transactions array
                return $transactions;
            }
            
            // New call style expects paginated result with metadata
            return [
                'transactions' => $transactions,
                'total' => $total,
                'limit' => $limit,
                'offset' => $offset,
                'has_more' => ($offset + count($transactions)) < $total,
            ];
        } catch (\Exception $e) {
            Log::error('Failed to fetch user transactions', [
                'user_id' => $user->id,
                'filters' => $filters ?? [],
                'error' => $e->getMessage()
            ]);
            
            // v7.0: Return format depends on call style
            if ($isLegacyCall ?? false) {
                return [];
            }
            
            return [
                'transactions' => [],
                'total' => 0,
                'limit' => $limit,
                'offset' => $offset,
                'has_more' => false,
            ];
        }
    }
    
    /**
     * Export user transactions as CSV or JSON
     * v7.0: New method for transaction export
     * 
     * @param User $user The authenticated user
     * @param string $format 'csv' or 'json'
     * @param array $filters Optional filters (same as getUserTransactions)
     * @return array|string Returns array for JSON, CSV string for CSV
     */
    public function exportTransactions(User $user, string $format = 'csv', array $filters = []): array|string
    {
        try {
            // Get all matching transactions (no limit for export)
            $query = DB::table('tkoin_settlements')
                ->where('user_id', $user->id);
            
            // Apply same filters
            if (!empty($filters['type']) && $filters['type'] !== 'all') {
                $query->where('type', $filters['type']);
            }
            if (!empty($filters['status']) && $filters['status'] !== 'all') {
                $query->where('status', $filters['status']);
            }
            if (!empty($filters['date_from'])) {
                $query->where('created_at', '>=', $filters['date_from']);
            }
            if (!empty($filters['date_to'])) {
                $query->where('created_at', '<=', $filters['date_to'] . ' 23:59:59');
            }
            
            $settlements = $query->orderBy('created_at', 'desc')->get();
            
            $transactions = $settlements->map(function ($settlement) {
                return [
                    'id' => $settlement->id,
                    'type' => strtoupper($settlement->type),
                    'amount_credit' => (float)$settlement->amount,
                    'amount_tkoin' => (float)$settlement->amount / 100,
                    'status' => strtoupper($settlement->status),
                    'solana_signature' => $settlement->solana_signature ?? '',
                    'created_at' => $settlement->created_at,
                    'completed_at' => $settlement->completed_at ?? '',
                ];
            })->toArray();
            
            if ($format === 'json') {
                return [
                    'export_date' => now()->toIso8601String(),
                    'user_id' => $user->id,
                    'total_transactions' => count($transactions),
                    'transactions' => $transactions,
                ];
            }
            
            // Generate CSV with BOM for Excel compatibility
            $csv = "\xEF\xBB\xBF"; // UTF-8 BOM
            $csv .= "ID,Type,Amount (CREDIT),Amount (TKOIN),Status,Solana Signature,Created At,Completed At\n";
            
            foreach ($transactions as $tx) {
                $csv .= sprintf(
                    "%d,%s,%.2f,%.4f,%s,%s,%s,%s\n",
                    $tx['id'],
                    $tx['type'],
                    $tx['amount_credit'],
                    $tx['amount_tkoin'],
                    $tx['status'],
                    $tx['solana_signature'],
                    $tx['created_at'],
                    $tx['completed_at']
                );
            }
            
            return $csv;
        } catch (\Exception $e) {
            Log::error('Failed to export transactions', [
                'user_id' => $user->id,
                'format' => $format,
                'error' => $e->getMessage()
            ]);
            throw $e;
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
