<?php
namespace App\Services;

use App\Models\Account;
use App\Models\TkoinSettlement;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class TkoinService
{
    protected string $baseUrl;

    public function __construct()
    {
        $this->baseUrl = rtrim(env('TKOIN_API_URL', 'https://tkoin.finance'), '/');
    }

    /**
     * Get user balance from BetWin's local database
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
     * Get user transaction history - FIXED to include all fields
     * Returns both deposits AND withdrawals from tkoin_settlements table
     */
    public function getUserTransactions(User $user, int $limit = 20): array
    {
        try {
            // Query directly from tkoin_settlements table to get all transaction types
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

    /**
     * Verify webhook signature
     */
    public function verifyWebhookSignature(string $payload, string $signature): bool
    {
        $webhookSecret = env('TKOIN_WEBHOOK_SECRET');
        $expectedSignature = hash_hmac('sha256', $payload, $webhookSecret);
        return hash_equals($expectedSignature, $signature);
    }
}
