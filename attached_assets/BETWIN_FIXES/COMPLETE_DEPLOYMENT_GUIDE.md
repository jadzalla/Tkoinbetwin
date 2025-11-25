# COMPLETE BetWin Tkoin Wallet Fix - Deployment Guide

## Issues Being Fixed

| # | Issue | Cause | Solution |
|---|-------|-------|----------|
| 1 | "Route [login] not defined" | Missing named login route | Add named route to web.php |
| 2 | Balance shows "---" | API returning wrong data/format | Fixed TkoinService + TkoinController |
| 3 | "Connect Solana Wallet" not working | Event listener issue | Fixed JavaScript |

---

## Files to Deploy

### Total: 4 Files

| File | Destination | Purpose |
|------|-------------|---------|
| `TkoinService.php` | `app/Services/TkoinService.php` | Query local DB (not external API) |
| `TkoinController.php` | `app/Http/Controllers/TkoinController.php` | Return correct JSON keys |
| `tkoin-wallet-v2.js` | `public/js/tkoin-wallet.js` | Fixed JS with debugging + wallet connection |
| `routes_fix.php` | **Merge into** `routes/web.php` | Add missing routes |

---

## Step-by-Step Deployment

### Step 1: Fix the Login Route

Open `routes/web.php` and ensure you have a named `login` route:

```php
// Add this if not present:
Route::get('/login', [App\Http\Controllers\Auth\LoginController::class, 'showLoginForm'])->name('login');
```

If your login route already exists but isn't named, add `->name('login')`:

```php
// Before:
Route::get('/login', [LoginController::class, 'showLoginForm']);

// After:
Route::get('/login', [LoginController::class, 'showLoginForm'])->name('login');
```

### Step 2: Verify Tkoin Routes

Make sure these routes exist in `routes/web.php`:

```php
Route::middleware(['auth'])->prefix('tkoin')->group(function () {
    Route::get('/balance', [App\Http\Controllers\TkoinController::class, 'balance'])->name('tkoin.balance');
    Route::get('/history', [App\Http\Controllers\TkoinController::class, 'history'])->name('tkoin.history');
    Route::post('/deposit', [App\Http\Controllers\TkoinController::class, 'deposit'])->name('tkoin.deposit');
    Route::post('/withdrawal', [App\Http\Controllers\TkoinController::class, 'withdrawal'])->name('tkoin.withdrawal');
});

Route::middleware(['auth'])->group(function () {
    Route::get('/user/tkoin-wallet', [App\Http\Controllers\TkoinController::class, 'showWallet'])->name('user.tkoin-wallet');
});
```

### Step 3: Upload the PHP Files

1. Upload `TkoinService.php` to `app/Services/TkoinService.php`
2. Upload `TkoinController.php` to `app/Http/Controllers/TkoinController.php`

### Step 4: Upload the JavaScript File

Upload `tkoin-wallet-v2.js` to `public/js/tkoin-wallet.js`

### Step 5: Clear Laravel Cache

```bash
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear
```

### Step 6: Verify Routes

```bash
php artisan route:list | grep -E "(login|tkoin)"
```

Expected output:
```
GET  login          App\Http\Controllers\Auth\LoginController@showLoginForm
GET  tkoin/balance  App\Http\Controllers\TkoinController@balance
GET  tkoin/history  App\Http\Controllers\TkoinController@history
POST tkoin/deposit  App\Http\Controllers\TkoinController@deposit
POST tkoin/withdrawal App\Http\Controllers\TkoinController@withdrawal
GET  user/tkoin-wallet App\Http\Controllers\TkoinController@showWallet
```

### Step 7: Test

1. **Test unauthenticated access:**
   - Go to `https://betwin.tkoin.finance/user/tkoin-wallet` directly
   - Should redirect to login page (no error)

2. **Test authenticated access:**
   - Login first
   - Navigate to Tkoin Wallet
   - Balance should show `1,461.73 CREDIT`
   - Account ID should show `1`

3. **Test Phantom wallet:**
   - Open browser console (F12)
   - Click "Connect Solana Wallet"
   - Console should show: `[Tkoin] Connect wallet button clicked`
   - Phantom popup should appear

---

## Debugging

If issues persist, open browser console (F12) and look for:

```
[Tkoin] Initializing wallet...
[Tkoin] CSRF token found
[Tkoin] Fetching balance from: /tkoin/balance
[Tkoin] Balance response status: 200
[Tkoin] Balance data received: { balance: 1461.73, currency: "CREDIT", account_id: 1 }
```

### Common Issues:

| Console Message | Problem | Solution |
|-----------------|---------|----------|
| `401 Unauthorized` | Session expired/invalid | Re-login |
| `419 CSRF token mismatch` | CSRF token missing | Check `<meta name="csrf-token">` in Blade template |
| `404 Not Found` | Route missing | Add routes to web.php |
| `500 Server Error` | PHP error | Check Laravel logs |

### Check Laravel Logs:
```bash
tail -f storage/logs/laravel.log
```

---

## Summary

After deployment:
- ✅ Direct URL access redirects to login (no error)
- ✅ Balance displays `1,461.73 CREDIT`
- ✅ Account ID displays `1`
- ✅ Connect Solana Wallet button works
- ✅ Refresh button updates balance
- ✅ Transaction history loads
