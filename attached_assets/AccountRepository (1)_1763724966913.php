<?php
/**
 *   1Stake iGaming Platform
 *   -----------------------
 *   AccountRepository.php
 * 
 *   @copyright  Copyright (c) 1stake, All rights reserved
 *   @author     1stake <sales@1stake.app>
 *   @see        https://1stake.app
*/

namespace App\Repositories;

use App\Models\Account;
use App\Models\Currency;
use App\Models\User;

class AccountRepository
{
    
    public static function create(User $user, string $currencyCode = null): void
    {
        $currencyCodes = $currencyCode
            ? collect([$currencyCode])
            : (new CurrencyRepository)->all()->pluck('code');

        $currencyCodes->each(function ($currencyCode) use ($user) {
            $account = new Account();
            $account->uuid = str()->uuid();
            $account->currency()->associate($currencyCode);
            $account->user()->associate($user);
            $account->save();
        });
    }
}
