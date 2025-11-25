<?php
/**
 *   BetWin - Tkoin Protocol Integration
 *   ------------------------------------
 *   TkoinSettlementRepository.php
 * 
 *   @copyright  Copyright (c) BetWin, All rights reserved
 *   @author     BetWin <dev@betwin.tkoin.finance>
 *   @see        https://betwin.tkoin.finance
*/

namespace App\Repositories;

use App\Models\Account;
use App\Models\TkoinSettlement;
use App\Models\User;
use Closure;
use Illuminate\Support\Facades\DB;

class TkoinSettlementRepository
{
    /**
     * Create a new settlement record
     */
    public static function create(
        User $user,
        Account $account,
        string $type,
        float $amount,
        array $metadata = []
    ): TkoinSettlement {
        return TkoinSettlement::create([
            'user_id' => $user->id,
            'account_id' => $account->id,
            'type' => $type,
            'status' => TkoinSettlement::STATUS_PENDING,
            'amount' => $amount,
            'metadata' => $metadata,
        ]);
    }

    /**
     * Create a deposit settlement
     */
    public static function createDeposit(
        User $user,
        Account $account,
        float $amount,
        array $metadata = []
    ): TkoinSettlement {
        return self::create($user, $account, TkoinSettlement::TYPE_DEPOSIT, $amount, $metadata);
    }

    /**
     * Create a withdrawal settlement
     */
    public static function createWithdrawal(
        User $user,
        Account $account,
        float $amount,
        array $metadata = []
    ): TkoinSettlement {
        return self::create($user, $account, TkoinSettlement::TYPE_WITHDRAWAL, $amount, $metadata);
    }

    /**
     * Mark settlement as processing
     */
    public static function markProcessing(TkoinSettlement $settlement): void
    {
        $settlement->update(['status' => TkoinSettlement::STATUS_PROCESSING]);
    }

    /**
     * Complete settlement and apply to account balance
     */
    public static function completeSettlement(
        TkoinSettlement $settlement,
        string $signature = null,
        bool $applyBalance = true
    ): void {
        $settle = function () use ($settlement, $signature, $applyBalance) {
            // Mark settlement as completed
            $settlement->markCompleted($signature);

            // Apply to account balance
            if ($applyBalance) {
                self::applySettlementToBalance($settlement);
            }
        };

        DB::transaction(Closure::fromCallable($settle));
    }

    /**
     * Apply settlement amount to account balance
     */
    public static function applySettlementToBalance(TkoinSettlement $settlement): void
    {
        $account = $settlement->account;
        
        if ($settlement->isDeposit()) {
            // Increment balance for deposits
            $account->increment('balance', $settlement->amount);
        } elseif ($settlement->isWithdrawal()) {
            // Decrement balance for withdrawals
            $account->decrement('balance', $settlement->amount);
        }

        // Fire balance update event
        event(new \App\Events\UserAccountBalanceIsUpdated($account));
    }

    /**
     * Get settlement by ID
     */
    public static function findById(int $id): ?TkoinSettlement
    {
        return TkoinSettlement::find($id);
    }

    /**
     * Get settlement by Solana signature
     */
    public static function findBySignature(string $signature): ?TkoinSettlement
    {
        return TkoinSettlement::where('solana_signature', $signature)->first();
    }

    /**
     * Get user's pending settlements
     */
    public static function getUserPendingSettlements(User $user)
    {
        return TkoinSettlement::where('user_id', $user->id)
            ->pending()
            ->orderBy('created_at', 'desc')
            ->get();
    }

    /**
     * Get user's completed settlements
     */
    public static function getUserCompletedSettlements(User $user, int $limit = 50)
    {
        return TkoinSettlement::where('user_id', $user->id)
            ->completed()
            ->orderBy('completed_at', 'desc')
            ->limit($limit)
            ->get();
    }

    /**
     * Get user's settlement history
     */
    public static function getUserSettlementHistory(User $user, int $limit = 100)
    {
        return TkoinSettlement::where('user_id', $user->id)
            ->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get();
    }

    /**
     * Fail settlement with reason
     */
    public static function failSettlement(TkoinSettlement $settlement, string $reason = null): void
    {
        $settlement->markFailed($reason);
    }

    /**
     * Get settlement stats for user
     */
    public static function getUserStats(User $user): array
    {
        $deposits = TkoinSettlement::where('user_id', $user->id)
            ->completed()
            ->ofType(TkoinSettlement::TYPE_DEPOSIT)
            ->sum('amount');

        $withdrawals = TkoinSettlement::where('user_id', $user->id)
            ->completed()
            ->ofType(TkoinSettlement::TYPE_WITHDRAWAL)
            ->sum('amount');

        $pendingDeposits = TkoinSettlement::where('user_id', $user->id)
            ->pending()
            ->ofType(TkoinSettlement::TYPE_DEPOSIT)
            ->sum('amount');

        return [
            'total_deposits' => (float) $deposits,
            'total_withdrawals' => (float) $withdrawals,
            'pending_deposits' => (float) $pendingDeposits,
            'net_flow' => (float) ($deposits - $withdrawals),
        ];
    }
}
