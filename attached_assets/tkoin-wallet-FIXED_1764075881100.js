/**
 * Tkoin Wallet Integration for BetWin Casino
 * FIXED VERSION - v4.0
 * 
 * FIXES:
 * ✅ Wallet connection requires explicit user click (no auto-connect)
 * ✅ Disconnect wallet button added
 * ✅ Deposit triggers actual Phantom SPL token transfer
 * ✅ Verifies transaction on blockchain after sending
 * ✅ Credits added after verification
 */

class TkoinWallet {
  constructor() {
    this.apiBaseUrl = '/tkoin';
    this.phantom = null;
    this.publicKey = null;
    this.connected = false;
    
    // Solana configuration
    this.treasuryWallet = null;
    this.tkoinMint = null;
    this.platformUserId = null;
    
    this.init();
  }

  init() {
    console.log('[Tkoin] Initializing wallet manager...');
    
    // Fetch initial data (balance, history)
    this.fetchBalance();
    this.fetchHistory();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Check if Phantom is installed (but DON'T auto-connect)
    this.checkPhantomInstalled();
    
    console.log('[Tkoin] Wallet manager initialized');
  }

  checkPhantomInstalled() {
    if (window.solana?.isPhantom) {
      console.log('[Tkoin] Phantom wallet detected');
      this.phantom = window.solana;
      
      // Listen for account changes
      this.phantom.on('accountChanged', (publicKey) => {
        if (publicKey) {
          this.handleWalletConnected(publicKey.toString());
        } else {
          this.handleWalletDisconnected();
        }
      });
      
      // Listen for disconnect
      this.phantom.on('disconnect', () => {
        this.handleWalletDisconnected();
      });
      
      // Update UI to show "Connect" button
      this.updateWalletUI(false);
    } else {
      console.log('[Tkoin] Phantom wallet not detected');
      this.showPhantomNotInstalled();
    }
  }

  setupEventListeners() {
    // Connect wallet button
    const connectBtn = document.getElementById('connectWalletBtn');
    if (connectBtn) {
      connectBtn.addEventListener('click', () => this.connectWallet());
    }

    // Disconnect wallet button
    const disconnectBtn = document.getElementById('disconnectWalletBtn');
    if (disconnectBtn) {
      disconnectBtn.addEventListener('click', () => this.disconnectWallet());
    }

    // Deposit form
    const depositForm = document.getElementById('depositForm');
    if (depositForm) {
      depositForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleDeposit();
      });
    }

    // Withdraw form
    const withdrawForm = document.getElementById('withdrawForm');
    if (withdrawForm) {
      withdrawForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleWithdraw();
      });
    }

    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.fetchBalance();
        this.fetchHistory();
      });
    }
  }

  getHeaders() {
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(csrfToken && { 'X-CSRF-TOKEN': csrfToken }),
    };
  }

  // ==================== WALLET CONNECTION ====================

  async connectWallet() {
    if (!this.phantom) {
      this.showError('Please install Phantom wallet from phantom.app');
      return;
    }

    try {
      console.log('[Tkoin] Requesting wallet connection...');
      const response = await this.phantom.connect();
      const publicKey = response.publicKey.toString();
      
      this.handleWalletConnected(publicKey);
      this.showSuccess('Phantom wallet connected successfully!');
      
    } catch (error) {
      console.error('[Tkoin] Connection error:', error);
      if (error.code === 4001) {
        this.showError('Connection rejected by user');
      } else {
        this.showError('Failed to connect wallet: ' + error.message);
      }
    }
  }

  async disconnectWallet() {
    try {
      if (this.phantom) {
        await this.phantom.disconnect();
      }
      this.handleWalletDisconnected();
      this.showSuccess('Wallet disconnected');
    } catch (error) {
      console.error('[Tkoin] Disconnect error:', error);
      // Force disconnect UI update even if error
      this.handleWalletDisconnected();
    }
  }

  handleWalletConnected(publicKey) {
    console.log('[Tkoin] Wallet connected:', publicKey);
    this.publicKey = publicKey;
    this.connected = true;
    this.updateWalletUI(true);
    this.fetchWalletBalance();
  }

  handleWalletDisconnected() {
    console.log('[Tkoin] Wallet disconnected');
    this.publicKey = null;
    this.connected = false;
    this.updateWalletUI(false);
    
    // Remove wallet balance card
    const walletCard = document.getElementById('wallet-balance-card');
    if (walletCard) walletCard.remove();
  }

  updateWalletUI(isConnected) {
    const connectBtn = document.getElementById('connectWalletBtn');
    const disconnectBtn = document.getElementById('disconnectWalletBtn');
    const walletStatus = document.getElementById('walletStatus');
    const walletAddress = document.getElementById('walletAddress');

    if (isConnected && this.publicKey) {
      // Show connected state
      if (connectBtn) connectBtn.style.display = 'none';
      if (disconnectBtn) disconnectBtn.style.display = 'inline-flex';
      if (walletStatus) {
        walletStatus.textContent = 'Connected';
        walletStatus.className = 'badge bg-success';
      }
      if (walletAddress) {
        walletAddress.textContent = this.publicKey.slice(0, 4) + '...' + this.publicKey.slice(-4);
        walletAddress.style.display = 'inline';
      }
    } else {
      // Show disconnected state
      if (connectBtn) connectBtn.style.display = 'inline-flex';
      if (disconnectBtn) disconnectBtn.style.display = 'none';
      if (walletStatus) {
        walletStatus.textContent = 'Not Connected';
        walletStatus.className = 'badge bg-secondary';
      }
      if (walletAddress) {
        walletAddress.style.display = 'none';
      }
    }
  }

  showPhantomNotInstalled() {
    const connectBtn = document.getElementById('connectWalletBtn');
    if (connectBtn) {
      connectBtn.textContent = 'Install Phantom';
      connectBtn.onclick = () => window.open('https://phantom.app/', '_blank');
    }
  }

  // ==================== BALANCE & HISTORY ====================

  async fetchBalance() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/balance`, {
        headers: this.getHeaders(),
      });
      
      const data = await response.json();
      console.log('[Tkoin] Balance response:', data);
      
      // Update balance display
      const balanceEl = document.getElementById('creditBalance');
      if (balanceEl && data.balance !== undefined) {
        balanceEl.textContent = parseFloat(data.balance).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }) + ' CREDIT';
      }

      // Update account ID
      const accountIdEl = document.getElementById('accountId');
      if (accountIdEl && data.account_id) {
        accountIdEl.textContent = 'Account ID: ' + data.account_id;
      }
      
    } catch (error) {
      console.error('[Tkoin] Balance fetch error:', error);
    }
  }

  async fetchHistory() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/history?limit=10`, {
        headers: this.getHeaders(),
      });
      
      const data = await response.json();
      console.log('[Tkoin] History response:', data);
      
      const transactions = data.transactions || data.settlements || [];
      this.renderTransactionHistory(transactions);
      
    } catch (error) {
      console.error('[Tkoin] History fetch error:', error);
    }
  }

  renderTransactionHistory(transactions) {
    const container = document.getElementById('transactionHistory');
    if (!container) return;

    if (!transactions || transactions.length === 0) {
      container.innerHTML = '<p class="text-muted text-center">No transactions yet</p>';
      return;
    }

    container.innerHTML = transactions.map(tx => `
      <div class="transaction-row">
        <span class="transaction-type ${tx.type?.toLowerCase()}">${tx.type?.toUpperCase() || 'N/A'}</span>
        <span class="transaction-amount">${parseFloat(tx.amount || 0).toFixed(2)} CREDIT</span>
        <span class="transaction-status badge ${this.getStatusBadge(tx.status)}">${tx.status?.toUpperCase() || 'N/A'}</span>
        <span class="transaction-date">${this.formatDate(tx.created_at)}</span>
      </div>
    `).join('');
  }

  getStatusBadge(status) {
    const badges = {
      'completed': 'bg-success',
      'processing': 'bg-warning',
      'pending': 'bg-info',
      'failed': 'bg-danger',
      'cancelled': 'bg-secondary',
    };
    return badges[status?.toLowerCase()] || 'bg-secondary';
  }

  formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  async fetchWalletBalance() {
    if (!this.publicKey || !this.phantom) return;
    
    try {
      // Create wallet balance card if not exists
      this.createWalletBalanceCard();
      
      // Fetch SOL balance
      const connection = new solanaWeb3.Connection('https://api.devnet.solana.com');
      const pubKey = new solanaWeb3.PublicKey(this.publicKey);
      const balance = await connection.getBalance(pubKey);
      const solBalance = balance / solanaWeb3.LAMPORTS_PER_SOL;
      
      const walletBalanceEl = document.getElementById('wallet-balance-amount');
      if (walletBalanceEl) {
        walletBalanceEl.textContent = `${solBalance.toFixed(4)} SOL`;
      }
      
      // TODO: Also fetch TKOIN SPL token balance
      
    } catch (error) {
      console.error('[Tkoin] Wallet balance error:', error);
    }
  }

  createWalletBalanceCard() {
    if (document.getElementById('wallet-balance-card')) return;
    
    const balanceCard = document.querySelector('.balance-card');
    if (!balanceCard) return;
    
    const walletCard = document.createElement('div');
    walletCard.id = 'wallet-balance-card';
    walletCard.className = 'balance-card';
    walletCard.innerHTML = `
      <div class="balance-label">Phantom Wallet</div>
      <div class="balance-amount" id="wallet-balance-amount">Loading...</div>
      <div class="balance-subtext">${this.publicKey.slice(0, 8)}...${this.publicKey.slice(-8)}</div>
    `;
    
    balanceCard.parentNode.insertBefore(walletCard, balanceCard.nextSibling);
  }

  // ==================== DEPOSIT FLOW ====================

  async handleDeposit() {
    const amountInput = document.getElementById('depositAmount');
    const amount = parseFloat(amountInput?.value || 0);
    const errorDiv = document.getElementById('depositError');
    const submitBtn = document.getElementById('depositSubmit');
    const spinner = document.getElementById('depositSpinner');
    const submitText = document.getElementById('depositSubmitText');

    // Clear previous errors
    if (errorDiv) {
      errorDiv.style.display = 'none';
      errorDiv.textContent = '';
    }

    // Validate amount
    if (!amount || amount < 1) {
      this.showError('Please enter at least 1 CREDIT', errorDiv);
      return;
    }

    // Check wallet connected
    if (!this.connected || !this.publicKey) {
      this.showError('Please connect your Phantom wallet first', errorDiv);
      return;
    }

    // Disable button and show spinner
    if (submitBtn) submitBtn.disabled = true;
    if (spinner) spinner.style.display = 'inline-block';
    if (submitText) submitText.textContent = 'Getting deposit info...';

    try {
      // STEP 1: Get deposit instructions from backend
      console.log('[Tkoin] Step 1: Getting deposit instructions...');
      const instructionsResponse = await fetch(`${this.apiBaseUrl}/deposit`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ amount: amount }),
      });

      const instructions = await instructionsResponse.json();
      console.log('[Tkoin] Deposit instructions:', instructions);

      if (!instructionsResponse.ok || !instructions.success) {
        throw new Error(instructions.error || 'Failed to get deposit instructions');
      }

      this.treasuryWallet = instructions.treasury_wallet;
      this.tkoinMint = instructions.tkoin_mint;
      this.platformUserId = instructions.platform_user_id;
      const tkoinAmount = instructions.suggested_amount || (amount / 100);

      if (!this.treasuryWallet) {
        throw new Error('Treasury wallet not configured');
      }

      // STEP 2: Create and send Solana transaction
      if (submitText) submitText.textContent = 'Sending TKOIN...';
      console.log('[Tkoin] Step 2: Creating Solana transaction...');
      console.log('[Tkoin] Treasury:', this.treasuryWallet);
      console.log('[Tkoin] Amount:', tkoinAmount, 'TKOIN');
      console.log('[Tkoin] Mint:', this.tkoinMint);

      const signature = await this.sendSolanaTransaction(tkoinAmount);
      
      if (!signature) {
        throw new Error('Transaction was cancelled or failed');
      }

      console.log('[Tkoin] Transaction signature:', signature);

      // STEP 3: Verify the deposit with backend
      if (submitText) submitText.textContent = 'Verifying deposit...';
      console.log('[Tkoin] Step 3: Verifying deposit...');

      const verifyResponse = await fetch(`${this.apiBaseUrl}/verify-deposit`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          signature: signature,
          amount: tkoinAmount,
          platformUserId: this.platformUserId,
        }),
      });

      const verifyResult = await verifyResponse.json();
      console.log('[Tkoin] Verification result:', verifyResult);

      if (!verifyResponse.ok || !verifyResult.success) {
        throw new Error(verifyResult.error || 'Deposit verification failed');
      }

      // SUCCESS!
      this.showSuccess(`Deposit successful! ${verifyResult.credits_amount} CREDIT added to your account.`);
      
      // Reset form
      if (amountInput) amountInput.value = '';
      
      // Close modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('depositModal'));
      if (modal) modal.hide();

      // Refresh balance and history
      setTimeout(() => {
        this.fetchBalance();
        this.fetchHistory();
        this.fetchWalletBalance();
      }, 1000);

    } catch (error) {
      console.error('[Tkoin] Deposit error:', error);
      this.showError(error.message || 'Deposit failed', errorDiv);
    } finally {
      // Re-enable button
      if (submitBtn) submitBtn.disabled = false;
      if (spinner) spinner.style.display = 'none';
      if (submitText) submitText.textContent = 'Initiate Deposit';
    }
  }

  async sendSolanaTransaction(tkoinAmount) {
    if (!this.phantom || !this.publicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      const connection = new solanaWeb3.Connection('https://api.devnet.solana.com', 'confirmed');
      const senderPubKey = new solanaWeb3.PublicKey(this.publicKey);
      const treasuryPubKey = new solanaWeb3.PublicKey(this.treasuryWallet);
      
      // For SPL token transfer, we need the token mint and associated token accounts
      if (this.tkoinMint) {
        // SPL Token transfer
        return await this.sendSplTokenTransfer(connection, senderPubKey, treasuryPubKey, tkoinAmount);
      } else {
        // Fallback: SOL transfer (for testing)
        return await this.sendSolTransfer(connection, senderPubKey, treasuryPubKey, tkoinAmount);
      }
      
    } catch (error) {
      console.error('[Tkoin] Transaction error:', error);
      if (error.code === 4001) {
        throw new Error('Transaction rejected by user');
      }
      throw error;
    }
  }

  async sendSplTokenTransfer(connection, senderPubKey, treasuryPubKey, amount) {
    // Get token accounts
    const mintPubKey = new solanaWeb3.PublicKey(this.tkoinMint);
    
    // Calculate amount in token decimals (assuming 9 decimals for TKOIN)
    const tokenAmount = Math.floor(amount * 1e9);
    
    // Get associated token accounts
    const senderAta = await this.getAssociatedTokenAddress(mintPubKey, senderPubKey);
    const treasuryAta = await this.getAssociatedTokenAddress(mintPubKey, treasuryPubKey);
    
    console.log('[Tkoin] Sender ATA:', senderAta.toString());
    console.log('[Tkoin] Treasury ATA:', treasuryAta.toString());
    
    // Create transfer instruction
    const transferInstruction = this.createTransferInstruction(
      senderAta,
      treasuryAta,
      senderPubKey,
      tokenAmount
    );
    
    // Add memo instruction for user identification
    const memoInstruction = new solanaWeb3.TransactionInstruction({
      keys: [],
      programId: new solanaWeb3.PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
      data: Buffer.from(`TKOIN:${this.platformUserId}`),
    });
    
    // Build transaction
    const transaction = new solanaWeb3.Transaction();
    transaction.add(transferInstruction);
    transaction.add(memoInstruction);
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = senderPubKey;
    
    // Sign and send via Phantom
    const signedTx = await this.phantom.signAndSendTransaction(transaction);
    
    // Wait for confirmation
    console.log('[Tkoin] Waiting for confirmation...');
    await connection.confirmTransaction(signedTx.signature, 'confirmed');
    
    return signedTx.signature;
  }

  async sendSolTransfer(connection, senderPubKey, treasuryPubKey, amount) {
    // Simple SOL transfer (fallback for testing)
    const lamports = Math.floor(amount * solanaWeb3.LAMPORTS_PER_SOL);
    
    const transaction = new solanaWeb3.Transaction().add(
      solanaWeb3.SystemProgram.transfer({
        fromPubkey: senderPubKey,
        toPubkey: treasuryPubKey,
        lamports: lamports,
      })
    );
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = senderPubKey;
    
    // Sign and send via Phantom
    const signedTx = await this.phantom.signAndSendTransaction(transaction);
    
    // Wait for confirmation
    console.log('[Tkoin] Waiting for confirmation...');
    await connection.confirmTransaction(signedTx.signature, 'confirmed');
    
    return signedTx.signature;
  }

  async getAssociatedTokenAddress(mint, owner) {
    // SPL Associated Token Account Program ID
    const ASSOCIATED_TOKEN_PROGRAM_ID = new solanaWeb3.PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
    const TOKEN_PROGRAM_ID = new solanaWeb3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
    
    const [address] = await solanaWeb3.PublicKey.findProgramAddress(
      [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    return address;
  }

  createTransferInstruction(source, destination, owner, amount) {
    const TOKEN_PROGRAM_ID = new solanaWeb3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
    
    const keys = [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ];
    
    // Transfer instruction data: [3, amount as u64]
    const data = Buffer.alloc(9);
    data.writeUInt8(3, 0); // Transfer instruction
    data.writeBigUInt64LE(BigInt(amount), 1);
    
    return new solanaWeb3.TransactionInstruction({
      keys,
      programId: TOKEN_PROGRAM_ID,
      data,
    });
  }

  // ==================== WITHDRAW FLOW ====================

  async handleWithdraw() {
    const amountInput = document.getElementById('withdrawAmount');
    const walletInput = document.getElementById('withdrawWallet');
    const amount = parseFloat(amountInput?.value || 0);
    const destinationWallet = walletInput?.value || this.publicKey;
    const errorDiv = document.getElementById('withdrawError');
    const submitBtn = document.getElementById('withdrawSubmit');
    const spinner = document.getElementById('withdrawSpinner');
    const submitText = document.getElementById('withdrawSubmitText');

    // Clear previous errors
    if (errorDiv) {
      errorDiv.style.display = 'none';
      errorDiv.textContent = '';
    }

    // Validate
    if (!amount || amount < 100) {
      this.showError('Minimum withdrawal is 100 CREDIT', errorDiv);
      return;
    }

    if (!destinationWallet || destinationWallet.length < 32) {
      this.showError('Please enter a valid Solana wallet address', errorDiv);
      return;
    }

    // Disable button and show spinner
    if (submitBtn) submitBtn.disabled = true;
    if (spinner) spinner.style.display = 'inline-block';
    if (submitText) submitText.textContent = 'Processing...';

    try {
      const response = await fetch(`${this.apiBaseUrl}/withdraw`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          credits_amount: amount,
          destination_wallet: destinationWallet,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || 'Withdrawal failed');
      }

      // Success
      this.showSuccess(`Withdrawal initiated! ${data.tkoin_amount} TKOIN will be sent to your wallet.`);
      
      // Reset form
      if (amountInput) amountInput.value = '';
      
      // Close modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('withdrawModal'));
      if (modal) modal.hide();

      // Refresh balance and history
      setTimeout(() => {
        this.fetchBalance();
        this.fetchHistory();
      }, 1000);

    } catch (error) {
      console.error('[Tkoin] Withdraw error:', error);
      this.showError(error.message || 'Failed to process withdrawal', errorDiv);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      if (spinner) spinner.style.display = 'none';
      if (submitText) submitText.textContent = 'Initiate Withdrawal';
    }
  }

  // ==================== UTILITIES ====================

  showSuccess(message) {
    alert(message); // Replace with toast notification if available
  }

  showError(message, errorDiv = null) {
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
    } else {
      alert('Error: ' + message);
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.tkoinWallet = new TkoinWallet();
});

// Also need to include @solana/web3.js
// Add this script tag to the page:
// <script src="https://unpkg.com/@solana/web3.js@latest/lib/index.iife.min.js"></script>
