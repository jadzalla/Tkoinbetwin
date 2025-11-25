<?php
/**
 *   BetWin - Tkoin Protocol Integration
 *   ------------------------------------
 *   web.php - COMPLETE MERGED VERSION
 * 
 *   FIXES APPLIED:
 *   - Added named 'login' route (fixes "Route [login] not defined" error)
 *   - All Tkoin routes preserved
 *   - Catch-all SPA route preserved at end
 * 
 *   IMPORTANT: This file should REPLACE your current routes/web.php
 *   If you have additional routes, merge them before the catch-all route.
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
| Authentication Routes - CRITICAL FIX
|--------------------------------------------------------------------------
|
| The 'login' route MUST be named so Laravel's 'auth' middleware can 
| redirect unauthenticated users. This fixes "Route [login] not defined".
|
| Choose ONE of the options below based on your auth setup:
|
*/

// OPTION 1: If you have a dedicated LoginController (most common)
// Uncomment this line and comment out Option 2:
// Route::get('/login', [App\Http\Controllers\Auth\LoginController::class, 'showLoginForm'])->name('login');

// OPTION 2: Redirect to home page where Vue SPA handles login (RECOMMENDED for BetWin)
// This works because BetWin uses a Vue SPA with its own auth handling
Route::get('/login', function () {
    return redirect('/');
})->name('login');

/*
|--------------------------------------------------------------------------
| Tkoin Wallet Routes
|--------------------------------------------------------------------------
|
| Routes for the Tkoin wallet integration - deposits, withdrawals, 
| balance checking, and transaction history.
|
*/

// Tkoin Wallet Page (requires authentication)
Route::get('/user/tkoin-wallet', [TkoinController::class, 'showWallet'])
    ->middleware('auth')
    ->name('user.tkoin-wallet');

// Tkoin API Routes (all require authentication)
Route::prefix('tkoin')->name('tkoin.')->middleware('auth')->group(function () {
    Route::get('/balance', [TkoinController::class, 'balance'])->name('balance');
    Route::get('/history', [TkoinController::class, 'history'])->name('history');
    Route::post('/deposit', [TkoinController::class, 'deposit'])->name('deposit');
    Route::post('/withdrawal', [TkoinController::class, 'withdrawal'])->name('withdrawal');
    Route::post('/verify-deposit', [TkoinController::class, 'verifyDeposit'])->name('verify-deposit');
});

/*
|--------------------------------------------------------------------------
| ADD YOUR OTHER EXISTING ROUTES HERE
|--------------------------------------------------------------------------
|
| If you have additional routes from your original web.php, add them here
| BEFORE the catch-all route below.
|
*/



/*
|--------------------------------------------------------------------------
| SPA Catch-All Route - MUST BE LAST
|--------------------------------------------------------------------------
|
| This route catches all other requests and passes them to the Vue SPA.
| IMPORTANT: This MUST be the LAST route defined in this file.
|
*/

Route::get('{path}', [PageController::class, 'index'])->where('path', '.*')->middleware('referrer');
