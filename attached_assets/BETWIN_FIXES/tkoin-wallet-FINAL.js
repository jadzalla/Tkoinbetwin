/**
 * Tkoin Wallet Integration for BetWin Casino
 * FIXED VERSION - v5.0
 * 
 * FIXES:
 * ✅ Wallet connection requires explicit user click (no auto-connect)
 * ✅ Disconnect wallet button added
 * ✅ Deposit triggers actual Phantom SPL token transfer
 * ✅ Verifies transaction on blockchain after sending
 * ✅ Credits added after verification
 * ✅ TKOIN SPL token balance properly fetched
 * ✅ Hardcoded fallback values for treasury/mint
 * ✅ Uses Devnet RPC
 */

class TkoinWallet {
  constructor() {
    this.apiBaseUrl = '/tkoin';
    this.phantom = null;
    this.publicKey = null;
    this.connected = false;
    
    // Solana configuration - FALLBACK VALUES (can be overridden by API)
    this.treasuryWallet = '953CKYH169xXxaNKVwLT9z9s38TEg1d2pQsY7d1Lv6dD';
    this.tkoinMint = 'BVUrPwnZTRwnZgw1JmM43mZf8K7WVoDejgJ2X11Evs6i';
    this.platformUserId = null;
    
    // Solana connection - DEVNET
    this.rpcUrl = 'https://api.devnet.solana.com';
    this.connection = null;
    
    // Token decimals (TKOIN uses 9 decimals)
    this.tokenDecimals = 9;
    
    this.init();
  }

  init() {
    console.log('[Tkoin] Initializing wallet manager v5.0...');
    console.log('[Tkoin] RPC:', this.rpcUrl);
    console.log('[Tkoin] Treasury:', this.treasuryWallet);
    console.log('[Tkoin] Mint:', this.tkoinMint);
    
    // Initialize Solana connection
    if (typeof solanaWeb3 !== 'undefined') {
      this.connection = new solanaWeb3.Connection(this.rpcUrl, 'confirmed');
      console.log('[Tkoin] Solana Web3.js loaded successfully');
    } else {
      console.error('[Tkoin] ERROR: Solana Web3.js not loaded!');
    }
    
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
      refreshBtn.addEventListener('click', () => this.refreshData());
    }

    console.log('[Tkoin] Event listeners set up');
  }

  // ==================== WALLET CONNECTION ====================

  async connectWallet() {
    if (!this.phantom) {
      alert('Please install Phantom wallet extension first!');
      window.open('https://phantom.app/', '_blank');
      return;
    }

    try {
      console.log('[Tkoin] Requesting wallet connection...');
      const response = await this.phantom.connect();
      const pubKey = response.publicKey.toString();
      console.log('[Tkoin] Wallet connected:', pubKey);
      
      this.handleWalletConnected(pubKey);
    } catch (error) {
      console.error('[Tkoin] Connection error:', error);
      if (error.code === 4001) {
        alert('Connection request was rejected. Please try again.');
      } else {
        alert('Failed to connect wallet: ' + error.message);
      }
    }
  }

  async disconnectWallet() {
    try {
      if (this.phantom) {
        await this.phantom.disconnect();
      }
      this.handleWalletDisconnected();
      console.log('[Tkoin] Wallet disconnected');
    } catch (error) {
      console.error('[Tkoin] Disconnect error:', error);
    }
  }

  handleWalletConnected(publicKey) {
    this.publicKey = publicKey;
    this.connected = true;
    
    console.log('[Tkoin] Wallet connected:', publicKey);
    
    // Update UI
    this.updateWalletUI(true);
    
    // Fetch TKOIN balance from blockchain
    this.fetchWalletBalance();
    
    // Auto-fill withdraw wallet address
    const withdrawWallet = document.getElementById('withdrawWallet');
    if (withdrawWallet && !withdrawWallet.value) {
      withdrawWallet.value = publicKey;
    }
  }

  handleWalletDisconnected() {
    this.publicKey = null;
    this.connected = false;
    
    console.log('[Tkoin] Wallet disconnected');
    
    // Update UI
    this.updateWalletUI(false);
    
    // Clear TKOIN balance display
    const tkoinBalanceEl = document.getElementById('tkoinBalance');
    if (tkoinBalanceEl) {
      tkoinBalanceEl.textContent = '0.00 TKOIN';
    }
  }

  updateWalletUI(connected) {
    const connectBtn = document.getElementById('connectWalletBtn');
    const disconnectBtn = document.getElementById('disconnectWalletBtn');
    const walletStatus = document.getElementById('walletStatus');
    const walletAddress = document.getElementById('walletAddress');

    if (connected && this.publicKey) {
      // Show connected state
      if (connectBtn) connectBtn.style.display = 'none';
      if (disconnectBtn) {
        disconnectBtn.style.display = 'inline-flex';
        disconnectBtn.textContent = `Disconnect ${this.publicKey.slice(0, 4)}...${this.publicKey.slice(-4)}`;
      }
      if (walletStatus) {
        walletStatus.textContent = 'Connected';
        walletStatus.className = 'badge bg-success';
      }
      if (walletAddress) {
        walletAddress.textContent = `${this.publicKey.slice(0, 8)}...${this.publicKey.slice(-8)}`;
        walletAddress.style.display = 'inline-block';
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
      connectBtn.innerHTML = '<i class="fa fa-download"></i> Install Phantom';
      connectBtn.addEventListener('click', () => {
        window.open('https://phantom.app/', '_blank');
      });
    }
  }

  // ==================== BALANCE FETCHING ====================

  async fetchBalance() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/balance`);
      const data = await response.json();
      
      if (data.success) {
        this.updateBalanceDisplay(data.balance);
      } else {
        console.error('[Tkoin] Balance fetch failed:', data.message);
      }
    } catch (error) {
      console.error('[Tkoin] Balance error:', error);
    }
  }

  updateBalanceDisplay(balance) {
    const creditBalanceEl = document.getElementById('creditBalance');
    if (creditBalanceEl) {
      const amount = parseFloat(balance.credits || balance || 0);
      creditBalanceEl.textContent = `${amount.toFixed(2)} CREDIT`;
    }
  }

  async fetchHistory() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/history?limit=10`);
      const data = await response.json();
      
      if (data.success) {
        this.updateHistoryDisplay(data.transactions || []);
      }
    } catch (error) {
      console.error('[Tkoin] History error:', error);
    }
  }

  updateHistoryDisplay(transactions) {
    const container = document.getElementById('transactionHistory');
    if (!container) return;
    
    if (!transactions.length) {
      container.innerHTML = `
        <tr>
          <td colspan="4" class="text-center text-muted py-4">
            <i class="fa fa-inbox fa-2x mb-2 d-block"></i>
            No transactions yet
          </td>
        </tr>
      `;
      return;
    }

    container.innerHTML = transactions.map(tx => `
      <tr>
        <td class="tx-type ${tx.type?.toLowerCase()}">${tx.type?.toUpperCase() || 'N/A'}</td>
        <td class="tx-amount">${parseFloat(tx.amount || 0).toFixed(2)} CREDIT</td>
        <td><span class="badge ${this.getStatusBadge(tx.status)}">${tx.status?.toUpperCase() || 'N/A'}</span></td>
        <td class="tx-date">${this.formatDate(tx.created_at)}</td>
      </tr>
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

  // ==================== TKOIN SPL TOKEN BALANCE ====================

  async fetchWalletBalance() {
    if (!this.publicKey || !this.connection) {
      console.log('[Tkoin] Cannot fetch balance - no wallet or connection');
      return;
    }
    
    try {
      console.log('[Tkoin] Fetching TKOIN balance for:', this.publicKey);
      console.log('[Tkoin] Token mint:', this.tkoinMint);
      
      const pubKey = new solanaWeb3.PublicKey(this.publicKey);
      const mintPubKey = new solanaWeb3.PublicKey(this.tkoinMint);
      
      // Get the Associated Token Account for this wallet
      const tokenAccount = await this.getAssociatedTokenAddress(mintPubKey, pubKey);
      console.log('[Tkoin] Token account:', tokenAccount.toString());
      
      // Fetch token account info
      const tokenAccountInfo = await this.connection.getAccountInfo(tokenAccount);
      
      let tkoinBalance = 0;
      
      if (tokenAccountInfo) {
        // Parse the token account data to get balance
        // Token account data format: 64 bytes mint, 32 bytes owner, 8 bytes amount (u64), etc.
        const data = tokenAccountInfo.data;
        
        // Amount is at offset 64 (after mint + owner) as a little-endian u64
        const amountBuffer = data.slice(64, 72);
        const rawAmount = this.readUInt64LE(amountBuffer);
        
        // Convert from raw amount (with decimals) to human-readable
        tkoinBalance = rawAmount / Math.pow(10, this.tokenDecimals);
        
        console.log('[Tkoin] Raw balance:', rawAmount);
        console.log('[Tkoin] Formatted balance:', tkoinBalance);
      } else {
        console.log('[Tkoin] No token account found - balance is 0');
      }
      
      // Update the TKOIN balance display
      this.updateTkoinBalanceDisplay(tkoinBalance);
      
    } catch (error) {
      console.error('[Tkoin] Error fetching TKOIN balance:', error);
      this.updateTkoinBalanceDisplay(0);
    }
  }

  readUInt64LE(buffer) {
    // Read 8 bytes as unsigned 64-bit integer (little-endian)
    let result = BigInt(0);
    for (let i = 0; i < 8; i++) {
      result += BigInt(buffer[i]) << BigInt(i * 8);
    }
    return Number(result);
  }

  updateTkoinBalanceDisplay(balance) {
    const tkoinBalanceEl = document.getElementById('tkoinBalance');
    if (tkoinBalanceEl) {
      // Format large numbers nicely
      let formattedBalance;
      if (balance >= 1000000) {
        formattedBalance = (balance / 1000000).toFixed(2) + 'M';
      } else if (balance >= 1000) {
        formattedBalance = (balance / 1000).toFixed(2) + 'K';
      } else {
        formattedBalance = balance.toFixed(2);
      }
      tkoinBalanceEl.textContent = `${formattedBalance} TKOIN`;
    }
    
    // Also update wallet address display if exists
    const walletAddressEl = document.getElementById('walletAddressDisplay');
    if (walletAddressEl && this.publicKey) {
      walletAddressEl.textContent = `${this.publicKey.slice(0, 8)}...${this.publicKey.slice(-4)}`;
    }
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

    // Show loading state
    this.setLoading(submitBtn, spinner, submitText, true, 'Preparing...');

    try {
      // Step 1: Get deposit instructions from backend
      console.log('[Tkoin] Step 1: Getting deposit instructions...');
      const instructions = await this.getDepositInstructions(amount);
      
      if (!instructions) {
        throw new Error('Failed to get deposit instructions');
      }
      
      console.log('[Tkoin] Deposit instructions received:', instructions);
      
      // Update treasury and mint from API response (if provided)
      if (instructions.treasury_wallet) {
        this.treasuryWallet = instructions.treasury_wallet;
      }
      if (instructions.tkoin_mint) {
        this.tkoinMint = instructions.tkoin_mint;
      }
      
      console.log('[Tkoin] Using treasury:', this.treasuryWallet);
      console.log('[Tkoin] Using mint:', this.tkoinMint);
      
      // Step 2: Send TKOIN via Phantom
      this.setLoading(submitBtn, spinner, submitText, true, 'Open Phantom...');
      console.log('[Tkoin] Step 2: Sending TKOIN via Phantom...');
      
      const tkoinAmount = instructions.tkoin_amount;
      const signature = await this.sendTkoinTransaction(tkoinAmount);
      
      if (!signature) {
        throw new Error('Transaction was cancelled or failed');
      }
      
      console.log('[Tkoin] Transaction signature:', signature);
      
      // Step 3: Verify transaction with backend
      this.setLoading(submitBtn, spinner, submitText, true, 'Verifying...');
      console.log('[Tkoin] Step 3: Verifying transaction...');
      
      const result = await this.verifyDeposit(instructions.deposit_id, signature);
      
      if (result.success) {
        // Success!
        this.showSuccess(`Deposit successful! ${amount} CREDIT added to your account.`);
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('depositModal'));
        if (modal) modal.hide();
        
        // Refresh data
        this.refreshData();
      } else {
        throw new Error(result.message || 'Verification failed');
      }
      
    } catch (error) {
      console.error('[Tkoin] Deposit error:', error);
      this.showError(error.message || 'Deposit failed. Please try again.', errorDiv);
    } finally {
      this.setLoading(submitBtn, spinner, submitText, false, '<i class="fa fa-paper-plane"></i> Send TKOIN');
    }
  }

  async getDepositInstructions(creditAmount) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content || '',
        },
        body: JSON.stringify({
          amount: creditAmount,
          wallet_address: this.publicKey,
        }),
      });
      
      const data = await response.json();
      console.log('[Tkoin] Deposit API response:', data);
      
      if (data.success && data.instructions) {
        return data.instructions;
      } else if (data.success) {
        // Old API format - construct instructions
        return {
          deposit_id: data.deposit_id || data.transaction_id,
          tkoin_amount: data.tkoin_amount || (creditAmount / 100),
          treasury_wallet: data.treasury_wallet || this.treasuryWallet,
          tkoin_mint: data.tkoin_mint || this.tkoinMint,
        };
      } else {
        throw new Error(data.message || 'Failed to initiate deposit');
      }
    } catch (error) {
      console.error('[Tkoin] Get instructions error:', error);
      throw error;
    }
  }

  async sendTkoinTransaction(tkoinAmount) {
    if (!this.connection) {
      this.connection = new solanaWeb3.Connection(this.rpcUrl, 'confirmed');
    }
    
    const senderPubKey = new solanaWeb3.PublicKey(this.publicKey);
    const treasuryPubKey = new solanaWeb3.PublicKey(this.treasuryWallet);
    const mintPubKey = new solanaWeb3.PublicKey(this.tkoinMint);
    
    console.log('[Tkoin] Preparing SPL token transfer...');
    console.log('[Tkoin] From:', this.publicKey);
    console.log('[Tkoin] To:', this.treasuryWallet);
    console.log('[Tkoin] Amount:', tkoinAmount, 'TKOIN');
    
    // Get token accounts
    const senderAta = await this.getAssociatedTokenAddress(mintPubKey, senderPubKey);
    const treasuryAta = await this.getAssociatedTokenAddress(mintPubKey, treasuryPubKey);
    
    console.log('[Tkoin] Sender ATA:', senderAta.toString());
    console.log('[Tkoin] Treasury ATA:', treasuryAta.toString());
    
    // Convert amount to raw (with decimals)
    const rawAmount = Math.floor(tkoinAmount * Math.pow(10, this.tokenDecimals));
    console.log('[Tkoin] Raw amount:', rawAmount);
    
    // Create transfer instruction
    const transferInstruction = this.createTransferInstruction(
      senderAta,
      treasuryAta,
      senderPubKey,
      BigInt(rawAmount)
    );
    
    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
    
    // Create transaction
    const transaction = new solanaWeb3.Transaction({
      recentBlockhash: blockhash,
      feePayer: senderPubKey,
    });
    
    transaction.add(transferInstruction);
    
    // Sign and send via Phantom
    console.log('[Tkoin] Requesting Phantom signature...');
    const signedTx = await this.phantom.signTransaction(transaction);
    
    console.log('[Tkoin] Sending transaction...');
    const signature = await this.connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    
    console.log('[Tkoin] Transaction sent:', signature);
    
    // Wait for confirmation
    console.log('[Tkoin] Waiting for confirmation...');
    const confirmation = await this.connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');
    
    if (confirmation.value.err) {
      throw new Error('Transaction failed: ' + JSON.stringify(confirmation.value.err));
    }
    
    console.log('[Tkoin] Transaction confirmed!');
    return signature;
  }

  async getAssociatedTokenAddress(mint, owner) {
    const TOKEN_PROGRAM_ID = new solanaWeb3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
    const ASSOCIATED_TOKEN_PROGRAM_ID = new solanaWeb3.PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
    
    const [address] = await solanaWeb3.PublicKey.findProgramAddress(
      [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    return address;
  }

  createTransferInstruction(source, destination, owner, amount) {
    const TOKEN_PROGRAM_ID = new solanaWeb3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
    
    // SPL Token Transfer instruction data
    // Instruction index 3 = Transfer
    // Followed by 8 bytes for amount (u64 little-endian)
    const dataBuffer = Buffer.alloc(9);
    dataBuffer.writeUInt8(3, 0); // Instruction index for Transfer
    
    // Write amount as u64 little-endian
    const amountBigInt = BigInt(amount);
    for (let i = 0; i < 8; i++) {
      dataBuffer.writeUInt8(Number((amountBigInt >> BigInt(i * 8)) & BigInt(0xff)), 1 + i);
    }
    
    return new solanaWeb3.TransactionInstruction({
      keys: [
        { pubkey: source, isSigner: false, isWritable: true },
        { pubkey: destination, isSigner: false, isWritable: true },
        { pubkey: owner, isSigner: true, isWritable: false },
      ],
      programId: TOKEN_PROGRAM_ID,
      data: dataBuffer,
    });
  }

  async verifyDeposit(depositId, signature) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/verify-deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content || '',
        },
        body: JSON.stringify({
          deposit_id: depositId,
          signature: signature,
          wallet_address: this.publicKey,
        }),
      });
      
      return await response.json();
    } catch (error) {
      console.error('[Tkoin] Verify deposit error:', error);
      return { success: false, message: error.message };
    }
  }

  // ==================== WITHDRAW FLOW ====================

  async handleWithdraw() {
    const amountInput = document.getElementById('withdrawAmount');
    const walletInput = document.getElementById('withdrawWallet');
    const amount = parseFloat(amountInput?.value || 0);
    const destinationWallet = walletInput?.value?.trim() || this.publicKey;
    const errorDiv = document.getElementById('withdrawError');
    const submitBtn = document.getElementById('withdrawSubmit');
    const spinner = document.getElementById('withdrawSpinner');
    const submitText = document.getElementById('withdrawSubmitText');

    // Clear previous errors
    if (errorDiv) {
      errorDiv.style.display = 'none';
      errorDiv.textContent = '';
    }

    // Validate amount
    if (!amount || amount < 100) {
      this.showError('Minimum withdrawal is 100 CREDIT', errorDiv);
      return;
    }

    // Validate wallet
    if (!destinationWallet || destinationWallet.length < 32) {
      this.showError('Please enter a valid Solana wallet address', errorDiv);
      return;
    }

    // Show loading state
    this.setLoading(submitBtn, spinner, submitText, true, 'Processing...');

    try {
      const response = await fetch(`${this.apiBaseUrl}/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content || '',
        },
        body: JSON.stringify({
          credits_amount: amount,
          destination_wallet: destinationWallet,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.showSuccess(`Withdrawal of ${amount} CREDIT initiated! You will receive ${data.tkoin_amount || (amount/100)} TKOIN.`);
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('withdrawModal'));
        if (modal) modal.hide();
        
        // Refresh data
        this.refreshData();
      } else {
        throw new Error(data.message || 'Withdrawal failed');
      }
      
    } catch (error) {
      console.error('[Tkoin] Withdraw error:', error);
      this.showError(error.message || 'Withdrawal failed. Please try again.', errorDiv);
    } finally {
      this.setLoading(submitBtn, spinner, submitText, false, '<i class="fa fa-arrow-up"></i> Withdraw');
    }
  }

  // ==================== UTILITIES ====================

  setLoading(button, spinner, textEl, loading, text) {
    if (button) button.disabled = loading;
    if (spinner) spinner.style.display = loading ? 'inline-block' : 'none';
    if (textEl) textEl.innerHTML = text;
  }

  showError(message, container) {
    if (container) {
      container.textContent = message;
      container.style.display = 'block';
    } else {
      alert(message);
    }
  }

  showSuccess(message) {
    // Try to use toast notification if available
    if (typeof toastr !== 'undefined') {
      toastr.success(message);
    } else {
      alert(message);
    }
  }

  refreshData() {
    console.log('[Tkoin] Refreshing data...');
    this.fetchBalance();
    this.fetchHistory();
    if (this.connected) {
      this.fetchWalletBalance();
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('[Tkoin] DOM loaded, initializing TkoinWallet...');
  window.tkoinWallet = new TkoinWallet();
});
