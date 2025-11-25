<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\PageController;
use App\Http\Controllers\TkoinController;

// Tkoin Wallet Route
Route::get('/user/tkoin-wallet', [TkoinController::class, 'showWallet'])
    ->middleware('auth')
    ->name('user.tkoin-wallet');

// Tkoin API Routes
Route::prefix('tkoin')->name('tkoin.')->middleware('auth')->group(function () {
    Route::get('/balance', [TkoinController::class, 'balance'])->name('balance');
    Route::get('/history', [TkoinController::class, 'history'])->name('history');
    Route::post('/deposit', [TkoinController::class, 'deposit'])->name('deposit');
    Route::post('/withdrawal', [TkoinController::class, 'withdrawal'])->name('withdrawal');
    Route::post('/verify-deposit', [TkoinController::class, 'verifyDeposit'])->name('verify-deposit');
});

// Catch-all Vue SPA route - MUST be last
Route::get('{path}', [PageController::class, 'index'])->where('path', '.*')->middleware('referrer');
