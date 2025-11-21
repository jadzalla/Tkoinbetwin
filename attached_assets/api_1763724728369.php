<?php
/**
 *   1Stake iGaming Platform
 *   -----------------------
 *   api.php
 * 
 *   @copyright  Copyright (c) 1stake, All rights reserved
 *   @author     1stake <sales@1stake.app>
 *   @see        https://1stake.app
*/

use App\Http\Controllers\Admin\AuditLogController;
use App\Http\Controllers\Admin\BonusController as AdminBonusController;
use App\Http\Controllers\Admin\BonusRuleController as AdminBonusRuleController;
use App\Http\Controllers\Admin\CurrencyController as AdminCurrencyController;
use App\Http\Controllers\Admin\UserDeviceController as AdminUserDeviceController;
use App\Http\Controllers\Admin\HelpController;
use App\Http\Controllers\Admin\KycProviderController as AdminKycProviderController;
use App\Http\Controllers\Admin\SecureFileController;
use App\Http\Controllers\Admin\TestController;
use App\Http\Controllers\Admin\UserIpHistoryController as AdminUserIpHistoryController;
use App\Http\Controllers\AssetController;
use App\Http\Controllers\Auth\Web3AuthController;
use App\Http\Controllers\Admin\KycController as AdminKycController;
use App\Http\Controllers\KycController;
use App\Http\Controllers\MultiplayerGameController;
use App\Http\Controllers\User\CashbackController;
use App\Http\Controllers\User\FaucetController;
use App\Http\Controllers\User\TipController;
use App\Http\Middleware\CanViewUserProfiles;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Admin\AccountController as AdminAccountController;
use App\Http\Controllers\Admin\AddonController;
use App\Http\Controllers\Admin\AffiliateController as AdminAffiliateController;
use App\Http\Controllers\Admin\ChatMessageController;
use App\Http\Controllers\Admin\ChatRoomController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\FileController;
use App\Http\Controllers\Admin\BetController as AdminBetController;
use App\Http\Controllers\Admin\LicenseController;
use App\Http\Controllers\Admin\MaintenanceController;
use App\Http\Controllers\Admin\SettingController;
use App\Http\Controllers\Admin\UserController as AdminUserController;
use App\Http\Controllers\Auth\ForgotPasswordController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\OauthController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\Auth\ResetPasswordController;
use App\Http\Controllers\Auth\VerificationController;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\GameRoomController;
use App\Http\Controllers\BetHistoryController;
use App\Http\Controllers\LeaderboardController;
use App\Http\Controllers\PageController;
use App\Http\Controllers\User\AccountController;
use App\Http\Controllers\User\AffiliateController;
use App\Http\Controllers\User\ProvableBetController;
use App\Http\Controllers\User\PasswordController;
use App\Http\Controllers\User\TwoFactorAuthController;
use App\Http\Controllers\User\UserController;
use App\Http\Controllers\Admin\PromoCodeController as AdminPromoCodeController;
use App\Http\Controllers\PromoCodeController;
use App\Http\Controllers\Admin\RankGroupController as AdminRankGroupController;
use App\Http\Controllers\Admin\RankController as AdminRankController;
use App\Http\Controllers\Admin\XpRateController as AdminXpRateController;
use Illuminate\Support\Facades\Broadcast;
use App\Http\Controllers\VipController;
use App\Http\Controllers\Admin\XpTransactionController as AdminXpTransactionController;




Route::prefix('pages')
    ->group(function () {
        Route::get('{page}', [PageController::class, 'show'])->name('pages.static');
    });

Route::name('bets.')
    ->prefix('bets')
    ->group(function () {
        Route::get('latest', [PageController::class, 'getLatestBets'])->name('latest');
        Route::get('big', [PageController::class, 'getBigBets'])->name('big');
        Route::get('biggest-win', [PageController::class, 'getBiggestWin'])->name('biggest-win');
        Route::get('last-win', [PageController::class, 'getLastWin'])->name('last-win');
        Route::get('count', [PageController::class, 'getBetCount'])->name('count');
    });

Route::name('assets.')
    ->prefix('assets')
    ->group(function () {
        Route::get('', [AssetController::class, 'index'])->name('index');
        Route::get('{asset}/price', [AssetController::class, 'price'])->name('price');
        Route::get('{asset}/history', [AssetController::class, 'history'])->name('history');
        Route::post('search', [AssetController::class, 'search'])->name('search');
    });

Route::name('webhooks.')
    ->prefix('webhooks')
    ->middleware('log')
    ->group(function () {
        Route::post('kyc', [KycController::class, 'processWebhook'])->name('kyc');
    });


Route::name('auth.')
    ->prefix('auth')
    ->middleware(['guest', 'maintenance', 'email_auth'])
    ->group(function () {
        Route::post('login', [LoginController::class, 'login'])->name('login');
        Route::post('register', [RegisterController::class, 'register'])->name('register');
        Route::post('password/email', [ForgotPasswordController::class, 'sendResetLinkEmail'])->name('email');
        Route::post('password/reset', [ResetPasswordController::class, 'reset'])->name('reset');
    });

Route::name('auth.web3.')
    ->prefix('auth/web3')
    ->middleware(['guest', 'maintenance'])
    ->group(function () {
        Route::get('nonce', [Web3AuthController::class, 'nonce'])->name('nonce');
        Route::post('{provider}', [Web3AuthController::class, 'login'])->name('login');
    });


Route::name('verification.')
    ->prefix('email')
    ->middleware(['auth:sanctum', 'maintenance', 'email_auth', 'active'])
    ->group(function () {
        Route::post('resend', [VerificationController::class, 'resend'])->name('resend')->middleware('throttle:6,1');
    });


Route::prefix('auth')
    ->middleware(['auth:sanctum', 'maintenance', 'active'])
    ->group(function () {
        Route::post('logout', [LoginController::class, 'logout'])->name('auth.logout');
    });


Route::prefix('oauth')
    ->middleware(['guest', 'maintenance', 'social'])
    ->group(function () {
        Route::post('{provider}/url', [OauthController::class, 'url'])->name('oauth.url');
        Route::get('{provider}/callback', [OauthController::class, 'callback'])->middleware('log');
    });


Route::name('user.')
    ->prefix('user')
    ->middleware(['cookies', 'user'])
    ->group(function () {
        
        Route::get('', [UserController::class, 'show'])->name('show');
        Route::get('profile', [UserController::class, 'profile'])->name('profile');
        Route::post('update', [UserController::class, 'update'])->name('update');
        
        Route::get('kyc', [KycController::class, 'show'])->name('kyc.show')->middleware('kyc_enabled');
        Route::post('kyc', [KycController::class, 'store'])->name('kyc.store')->middleware('kyc_enabled');
        
        Route::patch('security/password/update', [PasswordController::class, 'update'])->name('security.password.update');
        
        Route::post('security/2fa/enable', [TwoFactorAuthController::class, 'enable'])->name('security.2fa.enable');
        Route::post('security/2fa/confirm', [TwoFactorAuthController::class, 'confirm'])->name('security.2fa.confirm');
        Route::post('security/2fa/verify', [TwoFactorAuthController::class, 'verify'])->name('security.2fa.verify');
        Route::post('security/2fa/disable', [TwoFactorAuthController::class, 'disable'])->name('security.2fa.disable');
        
        Route::get('affiliates/info', [AffiliateController::class, 'info'])->name('affiliates.info');
        Route::get('affiliates/stats', [AffiliateController::class, 'stats'])->name('affiliates.stats');
        Route::get('affiliates/commissions', [AffiliateController::class, 'commissions'])->name('affiliates.commissions');
        
        Route::patch('accounts/currencies/{currency:code}/select', [AccountController::class, 'select'])->name('accounts.currencies.select');
        Route::get('account/bets', [AccountController::class, 'bets'])->name('account.bets');
        Route::get('account/transactions', [AccountController::class, 'transactions'])->name('account.transactions');
        Route::get('account/cashback', [CashbackController::class, 'show'])->middleware('kyc')->name('cashback.show');
        Route::post('account/cashback', [CashbackController::class, 'claim'])->middleware('kyc')->name('cashback.claim')->middleware('concurrent');
        Route::get('account/faucet', [FaucetController::class, 'show'])->middleware('kyc')->name('faucet.show');
        Route::post('account/faucet', [FaucetController::class, 'claim'])->middleware('kyc')->name('faucet.claim')->middleware('concurrent');
        Route::post('account/promo-codes', [PromoCodeController::class, 'redeem'])->name('promo-codes.redeem')->middleware('concurrent');
        
        Route::post('provable-bets/create', [ProvableBetController::class, 'create'])->middleware('kyc')->name('provable-bets.create');
    });


Broadcast::routes(['middleware' => ['user']]);


Route::middleware(['cookies', 'user'])
    ->group(function () {
        
        Route::get('users/{user:code}', [UserController::class, 'userProfile'])
            ->middleware(CanViewUserProfiles::class)
            ->name('users.profile');

        
        Route::post('users/{user:code}/tip', [TipController::class, 'send'])->name('users.tip');
        
        Route::get('history/recent', [BetHistoryController::class, 'recent'])->middleware('access.page')->name('history.recent');
        Route::get('history/wins', [BetHistoryController::class, 'wins'])->middleware('access.page')->name('history.wins');
        Route::get('history/losses', [BetHistoryController::class, 'losses'])->middleware('access.page')->name('history.losses');
        Route::get('history/bets/{bet:uuid}', [BetHistoryController::class, 'show'])->name('history.bets.show');
        Route::get('history/bets/{bet:uuid}/package', [BetHistoryController::class, 'package'])->name('history.bets.package');
        Route::get('history/bets/{bet:uuid}/verify', [BetHistoryController::class, 'verify'])->name('history.bets.verify');
        
        Route::get('leaderboard', [LeaderboardController::class, 'index'])->middleware('access.page')->name('leaderboard');
        
        Route::get('vip', [VipController::class, 'index'])->name('vip.index')->middleware('vip_enabled');
        
        Route::get('chat/rooms', [ChatController::class, 'getRooms'])->name('chat.rooms.index');
        Route::get('chat/{room}', [ChatController::class, 'getMessages'])->name('chat.messages.index');
        Route::post('chat/{room}', [ChatController::class, 'sendMessage'])->name('chat.messages.store');
        
        Route::get('multiplayer-games/{packageId}', [MultiplayerGameController::class, 'index'])->name('multiplayer-games.index');
        
        Route::get('games/{packageId}/rooms', [GameRoomController::class, 'index'])->name('multiplayer-games.rooms.index');
        Route::post('games/{packageId}/rooms', [GameRoomController::class, 'create'])->name('multiplayer-games.rooms.store');
        Route::post('games/{packageId}/rooms/join', [GameRoomController::class, 'join'])->middleware('room.lock')->name('multiplayer-games.rooms.join');
        Route::post('games/{packageId}/rooms/leave', [GameRoomController::class, 'leave'])->middleware('room.lock')->name('multiplayer-games.rooms.leave');
    });


Route::name('admin.')
    ->prefix('admin')
    ->middleware(['cookies', 'user', 'role:' . User::ROLE_ADMIN, 'permissions', 'audit'])
    ->group(function () {
        
        Route::get('dashboard/data/{key}', [DashboardController::class, 'getData'])->name('dashboard.data');

        
        Route::name('users.')->group(function () {
            Route::get('users', [AdminUserController::class, 'index'])->name('index');
            Route::get('users/{user}', [AdminUserController::class, 'show'])->name('show');
            Route::patch('users/{user}', [AdminUserController::class, 'update'])->name('update');
            Route::delete('users/{user}', [AdminUserController::class, 'destroy'])->name('destroy');
            Route::post('users/{user}/mail', [AdminUserController::class, 'mail'])->name('mail');
            Route::get('users/{user}/devices', [AdminUserDeviceController::class, 'index'])->name('devices');
            Route::get('users/{user}/ip-history', [AdminUserIpHistoryController::class, 'index'])->name('ip-history');
            Route::post('users/search', [AdminUserController::class, 'search'])->name('search');
        });

        $actions = ['index', 'show', 'store', 'update', 'destroy'];
        Route::resource('currencies', AdminCurrencyController::class)
            ->only($actions)
            ->names(collect($actions)->mapWithKeys(fn ($action) => [$action => 'currencies.'.$action])->all());

        
        Route::name('accounts.')->group(function () {
            Route::get('accounts', [AdminAccountController::class, 'index'])->name('index');
            Route::get('accounts/{account}', [AdminAccountController::class, 'show'])->name('show');
            Route::post('accounts/{account}/debit', [AdminAccountController::class, 'debit'])->name('debit');
            Route::post('accounts/{account}/credit', [AdminAccountController::class, 'credit'])->name('credit');
            Route::get('accounts/{account}/transactions', [AdminAccountController::class, 'transactions'])->name('transactions');
            Route::get('accounts/{account}/summary', [AdminAccountController::class, 'summary'])->name('summary.index');
        });

        
        
        Route::get('kyc/providers', [AdminKycProviderController::class, 'index'])->name('kyc.providers.index');
        Route::get('kyc/providers/{kycProvider}', [AdminKycProviderController::class, 'show'])->name('kyc.providers.show');
        Route::patch('kyc/providers/{kycProvider}', [AdminKycProviderController::class, 'update'])->name('kyc.providers.update');

        
        Route::get('kyc', [AdminKycController::class, 'index'])->name('kyc.index');
        Route::get('kyc/{kycRequest}', [AdminKycController::class, 'show'])->name('kyc.show');
        Route::post('kyc/{kycRequest}/approve', [AdminKycController::class, 'approve'])->name('kyc.approve');
        Route::post('kyc/{kycRequest}/reject', [AdminKycController::class, 'reject'])->name('kyc.reject');
        Route::delete('kyc/{kycRequest}', [AdminKycController::class, 'destroy'])->name('kyc.destroy');

        
        Route::get('bonuses', [AdminBonusController::class, 'index'])->name('bonuses.index');

        
        
        Route::get('bonuses/rules/types', [AdminBonusRuleController::class, 'types'])->name('bonuses.rules.types');

        
        $actions = ['index', 'show', 'store', 'destroy'];
        Route::resource('bonuses/rules', AdminBonusRuleController::class)
            ->only($actions)
            ->names(collect($actions)->mapWithKeys(fn ($action) => [$action => 'bonuses.rules.'.$action])->all());

        
        Route::get('bets', [AdminBetController::class, 'index'])->name('bets.index');

        
        Route::get('promo-codes/types', [AdminPromoCodeController::class, 'types'])->name('promo-codes.types');
        Route::get('promo-codes/fields', [AdminPromoCodeController::class, 'fields'])->name('promo-codes.fields');
        Route::get('promo-codes/{promoCode}/redemptions', [AdminPromoCodeController::class, 'redemptions'])->name('promo-codes.redemptions.index');

        $actions = ['index', 'show', 'store', 'update', 'destroy'];
        Route::resource('promo-codes', AdminPromoCodeController::class)
            ->only($actions)
            ->names(collect($actions)->mapWithKeys(fn ($action) => [$action => 'promo-codes.'.$action])->all())
            
            ->parameters(['promo-codes' => 'promoCode']);

        
        Route::resource('rank-groups', AdminRankGroupController::class)
            ->only($actions)
            ->names(collect($actions)->mapWithKeys(fn ($action) => [$action => 'rank-groups.'.$action])->all())
            ->parameters(['rank-groups' => 'rankGroup']);

        
        Route::resource('ranks', AdminRankController::class)
            ->only($actions)
            ->names(collect($actions)->mapWithKeys(fn ($action) => [$action => 'ranks.'.$action])->all());

        
        Route::resource('xp-rates', AdminXpRateController::class)
            ->only(['index', 'show', 'update'])
            ->names(['index' => 'xp-rates.index', 'show' => 'xp-rates.show', 'update' => 'xp-rates.update'])
            ->parameters(['xp-rates' => 'xpRate']);

        
        Route::get('vip/xp-transactions', [AdminXpTransactionController::class, 'index'])->name('vip.transactions.index');

        
        Route::name('affiliates.')->group(function () {
            Route::get('affiliates/tree', [AdminAffiliateController::class, 'tree'])->name('tree');
            Route::get('affiliates/commissions', [AdminAffiliateController::class, 'commissions'])->name('commissions.index');
            Route::get('affiliates/commissions/{commission}', [AdminAffiliateController::class, 'show'])->name('commissions.show');
            Route::patch('affiliates/commissions/{commission}/approve', [AdminAffiliateController::class, 'approve'])->name('commissions.approve');
            Route::patch('affiliates/commissions/{commission}/reject', [AdminAffiliateController::class, 'reject'])->name('commissions.reject');
        });

        
        $actions = ['index', 'show', 'store', 'update', 'destroy'];
        Route::resource('chat/rooms', ChatRoomController::class)
            ->only($actions)
            ->names(collect($actions)->mapWithKeys(fn ($action) => [$action => 'chat.rooms.'.$action])->all());

        Route::resource('chat/messages', ChatMessageController::class)
            ->only(['index', 'destroy'])
            ->names(['index' => 'chat.messages.index', 'destroy' => 'chat.messages.destroy']);

        
        Route::get('settings', [SettingController::class, 'index'])->name('settings.index');
        Route::patch('settings', [SettingController::class, 'update'])->name('settings.update');
        Route::get('settings/data', [SettingController::class, 'data'])->name('settings.data');
        Route::patch('seeders/asset', [SettingController::class, 'runAssetSeeder'])->name('seeders.asset');

        
        Route::get('files', [FileController::class, 'show'])->name('files.show');
        Route::post('files', [FileController::class, 'store'])->name('files.store');
        Route::patch('files', [FileController::class, 'update'])->name('files.update');
        Route::delete('files', [FileController::class, 'destroy'])->name('files.destroy');

        Route::get('secure-files', [SecureFileController::class, 'show'])->name('secure-files.show');

        
        Route::name('maintenance.')->group(function () {
            Route::get('maintenance', [MaintenanceController::class, 'index'])->name('index');
            Route::post('maintenance/upgrade', [MaintenanceController::class, 'upgrade'])->name('upgrade');
            Route::post('maintenance/up', [MaintenanceController::class, 'up'])->name('up');
            Route::post('maintenance/down', [MaintenanceController::class, 'down'])->name('down');
            Route::post('maintenance/command', [MaintenanceController::class, 'command'])->name('command');
            Route::post('maintenance/migrate', [MaintenanceController::class, 'migrate'])->name('migrate');
            Route::post('maintenance/cache', [MaintenanceController::class, 'cache'])->name('cache');
            Route::get('maintenance/jobs', [MaintenanceController::class, 'jobs'])->name('jobs');
            Route::get('maintenance/failed-jobs', [MaintenanceController::class, 'failedJobs'])->name('failed-jobs');
            Route::post('maintenance/queues/clear', [MaintenanceController::class, 'clearQueue'])->name('queues.clear');
            Route::post('maintenance/queues/worker/restart', [MaintenanceController::class, 'restartQueueWorker'])->name('worker.restart');
            Route::post('maintenance/queues/supervisor/status', [MaintenanceController::class, 'getSupervisorServiceStatus'])->name('supervisor.status');
            Route::post('maintenance/cron/jobs', [MaintenanceController::class, 'getCronJobs'])->name('cron.jobs');
            Route::get('maintenance/logs/{file}', [MaintenanceController::class, 'getLogFile'])->name('logs.show');
            Route::delete('maintenance/logs/{file}', [MaintenanceController::class, 'deleteLogFile'])->name('logs.delete');
            Route::get('maintenance/logs/{file}/download', [MaintenanceController::class, 'downloadLogFile'])->name('logs.download');
        });

        
        Route::resource('audit-logs', AuditLogController::class)
            ->only(['index', 'show'])
            ->names(['index' => 'audit-logs.index', 'show' => 'audit-logs.show']);

        
        Route::name('add-ons.')->group(function () {
            Route::get('add-ons', [AddonController::class, 'index'])->name('index');
            Route::get('add-ons/{packageId}', [AddonController::class, 'get'])->name('show');
            Route::get('add-ons/{packageId}/changelog', [AddonController::class, 'changelog'])->name('changelog');
            Route::patch('add-ons/{packageId}/enable', [AddonController::class, 'enable'])->name('enable');
            Route::patch('add-ons/{packageId}/disable', [AddonController::class, 'disable'])->name('disable');
            Route::post('add-ons/{packageId}/install', [AddonController::class, 'install'])->name('install');
            Route::post('add-ons/register-bundle', [AddonController::class, 'registerBundle'])->name('bundle.register');
        });

        
        Route::get('license', [LicenseController::class, 'index'])->name('license.index');
        Route::post('license', [LicenseController::class, 'register'])->name('license.register');
        
        Route::get('help/{file}', [HelpController::class, 'show'])->name('help.show');
        
        Route::post('tests/poker', [TestController::class, 'poker'])->name('tests.poker');
    });

if (app()->environment('development', 'testing')) {
    info('Registering concurrent test route');
    Route::post('test/concurrent', function (Request $request) {
        sleep($request->sleep);
        return response()->json(['time' => time()]);
    })->name('test.concurrent')->middleware(['api', 'concurrent']);
}
