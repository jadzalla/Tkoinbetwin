<?php
/**
 *   1Stake iGaming Platform
 *   -----------------------
 *   AccountTransactionRepository.php
 * 
 *   @copyright  Copyright (c) 1stake, All rights reserved
 *   @author     1stake <sales@1stake.app>
 *   @see        https://1stake.app
*/

namespace App\Repositories;

use App\Events\UserAccountBalanceIsUpdated;
use App\Models\Account;
use App\Models\AccountTransaction;
use App\Models\GenericAccountTransaction;
use Closure;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class AccountTransactionRepository
{
    
    public static function create(Account $account, Model $transactionable, float $amount = NULL, bool $singleDbTransaction = TRUE): ?AccountTransaction
    {
        $amount = $amount ?: $transactionable->amount;

        if ($amount == 0) {
            return NULL;
        }

        $create = function () use ($account, $transactionable, $amount) {
            
            if ($amount > 0) {
                $account->increment('balance', $amount);
            } else {
                $account->decrement('balance', abs($amount));
            }

            
            $transaction = new AccountTransaction();
            $transaction->account()->associate($account);
            $transaction->transactionable()->associate($transactionable);
            $transaction->amount = $amount;
            $transaction->balance = $account->balance;
            $transaction->save();

            return $transaction;
        };

        $transaction = $singleDbTransaction ? DB::transaction(Closure::fromCallable($create)) : $create();

        event(new UserAccountBalanceIsUpdated($account));

        return $transaction;
    }

    
    public static function createGeneric(Account $account, int $type, float $amount): ?AccountTransaction
    {
        if ($amount == 0) {
            return NULL;
        }

        $genericTransaction = new GenericAccountTransaction();
        $genericTransaction->account()->associate($account);
        $genericTransaction->type = $type;
        $genericTransaction->amount = $amount;
        $genericTransaction->save();

        return self::create($account, $genericTransaction);
    }


    
    public static function hasBalanceDroppedBelowSince(Account $account, float $threshold, Carbon $since): bool
    {
        return AccountTransaction::where('account_id', $account->id)
            ->where('created_at', '>=', $since)
            ->where('balance', '<', $threshold)
            ->exists();
    }
}
