/**
 * Blockchain Monitor Service
 * 
 * Monitors the Solana treasury wallet for incoming Tkoin deposits
 * and automatically triggers credit webhooks to the 1Stake casino platform.
 * 
 * Flow:
 * 1. Subscribe to treasury wallet transaction logs
 * 2. Detect incoming token transfers
 * 3. Calculate burn amount and net credits (1 TKOIN = 100 Credits by default)
 * 4. Create deposit record in database
 * 5. Send webhook to 1Stake with credit notification
 */

import { Connection, Keypair, PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js';
import { getAssociatedTokenAddress, getMint, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { storage } from '../storage';
import type { Deposit } from '@shared/schema';

export class BlockchainMonitor {
  private connection: Connection;
  private mintAddress: PublicKey;
  private treasuryWallet: PublicKey;
  private treasuryTokenAccount?: PublicKey;
  private tokenDecimals: number = 9; // Default, updated from mint info
  private isRunning: boolean = false;
  private subscriptionId?: number;
  private processedSignatures: Set<string> = new Set();
  private lastProcessedSignature: string | null = null;

  constructor(
    rpcUrl: string,
    mintAddress: string,
    treasuryWalletAddress: string
  ) {
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.mintAddress = new PublicKey(mintAddress);
    this.treasuryWallet = new PublicKey(treasuryWalletAddress);
  }

  /**
   * Start monitoring treasury wallet for deposits
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️  Blockchain monitor already running');
      return;
    }

    try {
      console.log('👁️  Starting blockchain deposit monitor...');
      console.log(`   Treasury: ${this.treasuryWallet.toBase58()}`);
      console.log(`   Mint: ${this.mintAddress.toBase58()}`);

      // Get mint info to fetch decimals
      const mintInfo = await getMint(
        this.connection,
        this.mintAddress,
        'confirmed',
        TOKEN_2022_PROGRAM_ID
      );
      this.tokenDecimals = mintInfo.decimals;
      console.log(`   Token Decimals: ${this.tokenDecimals}`);

      // Get treasury token account
      this.treasuryTokenAccount = await getAssociatedTokenAddress(
        this.mintAddress,
        this.treasuryWallet,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      console.log(`   Token Account: ${this.treasuryTokenAccount.toBase58()}`);

      // Subscribe to account changes (balance updates) for treasury token account
      this.subscriptionId = this.connection.onAccountChange(
        this.treasuryTokenAccount,
        async (accountInfo) => {
          // When account balance changes, check recent transactions
          await this.checkRecentTransactions();
        },
        'confirmed'
      );

      this.isRunning = true;
      console.log('✅ Blockchain monitor started successfully (polling mode enabled)');

      // Check for any pre-existing deposits before monitoring starts
      await this.checkRecentTransactions();
    } catch (error) {
      console.error('❌ Failed to start blockchain monitor:', error);
      throw error;
    }
  }

  /**
   * Stop monitoring
   */
  async stop(): Promise<void> {
    if (this.subscriptionId !== undefined) {
      await this.connection.removeAccountChangeListener(this.subscriptionId);
      this.subscriptionId = undefined;
    }
    this.isRunning = false;
    console.log('🛑 Blockchain monitor stopped');
  }

  /**
   * Check recent transactions for new deposits
   * Paginates through all unprocessed signatures to catch up on backlog
   */
  private async checkRecentTransactions(): Promise<void> {
    try {
      if (!this.treasuryTokenAccount) {
        return;
      }

      let hasMore = true;
      let batchCount = 0;
      const maxBatches = 20; // Safety limit to prevent infinite loops

      while (hasMore && batchCount < maxBatches) {
        // Fetch recent confirmed signatures for the treasury token account
        // Paginate using last processed signature
        const options: any = { limit: 50 };
        if (this.lastProcessedSignature) {
          options.before = this.lastProcessedSignature;
        }

        const signatures = await this.connection.getSignaturesForAddress(
          this.treasuryTokenAccount,
          options,
          'confirmed'
        );

        if (signatures.length === 0) {
          hasMore = false;
          break;
        }

        batchCount++;
        console.log(`   📦 Processing batch ${batchCount} (${signatures.length} signatures)`);

      // Process signatures in reverse order (oldest first)
      for (const sig of signatures.reverse()) {
        // Skip if already processed (in-memory cache)
        if (this.processedSignatures.has(sig.signature)) {
          continue;
        }

        // Skip failed transactions
        if (sig.err) {
          this.processedSignatures.add(sig.signature);
          this.lastProcessedSignature = sig.signature;
          continue;
        }

        // Check if deposit already exists in database (prevents duplicates on restart)
        const existingDeposit = await storage.getDepositBySignature(sig.signature);
        if (existingDeposit) {
          console.log(`   ℹ️  Deposit already processed: ${sig.signature.substring(0, 16)}...`);
          this.processedSignatures.add(sig.signature);
          this.lastProcessedSignature = sig.signature;
          continue;
        }

        console.log(`\n📥 [Deposit Monitor] New transaction detected: ${sig.signature}`);

        // Fetch full transaction details
        const tx = await this.connection.getParsedTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed',
        });

        if (!tx) {
          console.warn(`   ⚠️  Could not fetch transaction details`);
          continue;
        }

        // Process the transaction
        await this.processDeposit(sig.signature, tx);

        // Mark as processed and update last processed
        this.processedSignatures.add(sig.signature);
        this.lastProcessedSignature = sig.signature;
      }

        // Check if we've caught up (less than full page means we're done)
        if (signatures.length < 50) {
          hasMore = false;
        }
      }

      if (batchCount >= maxBatches) {
        console.warn(`   ⚠️  Reached maximum batch limit (${maxBatches}), stopping pagination`);
      }

      // Cleanup old signatures (keep last 1000)
      if (this.processedSignatures.size > 1000) {
        const signatures = Array.from(this.processedSignatures);
        this.processedSignatures = new Set(signatures.slice(-1000));
      }
    } catch (error) {
      console.error('[Deposit Monitor] Error checking recent transactions:', error);
    }
  }

  /**
   * Process a deposit transaction
   */
  private async processDeposit(
    signature: string,
    tx: ParsedTransactionWithMeta
  ): Promise<void> {
    try {
      // Extract deposit information from transaction
      const depositInfo = this.extractDepositInfo(tx);

      if (!depositInfo) {
        console.log(`   ℹ️  Not a deposit transaction, skipping`);
        return;
      }

      const { senderAddress, amount, memo } = depositInfo;

      console.log(`   💰 Deposit Amount: ${amount} TKOIN`);
      console.log(`   👤 From: ${senderAddress}`);
      if (memo) {
        console.log(`   📝 Memo: ${memo}`);
      }

      // Get system configuration
      const config = await storage.getAllSystemConfig();
      const burnRateConfig = config.find(c => c.key === 'burn_rate');
      const creditRatioConfig = config.find(c => c.key === 'tkoin_credit_ratio');
      const webhookUrlConfig = config.find(c => c.key === '1stake_webhook_url');
      const webhookEnabledConfig = config.find(c => c.key === 'webhook_enabled');

      const burnRate = Number(burnRateConfig?.value) || 100; // 1% default (100 basis points)
      const creditRatio = Number(creditRatioConfig?.value) || 100; // 1 TKOIN = 100 Credits default
      const webhookUrl = String(webhookUrlConfig?.value || '');
      const webhookEnabled = Number(webhookEnabledConfig?.value) === 1;

      // Calculate burn amount (burn_rate basis points)
      const burnAmount = (amount * burnRate) / 10000;
      const netAmount = amount - burnAmount;

      // Calculate credits (1 TKOIN = creditRatio Credits)
      const creditsAmount = netAmount * creditRatio;

      console.log(`   🔥 Burn: ${burnAmount} TKOIN (${burnRate / 100}%)`);
      console.log(`   💵 Net: ${netAmount} TKOIN`);
      console.log(`   🎰 Credits: ${creditsAmount} (ratio: 1:${creditRatio})`);

      // Create deposit record
      const deposit = await storage.createDeposit({
        userId: memo || senderAddress, // Use memo as userId if provided, otherwise sender address
        solanaSignature: signature,
        fromWallet: senderAddress,
        toWallet: this.treasuryWallet.toBase58(),
        tkoinAmount: amount.toString(),
        burnAmount: burnAmount.toString(),
        creditsAmount: creditsAmount.toString(),
        status: 'pending',
        memo: memo || null,
      });

      console.log(`   ✅ Deposit record created (ID: ${deposit.id})`);

      // Send webhook to 1Stake if enabled
      if (webhookEnabled && webhookUrl) {
        await this.sendCreditWebhook(deposit, webhookUrl);
      } else {
        console.log(`   ℹ️  Webhook disabled or URL not configured, skipping notification`);
      }

      // Create audit log
      await storage.createAuditLog({
        eventType: 'deposit_detected',
        entityType: 'deposit',
        entityId: deposit.id,
        actorId: 'system',
        actorType: 'system',
        metadata: {
          signature,
          amount: amount.toString(),
          burnAmount: burnAmount.toString(),
          creditsAmount: creditsAmount.toString(),
          senderAddress,
          memo,
        },
      });

      console.log(`   🎉 Deposit processed successfully!\n`);
    } catch (error) {
      console.error('[Deposit Monitor] Error processing deposit:', error);

      // Create error audit log
      await storage.createAuditLog({
        eventType: 'deposit_processing_error',
        entityType: 'transaction',
        entityId: 'error-' + signature.substring(0, 8),
        actorId: 'system',
        actorType: 'system',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          signature,
        },
      });
    }
  }

  /**
   * Extract deposit information from parsed transaction
   * Checks both top-level and inner instructions for Token-2022 transfers
   */
  private extractDepositInfo(tx: ParsedTransactionWithMeta): {
    senderAddress: string;
    amount: number;
    memo: string | null;
  } | null {
    try {
      // Helper function to check instructions
      const checkInstructions = (instructions: any[]): {
        senderAddress: string;
        amount: number;
        memo: string | null;
      } | null => {
        for (const instruction of instructions) {
          if (
            'parsed' in instruction && 
            (instruction.program === 'spl-token' || instruction.program === 'spl-token-2022')
          ) {
            const parsed = instruction.parsed;

            // Check if it's a transfer or transferChecked instruction
            if (
              parsed.type === 'transfer' ||
              parsed.type === 'transferChecked'
            ) {
              const info = parsed.info;

              // Verify it's a transfer TO our treasury token account
              if (
                info.destination === this.treasuryTokenAccount?.toBase58()
              ) {
                const amount = parsed.type === 'transferChecked'
                  ? parseFloat(info.tokenAmount.uiAmountString)
                  : parseFloat(info.amount) / Math.pow(10, this.tokenDecimals);

                // Get sender address (from authority or source)
                const senderAddress = info.authority || info.source;

                // Look for memo instruction
                let memo: string | null = null;
                for (const inst of instructions) {
                  if ('parsed' in inst && inst.program === 'spl-memo') {
                    memo = inst.parsed;
                    break;
                  }
                }

                return {
                  senderAddress,
                  amount,
                  memo,
                };
              }
            }
          }
        }
        return null;
      };

      // Check top-level instructions first
      const topLevelResult = checkInstructions(tx.transaction.message.instructions);
      if (topLevelResult) {
        return topLevelResult;
      }

      // Check inner instructions (for CPI calls)
      if (tx.meta?.innerInstructions) {
        for (const innerGroup of tx.meta.innerInstructions) {
          const innerResult = checkInstructions(innerGroup.instructions);
          if (innerResult) {
            return innerResult;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('[Deposit Monitor] Error extracting deposit info:', error);
      return null;
    }
  }

  /**
   * Send credit webhook to 1Stake platform
   */
  private async sendCreditWebhook(
    deposit: Deposit,
    webhookUrl: string
  ): Promise<void> {
    try {
      console.log(`   📤 Sending webhook to 1Stake...`);

      const webhookSecret = process.env.TKOIN_WEBHOOK_SECRET;
      if (!webhookSecret) {
        throw new Error('TKOIN_WEBHOOK_SECRET not configured');
      }

      // Import webhook service dynamically
      const { WebhookService } = await import('./webhook-service');

      // Send credit notification
      const result = await WebhookService.sendCreditNotification(
        webhookUrl,
        webhookSecret,
        {
          userId: deposit.userId || 'unknown',
          depositId: deposit.id,
          tkoinAmount: deposit.tkoinAmount,
          creditsAmount: deposit.creditsAmount,
          burnAmount: deposit.burnAmount,
          solanaSignature: deposit.solanaSignature,
          memo: deposit.memo || '',
        }
      );

      // Update deposit webhook status
      await storage.updateDepositWebhookStatus(
        deposit.id,
        result.success,
        webhookUrl,
        {
          attempts: result.attempts,
          statusCode: result.statusCode,
          response: result.response,
          error: result.error,
          deliveredAt: result.deliveredAt,
        }
      );

      if (result.success) {
        console.log(`   ✅ Webhook delivered successfully`);
      } else {
        console.warn(`   ⚠️  Webhook delivery failed after ${result.attempts} attempts`);
        console.warn(`   Error: ${result.error}`);
      }

      // Create webhook audit log
      await storage.createAuditLog({
        eventType: 'webhook_sent',
        entityType: 'deposit',
        entityId: deposit.id,
        actorId: 'system',
        actorType: 'system',
        metadata: {
          webhookUrl,
          success: result.success,
          attempts: result.attempts,
          statusCode: result.statusCode,
          error: result.error,
        },
      });
    } catch (error) {
      console.error('[Deposit Monitor] Error sending webhook:', error);

      // Update deposit status to failed
      await storage.updateDepositWebhookStatus(
        deposit.id,
        false,
        webhookUrl,
        {
          attempts: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      );
    }
  }

  /**
   * Get monitor status
   */
  getStatus(): {
    running: boolean;
    treasuryWallet: string;
    treasuryTokenAccount: string;
    mintAddress: string;
    processedCount: number;
  } {
    return {
      running: this.isRunning,
      treasuryWallet: this.treasuryWallet.toBase58(),
      treasuryTokenAccount: this.treasuryTokenAccount?.toBase58() || 'Not initialized',
      mintAddress: this.mintAddress.toBase58(),
      processedCount: this.processedSignatures.size,
    };
  }
}

// Export singleton instance (initialized in server/index.ts)
let blockchainMonitorInstance: BlockchainMonitor | null = null;

export function initializeBlockchainMonitor(
  rpcUrl: string,
  mintAddress: string,
  treasuryWallet: string
): BlockchainMonitor {
  if (!blockchainMonitorInstance) {
    blockchainMonitorInstance = new BlockchainMonitor(
      rpcUrl,
      mintAddress,
      treasuryWallet
    );
  }
  return blockchainMonitorInstance;
}

export function getBlockchainMonitor(): BlockchainMonitor | null {
  return blockchainMonitorInstance;
}
