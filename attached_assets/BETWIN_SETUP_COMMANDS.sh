#!/bin/bash
# BetWin Tkoin Wallet Integration - Complete Setup
# Run these commands on your BetWin server (root@srv684502)

# ============================================================================
# STEP 1: Create the Blade component (tkoin-wallet.blade.php)
# ============================================================================
cat > /home/tkoin-betwin/htdocs/betwin.tkoin.finance/resources/views/components/tkoin-wallet.blade.php << 'EOFBLADE'
<div id="tkoin-wallet" class="tkoin-wallet-container">
  <div class="wallet-header">
    <h2>Tkoin Wallet</h2>
    <div class="wallet-status" id="wallet-status"><span class="badge badge-info">Loading...</span></div>
  </div>
  <div class="balance-card">
    <div class="balance-label">Available Balance</div>
    <div class="balance-amount" id="balance-amount">--- CREDIT</div>
    <div class="balance-subtext" id="balance-account">Account ID: ---</div>
  </div>
  <div class="wallet-actions">
    <button type="button" class="btn btn-primary" id="btn-deposit" data-bs-toggle="modal" data-bs-target="#depositModal"><i class="fa fa-arrow-down"></i> Deposit</button>
    <button type="button" class="btn btn-primary" id="btn-withdrawal" data-bs-toggle="modal" data-bs-target="#withdrawalModal"><i class="fa fa-arrow-up"></i> Withdraw</button>
    <button type="button" class="btn btn-secondary" id="btn-refresh"><i class="fa fa-sync"></i> Refresh</button>
  </div>
  <div class="transaction-history">
    <h3>Recent Transactions</h3>
    <table class="table table-sm"><thead><tr><th>Type</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody id="transaction-body"><tr><td colspan="4" class="text-center text-muted">Loading...</td></tr></tbody></table>
  </div>
</div>

<div class="modal fade" id="depositModal" tabindex="-1" aria-hidden="true"><div class="modal-dialog"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">Deposit Tkoin</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><form id="depositForm"><div class="modal-body"><div class="mb-3"><label for="depositAmount" class="form-label">Amount (CREDIT)</label><input type="number" class="form-control" id="depositAmount" name="amount" min="0.01" step="0.01" required placeholder="Enter amount"><small class="text-muted">Minimum: 0.01 CREDIT</small></div><div class="alert alert-info">Your deposit will be initiated through Tkoin.</div><div id="depositError" class="alert alert-danger" style="display: none;"></div></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-primary" id="depositSubmit"><span id="depositSubmitText">Initiate Deposit</span><span id="depositSpinner" class="spinner-border spinner-border-sm ms-2" style="display: none;"></span></button></div></form></div></div></div>

<div class="modal fade" id="withdrawalModal" tabindex="-1" aria-hidden="true"><div class="modal-dialog"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">Withdraw Tkoin</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><form id="withdrawalForm"><div class="modal-body"><div class="mb-3"><label for="withdrawalAmount" class="form-label">Amount (CREDIT)</label><input type="number" class="form-control" id="withdrawalAmount" name="amount" min="0.01" step="0.01" required placeholder="Enter amount"><small class="text-muted">Minimum: 0.01 CREDIT</small></div><div class="mb-3"><label for="solanaAddress" class="form-label">Solana Address (Optional)</label><input type="text" class="form-control" id="solanaAddress" placeholder="Your Solana wallet"><small class="text-muted">Leave blank for default</small></div><div class="alert alert-info">Processing: 5-30 minutes</div><div id="withdrawalError" class="alert alert-danger" style="display: none;"></div></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-primary" id="withdrawalSubmit"><span id="withdrawalSubmitText">Initiate Withdrawal</span><span id="withdrawalSpinner" class="spinner-border spinner-border-sm ms-2" style="display: none;"></span></button></div></form></div></div></div>

<style>
.tkoin-wallet-container{max-width:600px;margin:20px 0}.wallet-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;border-bottom:2px solid #f0f0f0;padding-bottom:15px}.wallet-header h2{margin:0;font-size:24px;font-weight:600}.balance-card{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:30px;border-radius:12px;margin-bottom:25px;text-align:center;box-shadow:0 4px 15px rgba(102,126,234,.4)}.balance-label{font-size:14px;opacity:.9;margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px}.balance-amount{font-size:36px;font-weight:700;margin-bottom:8px}.balance-subtext{font-size:12px;opacity:.8}.wallet-actions{display:flex;gap:10px;margin-bottom:25px;flex-wrap:wrap}.wallet-actions .btn{flex:1;min-width:120px}.transaction-history{background:white;border:1px solid #e0e0e0;border-radius:8px;padding:20px}.transaction-history h3{font-size:16px;font-weight:600;margin-bottom:15px}.type-deposit{color:#28a745;font-weight:500}.type-withdrawal{color:#dc3545;font-weight:500}.status-pending{background-color:#ffc107;color:#000}.status-completed{background-color:#28a745;color:#fff}.status-processing{background-color:#17a2b8;color:#fff}@media (max-width:576px){.wallet-actions{flex-direction:column}.wallet-actions .btn{width:100%}.balance-amount{font-size:28px}}
</style>

<script src="{{ asset('js/tkoin-wallet.js') }}"></script>
EOFBLADE


# ============================================================================
# STEP 2: Create the JavaScript file (tkoin-wallet.js)
# ============================================================================
cat > /home/tkoin-betwin/htdocs/betwin.tkoin.finance/public/js/tkoin-wallet.js << 'EOFJS'
class TkoinWallet{constructor(){this.apiBaseUrl='/api/user/tkoin';this.authToken=this.getAuthToken();this.refreshInterval=null;this.init()}init(){this.setupEventListeners();this.fetchBalance();this.fetchHistory();this.refreshInterval=setInterval(()=>{this.fetchBalance();this.fetchHistory()},30000)}getAuthToken(){const e=document.querySelector('meta[name="csrf-token"]');return e?e.getAttribute('content'):null}setupEventListeners(){document.getElementById('btn-refresh')?.addEventListener('click',()=>{this.fetchBalance();this.fetchHistory()}),document.getElementById('depositForm')?.addEventListener('submit',e=>{e.preventDefault();this.handleDeposit()}),document.getElementById('withdrawalForm')?.addEventListener('submit',e=>{e.preventDefault();this.handleWithdrawal()})}async fetchBalance(){try{const e=await fetch(`${this.apiBaseUrl}/balance`,{method:'GET',headers:this.getHeaders()}),t=await e.json();e.ok&&this.updateBalanceDisplay(t)}catch(e){console.error('Error fetching balance:',e)}}updateBalanceDisplay(e){const t=parseFloat(e.balance).toFixed(2),a=e.currency||'CREDIT';document.getElementById('balance-amount').textContent=`${t} ${a}`,document.getElementById('balance-account').textContent=`Account ID: ${e.account_id||'---'}`;const s=document.getElementById('wallet-status');s&&(s.innerHTML='<span class="badge badge-success">Connected</span>')}async handleDeposit(){const e=document.getElementById('depositAmount').value,t=document.getElementById('depositError'),a=document.getElementById('depositSubmit'),s=document.getElementById('depositSpinner'),i=document.getElementById('depositSubmitText');if(t.style.display='none',!e||parseFloat(e)<=0)return void this.showError('Please enter a valid amount',t);a.disabled=!0,s.style.display='inline-block',i.textContent='Processing...';try{const o=await fetch(`${this.apiBaseUrl}/deposit`,{method:'POST',headers:this.getHeaders(),body:JSON.stringify({amount:parseFloat(e)})});if(!(await o.json()).ok)throw new Error('Deposit failed');this.showSuccess(`Deposit of ${e} CREDIT initiated successfully!`),document.getElementById('depositForm').reset();const n=bootstrap.Modal.getInstance(document.getElementById('depositModal'));n?.hide(),setTimeout(()=>{this.fetchBalance();this.fetchHistory()},1e3)}catch(e){this.showError(e.message||'Failed to initiate deposit',t)}finally{a.disabled=!1,s.style.display='none',i.textContent='Initiate Deposit'}}async handleWithdrawal(){const e=document.getElementById('withdrawalAmount').value,t=document.getElementById('solanaAddress').value,a=document.getElementById('withdrawalError'),s=document.getElementById('withdrawalSubmit'),i=document.getElementById('withdrawalSpinner'),o=document.getElementById('withdrawalSubmitText');if(a.style.display='none',!e||parseFloat(e)<=0)return void this.showError('Please enter a valid amount',a);s.disabled=!0,i.style.display='inline-block',o.textContent='Processing...';try{const n={amount:parseFloat(e)};t&&(n.solana_address=t);const r=await fetch(`${this.apiBaseUrl}/withdrawal`,{method:'POST',headers:this.getHeaders(),body:JSON.stringify(n)});if(!(await r.json()).ok)throw new Error('Withdrawal failed');this.showSuccess(`Withdrawal of ${e} CREDIT initiated! Processing: 5-30 min`),document.getElementById('withdrawalForm').reset();const l=bootstrap.Modal.getInstance(document.getElementById('withdrawalModal'));l?.hide(),setTimeout(()=>{this.fetchBalance();this.fetchHistory()},1e3)}catch(e){this.showError(e.message||'Failed to initiate withdrawal',a)}finally{s.disabled=!1,i.style.display='none',o.textContent='Initiate Withdrawal'}}async fetchHistory(){try{const e=await fetch(`${this.apiBaseUrl}/history?limit=10`,{method:'GET',headers:this.getHeaders()}),t=await e.json();e.ok&&this.updateHistoryDisplay(t.settlements)}catch(e){console.error('Error fetching history:',e)}}updateHistoryDisplay(e){const t=document.getElementById('transaction-body');e&&e.length>0?t.innerHTML=e.map(e=>{const a='deposit'===e.type?'type-deposit':'type-withdrawal',s=`status-${e.status}`,i='deposit'===e.type?'Deposit':'Withdrawal',o=parseFloat(e.amount).toFixed(2),n=new Date(e.created_at).toLocaleDateString(),r=e.status.charAt(0).toUpperCase()+e.status.slice(1);return`<tr><td><span class="${a}">${i}</span></td><td>${o} CREDIT</td><td><span class="badge ${s}">${r}</span></td><td>${n}</td></tr>`}).join(''):t.innerHTML='<tr><td colspan="4" class="text-center text-muted">No transactions yet</td></tr>'}showSuccess(e){const t=document.createElement('div');t.className='alert alert-success alert-dismissible fade show',t.innerHTML=`${e}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;const a=document.getElementById('tkoin-wallet');a.insertBefore(t,a.firstChild),setTimeout(()=>t.remove(),5e3)}showError(e,t=null){t&&(t.textContent=e,t.style.display='block')}getHeaders(){return{'Content-Type':'application/json','Accept':'application/json','X-CSRF-TOKEN':this.authToken||''}}destroy(){this.refreshInterval&&clearInterval(this.refreshInterval)}}document.addEventListener('DOMContentLoaded',()=>{window.tkoinWallet=new TkoinWallet()}),window.addEventListener('beforeunload',()=>{window.tkoinWallet?.destroy()});
EOFJS


# ============================================================================
# STEP 3: Update index.blade.php to include the Tkoin wallet component
# ============================================================================
cat > /home/tkoin-betwin/htdocs/betwin.tkoin.finance/resources/views/index.blade.php << 'EOFINDEX'
<!DOCTYPE html>
<html lang="{{ app()->getLocale() }}">
<head>
  <title>{{ config('app.name') }}</title>
  <!-- {{ config('app.version') }} -->

  <meta charset="utf-8" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
  <meta name="description" content="{{ __('Fair online casino games') }}" />
  <meta name="keywords" content="casino,blackjack,poker,slots,slot machine,baccarat,dice,roulette,online games" />
  <meta name="theme-color" content="#ffffff">
  <meta name="csrf-token" content="{{ csrf_token() }}">

  <!-- Favicon -->
  <link rel="icon" href="{{ asset(config('settings.favicon.ico')) }}" type="image/x-icon">
  @if(config('settings.favicon.apple_touch'))
    <link rel="apple-touch-icon" sizes="180x180" href="{{ asset(config('settings.favicon.apple_touch')) }}">
  @endif
  @if(config('settings.favicon.32x32'))
    <link rel="icon" sizes="32x32" href="{{ asset(config('settings.favicon.32x32')) }}">
  @endif
  @if(config('settings.favicon.192x192'))
    <link rel="icon" sizes="192x192" href="{{ asset(config('settings.favicon.192x192')) }}">
  @endif
  @if(config('settings.favicon.mask'))
    <link rel="mask-icon" color="#000000" href="{{ asset(config('settings.favicon.mask')) }}">
  @endif
    <!-- END Favicon -->

  <link rel="manifest" href="{{ asset('manifest.json') }}">

  <!--Open Graph tags-->
  <meta property="og:url" content="{{ url('/') }}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="{{ config('app.name') }}" />
  <meta property="og:description" content="{{ __('Fair online casino games') }}" />
  <meta property="og:image" content="{{ asset(config('app.og_image')) }}" />
  <!--END Open Graph tags-->

  <!--Google Tag Manager-->
  @if(config('services.gtm.container_id'))
    <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
        'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
      })(window,document,'script','dataLayer', '{{ config('services.gtm.container_id') }}');
    </script>
  @endif
  <!--END Google Tag Manager-->

  <!-- Bootstrap CSS (required for Tkoin Wallet) -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">

  <!-- Font Awesome (required for Tkoin Wallet icons) -->
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">

  @foreach($stylesheets as $stylesheet)
    <link href="{{ $stylesheet }}" rel="stylesheet">
  @endforeach

  <noscript>
    <h3>{{ __('Please enable JavaScript in your browser.') }}</h3>
  </noscript>
</head>
<body onload="if(window !== window.top) window.top.location = window.location">
  <div id="app"></div>

  <!-- Tkoin Wallet Component - Fixed Widget in bottom-right corner -->
  <div style="position: fixed; bottom: 20px; right: 20px; width: 420px; max-height: 700px; overflow-y: auto; z-index: 9999; background: white; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
    @include('components.tkoin-wallet')
  </div>

  <script>
    window.store = "{{ $store }}"
  </script>

  <script src="{{ asset('js/app.js') . '?' . md5(config('app.version')) }}"></script>
  
  <!-- Bootstrap JS (required for Tkoin Wallet modals) -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
  
  {!! $javascript !!}
</body>
</html>
EOFINDEX


# ============================================================================
# VERIFICATION
# ============================================================================
echo ""
echo "✅ Files Created:"
echo "---"
ls -lh /home/tkoin-betwin/htdocs/betwin.tkoin.finance/resources/views/components/tkoin-wallet.blade.php 2>/dev/null || echo "❌ Component file not found"
ls -lh /home/tkoin-betwin/htdocs/betwin.tkoin.finance/public/js/tkoin-wallet.js 2>/dev/null || echo "❌ JavaScript file not found"
ls -lh /home/tkoin-betwin/htdocs/betwin.tkoin.finance/resources/views/index.blade.php 2>/dev/null || echo "❌ Index blade file not found"

echo ""
echo "✅ Setup Complete! The Tkoin wallet widget will appear in the bottom-right corner of BetWin."
