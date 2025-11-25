<?php
/**
 * ROUTES FIX - Add to routes/web.php
 * 
 * Add these lines to your existing routes/web.php file
 * This fixes the "Route [login] not defined" error
 */

// =====================================================
// ADD THIS NAMED LOGIN ROUTE (if not already present)
// =====================================================

// Option 1: If you have a login controller
Route::get('/login', [App\Http\Controllers\Auth\LoginController::class, 'showLoginForm'])->name('login');

// Option 2: If you're using simple auth views
// Route::get('/login', function () {
//     return view('auth.login');
// })->name('login');

// Option 3: If you want to redirect to home page
// Route::get('/login', function () {
//     return redirect('/');
// })->name('login');


// =====================================================
// TKOIN ROUTES - Make sure these exist
// =====================================================

Route::middleware(['auth'])->prefix('tkoin')->group(function () {
    Route::get('/balance', [App\Http\Controllers\TkoinController::class, 'balance'])->name('tkoin.balance');
    Route::get('/history', [App\Http\Controllers\TkoinController::class, 'history'])->name('tkoin.history');
    Route::post('/deposit', [App\Http\Controllers\TkoinController::class, 'deposit'])->name('tkoin.deposit');
    Route::post('/withdrawal', [App\Http\Controllers\TkoinController::class, 'withdrawal'])->name('tkoin.withdrawal');
});

// Tkoin Wallet Page
Route::middleware(['auth'])->group(function () {
    Route::get('/user/tkoin-wallet', [App\Http\Controllers\TkoinController::class, 'showWallet'])->name('user.tkoin-wallet');
});
