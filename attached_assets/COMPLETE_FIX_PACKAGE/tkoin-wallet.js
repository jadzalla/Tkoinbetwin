/**
 * BetWin Tkoin Wallet JavaScript - CORRECTED VERSION
 * 
 * Place in: public/js/tkoin-wallet.js
 * 
 * Features:
 * - Fixed API base URL to /tkoin
 * - Proper balance/history display from BetWin DB
 * - Phantom wallet connection support
 * - Deposit/Withdrawal functionality
 */

class TkoinWallet {
  constructor() {
    this.apiBaseUrl = '/tkoin';
    this.authToken = this.getAuthToken();
    this.refreshInterval = null;
    this.walletAddress = null;
    this.walletBalance = 0;
    this.isWalletConnected = false;
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.checkPhantomWallet();
    this.fetchBalance();
    this.fetchHistory();
    
    // Auto-refresh every 30 seconds
    this.refreshInterval = setInterval(() => {
      this.fetchBalance();
      this.fetchHistory();
      if (this.isWalletConnected) {
        this.fetchWalletBalance();
      }
    }, 30000);
  }

  getAuthToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : null;
  }

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-CSRF-TOKEN': this.authToken,
      'X-Requested-With': 'XMLHttpRequest',
    };
  }

  checkPhantomWallet() {
    const connectBtn = document.getElementById('connect-wallet-btn');
    if (!connectBtn) return;

    if (typeof window.solana !== 'undefined' && window.solana.isPhantom) {
      connectBtn.textContent = 'Connect Phantom Wallet';
      connectBtn.disabled = false;
      
      window.solana.connect({ onlyIfTrusted: true })
        .then((response) => {
          this.handleWalletConnected(response.publicKey.toString());
        })
        .catch(() => {
          // Not connected yet
        });
    } else {
      connectBtn.innerHTML = '<i class="fa fa-wallet"></i> Install Phantom Wallet';
      connectBtn.onclick = () => {
        window.open('https://phantom.app/', '_blank');
      };
    }
  }

  async connectPhantomWallet() {
    try {
      if (typeof window.solana === 'undefined') {
        alert('Phantom Wallet not detected. Redirecting to installation page...');
        window.open('https://phantom.app/', '_blank');
        return;
      }

      const response = await window.solana.connect();
      const publicKey = response.publicKey.toString();
      this.handleWalletConnected(publicKey);
    } catch (error) {
      console.error('Wallet connection error:', error);
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
        connectBtn.onclick = () => this.connectPhantomWallet();
      }
      
      document.getElementById('wallet-balance-card')?.remove();
      
      this.showSuccess('Wallet disconnected successfully');
    } catch (error) {
      console.error('Disconnect error:', error);
      this.showError('Failed to disconnect wallet');
    }
  }

  handleWalletConnected(publicKey) {
    this.isWalletConnected = true;
    this.walletAddress = publicKey;
    
    const connectBtn = document.getElementById('connect-wallet-btn');
    if (connectBtn) {
      const shortAddress = publicKey.slice(0, 4) + '...' + publicKey.slice(-4);
      connectBtn.innerHTML = `<i class="fa fa-wallet"></i> Disconnect ${shortAddress}`;
      connectBtn.onclick = () => this.disconnectWallet();
    }
    
    this.fetchWalletBalance();
    this.showSuccess('Phantom wallet connected!');
  }

  async fetchWalletBalance() {
    if (!this.walletAddress) return;
    // TODO: Implement Solana RPC call for TKOIN balance
  }

  setupEventListeners() {
    document.getElementById('btn-refresh')?.addEventListener('click', () => {
      this.fetchBalance();
      this.fetchHistory();
      if (this.isWalletConnected) {
        this.fetchWalletBalance();
      }
    });

    document.getElementById('connect-wallet-btn')?.addEventListener('click', () => {
      if (!this.isWalletConnected) {
        this.connectPhantomWallet();
      } else {
        this.disconnectWallet();
      }
    });

    document.getElementById('depositForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleDeposit();
    });

    document.getElementById('withdrawalForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleWithdrawal();
    });
  }

  async fetchBalance() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/balance`, {
        method: 'GET',
        headers: this.getHeaders(),
        credentials: 'same-origin',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Balance response:', data);
      this.updateBalanceDisplay(data);
    } catch (error) {
      console.error('Error fetching balance:', error);
      this.showError('Failed to load wallet balance. Please refresh the page.');
    }
  }

  updateBalanceDisplay(data) {
    // Handle both response formats
    const balance = data.balance ?? data.credits ?? data.creditsBalance ?? 0;
    const currency = data.currency ?? 'CREDIT';
    const accountId = data.account_id ?? data.accountId ?? '---';
    
    const balanceEl = document.getElementById('balance-amount');
    const accountEl = document.getElementById('balance-account');
    
    if (balanceEl) {
      balanceEl.textContent = `${parseFloat(balance).toFixed(2)} ${currency}`;
    }
    
    if (accountEl) {
      accountEl.textContent = `Account ID: ${accountId}`;
    }
    
    const statusEl = document.getElementById('wallet-status');
    if (statusEl) {
      statusEl.innerHTML = '<span class="badge badge-success">Connected</span>';
    }
  }

  async handleDeposit() {
    const amount = document.getElementById('depositAmount')?.value;
    const errorDiv = document.getElementById('depositError');
    const submitBtn = document.getElementById('depositSubmit');
    const spinner = document.getElementById('depositSpinner');
    const submitText = document.getElementById('depositSubmitText');

    if (errorDiv) {
      errorDiv.style.display = 'none';
      errorDiv.textContent = '';
    }

    if (!amount || parseFloat(amount) <= 0) {
      this.showError('Please enter a valid amount', errorDiv);
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    if (spinner) spinner.style.display = 'inline-block';
    if (submitText) submitText.textContent = 'Processing...';

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
      
      const modal = bootstrap.Modal.getInstance(document.getElementById('depositModal'));
      modal?.hide();

      setTimeout(() => {
        this.fetchBalance();
        this.fetchHistory();
      }, 1000);

    } catch (error) {
      console.error('Deposit error:', error);
      this.showError(error.message || 'Failed to initiate deposit', errorDiv);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      if (spinner) spinner.style.display = 'none';
      if (submitText) submitText.textContent = 'Initiate Deposit';
    }
  }

  async handleWithdrawal() {
    const amount = document.getElementById('withdrawalAmount')?.value;
    const solanaAddress = document.getElementById('solanaAddress')?.value;
    const errorDiv = document.getElementById('withdrawalError');
    const submitBtn = document.getElementById('withdrawalSubmit');
    const spinner = document.getElementById('withdrawalSpinner');
    const submitText = document.getElementById('withdrawalSubmitText');

    if (errorDiv) {
      errorDiv.style.display = 'none';
      errorDiv.textContent = '';
    }

    if (!amount || parseFloat(amount) <= 0) {
      this.showError('Please enter a valid amount', errorDiv);
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    if (spinner) spinner.style.display = 'inline-block';
    if (submitText) submitText.textContent = 'Processing...';

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
      
      const modal = bootstrap.Modal.getInstance(document.getElementById('withdrawalModal'));
      modal?.hide();

      setTimeout(() => {
        this.fetchBalance();
        this.fetchHistory();
      }, 1000);

    } catch (error) {
      console.error('Withdrawal error:', error);
      this.showError(error.message || 'Failed to initiate withdrawal', errorDiv);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      if (spinner) spinner.style.display = 'none';
      if (submitText) submitText.textContent = 'Initiate Withdrawal';
    }
  }

  async fetchHistory() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/history?limit=10`, {
        method: 'GET',
        headers: this.getHeaders(),
        credentials: 'same-origin',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('History response:', data);
      this.updateHistoryDisplay(data.transactions || data.settlements || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  }

  updateHistoryDisplay(transactions) {
    const tbody = document.getElementById('transaction-body');
    if (!tbody) return;
    
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
  }

  showSuccess(message) {
    console.log('Success:', message);
    // You can implement toast/alert here
    alert(message);
  }

  showError(message, element = null) {
    console.error('Error:', message);
    if (element) {
      element.textContent = message;
      element.style.display = 'block';
    } else {
      alert('Error: ' + message);
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.tkoinWallet = new TkoinWallet();
});
