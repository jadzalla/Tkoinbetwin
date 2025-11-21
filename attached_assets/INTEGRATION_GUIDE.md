# BetWin Tkoin Wallet UI Integration Guide

This guide explains how to integrate the Tkoin Wallet UI components into your BetWin application.

## Files Included

1. **tkoin-wallet.blade.php** - Laravel Blade component with all UI elements
2. **tkoin-wallet.js** - JavaScript logic for API interactions
3. **This guide** - Integration instructions

## Installation Steps

### Step 1: Copy the Blade Component

Copy `tkoin-wallet.blade.php` to your BetWin resources directory:

```bash
cp tkoin-wallet.blade.php /home/tkoin-betwin/htdocs/betwin.tkoin.finance/resources/views/components/
```

Or create the file manually:
```bash
mkdir -p /home/tkoin-betwin/htdocs/betwin.tkoin.finance/resources/views/components/
cat > /home/tkoin-betwin/htdocs/betwin.tkoin.finance/resources/views/components/tkoin-wallet.blade.php << 'EOF'
[paste the content from tkoin-wallet.blade.php]
EOF
```

### Step 2: Copy the JavaScript File

Copy `tkoin-wallet.js` to your BetWin public directory:

```bash
cp tkoin-wallet.js /home/tkoin-betwin/htdocs/betwin.tkoin.finance/public/js/
```

Or create manually:
```bash
mkdir -p /home/tkoin-betwin/htdocs/betwin.tkoin.finance/public/js/
cat > /home/tkoin-betwin/htdocs/betwin.tkoin.finance/public/js/tkoin-wallet.js << 'EOF'
[paste the content from tkoin-wallet.js]
EOF
```

### Step 3: Include in Your Blade Template

In the Blade template where you want the wallet to appear (e.g., player dashboard, account page):

```blade
@include('components.tkoin-wallet')
```

Or using the component syntax:

```blade
<x-tkoin-wallet />
```

### Step 4: Verify Requirements

Ensure your BetWin Blade template includes:

```blade
<!-- Bootstrap CSS (if not already included) -->
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">

<!-- Font Awesome (for icons) -->
<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">

<!-- Bootstrap JS (required for modals) -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>

<!-- CSRF token (required for Laravel) -->
<meta name="csrf-token" content="{{ csrf_token() }}">
```

## Usage

Once integrated, the wallet component will automatically:

1. **Load on page load** - Fetches and displays current balance
2. **Auto-refresh** - Updates balance and history every 30 seconds
3. **Handle deposits** - Modal form to initiate deposits
4. **Handle withdrawals** - Modal form to initiate withdrawals with optional Solana address
5. **Show history** - Lists last 10 transactions with status

## API Endpoints Used

The component makes requests to these endpoints (all require authentication):

- `GET /api/user/tkoin/balance` - Get current balance
- `POST /api/user/tkoin/deposit` - Initiate a deposit
- `POST /api/user/tkoin/withdrawal` - Initiate a withdrawal
- `GET /api/user/tkoin/history` - Get transaction history

All endpoints are already implemented in your BetWin backend.

## Authentication

The component automatically handles authentication by:

1. Reading the CSRF token from the `<meta name="csrf-token">` tag
2. Including it in all POST requests
3. Using the user's Laravel session for authentication

The endpoints are protected by the `auth:sanctum` middleware and require a valid API token or session.

## Customization

### Change Colors

Edit the CSS in `tkoin-wallet.blade.php` to match your BetWin theme:

```css
.balance-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  /* Change these colors to match your brand */
}
```

### Change Refresh Interval

Edit the JavaScript in `tkoin-wallet.js`:

```javascript
// Auto-refresh balance every 30 seconds
// Change 30000 to your desired interval in milliseconds
this.refreshInterval = setInterval(() => {
  this.fetchBalance();
  this.fetchHistory();
}, 30000); // Change this value
```

### Change API Base URL

If your API is at a different URL, edit the JavaScript:

```javascript
this.apiBaseUrl = '/api/user/tkoin'; // Change if needed
```

### Limit Transaction History

Edit the fetch URL in `tkoin-wallet.js`:

```javascript
// Change limit parameter from 10 to your desired number
const response = await fetch(`${this.apiBaseUrl}/history?limit=10`, {
```

## Testing

1. **Access the page** where you included the wallet component
2. **Verify balance loads** - Should show your current CREDIT balance
3. **Click "Deposit"** - Opens deposit modal
4. **Enter amount** - Try 10.50
5. **Click "Initiate Deposit"** - Should show success message
6. **Check history** - New transaction should appear in "Recent Transactions"

### Test Commands (from BetWin server)

```bash
# Get balance
curl -X GET https://betwin.tkoin.finance/api/user/tkoin/balance \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json"

# Initiate deposit
curl -X POST https://betwin.tkoin.finance/api/user/tkoin/deposit \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 10.50}'

# Get history
curl -X GET https://betwin.tkoin.finance/api/user/tkoin/history \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json"
```

## Troubleshooting

### "Failed to load wallet balance"

- Check that `/api/user/tkoin/balance` endpoint is working
- Verify user is authenticated (logged in)
- Check browser console for error messages

### Modals not opening

- Ensure Bootstrap 5 JS is loaded (`bootstrap.bundle.min.js`)
- Check that Bootstrap CSS is loaded
- Verify modal IDs match (`depositModal`, `withdrawalModal`)

### Form submission fails

- Check browser Network tab to see API response
- Verify CSRF token is present in page meta tag
- Ensure user has an account associated with their user record

### Balance not updating

- Check browser console for fetch errors
- Verify the API token/session is valid
- Check that user account exists in database

## Example Integration in Account Page

```blade
<!-- resources/views/account.blade.php -->
@extends('layouts.app')

@section('content')
<div class="container">
  <h1>My Account</h1>
  
  <div class="row">
    <div class="col-md-6">
      <!-- Tkoin Wallet Widget -->
      @include('components.tkoin-wallet')
    </div>
    
    <div class="col-md-6">
      <!-- Other account info -->
      <h3>Account Information</h3>
      <!-- ... -->
    </div>
  </div>
</div>
@endsection
```

## Example Integration in Dashboard

```blade
<!-- resources/views/dashboard.blade.php -->
@extends('layouts.app')

@section('content')
<div class="container-fluid">
  <div class="row">
    <div class="col-md-12">
      <h1>Player Dashboard</h1>
    </div>
  </div>
  
  <div class="row mt-4">
    <div class="col-md-4">
      <!-- Tkoin Wallet on left sidebar -->
      @include('components.tkoin-wallet')
    </div>
    
    <div class="col-md-8">
      <!-- Game content on right -->
      <!-- ... -->
    </div>
  </div>
</div>
@endsection
```

## Production Checklist

- [ ] Blade component copied to `resources/views/components/`
- [ ] JavaScript copied to `public/js/`
- [ ] Included in your player-facing page
- [ ] Bootstrap CSS and JS included in your layout
- [ ] Font Awesome CSS included for icons
- [ ] CSRF token meta tag present
- [ ] API endpoints are working (test with curl)
- [ ] User can login and see wallet
- [ ] Deposit/withdrawal forms submit successfully
- [ ] Transaction history displays correctly

## Support

If you encounter issues:

1. Check browser console (F12) for JavaScript errors
2. Check Network tab for API errors
3. Verify all files are in correct locations
4. Ensure Bootstrap and Font Awesome are loaded
5. Test API endpoints directly with curl

The component is designed to work with your existing Laravel authentication system and requires no additional configuration beyond the file placement.
