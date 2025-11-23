/**
 * Phantom Wallet Deposit Integration for BetWin Casino
 * 
 * This script handles direct TKOIN deposits from Phantom wallets to the Tkoin treasury.
 * Users connect their Phantom wallet, sign a transaction, and receive instant credits.
 * 
 * Dependencies:
 * - @solana/web3.js (CDN or npm)
 * - Phantom Wallet extension installed in user's browser
 * 
 * Integration: Add to public/js/phantom-deposit.js and include in blade template
 */

(function() {
  'use strict';

  // Configuration (update these with your values)
  const TKOIN_API_BASE = window.TKOIN_API_BASE || 'https://your-tkoin-protocol-domain.com';
  const TREASURY_WALLET = window.TKOIN_TREASURY_WALLET || 'YOUR_TREASURY_WALLET_ADDRESS';
  const TKOIN_MINT = window.TKOIN_MINT_ADDRESS || 'YOUR_TKOIN_MINT_ADDRESS';
  
  // DOM Elements
  let connectBtn, depositBtn, amountInput, statusText, walletAddressDisplay;
  
  // State
  let phantomProvider = null;
  let connectedWallet = null;

  /**
   * Initialize the Phantom deposit system
   */
  window.initPhantomDeposit = function() {
    // Get DOM elements
    connectBtn = document.getElementById('connect-phantom-btn');
    depositBtn = document.getElementById('deposit-phantom-btn');
    amountInput = document.getElementById('deposit-amount-input');
    statusText = document.getElementById('phantom-status-text');
    walletAddressDisplay = document.getElementById('wallet-address-display');
    
    if (!connectBtn || !depositBtn || !amountInput) {
      console.error('Phantom deposit: Required DOM elements not found');
      return;
    }
    
    // Check if Phantom is installed
    checkPhantomInstalled();
    
    // Event listeners
    connectBtn.addEventListener('click', connectPhantomWallet);
    depositBtn.addEventListener('click', initiateDeposit);
  };

  /**
   * Check if Phantom wallet is installed
   */
  function checkPhantomInstalled() {
    const isPhantomInstalled = window.solana && window.solana.isPhantom;
    
    if (isPhantomInstalled) {
      phantomProvider = window.solana;
      updateStatus('Phantom wallet detected. Click to connect.', 'info');
      
      // Check if already connected
      phantomProvider.on('connect', handleWalletConnected);
      phantomProvider.on('disconnect', handleWalletDisconnected);
      
      // Auto-connect if previously connected
      if (phantomProvider.isConnected) {
        connectedWallet = phantomProvider.publicKey.toString();
        handleWalletConnected();
      }
    } else {
      updateStatus('Phantom wallet not detected. Please install from phantom.app', 'error');
      connectBtn.disabled = true;
      connectBtn.textContent = 'Install Phantom';
      connectBtn.onclick = () => window.open('https://phantom.app', '_blank');
    }
  }

  /**
   * Connect to Phantom wallet
   */
  async function connectPhantomWallet() {
    try {
      updateStatus('Connecting to Phantom...', 'loading');
      connectBtn.disabled = true;
      
      const response = await phantomProvider.connect();
      connectedWallet = response.publicKey.toString();
      
      handleWalletConnected();
    } catch (error) {
      console.error('Failed to connect to Phantom:', error);
      updateStatus('Failed to connect: ' + error.message, 'error');
      connectBtn.disabled = false;
    }
  }

  /**
   * Handle wallet connected event
   */
  function handleWalletConnected() {
    connectBtn.style.display = 'none';
    depositBtn.style.display = 'block';
    amountInput.disabled = false;
    
    if (walletAddressDisplay) {
      walletAddressDisplay.textContent = formatWalletAddress(connectedWallet);
      walletAddressDisplay.parentElement.style.display = 'block';
    }
    
    updateStatus('Wallet connected! Enter amount to deposit.', 'success');
  }

  /**
   * Handle wallet disconnected event
   */
  function handleWalletDisconnected() {
    connectedWallet = null;
    connectBtn.style.display = 'block';
    depositBtn.style.display = 'none';
    amountInput.disabled = true;
    
    if (walletAddressDisplay) {
      walletAddressDisplay.parentElement.style.display = 'none';
    }
    
    updateStatus('Wallet disconnected', 'info');
  }

  /**
   * Initiate TKOIN deposit
   */
  async function initiateDeposit() {
    const amount = parseFloat(amountInput.value);
    
    if (!amount || amount <= 0) {
      updateStatus('Please enter a valid amount', 'error');
      return;
    }
    
    if (amount < 10) {
      updateStatus('Minimum deposit: 10 TKOIN', 'error');
      return;
    }
    
    try {
      depositBtn.disabled = true;
      updateStatus('Preparing transaction...', 'loading');
      
      // Import Solana Web3 (ensure it's loaded)
      if (!window.solanaWeb3) {
        throw new Error('Solana Web3.js not loaded. Please refresh the page.');
      }
      
      const { Connection, PublicKey, Transaction, SystemProgram } = window.solanaWeb3;
      const { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddress, createTransferCheckedInstruction } = window.solanaWeb3;
      
      // Connect to Solana
      const connection = new Connection('https://api.devnet.solana.com', 'confirmed'); // Use mainnet in production
      
      // Get user's TKOIN token account
      const mintPublicKey = new PublicKey(TKOIN_MINT);
      const fromTokenAccount = await getAssociatedTokenAddress(
        mintPublicKey,
        phantomProvider.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );
      
      // Get treasury TKOIN token account
      const treasuryPublicKey = new PublicKey(TREASURY_WALLET);
      const toTokenAccount = await getAssociatedTokenAddress(
        mintPublicKey,
        treasuryPublicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );
      
      // Get user ID from page (Laravel blade variable)
      const platformUserId = window.BETWIN_USER_ID || 'unknown';
      
      // Convert amount to base units (TKOIN has 9 decimals)
      const amountInBaseUnits = Math.floor(amount * Math.pow(10, 9));
      
      updateStatus('Creating transaction...', 'loading');
      
      // Create transfer instruction
      const transferInstruction = createTransferCheckedInstruction(
        fromTokenAccount,
        mintPublicKey,
        toTokenAccount,
        phantomProvider.publicKey,
        amountInBaseUnits,
        9, // TKOIN decimals
        [],
        TOKEN_2022_PROGRAM_ID
      );
      
      // Create transaction
      const transaction = new Transaction().add(transferInstruction);
      
      // Add memo instruction with user ID
      const memoInstruction = new window.solanaWeb3.TransactionInstruction({
        keys: [],
        programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
        data: Buffer.from(`BetWin-${platformUserId}`, 'utf-8'),
      });
      transaction.add(memoInstruction);
      
      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = phantomProvider.publicKey;
      
      updateStatus('Please approve transaction in Phantom...', 'loading');
      
      // Sign and send transaction
      const signedTransaction = await phantomProvider.signAndSendTransaction(transaction);
      const signature = signedTransaction.signature;
      
      updateStatus('Transaction sent! Verifying...', 'loading');
      
      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');
      
      updateStatus('Verifying deposit with BetWin...', 'loading');
      
      // Verify with BetWin backend
      const verifyResponse = await fetch('/tkoin/verify-deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
        },
        body: JSON.stringify({
          signature,
          amount,
          platformUserId
        })
      });
      
      const verifyData = await verifyResponse.json();
      
      if (verifyData.success) {
        updateStatus(`Success! ${verifyData.credits_amount} credits added to your account.`, 'success');
        
        // Refresh balance on page
        if (window.refreshBalance) {
          window.refreshBalance();
        }
        
        // Reset form
        amountInput.value = '';
        
        // Show success notification
        if (window.showNotification) {
          window.showNotification('Deposit successful!', 'success');
        }
      } else {
        throw new Error(verifyData.error || 'Verification failed');
      }
      
    } catch (error) {
      console.error('Deposit failed:', error);
      updateStatus('Deposit failed: ' + error.message, 'error');
    } finally {
      depositBtn.disabled = false;
    }
  }

  /**
   * Update status message
   */
  function updateStatus(message, type = 'info') {
    if (!statusText) return;
    
    statusText.textContent = message;
    statusText.className = 'phantom-status ' + type;
    
    // Remove any existing status classes
    statusText.classList.remove('info', 'success', 'error', 'loading');
    statusText.classList.add(type);
  }

  /**
   * Format wallet address for display
   */
  function formatWalletAddress(address) {
    if (!address) return '';
    return address.substring(0, 4) + '...' + address.substring(address.length - 4);
  }

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initPhantomDeposit);
  } else {
    window.initPhantomDeposit();
  }

})();
