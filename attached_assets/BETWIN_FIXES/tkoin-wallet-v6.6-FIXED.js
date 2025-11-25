v);
      return;
    }

    this.setLoading(submitBtn, spinner, submitText, true, 'Preparing...');

    try {
      console.log('[Tkoin] Step 1: Getting deposit instructions...');
      const instructions = await this.getDepositInstructions(amount);
      
      if (!instructions) {
        throw new Error('Failed to get deposit instructions');
      }
      
      console.log('[Tkoin] Deposit instructions received:', instructions);
      
      const treasuryWallet = instructions.treasury_wallet || this.treasuryWallet;
      const tkoinMint = instructions.tkoin_mint || this.tkoinMint;
      const tkoinAmount = instructions.tkoin_amount || (amount / 100);
      
      this.setLoading(submitBtn, spinner, submitText, true, 'Open Phantom...');
      console.log('[Tkoin] Step 2: Sending TKOIN via Phantom...');
      
      const signature = await this.sendToken2022Transfer(tkoinAmount, treasuryWallet, tkoinMint);
      
      if (!signature) {
        throw new Error('Transaction was cancelled or failed');
      }
      
      this.setLoading(submitBtn, spinner, submitText, true, 'Verifying...');
      console.log('[Tkoin] Step 3: Verifying transaction...');
      
      const result = await this.verifyDeposit(instructions.deposit_id, signature);
      
      if (result.success) {
        this.showSuccess(`Deposit successful! ${amount} CREDIT added to your account.`);
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('depositModal'));
        if (modal) modal.hide();
        
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
    
    const senderAta = await this.getToken2022ATA(mintPubKey, senderPubKey);
    const treasuryAta = await this.getToken2022ATA(mintPubKey, treasuryPubKey);
    
    console.log('[Tkoin] Sender ATA:', senderAta.toString());
    console.log('[Tkoin] Treasury ATA:', treasuryAta.toString());
    
    const rawAmount = Math.floor(tkoinAmount * Math.pow(10, this.tokenDecimals));
    console.log('[Tkoin] Raw amount:', rawAmount);
    
    const transferInstruction = this.createToken2022TransferInstruction(
      senderAta,
      treasuryAta,
      senderPubKey,
      BigInt(rawAmount),
      token2022ProgramId
    );
    
    const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');
    
    const transaction = new solanaWeb3.Transaction({
      recentBlockhash: blockhash,
      feePayer: senderPubKey,
    });
    
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
    // v6.6 FIX: Use Uint8Array instead of Buffer for browser compatibility
    const dataBuffer = new Uint8Array(9);
    dataBuffer[0] = 3; // Transfer instruction discriminator
    
    // Write amount as little-endian 64-bit unsigned integer
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
      errorDiv.textContent = '';
    }

    if (!amount || amount < 100) {
      this.showError('Minimum withdrawal is 100 CREDIT', errorDiv);
      return;
    }

    if (!destinationWallet || destinationWallet.length < 32) {
      this.showError('Please enter a valid Solana wallet address', errorDiv);
      return;
    }

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
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('withdrawModal'));
        if (modal) modal.hide();
        
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
    if (typeof toastr !== 'undefined') {
      toastr.success(message);
    } else {
      alert(message);
    }
  }

  refreshData() {
    console.log('[Tkoin] ========================================');
    console.log('[Tkoin] REFRESHING ALL DATA...');
    console.log('[Tkoin] ========================================');
    this.fetchBalance();
    this.fetchHistory();
    if (this.connected) {
      this.fetchTkoinBalance();
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('[Tkoin] DOM loaded, initializing TkoinWallet v6.5 (ACCOUNT ID + HISTORY FIX)...');
  window.tkoinWallet = new TkoinWallet();
});
