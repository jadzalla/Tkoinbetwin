<?php
/**
 *   1Stake iGaming Platform
 *   -----------------------
 *   User.php
 * 
 *   @copyright  Copyright (c) 1stake, All rights reserved
 *   @author     1stake <sales@1stake.app>
 *   @see        https://1stake.app
*/

namespace App\Models;
use Laravel\Sanctum\HasApiTokens;

use App\Casts\UserFields;
use App\Casts\UserFlags;
use App\Helpers\PackageManager;
use App\Models\Scopes\DbScope;
use App\Models\Scopes\PeriodScope;
use App\Models\Scopes\UserRoleScope;
use App\Notifications\ResetPassword;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Notifications\Notifiable;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Foundation\Auth\User as Authenticatable;


class User extends Authenticatable implements MustVerifyEmail
{
    use HasFactory;
    use Notifiable;
    use HasApiTokens;
    use DefaultTimestampsAgoAttributes;
    use StandardDateFormat;
    use PeriodScope;
    use UserRoleScope;

    const ROLE_USER  = 1;
    const ROLE_ADMIN = 2;
    const ROLE_BOT   = 4;

    const STATUS_ACTIVE  = 0;
    const STATUS_BLOCKED = 1;

    
    const KYC_STATUS_NOT_STARTED = 0;
    const KYC_STATUS_PENDING = 1;
    const KYC_STATUS_PASSED = 2;
    const KYC_STATUS_FAILED = 10;

    
    const PERMISSION_ACCOUNTS = 'accounts';
    const PERMISSION_ADDONS = 'add-ons';
    const PERMISSION_AUDIT_LOGS = 'audit-logs';
    const PERMISSION_AFFILIATES = 'affiliates';
    const PERMISSION_BONUSES = 'bonuses';
    const PERMISSION_PROMO_CODES = 'promo-codes';
    const PERMISSION_VIP = 'vip';
    const PERMISSION_CHAT = 'chat';
    const PERMISSION_DASHBOARD = 'dashboard';
    const PERMISSION_HELP = 'help';
    const PERMISSION_GAMES = 'games';
    const PERMISSION_GAMES_PROVIDERS = 'game-providers';
    const PERMISSION_KYC = 'kyc';
    const PERMISSION_MAINTENANCE = 'maintenance';
    const PERMISSION_SETTINGS = 'settings';
    const PERMISSION_USERS = 'users';
    const PERMISSION_FILES = 'files';
    const PERMISSION_SECURE_FILES = 'secure-files';
    
    const PERMISSION_DEPOSITS = 'deposits';
    const PERMISSION_DEPOSIT_METHODS = 'deposit-methods';
    const PERMISSION_WITHDRAWALS = 'withdrawals';
    const PERMISSION_WITHDRAWAL_METHODS = 'withdrawal-methods';
    
    const PERMISSION_RAFFLES = 'raffles';

    const ACCESS_NONE = 0;
    const ACCESS_READONLY = 1;
    const ACCESS_FULL = 10;

    protected $visible = [
        'code',
        'name',
        
        'display_name',
        'avatar_url',
        'is_online'
    ];

    protected $casts = [
        'email_verified_at'     => 'datetime',
        'password'              => 'hashed',
        'bet_count'             => 'integer',
        'bet_total'             => 'float',
        'last_seen_at'          => 'datetime',
        'banned_from_chat'      => 'boolean',
        'permissions'           => 'collection',
        'affiliate_commissions' => 'collection',
        'role'                  => 'integer',
        'status'                => 'integer',
        'fields'                => UserFields::class,
        'flags'                 => UserFlags::class,
    ];

    protected $appends = ['display_name', 'avatar_url', 'is_online'];

    
    public function referrer()
    {
        return $this->belongsTo(User::class);
    }

    
    public function referees()
    {
        return $this->hasMany(User::class, 'referrer_id');
    }

    public function rank(): BelongsTo
    {
        return $this->belongsTo(Rank::class);
    }

    
    public function scopeActive($query): Builder
    {
        return $query->where('users.status', '=', self::STATUS_ACTIVE);
    }

    
    public function scopeBot($query): Builder
    {
        return $query->where('users.role', '=', self::ROLE_BOT);
    }

    
    public function scopeRegular($query)
    {
        return $query->where('users.role', '=', self::ROLE_USER);
    }

    
    public function scopeNotAdmin($query)
    {
        return $query->where('users.role', '!=', self::ROLE_ADMIN);
    }

    public function account()
    {
        $currencyCode = session('user.accounts.selected-currency');

        return $currencyCode
            ? $this->accounts()->one()->where('currency_code', $currencyCode)
            : $this->accounts()->one()->oldestOfMany();
    }

    protected static function booted(): void
    {
        static::addGlobalScope(new DbScope());
    }

    public function accounts(): HasMany
    {
        return $this->hasMany(Account::class);
    }

    public function transactions(): HasManyThrough
    {
        return $this->hasManyThrough(AccountTransaction::class, Account::class);
    }

    public function commission(): MorphMany
    {
        return $this->morphMany(AffiliateCommission::class, 'commissionable');
    }

    public function games(): HasManyThrough
    {
        return $this->hasManyThrough(Bet::class, Account::class);
    }

    public function chatMessages(): HasMany
    {
        return $this->hasMany(ChatMessage::class);
    }

    
    public function devices(): HasMany
    {
        return $this->hasMany(Device::class);
    }

    
    public function ipHistories(): HasMany
    {
        return $this->hasMany(UserIpHistory::class);
    }

    public function latestIpHistory(): HasOne
    {
        return $this->ipHistories()->one()->latest();
    }

    
    public function gravatarUrl(): Attribute
    {
        return new Attribute(
            get: fn () => 'https://www.gravatar.com/avatar/'.md5(strtolower($this->email)).'.jpg?s=100&d=mp'
        );
    }


    
    public function avatarUrl(): Attribute
    {
        return new Attribute(
            get: fn () => $this->avatar ? asset('storage/avatars/' . $this->avatar) : $this->gravatar_url
        );
    }

    
    public function affiliateUrl(): Attribute
    {
        return new Attribute(
            get: fn () => url('?ref=' . md5($this->code))
        );
    }

    
    public function twoFactorAuthEnabled(): Attribute
    {
        return new Attribute(
            get: fn () => $this->totp_secret ? TRUE : FALSE
        );
    }

    
    public function twoFactorAuthPassed(): Attribute
    {
        return new Attribute(
            get: fn () => request()->session()->get('two_factor_auth_passed', FALSE)
        );
    }

    
    public function isAdmin(): Attribute
    {
        return new Attribute(
            get: fn () => $this->hasRole(self::ROLE_ADMIN)
        );
    }

    
    public function isBot(): Attribute
    {
        return new Attribute(
            get: fn () => $this->hasRole(self::ROLE_BOT)
        );
    }

    
    public function isActive(): Attribute
    {
        return new Attribute(
            get: fn () => $this->status == self::STATUS_ACTIVE
        );
    }

    
    public function isOnline(): Attribute
    {
        return new Attribute(
            get: fn ($value, array $attrs) => $value && $value->gte(Carbon::now()->subSeconds($attrs['is_bot'] ? 300 : 120)),
            set: fn (bool $value) => ['last_seen_at' => $value ? Carbon::now() : $this->last_seen_at]
        );
    }

    
    public function profiles(): HasMany
    {
        return $this->hasMany(SocialProfile::class);
    }

    
    public function delete()
    {
        if ($this->avatar) {
            Storage::disk('public')->delete('avatars/' . $this->avatar);
        }

        return parent::delete();
    }

    
    public function hasVerifiedEmail(): bool
    {
        return !$this->is_bot && (config('settings.users.email_auth') && config('settings.users.email_verification')) ? !is_null($this->email_verified_at) : TRUE;
    }

    
    public function sendPasswordResetNotification($token)
    {
        $this->notify(new ResetPassword($token));
    }

    
    public function hasRole($role): bool
    {
        return isset($this->role) && $this->role == $role;
    }

    
    public function hasReadOnlyAccess(string $module): bool
    {
        return is_null($this->permissions) || (int)$this->permissions->get($module) >= self::ACCESS_READONLY;
    }

    
    public function hasFullAccess(string $module): bool
    {
        return is_null($this->permissions) || (int)$this->permissions->get($module) >= self::ACCESS_FULL;
    }

    
    public function totpSecret(): Attribute
    {
        return new Attribute(
            get: fn ($value) => $value ? decrypt($value) : NULL,
            set: fn ($value) => encrypt($value)
        );
    }

    public static function roles(): array
    {
        return [
            self::ROLE_USER => __('User'),
            self::ROLE_ADMIN => __('Admin'),
            self::ROLE_BOT => __('Bot'),
        ];
    }

    public static function statuses(): array
    {
        return [
            self::STATUS_ACTIVE => __('Active'),
            self::STATUS_BLOCKED => __('Blocked'),
        ];
    }

    public static function kycStatuses(): array
    {
        return [
            self::KYC_STATUS_NOT_STARTED => __('Not started'),
            self::KYC_STATUS_PENDING => __('Pending'),
            self::KYC_STATUS_PASSED => __('Passed'),
            self::KYC_STATUS_FAILED => __('Failed'),
        ];
    }

    public static function accessModes(): array
    {
        return [
            self::ACCESS_NONE => __('None'),
            self::ACCESS_READONLY => __('Read only'),
            self::ACCESS_FULL => __('Full'),
        ];
    }

    public static function permissions(): array
    {
        $packageManager = app()->make(PackageManager::class);

        $permissions = [
            self::PERMISSION_DASHBOARD => __('Dashboard'),
            self::PERMISSION_USERS => __('Users'),
            self::PERMISSION_ACCOUNTS => __('Accounts'),
            self::PERMISSION_KYC => __('KYC'),
            self::PERMISSION_GAMES => __('Games'),
            self::PERMISSION_BONUSES => __('Bonuses'),
            self::PERMISSION_PROMO_CODES => __('Promo codes'),
            self::PERMISSION_VIP => __('VIP'),
            self::PERMISSION_AFFILIATES => __('Affiliates'),
            self::PERMISSION_CHAT => __('Chat'),
            self::PERMISSION_SETTINGS => __('Settings'),
            self::PERMISSION_MAINTENANCE => __('Maintenance'),
            self::PERMISSION_AUDIT_LOGS => __('Audit log'),
            self::PERMISSION_ADDONS => __('Add-ons'),
            self::PERMISSION_HELP => __('Help'),
            self::PERMISSION_FILES => __('Files'),
            self::PERMISSION_SECURE_FILES => __('Secure files'),
        ];

        if ($packageManager->get('game-providers')->installed) {
            $permissions[self::PERMISSION_GAMES_PROVIDERS] = __('Games providers');
        }

        if ($packageManager->get('raffle')->installed) {
            $permissions[self::PERMISSION_RAFFLES] = __('Raffles');
        }

        if ($packageManager->get('payments')->installed) {
            $permissions[self::PERMISSION_DEPOSITS] = __('Deposits');
            $permissions[self::PERMISSION_DEPOSIT_METHODS] = __('Deposit methods');
            $permissions[self::PERMISSION_WITHDRAWALS] = __('Withdrawals');
            $permissions[self::PERMISSION_WITHDRAWAL_METHODS] = __('Withdrawal methods');
        }

        return $permissions;
    }

    
    public function getAuthIdentifierForBroadcasting(): string
    {
        return $this->code;
    }

    
    public function displayName(): Attribute
    {
        return new Attribute(
            get: function () {
                $name = str($this->name);
                return $name->startsWith('0x') && $name->length() >= 26
                    ? $name->substr(0, 4) . '...' . $name->substr(-4)
                    : $this->name;
            }
        );
    }

    
    public function lastSeenAgo(): Attribute
    {
        return new Attribute(
            get: fn () => $this->last_seen_at ? $this->last_seen_at->diffForHumans() : NULL
        );
    }

    
    public function roleTitle(): Attribute
    {
        return new Attribute(
            get: fn () => self::roles()[$this->role] ?? ''
        );
    }

    
    public function statusTitle(): Attribute
    {
        return new Attribute(
            get: fn () => self::statuses()[$this->status] ?? ''
        );
    }

    
    public function kycStatusTitle(): Attribute
    {
        return new Attribute(
            get: fn () => self::kycStatuses()[$this->kyc_status] ?? ''
        );
    }

    
    public function kycPassed(): Attribute
    {
        return new Attribute(
            get: fn () => $this->kyc_status === self::KYC_STATUS_PASSED,
            set: fn ($value) => ['kyc_status' => $value ? self::KYC_STATUS_PASSED : $this->kyc_status]
        );
    }

    public function kycFailed(): Attribute
    {
        return new Attribute(
            get: fn () => $this->kyc_status === self::KYC_STATUS_FAILED,
            set: fn ($value) => ['kyc_status' => $value ? self::KYC_STATUS_FAILED : $this->kyc_status]
        );
    }

    public function safeAttributes(): Attribute
    {
        return new Attribute(fn () => ['code', 'display_name', 'avatar_url']);
    }

    
    public function affiliateCommissionRates(): Attribute
    {
        return new Attribute(fn () => $this->affiliate_commissions ?? config('settings.affiliate.commissions'));
    }

    public function safe(): Attribute
    {
        
        return new Attribute(fn () => $this->only($this->safeAttributes));
    }

    public function profile(): Attribute
    {
        return new Attribute(function () {
           $fields = ['email', 'avatar', 'fields', 'permissions', 'email_verified_at'];

           $relations = ['account', 'accounts', 'profiles', 'rank', 'rank.group:id,name,icon,color'];

           $attributes = ['two_factor_auth_enabled', 'two_factor_auth_passed', 'is_admin', 'affiliate_url', 'affiliate_commission_rates'];

           if (config('settings.kyc.enabled')) {
               $attributes[] = 'kyc_passed';
           }

           $this
               ->makeVisible(...$fields, ...$relations, ...$attributes)
               ->append($attributes)
               ->loadMissing(...$relations, ...['account.currency', 'accounts.currency']);

           $this->account->makeVisible('balance');
           $this->accounts->map->makeVisible('balance');

           return $this;
        });
    }

    public function makeVisibleAll(): static
    {
        $fields = collect($this->getAttributes())->except(['password', 'remember_token', 'totp_secret'])->keys()->toArray();

        $relations = ['referrer', 'profiles', 'rank'];

        $attributes =  [
            'two_factor_auth_enabled', 'two_factor_auth_passed',
            'role_title', 'status_title', 'kyc_status_title',
            'is_admin', 'is_bot', 'is_active',
            'created_ago', 'last_seen_ago'
        ];

        return $this
            ->makeVisible(...$fields, ...$relations, ...$attributes)
            ->append($attributes)
            ->loadMissing($relations);
    }
}
