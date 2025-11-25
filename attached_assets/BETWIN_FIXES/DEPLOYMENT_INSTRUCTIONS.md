# BetWin Tkoin Wallet - Complete Fix Package v4

## Files to Deploy

### 1. TkoinController.php
**Location:** `app/Http/Controllers/TkoinController.php`

**Changes:**
- `deposit()` - Returns deposit instructions (treasury wallet, mint address)
- `verifyDeposit()` - Verifies blockchain signature and credits account
- Balance and history work correctly

### 2. tkoin-wallet-FIXED.js
**Location:** `public/js/tkoin-wallet.js`

**Changes:**
- NO auto-connect (requires user click)
- Disconnect wallet button support
- Full deposit flow: instructions → Phantom transaction → verification
- Proper error handling

---

## HTML Template Updates

Add these changes to your Blade template (`resources/views/user/tkoin-wallet.blade.php` or similar):

### 1. Add Solana Web3.js Library

Add BEFORE your tkoin-wallet.js script:
```html
<script src="https://unpkg.com/@solana/web3.js@latest/lib/index.iife.min.js"></script>
```

### 2. Update Wallet Connection Buttons

Replace the wallet button section with:
```html
<div class="wallet-controls">
    <button id="connectWalletBtn" class="btn btn-primary">
        <i class="fa fa-wallet"></i> CONNECT PHANTOM WALLET
    </button>
    <button id="disconnectWalletBtn" class="btn btn-outline-danger" style="display: none;">
        <i class="fa fa-sign-out-alt"></i> Disconnect
    </button>
    <span id="walletAddress" class="wallet-address" style="display: none;"></span>
    <span id="walletStatus" class="badge bg-secondary">Not Connected</span>
</div>
```

### 3. Deposit Modal Structure (verify these IDs exist)
```html
<div class="modal fade" id="depositModal">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Deposit Tkoin</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <form id="depositForm">
                    <div class="mb-3">
                        <label for="depositAmount" class="form-label">Amount (CREDIT)</label>
                        <input type="number" class="form-control" id="depositAmount" 
                               min="1" step="0.01" placeholder="100">
                        <div class="form-text">Minimum: 1 CREDIT. 100 CREDIT = 1 TKOIN</div>
                    </div>
                    
                    <div id="depositError" class="alert alert-danger" style="display: none;"></div>
                    
                    <div class="alert alert-info">
                        <strong>How it works:</strong>
                        <ol class="mb-0">
                            <li>Enter amount in CREDIT</li>
                            <li>Click "Send TKOIN" to open Phantom</li>
                            <li>Approve the transaction in Phantom</li>
                            <li>Credits will be added automatically</li>
                        </ol>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" form="depositForm" id="depositSubmit" class="btn btn-success">
                    <span id="depositSpinner" class="spinner-border spinner-border-sm" style="display: none;"></span>
                    <span id="depositSubmitText">Send TKOIN</span>
                </button>
            </div>
        </div>
    </div>
</div>
```

---

## Deployment Commands

```bash
# 1. Upload files
# Upload TkoinController.php to app/Http/Controllers/
# Upload tkoin-wallet-FIXED.js to public/js/tkoin-wallet.js

# 2. Clear all caches
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear

# 3. Verify deployment
grep -n "function deposit" app/Http/Controllers/TkoinController.php | head -5
head -20 public/js/tkoin-wallet.js
```

---

## Flow After Fix

1. **Page Load**
   - Wallet NOT connected (shows "Connect Phantom" button)
   - Balance loads from BetWin DB

2. **User Clicks "Connect Phantom"**
   - Phantom prompts for connection approval
   - On approval: shows wallet address + disconnect button

3. **User Clicks "Deposit"**
   - Enter amount (e.g., 100 CREDIT = 1 TKOIN)
   - Click "Send TKOIN"
   - Phantom opens with transaction for 1 TKOIN to treasury
   - User approves in Phantom
   - Backend verifies on-chain transaction
   - Credits added to account
   - Balance updates

4. **User Clicks "Disconnect"**
   - Wallet disconnected
   - UI reverts to "Connect" button

---

## Environment Variables Required

Make sure these are set in your `.env`:
```
SOLANA_TREASURY_WALLET=953CKYH169xXxaNKVwLT9z9s38TEg1d2pQsY7d1Lv6dD
TKOIN_MINT_ADDRESS=<your_tkoin_token_mint_address>
TKOIN_PROTOCOL_API_BASE=https://your-replit-app.replit.dev
```

And in `config/services.php`:
```php
'tkoin' => [
    'treasury_wallet' => env('SOLANA_TREASURY_WALLET'),
    'mint_address' => env('TKOIN_MINT_ADDRESS'),
    'api_base' => env('TKOIN_PROTOCOL_API_BASE'),
],
```
