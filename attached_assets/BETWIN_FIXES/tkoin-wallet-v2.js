/**
 * BetWin Tkoin Wallet JavaScript - VERSION 2 (COMPLETE FIX)
 * 
 * Place in: public/js/tkoin-wallet.js
 * 
 * FIXES:
 * - Proper CSRF token handling for Laravel
 * - Connect Solana Wallet button working
 * - Better error handling and debugging
 * - Balance/history loading properly
 */

class TkoinWallet {
  constructor() {
    this.apiBaseUrl = '/tkoin';
    this.authToken = null;
    this.refreshInterval = null;
    this.walletAddress = null;
    this.walletBalance = 0;
    this.isWalletConnected = false;
    
    // Initialize auth token first
    this.initAuthToken();
    this.init();
  }

  initAuthToken() {
    // Get CSRF token from meta tag (Laravel standard)
    const meta = document.querySelector('meta[name="csrf-token"]');
    if (meta) {
      this.authToken = meta.getAttribute('content');
      console.log('[Tkoin] CSRF token found');
    } else {
      console.warn('[Tkoin] No CSRF token meta tag found!');
      // Try to get from cookie as fallback
      const cookies = document.cookie.split(';');
      for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'XSRF-TOKEN') {
          this.authToken = decodeURIComponent(value);
          console.log('[Tkoin] CSRF token found in cookie');
          break;
        }
      }
    }
  }

  init() {
    console.log('[Tkoin] Initializing wallet...');
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.startWallet());
    } else {
      this.startWallet();
    }
  }

  startWallet() {
    console.log('[Tkoin] Starting wallet initialization...');
    
    this.setupEventListeners();
    this.checkPhantomWallet();
    this.fetchBalance();
    this.fetchHistory();
    
    // Update status indicator
    this.updateStatus('loading');
    
    // Auto-refresh every 30 seconds
    this.refreshInterval = setInterval(() => {
      this.fetchBalance();
      this.fetchHistory();
      if (this.isWalletConnected) {
        this.fetchWalletBalance();
      }
    }, 30000);
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    };
    
    if (this.authToken) {
      headers['X-CSRF-TOKEN'] = this.authToken;
    }
    
    return headers;
  }

  updateStatus(status) {
    const statusEl = document.getElementById('wallet-status');
    if (!statusEl) return;
    
    switch (status) {
      case 'loading':
        statusEl.innerHTML = '<span class="badge badge-warning" style="background-color: #fbbf24; color: #000;">Loading...</span>';
        break;
      case 'connected':
        statusEl.innerHTML = '<span class="badge badge-success" style="background-color: #22c55e; color: #fff;">Connected</span>';
        break;
      case 'error':
        statusEl.innerHTML = '<span class="badge badge-danger" style="background-color: #ef4444; color: #fff;">Error</span>';
        break;
      default:
        statusEl.innerHTML = '<span class="badge badge-secondary">Unknown</span>';
    }
  }

  checkPhantomWallet() {
    const connectBtn = document.getElementById('connect-wallet-btn');
    if (!connectBtn) {
      console.warn('[Tkoin] Connect wallet button not found');
      return;
    }

    console.log('[Tkoin] Checking for Phantom wallet...');
    console.log('[Tkoin] window.solana exists:', typeof window.solana !== 'undefined');
    console.log('[Tkoin] window.solana.isPhantom:', window.solana?.isPhantom);

    if (typeof window.solana !== 'undefined' && window.solana.isPhantom) {
      console.log('[Tkoin] Phantom wallet detected');
      connectBtn.innerHTML = '<i class="fa fa-wallet"></i> Connect Phantom Wallet';
      connectBtn.disabled = false;
      
      // Try to auto-connect if previously connected
      window.solana.connect({ onlyIfTrusted: true })
        .then((response) => {
          console.log('[Tkoin] Auto-connected to Phantom');
          this.handleWalletConnected(response.publicKey.toString());
        })
        .catch((err) => {
          console.log('[Tkoin] Not auto-connected:', err.message);
        });
    } else {
      console.log('[Tkoin] Phantom wallet not detected');
      connectBtn.innerHTML = '<i class="fa fa-download"></i> Install Phantom Wallet';
    }
  }

  async connectPhantomWallet() {
    console.log('[Tkoin] Attempting to connect Phantom wallet...');
    
    try {
      if (typeof window.solana === 'undefined') {
        console.log('[Tkoin] Phantom not installed, redirecting...');
        alert('Phantom Wallet not detected. Redirecting to installation page...');
        window.open('https://phantom.app/', '_blank');
        return;
      }

      const response = await window.solana.connect();
      const publicKey = response.publicKey.toString();
      console.log('[Tkoin] Wallet connected:', publicKey);
      this.handleWalletConnected(publicKey);
    } catch (error) {
      console.error('[Tkoin] Wallet connection error:', error);
      this.showError('Failed to connect wallet: ' + error.message);
    }
  }

  async disconnectWallet() {
    try {
      if (window.solana && window.solana.isConnected) {
        await window.solana.disconnect();
      }
      
      this.isWalletConnected = false;
      this.walletAddress = null;
      this.walletBalance = 0;
      
      const connectBtn = document.getElementById('connect-wallet-btn');
      if (connectBtn) {
        connectBtn.innerHTML = '<i class="fa fa-wallet"></i> Connect Solana Wallet';
      }
      
      console.log('[Tkoin] Wallet disconnected');
      this.showSuccess('Wallet disconnected successfully');
    } catch (error) {
      console.error('[Tkoin] Disconnect error:', error);
      this.showError('Failed to disconnect wallet');
    }
  }

  handleWalletConnected(publicKey) {
    this.isWalletConnected = true;
    this.walletAddress = publicKey;
    
    const connectBtn = document.getElementById('connect-wallet-btn');
    if (connectBtn) {
      const shortAddress = publicKey.slice(0, 4) + '...' + publicKey.slice(-4);
      connectBtn.innerHTML = `<i class="fa fa-check-circle"></i> ${shortAddress}`;
      connectBtn.classList.add('connected');
    }
    
    this.fetchWalletBalance();
    this.showSuccess('Phantom wallet connected!');
  }

  async fetchWalletBalance() {
    if (!this.walletAddress) return;
    console.log('[Tkoin] Fetching wallet balance for:', this.walletAddress);
    // TODO: Implement Solana RPC call for TKOIN balance
  }

  setupEventListeners() {
    console.log('[Tkoin] Setting up event listeners...');
    
    // Refresh button
    const refreshBtn = document.getElementById('btn-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('[Tkoin] Refresh button clicked');
        this.fetchBalance();
        this.fetchHistory();
        if (this.isWalletConnected) {
          this.fetchWalletBalance();
        }
      });
      console.log('[Tkoin] Refresh button listener attached');
    }

    // Connect Wallet button - THE FIX
    const connectBtn = document.getElementById('connect-wallet-btn');
    if (connectBtn) {
      // Remove any existing listeners
      const newBtn = connectBtn.cloneNode(true);
      connectBtn.parentNode.replaceChild(newBtn, connectBtn);
      
      // Add new click listener
      newBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('[Tkoin] Connect wallet button clicked');
        if (!this.isWalletConnected) {
          this.connectPhantomWallet();
        } else {
          this.disconnectWallet();
        }
      });
      console.log('[Tkoin] Connect wallet button listener attached');
    } else {
      console.warn('[Tkoin] Connect wallet button not found!');
    }

    // Deposit form
    const depositForm = document.getElementById('depositForm');
    if (depositForm) {
      depositForm.addEventListener('submit', (e) => {
        e.preventDefault();
        console.log('[Tkoin] Deposit form submitted');
        this.handleDeposit();
      });
    }

    // Withdrawal form
    const withdrawalForm = document.getElementById('withdrawalForm');
    if (withdrawalForm) {
      withdrawalForm.addEventListener('submit', (e) => {
        e.preventDefault();
        console.log('[Tkoin] Withdrawal form submitted');
        this.handleWithdrawal();
      });
    }
  }

  async fetchBalance() {
    console.log('[Tkoin] Fetching balance from:', `${this.apiBaseUrl}/balance`);
    
    try {
      const response = await fetch(`${this.apiBaseUrl}/balance`, {
        method: 'GET',
        headers: this.getHeaders(),
        credentials: 'same-origin',
      });

      console.log('[Tkoin] Balance response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Tkoin] Balance error response:', errorText);
        
        if (response.status === 401) {
          this.updateStatus('error');
          console.error('[Tkoin] User not authenticated');
          return;
        }
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('[Tkoin] Balance data received:', data);
      this.updateBalanceDisplay(data);
      this.updateStatus('connected');
    } catch (error) {
      console.error('[Tkoin] Error fetching balance:', error);
      this.updateStatus('error');
    }
  }

  updateBalanceDisplay(data) {
    // Handle multiple response formats for compatibility
    const balance = data.balance ?? data.credits ?? data.creditsBalance ?? 0;
    const currency = data.currency ?? 'CREDIT';
    const accountId = data.account_id ?? data.accountId ?? '---';
    
    console.log('[Tkoin] Updating display:', { balance, currency, accountId });
    
    const balanceEl = document.getElementById('balance-amount');
    const accountEl = document.getElementById('balance-account');
    
    if (balanceEl) {
      balanceEl.textContent = `${parseFloat(balance).toFixed(2)} ${currency}`;
      console.log('[Tkoin] Balance element updated');
    } else {
      console.warn('[Tkoin] Balance element not found');
    }
    
    if (accountEl) {
      accountEl.textContent = `Account ID: ${accountId}`;
      console.log('[Tkoin] Account element updated');
    } else {
      console.warn('[Tkoin] Account element not found');
    }
  }

  async fetchHistory() {
    console.log('[Tkoin] Fetching history...');
    
    try {
      const response = await fetch(`${this.apiBaseUrl}/history?limit=10`, {
        method: 'GET',
        headers: this.getHeaders(),
        credentials: 'same-origin',
      });

      console.log('[Tkoin] History response status:', response.status);

      if (!response.ok) {
        if (response.status === 401) {
          console.log('[Tkoin] User not authenticated for history');
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('[Tkoin] History data received:', data);
      this.updateHistoryDisplay(data.transactions || data.settlements || []);
    } catch (error) {
      console.error('[Tkoin] Error fetching history:', error);
    }
  }

  updateHistoryDisplay(transactions) {
    const tbody = document.getElementById('transaction-body');
    if (!tbody) {
      console.warn('[Tkoin] Transaction body element not found');
      return;
    }
    
    if (!transactions || transactions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: #94a3b8;">No transactions yet</td></tr>';
      return;
    }

    tbody.innerHTML = transactions.map(tx => {
      const typeClass = tx.type === 'deposit' ? 'type-deposit' : 'type-withdrawal';
      const statusClass = `status-${tx.status}`;
      const date = tx.created_at ? new Date(tx.created_at).toLocaleDateString() : 'N/A';
      const amount = parseFloat(tx.amount || 0).toFixed(2);
      
      return `
        <tr>
          <td><span class="${typeClass}">${tx.type?.toUpperCase() || 'N/A'}</span></td>
          <td>${amount} CREDIT</td>
          <td><span class="${statusClass}">${tx.status?.toUpperCase() || 'N/A'}</span></td>
          <td>${date}</td>
        </tr>
      `;
    }).join('');
    
    console.log('[Tkoin] History display updated with', transactions.length, 'transactions');
  }

  async handleDeposit() {
    const amount = document.getElementById('depositAmount')?.value;
    const errorDiv = document.getElementById('depositError');
    const submitBtn = document.getElementById('depositSubmit');

    if (errorDiv) {
      errorDiv.style.display = 'none';
    }

    if (!amount || parseFloat(amount) <= 0) {
      this.showError('Please enter a valid amount', errorDiv);
      return;
    }

    if (submitBtn) submitBtn.disabled = true;

    try {
      const response = await fetch(`${this.apiBaseUrl}/deposit`, {
        method: 'POST',
        headers: this.getHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify({ amount: parseFloat(amount) }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Deposit failed');
      }

      this.showSuccess(`Deposit of ${amount} CREDIT initiated successfully!`);
      document.getElementById('depositForm')?.reset();
      
      setTimeout(() => {
        this.fetchBalance();
        this.fetchHistory();
      }, 1000);

    } catch (error) {
      console.error('[Tkoin] Deposit error:', error);
      this.showError(error.message || 'Failed to initiate deposit', errorDiv);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  async handleWithdrawal() {
    const amount = document.getElementById('withdrawalAmount')?.value;
    const solanaAddress = document.getElementById('solanaAddress')?.value;
    const errorDiv = document.getElementById('withdrawalError');
    const submitBtn = document.getElementById('withdrawalSubmit');

    if (errorDiv) {
      errorDiv.style.display = 'none';
    }

    if (!amount || parseFloat(amount) <= 0) {
      this.showError('Please enter a valid amount', errorDiv);
      return;
    }

    if (submitBtn) submitBtn.disabled = true;

    try {
      const payload = { 
        credits_amount: parseFloat(amount),
        destination_wallet: solanaAddress || this.walletAddress || '',
      };

      const response = await fetch(`${this.apiBaseUrl}/withdrawal`, {
        method: 'POST',
        headers: this.getHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Withdrawal failed');
      }

      this.showSuccess(`Withdrawal of ${amount} CREDIT initiated successfully!`);
      document.getElementById('withdrawalForm')?.reset();
      
      setTimeout(() => {
        this.fetchBalance();
        this.fetchHistory();
      }, 1000);

    } catch (error) {
      console.error('[Tkoin] Withdrawal error:', error);
      this.showError(error.message || 'Failed to initiate withdrawal', errorDiv);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  showSuccess(message) {
    console.log('[Tkoin] Success:', message);
    // Use Laravel's toast if available, otherwise alert
    if (typeof toastr !== 'undefined') {
      toastr.success(message);
    } else {
      alert(message);
    }
  }

  showError(message, element = null) {
    console.error('[Tkoin] Error:', message);
    if (element) {
      element.textContent = message;
      element.style.display = 'block';
    } else if (typeof toastr !== 'undefined') {
      toastr.error(message);
    } else {
      alert('Error: ' + message);
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[Tkoin] DOM loaded, creating TkoinWallet instance');
    window.tkoinWallet = new TkoinWallet();
  });
} else {
  console.log('[Tkoin] DOM already loaded, creating TkoinWallet instance');
  window.tkoinWallet = new TkoinWallet();
}
