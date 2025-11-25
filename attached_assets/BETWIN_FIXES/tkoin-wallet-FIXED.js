/**
 * Tkoin Wallet Integration for BetWin Casino
 * FIXED VERSION - v6.0 (Token2022 Support)
 * 
 * FIXES:
 * ✅ Token2022 program ID (not standard SPL)
 * ✅ Correct Token2022 ATA derivation
 * ✅ Token2022 balance fetching
 * ✅ Devnet configuration with correct mint
 * ✅ Wallet connection requires explicit user click
 * ✅ Deposit triggers actual Phantom Token2022 transfer
 * ✅ Verifies transaction on blockchain after sending
 */

class TkoinWallet {
  constructor() {
    this.apiBaseUrl = '/tkoin';
    this.phantom = null;
    this.publicKey = null;
    this.connected = false;
    
    // ============ NETWORK CONFIGURATION ============
    // DEVNET (for testing)
    this.rpcUrl = 'https://api.devnet.solana.com';
    this.treasuryWallet = '953CKYH169xXxaNKVwLT9z9s38TEg1d2pQsY7d1Lv6dD';
    this.tkoinMint = '953CKYH169xXxaNKVwLT9z9s38TEg1d2pQsY7d1Lv6dD';
    
    // MAINNET (uncomment for production)
    // this.rpcUrl = 'https://api.mainnet-beta.solana.com';
    // this.treasuryWallet = '953CKYH169xXxaNKVwLT9z9s38TEg1d2pQsY7d1Lv6dD';
    // this.tkoinMint = 'BVUrPwnZTRwnZgw1JmM43mZf8K7WVoDejgJ2X11Evs6i';
    
    // ============ TOKEN2022 PROGRAM IDs ============
    // CRITICAL: TKOIN is Token2022, NOT standard SPL Token!
    this.TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
    this.ASSOCIATED_TOKEN_PROGRAM_ID = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
    
    // Token decimals (TKOIN uses 9 decimals)
    this.tokenDecimals = 9;
    
    this.platformUserId = null;
    this.connection = null;
    
    this.init();
  }

  init() {
    console.log('[Tkoin] Initializing wallet manager v6.0 (Token2022)...');
    console.log('[Tkoin] Network:', this.rpcUrl.includes('devnet') ? 'DEVNET' : 'MAINNET');
    console.log('[Tkoin] Treasury:', this.treasuryWallet);
    console.log('[Tkoin] Mint:', this.tkoinMint);
    console.log('[Tkoin] Token Program: Token2022 (' + this.TOKEN_2022_PROGRAM_ID + ')');
    
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
      this.handleWalletDisconnected();
    }
  }

  handleWalletConnected(publicKey) {
    this.publicKey = publicKey;
    this.connected = true;
    
    console.log('[Tkoin] Wallet connected:', publicKey);
    
    // Update UI
    this.updateWalletUI(true);
    
    // Fetch TKOIN Token2022 balance from blockchain
    this.fetchTkoinBalance();
    
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
    
    // Remove wallet balance card
    const walletCard = document.getElementById('wallet-balance-card');
    if (walletCard) walletCard.remove();
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
        disconnectBtn.innerHTML = `<i class="fa fa-unlink"></i> Disconnect ${this.publicKey.slice(0, 4)}...${this.publicKey.slice(-4)}`;
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
      const response = await fetch(`${this.apiBaseUrl}/balance`, {
        headers: this.getHeaders(),
      });
      const data = await response.json();
      console.log('[Tkoin] Balance response:', data);
      
      if (data.success !== false) {
        this.updateBalanceDisplay(data.balance || data);
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
      creditBalanceEl.textContent = `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CREDIT`;
    }
    
    // Update account ID if available
    const accountIdEl = document.getElementById('accountId');
    if (accountIdEl && balance.account_id) {
      accountIdEl.textContent = 'Account ID: ' + balance.account_id;
    }
  }

  async fetchHistory() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/history?limit=10`, {
        headers: this.getHeaders(),
      });
      const data = await response.json();
      console.log('[Tkoin] History response:', data);
      
      if (data.success !== false) {
        this.updateHistoryDisplay(data.transactions || data.settlements || []);
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

  // ==================== TOKEN2022 BALANCE FETCHING ====================

  async fetchTkoinBalance() {
    if (!this.publicKey || !this.connection) {
      console.log('[Tkoin] Cannot fetch balance - no wallet or connection');
      return;
    }
    
    try {
      console.log('[Tkoin] Fetching TKOIN Token2022 balance...');
      console.log('[Tkoin] Wallet:', this.publicKey);
      console.log('[Tkoin] Mint:', this.tkoinMint);
      
      const ownerPubKey = new solanaWeb3.PublicKey(this.publicKey);
      const mintPubKey = new solanaWeb3.PublicKey(this.tkoinMint);
      const token2022ProgramId = new solanaWeb3.PublicKey(this.TOKEN_2022_PROGRAM_ID);
      
      // Get the Associated Token Account for Token2022
      const ata = await this.getToken2022ATA(mintPubKey, ownerPubKey);
      console.log('[Tkoin] Token2022 ATA:', ata.toString());
      
      // Fetch token account info
      const accountInfo = await this.connection.getAccountInfo(ata);
      
      let tkoinBalance = 0;
      
      if (accountInfo && accountInfo.data) {
        // Token2022 account structure is similar to SPL Token
        // Account data layout: 
        // - mint (32 bytes)
        // - owner (32 bytes)  
        // - amount (8 bytes, u64 little-endian)
        // - delegate option (4 + 32 bytes)
        // - state (1 byte)
        // - is_native option (4 + 8 bytes)
        // - delegated_amount (8 bytes)
        // - close_authority option (4 + 32 bytes)
        
        const data = accountInfo.data;
        
        // Amount is at offset 64 (after mint + owner) as a little-endian u64
        if (data.length >= 72) {
          const amountBuffer = data.slice(64, 72);
          const rawAmount = this.readUInt64LE(amountBuffer);
          
          // Convert from raw amount (with decimals) to human-readable
          tkoinBalance = rawAmount / Math.pow(10, this.tokenDecimals);
          
          console.log('[Tkoin] Raw balance:', rawAmount);
          console.log('[Tkoin] TKOIN balance:', tkoinBalance);
        }
      } else {
        console.log('[Tkoin] No Token2022 account found - balance is 0');
        console.log('[Tkoin] User may need to receive TKOIN first to create the account');
      }
      
      // Update the display
      this.updateTkoinBalanceDisplay(tkoinBalance);
      this.createWalletBalanceCard(tkoinBalance);
      
    } catch (error) {
      console.error('[Tkoin] Error fetching TKOIN balance:', error);
      this.updateTkoinBalanceDisplay(0);
    }
  }

  async getToken2022ATA(mint, owner) {
    // Token2022 ATA derivation uses the Token2022 program ID
    const token2022ProgramId = new solanaWeb3.PublicKey(this.TOKEN_2022_PROGRAM_ID);
    const associatedTokenProgramId = new solanaWeb3.PublicKey(this.ASSOCIATED_TOKEN_PROGRAM_ID);
    
    const [ata] = await solanaWeb3.PublicKey.findProgramAddress(
      [
        owner.toBuffer(),
        token2022ProgramId.toBuffer(),
        mint.toBuffer(),
      ],
      associatedTokenProgramId
    );
    
    return ata;
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
      if (balance >= 1000000000) {
        formattedBalance = (balance / 1000000000).toFixed(2) + 'B';
      } else if (balance >= 1000000) {
        formattedBalance = (balance / 1000000).toFixed(2) + 'M';
      } else if (balance >= 1000) {
        formattedBalance = (balance / 1000).toFixed(2) + 'K';
      } else {
        formattedBalance = balance.toFixed(2);
      }
      tkoinBalanceEl.textContent = `${formattedBalance} TKOIN`;
    }
  }

  createWalletBalanceCard(tkoinBalance) {
    // Remove existing card if any
    const existingCard = document.getElementById('wallet-balance-card');
    if (existingCard) existingCard.remove();
    
    const balanceCard = document.querySelector('.balance-card');
    if (!balanceCard) return;
    
    // Format balance for display
    let formattedBalance;
    if (tkoinBalance >= 1000000000) {
      formattedBalance = (tkoinBalance / 1000000000).toFixed(2) + 'B';
    } else if (tkoinBalance >= 1000000) {
      formattedBalance = (tkoinBalance / 1000000).toFixed(2) + 'M';
    } else if (tkoinBalance >= 1000) {
      formattedBalance = (tkoinBalance / 1000).toFixed(2) + 'K';
    } else {
      formattedBalance = tkoinBalance.toFixed(4);
    }
    
    const walletCard = document.createElement('div');
    walletCard.id = 'wallet-balance-card';
    walletCard.className = 'balance-card mt-3';
    walletCard.style.cssText = 'background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border: 1px solid #6c5ce7;';
    walletCard.innerHTML = `
      <div class="balance-label" style="color: #a29bfe;">Phantom Wallet (TKOIN)</div>
      <div class="balance-amount" id="wallet-tkoin-balance" style="color: #fff; font-size: 1.5rem;">${formattedBalance} TKOIN</div>
      <div class="balance-subtext" style="color: #74b9ff; font-size: 0.8rem;">${this.publicKey.slice(0, 8)}...${this.publicKey.slice(-8)}</div>
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
      
      // Use API values if provided, otherwise use defaults
      const treasuryWallet = instructions.treasury_wallet || this.treasuryWallet;
      const tkoinMint = instructions.tkoin_mint || this.tkoinMint;
      const tkoinAmount = instructions.tkoin_amount || (amount / 100);
      
      console.log('[Tkoin] Using treasury:', treasuryWallet);
      console.log('[Tkoin] Using mint:', tkoinMint);
      console.log('[Tkoin] TKOIN amount:', tkoinAmount);
      
      // Step 2: Send TKOIN via Phantom (Token2022 transfer)
      this.setLoading(submitBtn, spinner, submitText, true, 'Open Phantom...');
      console.log('[Tkoin] Step 2: Sending TKOIN via Phantom (Token2022)...');
      
      const signature = await this.sendToken2022Transfer(tkoinAmount, treasuryWallet, tkoinMint);
      
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
        headers: this.getHeaders(),
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
        throw new Error(data.message || data.error || 'Failed to initiate deposit');
      }
    } catch (error) {
      console.error('[Tkoin] Get instructions error:', error);
      throw error;
    }
  }

  async sendToken2022Transfer(tkoinAmount, treasuryWallet, tkoinMint) {
    if (!this.connection) {
      this.connection = new solanaWeb3.Connection(this.rpcUrl, 'confirmed');
    }
    
    const senderPubKey = new solanaWeb3.PublicKey(this.publicKey);
    const treasuryPubKey = new solanaWeb3.PublicKey(treasuryWallet);
    const mintPubKey = new solanaWeb3.PublicKey(tkoinMint);
    const token2022ProgramId = new solanaWeb3.PublicKey(this.TOKEN_2022_PROGRAM_ID);
    
    console.log('[Tkoin] Preparing Token2022 transfer...');
    console.log('[Tkoin] From:', this.publicKey);
    console.log('[Tkoin] To:', treasuryWallet);
    console.log('[Tkoin] Mint:', tkoinMint);
    console.log('[Tkoin] Amount:', tkoinAmount, 'TKOIN');
    console.log('[Tkoin] Program:', this.TOKEN_2022_PROGRAM_ID);
    
    // Get Token2022 ATAs
    const senderAta = await this.getToken2022ATA(mintPubKey, senderPubKey);
    const treasuryAta = await this.getToken2022ATA(mintPubKey, treasuryPubKey);
    
    console.log('[Tkoin] Sender ATA:', senderAta.toString());
    console.log('[Tkoin] Treasury ATA:', treasuryAta.toString());
    
    // Convert amount to raw (with decimals)
    const rawAmount = Math.floor(tkoinAmount * Math.pow(10, this.tokenDecimals));
    console.log('[Tkoin] Raw amount:', rawAmount);
    
    // Create Token2022 transfer instruction
    const transferInstruction = this.createToken2022TransferInstruction(
      senderAta,
      treasuryAta,
      senderPubKey,
      BigInt(rawAmount),
      token2022ProgramId
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

  createToken2022TransferInstruction(source, destination, owner, amount, programId) {
    // Token2022 Transfer instruction (same format as SPL Token)
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
      programId: programId,
      data: dataBuffer,
    });
  }

  async verifyDeposit(depositId, signature) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/verify-deposit`, {
        method: 'POST',
        headers: this.getHeaders(),
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
        headers: this.getHeaders(),
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
      container.className = 'alert alert-danger';
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
      this.fetchTkoinBalance();
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('[Tkoin] DOM loaded, initializing TkoinWallet v6.0...');
  window.tkoinWallet = new TkoinWallet();
});
