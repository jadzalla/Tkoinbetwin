<?php
/**
 * Add these routes to your routes/web.php file
 * 
 * Location: /home/tkoin-betwin/htdocs/betwin.tkoin.finance/routes/web.php
 * 
 * Add these routes in the authenticated section (after Route::middleware(['auth'])-> group)
 */

// Tkoin Wallet Widget Routes
Route::prefix('tkoin')->name('tkoin.')->middleware('auth')->group(function () {
    Route::get('/balance', [App\Http\Controllers\TkoinController::class, 'balance'])->name('balance');
    Route::get('/history', [App\Http\Controllers\TkoinController::class, 'history'])->name('history');
    Route::post('/deposit', [App\Http\Controllers\TkoinController::class, 'deposit'])->name('deposit');
    Route::post('/withdrawal', [App\Http\Controllers\TkoinController::class, 'withdrawal'])->name('withdrawal');
});
