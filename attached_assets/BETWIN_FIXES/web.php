<?php
/**
 *   BetWin - Tkoin Protocol Integration
 *   ------------------------------------
 *   web.php - COMPLETE MERGED VERSION v4
 * 
 *   FIXES APPLIED:
 *   - v3: Added named 'login' route that renders SPA (NO REDIRECT - prevents loop!)
 *   - v4: Added /tkoin/withdraw route (JS calls /withdraw, not /withdrawal)
 *   - All Tkoin routes preserved
 *   - Catch-all SPA route preserved at end
 * 
 *   @copyright  Copyright (c) BetWin, All rights reserved
 *   @author     BetWin <dev@betwin.tkoin.finance>
 *   @see        https://betwin.tkoin.finance
 */

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\PageController;
use App\Http\Controllers\TkoinController;

/*
|--------------------------------------------------------------------------
| Authentication Routes - CRITICAL FIX v3
|--------------------------------------------------------------------------
|
| The 'login' route renders the SPA shell (same as catch-all).
| This prevents redirect loops while giving auth middleware a valid target.
| The Vue SPA handles showing the login UI.
|
*/

// Named login route - renders SPA (Vue handles the login UI)
// NO AUTH MIDDLEWARE - must be accessible to guests!
Route::get('/login', [PageController::class, 'index'])->name('login');

/*
|--------------------------------------------------------------------------
| Tkoin Wallet Routes
|--------------------------------------------------------------------------
*/

// Tkoin Wallet Page (requires authentication)
Route::get('/user/tkoin-wallet', [TkoinController::class, 'showWallet'])
    ->middleware('auth')
    ->name('user.tkoin-wallet');

// Tkoin API Routes (all require authentication)
Route::prefix('tkoin')->name('tkoin.')->middleware('auth')->group(function () {
    // Balance & History
    Route::get('/balance', [TkoinController::class, 'balance'])->name('balance');
    Route::get('/history', [TkoinController::class, 'history'])->name('history');
    
    // Export - v7.0: Download transactions as CSV/JSON
    Route::get('/export', [TkoinController::class, 'export'])->name('export');
    
    // Deposits
    Route::post('/deposit', [TkoinController::class, 'deposit'])->name('deposit');
    Route::post('/verify-deposit', [TkoinController::class, 'verifyDeposit'])->name('verify-deposit');
    
    // Withdrawals - BOTH routes needed!
    // /tkoin/withdraw - Used by tkoin-wallet.js (the JS frontend)
    Route::post('/withdraw', [TkoinController::class, 'withdraw'])->name('withdraw');
    // /tkoin/withdrawal - Legacy route (may be used by other code)
    Route::post('/withdrawal', [TkoinController::class, 'withdrawal'])->name('withdrawal');
    
    // P2P Marketplace - v7.0: Buy TKOIN from agents
    Route::get('/marketplace/agents', [TkoinController::class, 'marketplaceAgents'])->name('marketplace.agents');
    Route::get('/marketplace/orders', [TkoinController::class, 'marketplaceMyOrders'])->name('marketplace.orders');
    Route::post('/marketplace/purchase', [TkoinController::class, 'marketplacePurchase'])->name('marketplace.purchase');
    Route::get('/marketplace/orders/{id}', [TkoinController::class, 'marketplaceOrderStatus'])->name('marketplace.order.status');
    Route::post('/marketplace/orders/{id}/confirm', [TkoinController::class, 'marketplaceConfirmPayment'])->name('marketplace.order.confirm');
    Route::post('/marketplace/orders/{id}/cancel', [TkoinController::class, 'marketplaceCancelOrder'])->name('marketplace.order.cancel');
});

/*
|--------------------------------------------------------------------------
| SPA Catch-All Route - MUST BE LAST
|--------------------------------------------------------------------------
*/

Route::get('{path}', [PageController::class, 'index'])->where('path', '.*')->middleware('referrer');
