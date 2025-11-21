/**
 * BetWin Tkoin Wallet JavaScript
 * Place in: public/js/tkoin-wallet.js
 * 
 * Handles all Tkoin wallet interactions:
 * - Balance fetching
 * - Deposits
 * - Withdrawals
 * - Transaction history
 */

class TkoinWallet {
  constructor() {
    this.apiBaseUrl = '/api/user/tkoin';
    this.authToken = this.getAuthToken();
    this.refreshInterval = null;
    
    this.init();
  }

  // Initialize wallet on page load
  init() {
    this.setupEventListeners();
    this.fetchBalance();
    this.fetchHistory();
    
    // Auto-refresh balance every 30 seconds
    this.refreshInterval = setInterval(() => {
      this.fetchBalance();
      this.fetchHistory();
    }, 30000);
  }

  // Get CSRF token or API auth token from page
  getAuthToken() {
    // For Laravel, the token is typically in meta tag or cookie
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : null;
  }

  // Setup event listeners
  setupEventListeners() {
    // Refresh button
    document.getElementById('btn-refresh')?.addEventListener('click', () => {
      this.fetchBalance();
      this.fetchHistory();
    });

    // Deposit form
    document.getElementById('depositForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleDeposit();
    });

    // Withdrawal form
    document.getElementById('withdrawalForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleWithdrawal();
    });
  }

  // Fetch current balance
  async fetchBalance() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/balance`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      this.updateBalanceDisplay(data);
    } catch (error) {
      console.error('Error fetching balance:', error);
      this.showError('Failed to load wallet balance. Please refresh the page.');
    }
  }

  // Update balance display
  updateBalanceDisplay(data) {
    const amount = parseFloat(data.balance).toFixed(2);
    const currency = data.currency || 'CREDIT';
    
    document.getElementById('balance-amount').textContent = `${amount} ${currency}`;
    document.getElementById('balance-account').textContent = `Account ID: ${data.account_id || '---'}`;
    
    // Update status
    const statusEl = document.getElementById('wallet-status');
    if (statusEl) {
      statusEl.innerHTML = '<span class="badge badge-success">Connected</span>';
    }
  }

  // Handle deposit submission
  async handleDeposit() {
    const amount = document.getElementById('depositAmount').value;
    const errorDiv = document.getElementById('depositError');
    const submitBtn = document.getElementById('depositSubmit');
    const spinner = document.getElementById('depositSpinner');
    const submitText = document.getElementById('depositSubmitText');

    // Clear previous errors
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';

    // Validate
    if (!amount || parseFloat(amount) <= 0) {
      this.showError('Please enter a valid amount', errorDiv);
      return;
    }

    // Disable button and show spinner
    submitBtn.disabled = true;
    spinner.style.display = 'inline-block';
    submitText.textContent = 'Processing...';

    try {
      const response = await fetch(`${this.apiBaseUrl}/deposit`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ amount: parseFloat(amount) }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Deposit failed');
      }

      // Success
      this.showSuccess(`Deposit of ${amount} CREDIT initiated successfully!`);
      document.getElementById('depositForm').reset();
      
      // Close modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('depositModal'));
      modal?.hide();

      // Refresh balance and history
      setTimeout(() => {
        this.fetchBalance();
        this.fetchHistory();
      }, 1000);

    } catch (error) {
      console.error('Deposit error:', error);
      this.showError(error.message || 'Failed to initiate deposit', errorDiv);
    } finally {
      // Re-enable button
      submitBtn.disabled = false;
      spinner.style.display = 'none';
      submitText.textContent = 'Initiate Deposit';
    }
  }

  // Handle withdrawal submission
  async handleWithdrawal() {
    const amount = document.getElementById('withdrawalAmount').value;
    const solanaAddress = document.getElementById('solanaAddress').value;
    const errorDiv = document.getElementById('withdrawalError');
    const submitBtn = document.getElementById('withdrawalSubmit');
    const spinner = document.getElementById('withdrawalSpinner');
    const submitText = document.getElementById('withdrawalSubmitText');

    // Clear previous errors
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';

    // Validate
    if (!amount || parseFloat(amount) <= 0) {
      this.showError('Please enter a valid amount', errorDiv);
      return;
    }

    // Disable button and show spinner
    submitBtn.disabled = true;
    spinner.style.display = 'inline-block';
    submitText.textContent = 'Processing...';

    try {
      const payload = { amount: parseFloat(amount) };
      if (solanaAddress) {
        payload.solana_address = solanaAddress;
      }

      const response = await fetch(`${this.apiBaseUrl}/withdrawal`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Withdrawal failed');
      }

      // Success
      this.showSuccess(`Withdrawal of ${amount} CREDIT initiated successfully! Processing time: 5-30 minutes.`);
      document.getElementById('withdrawalForm').reset();
      
      // Close modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('withdrawalModal'));
      modal?.hide();

      // Refresh balance and history
      setTimeout(() => {
        this.fetchBalance();
        this.fetchHistory();
      }, 1000);

    } catch (error) {
      console.error('Withdrawal error:', error);
      this.showError(error.message || 'Failed to initiate withdrawal', errorDiv);
    } finally {
      // Re-enable button
      submitBtn.disabled = false;
      spinner.style.display = 'none';
      submitText.textContent = 'Initiate Withdrawal';
    }
  }

  // Fetch transaction history
  async fetchHistory() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/history?limit=10`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      this.updateHistoryDisplay(data.settlements);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  }

  // Update transaction history display
  updateHistoryDisplay(settlements) {
    const tbody = document.getElementById('transaction-body');
    
    if (!settlements || settlements.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No transactions yet</td></tr>';
      return;
    }

    tbody.innerHTML = settlements.map(settlement => {
      const typeClass = settlement.type === 'deposit' ? 'type-deposit' : 'type-withdrawal';
      const statusClass = `status-${settlement.status}`;
      const typeLabel = settlement.type === 'deposit' ? '📥 Deposit' : '📤 Withdrawal';
      const amount = parseFloat(settlement.amount).toFixed(2);
      const date = new Date(settlement.created_at).toLocaleDateString();
      const statusLabel = settlement.status.charAt(0).toUpperCase() + settlement.status.slice(1);

      return `
        <tr>
          <td><span class="${typeClass}">${typeLabel}</span></td>
          <td>${amount} CREDIT</td>
          <td><span class="badge ${statusClass}">${statusLabel}</span></td>
          <td>${date}</td>
        </tr>
      `;
    }).join('');
  }

  // Show success message
  showSuccess(message) {
    // Create a toast/alert element
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-success alert-dismissible fade show';
    alertDiv.setAttribute('role', 'alert');
    alertDiv.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Insert at top of wallet container
    const container = document.getElementById('tkoin-wallet');
    container.insertBefore(alertDiv, container.firstChild);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      alertDiv.remove();
    }, 5000);
  }

  // Show error message
  showError(message, errorDiv = null) {
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
    } else {
      const alertDiv = document.createElement('div');
      alertDiv.className = 'alert alert-danger alert-dismissible fade show';
      alertDiv.setAttribute('role', 'alert');
      alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      `;
      
      const container = document.getElementById('tkoin-wallet');
      container.insertBefore(alertDiv, container.firstChild);

      setTimeout(() => {
        alertDiv.remove();
      }, 5000);
    }
  }

  // Get request headers
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // Add CSRF token for Laravel
    if (this.authToken) {
      headers['X-CSRF-TOKEN'] = this.authToken;
    }

    return headers;
  }

  // Cleanup on page unload
  destroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }
}

// Initialize wallet when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.tkoinWallet = new TkoinWallet();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  window.tkoinWallet?.destroy();
});
