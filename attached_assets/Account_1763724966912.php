<?php
/**
 *   1Stake iGaming Platform
 *   -----------------------
 *   Account.php
 * 
 *   @copyright  Copyright (c) 1stake, All rights reserved
 *   @author     1stake <sales@1stake.app>
 *   @see        https://1stake.app
*/

namespace App\Models;

use App\Repositories\CurrencyRepository;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Account extends Model
{
    use HasFactory;
    use DefaultTimestampsAgoAttributes;
    use StandardDateFormat;

    
    protected $casts = [
        'balance' => 'float'
    ];

    protected $appends = ['updated_ago'];

    protected $attributes = [
        'balance' => 0
    ];

    protected $visible = ['currency_code', 'currency', 'user', 'games', 'transactions', 'commissions'];

    public function currency(): BelongsTo
    {
        return $this->belongsTo(Currency::class, 'currency_code', 'code');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function games(): HasMany
    {
        return $this->hasMany(Bet::class)->completed();
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(AccountTransaction::class);
    }

    public function commissions(): HasMany
    {
        return $this->hasMany(AffiliateCommission::class);
    }

    public function scopeOfCurrency(Builder $query, string $currencyCode): Builder
    {
        return $query->where('currency_code', $currencyCode);
    }

    
    public function externalCurrencyCode(): Attribute
    {
        return new Attribute(
            fn() => (new CurrencyRepository)->findByCode($this->currency_code)?->external_code ?? $this->currency_code
        );
    }
}
