/**
 * Tkoin Wallet Integration for BetWin Casino
 * VERSION v6.7 - COMPLETE FIX (Buffer + Account ID + Transaction History)
 * 
 * FIXES in v6.7:
 * - Buffer polyfill: Uses Uint8Array/toBytes() instead of Buffer/toBuffer()
 * - Account ID: Correctly extracts account_id from API response object
 * - Transaction History: Better fallback for finding transaction container
 * - API Response: Passes full response object, not just balance number
 * 
 * CONFIGURATION:
 * - Token: TKOIN on Solana Devnet (Token-2022)
 * - Mint: 9XPD1ZcAtNZgc1pGYYL3Z4W3mNqHKmqKDsUtsKKzAJE5
 * - Treasury: 953CKYH169xXxaNKVwLT9z9s38TEg1d2pQsY7d1Lv6dD
 * - Conversion: 100 CREDIT = 1 TKOIN
 */

class TkoinWallet {
  constructor() {
    this.phantom = null;
    this.publicKey = null;
    this.connection = null;
    this.apiBaseUrl = '/tkoin';
    this.csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    
    // Token2022 Configuration - CORRECT VALUES
    this.TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
    this.ASSOCIATED_TOKEN_PROGRAM_ID = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
    this.TKOIN_MINT = '9XPD1ZcAtNZgc1pGYYL3Z4W3mNqHKmqKDsUtsKKzAJE5';
    this.TREASURY_WALLET = '953CKYH169xXxaNKVwLT9z9s38TEg1d2pQsY7d1Lv6dD';
    this.CREDIT_TO_TKOIN = 100;
    this.rpcUrl = 'https://api.devnet.solana.com';
    this.tokenDecimals = 9;
    
    console.log('[Tkoin] Initializing wallet manager v6.7 (COMPLETE FIX)');
    console.log('[Tkoin] Token2022 Mint:', this.TKOIN_MINT);
    console.log('[Tkoin] Treasury:', this.TREASURY_WALLET);
    
    this.init();
  }

  async init() {
    try {
      this.connection = new solanaWeb3.Connection(this.rpcUrl, 'confirmed');
      console.log('[Tkoin] Connected to Solana Devnet');
      
      this.bindEvents();
      this.checkPhantomWallet();
      await this.fetchBalance();
      await this.fetchHistory();
      
    } catch (error) {
      console.error('[Tkoin] Initialization error:', error);
    }
  }

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-CSRF-TOKEN': this.csrfToken,
      'X-Requested-With': 'XMLHttpRequest',
    };
  }

  getElement(primaryId, fallbackId) {
    let el = document.getElementById(primaryId);
    if (el) {
      console.log(`[Tkoin] Found element: ${primaryId}`);
      return el;
    }
    if (fallbackId) {
      el = document.getElementById(fallbackId);
      if (el) {
        console.log(`[Tkoin] Found element via fallback: ${fallbackId}`);
        return el;
      }
    }
    console.warn(`[Tkoin] Element not found: ${primaryId}${fallbackId ? ' or ' + fallbackId : ''}`);
    return null;
  }

  bindEvents() {
    const depositForm = document.getElementById('depositForm');
    if (depositForm) {
      depositForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleDeposit();
      });
    }

    const withdrawForm = document.getElementById('withdrawForm');
    if (withdrawForm) {
      withdrawForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleWithdraw();
      });
    }

    const connectBtn = this.getElement('connect-wallet-btn', 'connectWalletBtn');
    if (connectBtn) {
      connectBtn.addEventListener('click', () => this.connectWallet());
    }

    const disconnectBtn = this.getElement('disconnect-wallet-btn', 'disconnectWalletBtn');
    if (disconnectBtn) {
      disconnectBtn.addEventListener('click', () => this.disconnectWallet());
    }

    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.fetchBalance();
        this.fetchHistory();
        if (this.publicKey) {
          this.fetchTkoinBalance();
        }
      });
    }

    console.log('[Tkoin] Events bound successfully');
  }

  // ==================== PHANTOM WALLET ====================

  checkPhantomWallet() {
    if (window.solana?.isPhantom) {
      this.phantom = window.solana;
      console.log('[Tkoin] Phantom wallet detected');
      
      this.phantom.on('connect', () => {
        console.log('[Tkoin] Phantom connected event');
        this.onWalletConnected();
      });
      
      this.phantom.on('disconnect', () => {
        console.log('[Tkoin] Phantom disconnected event');
        this.onWalletDisconnected();
      });
      
      this.phantom.on('accountChanged', (publicKey) => {
        if (publicKey) {
          console.log('[Tkoin] Account changed:', publicKey.toString());
          this.publicKey = publicKey.toString();
          this.onWalletConnected();
        } else {
          this.onWalletDisconnected();
        }
      });
      
    } else {
      console.log('[Tkoin] Phantom not installed');
      this.showPhantomNotInstalled();
    }
  }

  async connectWallet() {
    if (!this.phantom) {
      window.open('https://phantom.app/', '_blank');
      return;
    }
    
    try {
      console.log('[Tkoin] Requesting Phantom connection...');
      
      // v6.4 FIX: Force popup by disconnecting first if already connected
      if (this.phantom.isConnected) {
        console.log('[Tkoin] Already connected, requesting new connection...');
        try {
          await this.phantom.disconnect();
        } catch (e) {
          console.log('[Tkoin] Disconnect before reconnect:', e.message);
        }
      }
      
      // Always use onlyIfTrusted: false to force popup
      const response = await this.phantom.connect({ onlyIfTrusted: false });
      this.publicKey = response.publicKey.toString();
      console.log('[Tkoin] Connected wallet:', this.publicKey);
      
      this.onWalletConnected();
      
    } catch (error) {
      console.error('[Tkoin] Connection error:', error);
      if (error.code === 4001) {
        console.log('[Tkoin] User rejected connection');
      }
    }
  }

  disconnectWallet() {
    if (this.phantom) {
      this.phantom.disconnect();
    }
    this.publicKey = null;
    this.onWalletDisconnected();
    console.log('[Tkoin] Wallet disconnected');
  }

  onWalletConnected() {
    if (!this.publicKey && this.phantom?.publicKey) {
      this.publicKey = this.phantom.publicKey.toString();
    }
    
    console.log('[Tkoin] Wallet connected:', this.publicKey);
    
    // DUAL IDs for all elements
    const connectBtn = this.getElement('connect-wallet-btn', 'connectWalletBtn');
    const disconnectBtn = this.getElement('disconnect-wallet-btn', 'disconnectWalletBtn');
    const walletStatus = document.getElementById('walletStatus');
    const walletAddress = document.getElementById('walletAddress');
    const walletRequiredNotice = document.getElementById('walletRequiredNotice');
    
    if (connectBtn) connectBtn.style.display = 'none';
    if (disconnectBtn) {
      disconnectBtn.style.display = 'inline-flex';
      console.log('[Tkoin] Disconnect button shown');
    }
    if (walletStatus) {
      walletStatus.textContent = 'Connected';
      walletStatus.className = 'badge bg-success';
    }
    if (walletAddress) {
      const shortAddress = this.publicKey.slice(0, 4) + '...' + this.publicKey.slice(-4);
      walletAddress.textContent = shortAddress;
      walletAddress.style.display = 'inline';
    }
    if (walletRequiredNotice) {
      walletRequiredNotice.style.display = 'none';
    }
    
    this.fetchTkoinBalance();
  }

  onWalletDisconnected() {
    const connectBtn = this.getElement('connect-wallet-btn', 'connectWalletBtn');
    const disconnectBtn = this.getElement('disconnect-wallet-btn', 'disconnectWalletBtn');
    const walletStatus = document.getElementById('walletStatus');
    const walletAddress = document.getElementById('walletAddress');
    
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

  showPhantomNotInstalled() {
    const connectBtn = this.getElement('connect-wallet-btn', 'connectWalletBtn');
    if (connectBtn) {
      connectBtn.innerHTML = '<i class="fa fa-download"></i> Install Phantom';
      connectBtn.onclick = () => window.open('https://phantom.app/', '_blank');
    }
  }

  // ==================== BALANCE FETCHING ====================

  async fetchBalance() {
    try {
      console.log('[Tkoin] Fetching balance from API...');
      const response = await fetch(`${this.apiBaseUrl}/balance`, {
        headers: this.getHeaders(),
      });
      const data = await response.json();
      console.log('[Tkoin] Balance API response:', JSON.stringify(data, null, 2));
      
      if (data.success !== false) {
        // v6.7 FIX: Pass the FULL data object, not just data.balance
        // This ensures account_id is available in updateBalanceDisplay
        this.updateBalanceDisplay(data);
      } else {
        console.error('[Tkoin] Balance fetch failed:', data.message);
      }
    } catch (error) {
      console.error('[Tkoin] Balance error:', error);
    }
  }

  updateBalanceDisplay(data) {
    console.log('[Tkoin] Updating balance display with:', JSON.stringify(data, null, 2));
    
    // v6.7 FIX: Extract balance from data object or use data directly if it's a number
    const balanceValue = typeof data === 'object' ? (data.balance || data.credits || 0) : data;
    
    // ============ CREDIT BALANCE (DUAL IDs) ============
    const creditBalanceEl = this.getElement('balance-amount', 'creditBalance');
    if (creditBalanceEl) {
      const amount = parseFloat(balanceValue);
      creditBalanceEl.textContent = `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CREDIT`;
      console.log('[Tkoin] Updated credit balance to:', amount);
    }
    
    // ============ ACCOUNT ID - v6.7 FIX ============
    // Extract account_id from the full data object
    const accountIdEl = this.getElement('balance-account', 'accountId');
    if (accountIdEl) {
      // v6.7: data is now the full API response object with account_id
      const accountId = typeof data === 'object' ? (data.account_id || data.user_id) : null;
      
      if (accountId && accountId !== 'undefined' && accountId !== 'null' && accountId !== '---') {
        accountIdEl.textContent = 'Account ID: ' + accountId;
        console.log('[Tkoin] Updated account ID to:', accountId);
      } else {
        console.log('[Tkoin] No account_id in response, keeping current:', accountIdEl.textContent);
      }
    }
  }

  async fetchHistory() {
    try {
      console.log('[Tkoin] Fetching transaction history...');
      const response = await fetch(`${this.apiBaseUrl}/history?limit=10`, {
        headers: this.getHeaders(),
      });
      const data = await response.json();
      console.log('[Tkoin] History API response:', JSON.stringify(data, null, 2));
      
      if (data.success !== false) {
        this.updateHistoryDisplay(data.transactions || data.settlements || []);
      }
    } catch (error) {
      console.error('[Tkoin] History error:', error);
    }
  }

  updateHistoryDisplay(transactions) {
    // v6.7 FIX: Better fallback chain for finding transaction container
    let container = document.getElementById('transactionHistory');
    
    if (!container) {
      container = document.getElementById('transaction-history');
    }
    
    if (!container) {
      // Try to find any tbody in a transaction-related table
      container = document.querySelector('.transaction-table tbody');
    }
    
    if (!container) {
      // Last resort: find the first tbody that contains "Loading" or transaction text
      const allTbodies = document.querySelectorAll('tbody');
      for (const tbody of allTbodies) {
        if (tbody.innerHTML.includes('Loading') || tbody.innerHTML.includes('transaction')) {
          container = tbody;
          console.log('[Tkoin] Found transaction container via content search');
          break;
        }
      }
    }
    
    if (!container) {
      console.error('[Tkoin] Could not find any transaction history container');
      return;
    }
    
    console.log('[Tkoin] Updating transaction history with', transactions.length, 'transactions');
    
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
    
    console.log('[Tkoin] Transaction history updated');
  }

  getStatusBadge(status) {
    const badges = {
      'completed': 'bg-success',
      'pending': 'bg-warning text-dark',
      'failed': 'bg-danger',
      'cancelled': 'bg-secondary',
    };
    return badges[status?.toLowerCase()] || 'bg-secondary';
  }

  formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    } catch (e) {
      return dateString;
    }
  }

  // ==================== TKOIN ON-CHAIN BALANCE ====================

  async fetchTkoinBalance() {
    if (!this.publicKey) return;
    
    try {
      console.log('[Tkoin] Fetching on-chain TKOIN balance...');
      
      const ownerPubkey = new solanaWeb3.PublicKey(this.publicKey);
      const mintPubkey = new solanaWeb3.PublicKey(this.TKOIN_MINT);
      
      const ata = await this.getToken2022ATA(mintPubkey, ownerPubkey);
      console.log('[Tkoin] Token2022 ATA:', ata.toString());
      
      const accountInfo = await this.connection.getAccountInfo(ata);
      let tkoinBalance = 0;
      
      if (accountInfo && accountInfo.data) {
        const data = accountInfo.data;
        
        if (data.length >= 72) {
          const amountBuffer = data.slice(64, 72);
          const rawAmount = this.readUInt64LE(amountBuffer);
          tkoinBalance = rawAmount / Math.pow(10, this.tokenDecimals);
          
          console.log('[Tkoin] Raw balance:', rawAmount);
          console.log('[Tkoin] TKOIN balance:', tkoinBalance);
        }
      } else {
        console.log('[Tkoin] No Token2022 account found - balance is 0');
        console.log('[Tkoin] User needs to receive TKOIN first to create the account');
      }
      
      this.updateTkoinBalanceDisplay(tkoinBalance);
      this.createWalletBalanceCard(tkoinBalance);
      
    } catch (error) {
      console.error('[Tkoin] Error fetching TKOIN balance:', error);
      this.updateTkoinBalanceDisplay(0);
    }
  }

  async getToken2022ATA(mint, owner) {
    const token2022ProgramId = new solanaWeb3.PublicKey(this.TOKEN_2022_PROGRAM_ID);
    const associatedTokenProgramId = new solanaWeb3.PublicKey(this.ASSOCIATED_TOKEN_PROGRAM_ID);
    
    // v6.6 FIX: Use toBytes() instead of toBuffer() for browser compatibility
    const [ata] = await solanaWeb3.PublicKey.findProgramAddress(
      [
        owner.toBytes(),
        token2022ProgramId.toBytes(),
        mint.toBytes(),
      ],
      associatedTokenProgramId
    );
    
    return ata;
  }

  readUInt64LE(buffer) {
    let result = BigInt(0);
    for (let i = 0; i < 8; i++) {
      result += BigInt(buffer[i]) << BigInt(i * 8);
    }
    return Number(result);
  }

  updateTkoinBalanceDisplay(balance) {
    const tkoinBalanceEl = document.getElementById('tkoinBalance');
    if (tkoinBalanceEl) {
      let formattedBalance;
      if (balance >= 1000000000) {
        formattedBalance = (balance / 1000000000).toFixed(2) + 'B';
      } else if (balance >= 1000000) {
        formattedBalance = (balance / 1000000).toFixed(2) + 'M';
      } else if (balance >= 1000) {
        formattedBalance = (balance / 1000).toFixed(2) + 'K';
      } else {
        formattedBalance = balance.toFixed(5);
      }
      tkoinBalanceEl.textContent = `${formattedBalance} TKOIN`;
    }
  }

  createWalletBalanceCard(tkoinBalance) {
    const existingCard = document.getElementById('wallet-balance-card');
    if (existingCard) existingCard.remove();
    
    const balanceCard = document.querySelector('.balance-card');
    if (!balanceCard) return;
    
    let formattedBalance;
    if (tkoinBalance >= 1000000000) {
      formattedBalance = (tkoinBalance / 1000000000).toFixed(2) + 'B';
    } else if (tkoinBalance >= 1000000) {
      formattedBalance = (tkoinBalance / 1000000).toFixed(2) + 'M';
    } else if (tkoinBalance >= 1000) {
      formattedBalance = (tkoinBalance / 1000).toFixed(2) + 'K';
    } else {
      formattedBalance = tkoinBalance.toFixed(5);
    }
    
    const walletCard = document.createElement('div');
    walletCard.id = 'wallet-balance-card';
    walletCard.className = 'balance-card wallet-card mt-3';
    walletCard.innerHTML = `
      <div class="balance-header">
        <span class="balance-label">WALLET BALANCE</span>
        <span class="wallet-network">Solana Devnet</span>
      </div>
      <div class="balance-amount tkoin-balance">
        ${formattedBalance} TKOIN
      </div>
    `;
    
    balanceCard.parentNode.insertBefore(walletCard, balanceCard.nextSibling);
  }

  // ==================== DEPOSIT FLOW ====================

  async handleDeposit() {
    const amountInput = document.getElementById('depositAmount');
    const amount = parseFloat(amountInput?.value || 0);
    const errorDiv = document.getElementById('depositError');
    
    // DUAL IDs for deposit button
    const submitBtn = this.getElement('depositSubmit', 'depositBtn');
    const spinner = document.getElementById('depositSpinner');
    const submitText = document.getElementById('depositSubmitText');

    if (errorDiv) {
      errorDiv.style.display = 'none';
    }

    if (!this.publicKey) {
      this.showError(errorDiv, 'Please connect your Phantom wallet first');
      return;
    }

    if (amount < 1) {
      this.showError(errorDiv, 'Minimum deposit is 1 CREDIT');
      return;
    }

    try {
      this.setLoading(submitBtn, spinner, submitText, true, 'Processing...');

      console.log('[Tkoin] Starting deposit flow for', amount, 'CREDIT');

      // Step 1: Create deposit request
      const depositResponse = await fetch(`${this.apiBaseUrl}/deposit`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ amount: amount }),
      });

      const depositData = await depositResponse.json();
      console.log('[Tkoin] Deposit request response:', depositData);

      if (!depositData.success) {
        throw new Error(depositData.message || 'Failed to create deposit request');
      }

      const depositId = depositData.deposit_id || depositData.id;
      const tkoinAmount = depositData.tkoin_amount || (amount / this.CREDIT_TO_TKOIN);

      console.log('[Tkoin] Deposit ID:', depositId);
      console.log('[Tkoin] TKOIN to send:', tkoinAmount);

      // Step 2: Execute blockchain transaction
      this.setLoading(submitBtn, spinner, submitText, true, 'Sending TKOIN...');
      
      const signature = await this.sendTkoinToTreasury(tkoinAmount);
      console.log('[Tkoin] Transaction signature:', signature);

      // Step 3: Verify deposit
      this.setLoading(submitBtn, spinner, submitText, true, 'Verifying...');
      
      const verifyResult = await this.verifyDeposit(depositId, signature);
      console.log('[Tkoin] Verify result:', verifyResult);

      if (verifyResult.success) {
        this.showSuccess('Deposit successful! ' + amount + ' CREDIT added.');
        
        // Close modal and refresh
        const modal = bootstrap.Modal.getInstance(document.getElementById('depositModal'));
        if (modal) modal.hide();
        
        if (amountInput) amountInput.value = '';
        
        await this.fetchBalance();
        await this.fetchHistory();
        await this.fetchTkoinBalance();
      } else {
        throw new Error(verifyResult.message || 'Verification failed');
      }

    } catch (error) {
      console.error('[Tkoin] Deposit error:', error);
      this.showError(errorDiv, error.message || 'Deposit failed');
    } finally {
      this.setLoading(submitBtn, spinner, submitText, false, '<i class="fa fa-paper-plane"></i> Send TKOIN');
    }
  }

  async sendTkoinToTreasury(tkoinAmount) {
    const ownerPubkey = new solanaWeb3.PublicKey(this.publicKey);
    const mintPubkey = new solanaWeb3.PublicKey(this.TKOIN_MINT);
    const treasuryPubkey = new solanaWeb3.PublicKey(this.TREASURY_WALLET);
    const token2022ProgramId = new solanaWeb3.PublicKey(this.TOKEN_2022_PROGRAM_ID);
    
    // Get ATAs
    const sourceATA = await this.getToken2022ATA(mintPubkey, ownerPubkey);
    const destATA = await this.getToken2022ATA(mintPubkey, treasuryPubkey);
    
    console.log('[Tkoin] Source ATA:', sourceATA.toString());
    console.log('[Tkoin] Destination ATA:', destATA.toString());
    
    // Calculate amount with decimals
    const amountInSmallestUnit = Math.floor(tkoinAmount * Math.pow(10, this.tokenDecimals));
    console.log('[Tkoin] Amount in smallest unit:', amountInSmallestUnit);
    
    // Create transaction
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
    
    const transaction = new solanaWeb3.Transaction({
      feePayer: ownerPubkey,
      recentBlockhash: blockhash,
    });
    
    // v6.6/6.7 FIX: Create Token2022 transfer instruction without Buffer
    const transferInstruction = this.createToken2022TransferInstruction(
      sourceATA,
      destATA,
      ownerPubkey,
      amountInSmallestUnit,
      token2022ProgramId
    );
    
    transaction.add(transferInstruction);
    
    console.log('[Tkoin] Requesting Phantom signature...');
    const signedTx = await this.phantom.signTransaction(transaction);
    
    console.log('[Tkoin] Sending transaction...');
    const signature = await this.connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    
    console.log('[Tkoin] Transaction sent:', signature);
    
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
    // v6.6/6.7 FIX: Use Uint8Array instead of Buffer for browser compatibility
    const dataBuffer = new Uint8Array(9);
    dataBuffer[0] = 3; // Transfer instruction discriminator
    
    const amountBigInt = BigInt(amount);
    for (let i = 0; i < 8; i++) {
      dataBuffer[1 + i] = Number((amountBigInt >> BigInt(i * 8)) & BigInt(0xff));
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
    
    // DUAL IDs for withdraw button
    const submitBtn = this.getElement('withdrawalSubmit', 'withdrawSubmit');
    const spinner = document.getElementById('withdrawSpinner');
    const submitText = document.getElementById('withdrawSubmitText');

    if (errorDiv) {
      errorDiv.style.display = 'none';
    }

    if (amount < 100) {
      this.showError(errorDiv, 'Minimum withdrawal is 100 CREDIT (1 TKOIN)');
      return;
    }

    if (!destinationWallet) {
      this.showError(errorDiv, 'Please enter a destination wallet address or connect Phantom');
      return;
    }

    // Validate Solana address
    try {
      new solanaWeb3.PublicKey(destinationWallet);
    } catch (e) {
      this.showError(errorDiv, 'Invalid Solana wallet address');
      return;
    }

    try {
      this.setLoading(submitBtn, spinner, submitText, true, 'Processing...');

      console.log('[Tkoin] Starting withdrawal for', amount, 'CREDIT to', destinationWallet);

      const response = await fetch(`${this.apiBaseUrl}/withdraw`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          amount: amount,
          wallet_address: destinationWallet,
        }),
      });

      const data = await response.json();
      console.log('[Tkoin] Withdrawal response:', data);

      if (data.success) {
        this.showSuccess('Withdrawal request submitted! TKOIN will be sent shortly.');
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('withdrawModal'));
        if (modal) modal.hide();
        
        if (amountInput) amountInput.value = '';
        
        await this.fetchBalance();
        await this.fetchHistory();
      } else {
        throw new Error(data.message || 'Withdrawal failed');
      }

    } catch (error) {
      console.error('[Tkoin] Withdrawal error:', error);
      this.showError(errorDiv, error.message || 'Withdrawal failed');
    } finally {
      this.setLoading(submitBtn, spinner, submitText, false, '<i class="fa fa-arrow-up"></i> Withdraw');
    }
  }

  // ==================== UI HELPERS ====================

  setLoading(button, spinner, textEl, isLoading, text) {
    if (button) button.disabled = isLoading;
    if (spinner) spinner.style.display = isLoading ? 'inline-block' : 'none';
    if (textEl) textEl.innerHTML = text;
  }

  showError(element, message) {
    if (element) {
      element.innerHTML = `<i class="fa fa-exclamation-circle"></i> ${message}`;
      element.style.display = 'block';
    } else {
      console.error('[Tkoin] Error:', message);
      alert('Error: ' + message);
    }
  }

  showSuccess(message) {
    console.log('[Tkoin] Success:', message);
    
    // Try to use toast if available
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: message,
        timer: 3000,
        showConfirmButton: false,
      });
    } else if (typeof toastr !== 'undefined') {
      toastr.success(message);
    } else {
      alert(message);
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('[Tkoin] DOM ready, initializing TkoinWallet v6.7...');
  window.tkoinWallet = new TkoinWallet();
});

// Also try to initialize if DOM is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(() => {
    if (!window.tkoinWallet) {
      console.log('[Tkoin] Late initialization of TkoinWallet v6.7...');
      window.tkoinWallet = new TkoinWallet();
    }
  }, 100);
}
