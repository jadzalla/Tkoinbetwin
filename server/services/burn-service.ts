/**
 * Automated Burn Service
 * 
 * Periodically harvests and burns withheld transfer fees to maintain
 * the deflationary burn mechanism (default 1%, configurable 0-2% via system_config).
 * 
 * Note: The actual burn rate is enforced at the blockchain level via Token-2022
 * transfer fee extension. This service simply harvests and burns the withheld fees.
 * The system_config burn_rate setting is used for frontend display and calculations.
 * 
 * This service should run as a background job.
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
  harvestWithheldTokensToMint,
  withdrawWithheldTokensFromMint,
  burnChecked,
  getMint,
  getAccount,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddress,
} from '@solana/spl-token';
import { db } from '../db';
import { auditLogs } from '@shared/schema';
import { storage } from '../storage';

export class BurnService {
  private connection: Connection;
  private mintAddress: PublicKey;
  private treasuryWallet: Keypair;
  private isRunning: boolean = false;
  private intervalId?: NodeJS.Timeout;

  constructor(
    rpcUrl: string,
    mintAddress: string,
    treasuryPrivateKey: number[]
  ) {
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.mintAddress = new PublicKey(mintAddress);
    this.treasuryWallet = Keypair.fromSecretKey(Uint8Array.from(treasuryPrivateKey));
  }

  /**
   * Start automated burn service
   * @param intervalMinutes How often to run burn process (default: 60 minutes)
   */
  start(intervalMinutes: number = 60): void {
    if (this.isRunning) {
      console.log('⚠️  Burn service already running');
      return;
    }

    console.log(`🔥 Starting automated burn service (interval: ${intervalMinutes}m)`);
    this.isRunning = true;

    // Run immediately on start
    this.executeBurn();

    // Schedule periodic execution
    this.intervalId = setInterval(() => {
      this.executeBurn();
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Stop automated burn service
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isRunning = false;
    console.log('🛑 Burn service stopped');
  }

  /**
   * Get current burn rate from system config
   */
  private async getBurnRate(): Promise<number> {
    try {
      const config = await storage.getAllSystemConfig();
      const burnRateConfig = config.find(c => c.key === 'burn_rate');
      return burnRateConfig?.value || 100; // Default to 1% (100 basis points)
    } catch (error) {
      console.warn('⚠️  Could not fetch burn_rate from config, using default 1%');
      return 100;
    }
  }

  /**
   * Execute burn process once
   */
  private async executeBurn(): Promise<void> {
    try {
      console.log('\n🔥 [Burn Service] Starting burn cycle...');
      
      const startTime = Date.now();
      
      // Get current configured burn rate for logging/reporting
      const configuredBurnRate = await this.getBurnRate();
      const burnRatePercent = configuredBurnRate / 100;
      console.log(`   📋 Configured burn rate: ${configuredBurnRate} basis points (${burnRatePercent}%)`);

      // Ensure treasury token account exists
      const treasuryTokenAccount = await getAssociatedTokenAddress(
        this.mintAddress,
        this.treasuryWallet.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      // Create treasury token account if it doesn't exist
      try {
        await getAccount(
          this.connection,
          treasuryTokenAccount,
          'confirmed',
          TOKEN_2022_PROGRAM_ID
        );
      } catch (error: any) {
        if (error.message?.includes('could not find account')) {
          console.log('   📝 Creating treasury token account...');
          const { createAssociatedTokenAccountIdempotent } = await import('@solana/spl-token');
          await createAssociatedTokenAccountIdempotent(
            this.connection,
            this.treasuryWallet,
            this.mintAddress,
            this.treasuryWallet.publicKey,
            false,
            'confirmed',
            TOKEN_2022_PROGRAM_ID
          );
          console.log('   ✅ Treasury token account created');
        } else {
          throw error;
        }
      }

      // Get current supply
      const mintInfo = await getMint(
        this.connection,
        this.mintAddress,
        'confirmed',
        TOKEN_2022_PROGRAM_ID
      );

      const supplyBefore = Number(mintInfo.supply);

      // Step 1: Harvest withheld fees from all accounts
      try {
        const harvestSignature = await harvestWithheldTokensToMint(
          this.connection,
          this.treasuryWallet,
          this.mintAddress,
          [treasuryTokenAccount],
          [], // multiSigners
          { commitment: 'confirmed' },
          TOKEN_2022_PROGRAM_ID
        );

        console.log('   ✅ Harvested withheld fees:', harvestSignature);

        // Log to audit trail
        await db.insert(auditLogs).values({
          eventType: 'fees_harvested',
          entityType: 'token',
          entityId: this.mintAddress.toBase58(),
          actorType: 'system',
          actorId: 'burn_service',
          metadata: {
            signature: harvestSignature,
            timestamp: new Date().toISOString(),
          },
        });

      } catch (harvestError: any) {
        if (harvestError.message?.includes('nothing to harvest')) {
          console.log('   ℹ️  No withheld fees to harvest, continuing to withdrawal check...');
          // Don't return - continue to withdrawal/burn logic for validation
        } else {
          throw harvestError;
        }
      }

      // Step 2: Withdraw withheld fees from mint and burn them
      try {
        // Use treasury token account as fee vault (destination for withdrawn fees)
        const feeVault = treasuryTokenAccount;

        // Get balance before withdrawal to calculate delta
        const feeVaultBefore = await getAccount(
          this.connection,
          feeVault,
          'confirmed',
          TOKEN_2022_PROGRAM_ID
        );
        const balanceBefore = feeVaultBefore.amount;

        // Withdraw fees from mint to fee vault
        const withdrawSignature = await withdrawWithheldTokensFromMint(
          this.connection,
          this.treasuryWallet,
          this.mintAddress,
          feeVault,
          this.treasuryWallet.publicKey,
          [],
          { commitment: 'confirmed' },
          TOKEN_2022_PROGRAM_ID
        );

        console.log('   ✅ Withdrew fees from mint:', withdrawSignature);

        // Get balance after withdrawal
        const feeVaultAfter = await getAccount(
          this.connection,
          feeVault,
          'confirmed',
          TOKEN_2022_PROGRAM_ID
        );
        const balanceAfter = feeVaultAfter.amount;

        // Calculate the actual withdrawn fee amount (delta, not entire balance)
        const feeAmount = balanceAfter - balanceBefore;

        if (feeAmount > 0n) {
          // Step 3: Burn the withdrawn fees
          const burnSignature = await burnChecked(
            this.connection,
            this.treasuryWallet,
            feeVault,
            this.mintAddress,
            this.treasuryWallet,
            feeAmount,
            mintInfo.decimals,
            [],
            { commitment: 'confirmed' },
            TOKEN_2022_PROGRAM_ID
          );

          const burnedAmount = Number(feeAmount) / (10 ** mintInfo.decimals);

          console.log('   🔥 BURNED:', burnedAmount, 'TKOIN');
          console.log('   📝 Burn signature:', burnSignature);

          // Get supply after burn
          const updatedMintInfo = await getMint(
            this.connection,
            this.mintAddress,
            'confirmed',
            TOKEN_2022_PROGRAM_ID
          );

          const supplyAfter = Number(updatedMintInfo.supply);
          const supplyChange = (supplyBefore - supplyAfter) / (10 ** mintInfo.decimals);

          console.log('   📊 Supply reduced by:', supplyChange, 'TKOIN');

          // Log to audit trail
          await db.insert(auditLogs).values({
            eventType: 'tokens_burned',
            entityType: 'token',
            entityId: this.mintAddress.toBase58(),
            actorType: 'system',
            actorId: 'burn_service',
            metadata: {
              burnSignature,
              withdrawSignature,
              amountBurned: burnedAmount,
              supplyBefore: supplyBefore / (10 ** mintInfo.decimals),
              supplyAfter: supplyAfter / (10 ** mintInfo.decimals),
              configuredBurnRateBasisPoints: configuredBurnRate,
              configuredBurnRatePercent: burnRatePercent,
              timestamp: new Date().toISOString(),
              executionTimeMs: Date.now() - startTime,
            },
          });

          console.log(`   ✅ Burn cycle completed in ${Date.now() - startTime}ms`);
        } else {
          console.log('   ℹ️  No fees to burn (delta was zero)');
          
          // Log zero-fee completion for monitoring
          await db.insert(auditLogs).values({
            eventType: 'burn_cycle_no_fees',
            entityType: 'token',
            entityId: this.mintAddress.toBase58(),
            actorType: 'system',
            actorId: 'burn_service',
            metadata: {
              message: 'Burn cycle completed with no fees to burn',
              timestamp: new Date().toISOString(),
              executionTimeMs: Date.now() - startTime,
            },
          });
        }

      } catch (burnError: any) {
        if (burnError.message?.includes('nothing to withdraw')) {
          console.log('   ℹ️  No withheld fees in mint to withdraw');
          
          // Log for monitoring
          await db.insert(auditLogs).values({
            eventType: 'burn_cycle_no_withdrawal',
            entityType: 'token',
            entityId: this.mintAddress.toBase58(),
            actorType: 'system',
            actorId: 'burn_service',
            metadata: {
              message: 'No withheld fees available for withdrawal',
              timestamp: new Date().toISOString(),
              executionTimeMs: Date.now() - startTime,
            },
          });
        } else {
          console.error('   ❌ Burn error:', burnError.message);
          throw burnError;
        }
      }

    } catch (error: any) {
      console.error('❌ [Burn Service] Error during burn cycle:', error.message);
      
      // Log error to audit trail
      await db.insert(auditLogs).values({
        eventType: 'burn_error',
        entityType: 'token',
        entityId: this.mintAddress.toBase58(),
        actorType: 'system',
        actorId: 'burn_service',
        metadata: {
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  /**
   * Manually trigger burn (for testing or emergency use)
   */
  async manualBurn(): Promise<void> {
    console.log('🔥 Manual burn triggered');
    await this.executeBurn();
  }

  /**
   * Get service status
   */
  getStatus(): { running: boolean; mintAddress: string; treasuryWallet: string } {
    return {
      running: this.isRunning,
      mintAddress: this.mintAddress.toBase58(),
      treasuryWallet: this.treasuryWallet.publicKey.toBase58(),
    };
  }
}

// Export singleton instance (initialized in server/index.ts)
let burnServiceInstance: BurnService | null = null;

export function initializeBurnService(
  rpcUrl: string,
  mintAddress: string,
  treasuryPrivateKey: number[]
): BurnService {
  if (!burnServiceInstance) {
    burnServiceInstance = new BurnService(rpcUrl, mintAddress, treasuryPrivateKey);
  }
  return burnServiceInstance;
}

export function getBurnService(): BurnService {
  if (!burnServiceInstance) {
    throw new Error('Burn service not initialized. Call initializeBurnService first.');
  }
  return burnServiceInstance;
}
