<?php
/**
 *   BetWin - Tkoin Protocol Integration
 *   ------------------------------------
 *   API_ROUTES_TO_ADD.php
 *   
 *   INSTRUCTIONS: Add these route groups to routes/api.php
 *   Place the Tkoin user routes after the other authenticated user routes
 *   Place the Tkoin webhook route in the webhooks group
 * 
 *   @copyright  Copyright (c) BetWin, All rights reserved
 *   @author     BetWin <dev@betwin.tkoin.finance>
 *   @see        https://betwin.tkoin.finance
*/

// ============================================================================
// ADD THIS TO routes/api.php - IMPORT STATEMENTS (at the top with other imports)
// ============================================================================

use App\Http\Controllers\TkoinController;
use App\Http\Controllers\TkoinWebhookController;


// ============================================================================
// ADD THIS ROUTE GROUP TO routes/api.php - USER AUTHENTICATED ROUTES
// ============================================================================
// Place this inside the Route::name('user.')->prefix('user')->middleware([...]) group
// or create a similar authenticated group

Route::name('tkoin.')
    ->prefix('tkoin')
    ->middleware(['auth:sanctum', 'cookies', 'user', 'active'])
    ->group(function () {
        // Get user's current Tkoin balance
        Route::get('balance', [TkoinController::class, 'balance'])->name('balance');
        
        // Get settlement statistics (total deposits, withdrawals, pending, etc.)
        Route::get('stats', [TkoinController::class, 'stats'])->name('stats');
        
        // Get settlement history (with filtering by type and status)
        Route::get('history', [TkoinController::class, 'history'])->name('history');
        
        // Get specific settlement details
        Route::get('settlements/{settlement}', [TkoinController::class, 'show'])->name('show');
        
        // Initiate a new deposit request
        Route::post('deposit', [TkoinController::class, 'deposit'])->name('deposit');
        
        // Initiate a new withdrawal request
        Route::post('withdrawal', [TkoinController::class, 'withdrawal'])->name('withdrawal');
        
        // Cancel a pending or processing settlement
        Route::post('settlements/{settlement}/cancel', [TkoinController::class, 'cancel'])->name('cancel');
    });


// ============================================================================
// ADD THIS WEBHOOK ROUTE TO routes/api.php - WEBHOOK ROUTES
// ============================================================================
// Place this inside the Route::name('webhooks.')->prefix('webhooks') group
// or add to your existing webhooks group

// Inside the webhooks group:
Route::post('tkoin', [TkoinWebhookController::class, 'handleWebhook'])
    ->name('tkoin')
    ->withoutMiddleware('auth:sanctum'); // Webhooks don't require authentication


// ============================================================================
// COMPLETE EXAMPLE: How it looks in context
// ============================================================================
/*
Route::name('webhooks.')
    ->prefix('webhooks')
    ->middleware('log')
    ->group(function () {
        Route::post('kyc', [KycController::class, 'processWebhook'])->name('kyc');
        
        // ADD THIS LINE:
        Route::post('tkoin', [TkoinWebhookController::class, 'handleWebhook'])->name('tkoin');
    });

Route::name('user.')
    ->prefix('user')
    ->middleware(['cookies', 'user'])
    ->group(function () {
        // ... existing user routes ...
        
        // ADD THIS ENTIRE GROUP:
        Route::name('tkoin.')
            ->prefix('tkoin')
            ->middleware(['auth:sanctum', 'cookies', 'user', 'active'])
            ->group(function () {
                Route::get('balance', [TkoinController::class, 'balance'])->name('balance');
                Route::get('stats', [TkoinController::class, 'stats'])->name('stats');
                Route::get('history', [TkoinController::class, 'history'])->name('history');
                Route::get('settlements/{settlement}', [TkoinController::class, 'show'])->name('show');
                Route::post('deposit', [TkoinController::class, 'deposit'])->name('deposit');
                Route::post('withdrawal', [TkoinController::class, 'withdrawal'])->name('withdrawal');
                Route::post('settlements/{settlement}/cancel', [TkoinController::class, 'cancel'])->name('cancel');
            });
    });
*/
