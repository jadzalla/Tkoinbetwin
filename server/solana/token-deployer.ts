import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  getMintLen,
  createInitializeMintInstruction,
  createInitializeTransferFeeConfigInstruction,
} from '@solana/spl-token';
import { solanaCore } from './solana-core';
import { db } from '../db';
import { tokenConfig } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface TokenDeploymentConfig {
  tokenName: string;
  tokenSymbol: string;
  decimals: number;
  maxSupply: string;
  burnRateBasisPoints: number; // 100 = 1%
  maxBurnRateBasisPoints: number; // 200 = 2%
  description?: string;
}

export interface TokenDeploymentResult {
  success: boolean;
  mintAddress?: string;
  signature?: string;
  error?: string;
  configId?: string;
}

/**
 * TokenDeployer - Handles TKOIN Token-2022 deployment on Solana
 * 
 * Deploys a Token-2022 with:
 * - Transfer fee extension (configurable burn mechanism)
 * - 1% default burn rate (adjustable 0-2%)
 * - Treasury as fee collection authority
 */
export class TokenDeployer {
  private connection: Connection;
  private payer: Keypair;

  constructor() {
    if (!solanaCore.isReady()) {
      throw new Error('Solana Core not configured. Cannot deploy token.');
    }
    
    this.connection = solanaCore.getConnection();
    this.payer = solanaCore.getTreasuryKeypair();
  }

  /**
   * Deploy TKOIN Token-2022 with transfer fee extension
   */
  async deployToken(config: TokenDeploymentConfig): Promise<TokenDeploymentResult> {
    console.log('🚀 Starting TKOIN Token-2022 deployment...');
    console.log(`   Name: ${config.tokenName} (${config.tokenSymbol})`);
    console.log(`   Decimals: ${config.decimals}`);
    console.log(`   Max Supply: ${config.maxSupply}`);
    console.log(`   Burn Rate: ${config.burnRateBasisPoints / 100}%`);

    try {
      // Check if token already deployed
      const existing = await db.select().from(tokenConfig)
        .where(eq(tokenConfig.deploymentStatus, 'deployed'))
        .limit(1);
      
      if (existing.length > 0) {
        console.warn('⚠️  Token already deployed!');
        return {
          success: false,
          error: 'Token already deployed. Mint address: ' + existing[0].mintAddress,
        };
      }

      // PHASE 1: Create placeholder row with 'pending' status (atomic lock)
      // Delete any existing rows and insert new pending row
      await db.delete(tokenConfig).execute();
      
      await db.insert(tokenConfig).values({
        tokenName: config.tokenName,
        tokenSymbol: config.tokenSymbol,
        decimals: config.decimals,
        totalSupply: config.maxSupply,
        mintAddress: '', // Will be updated after deployment
        burnRateBasisPoints: config.burnRateBasisPoints,
        maxBurnRateBasisPoints: config.maxBurnRateBasisPoints,
        description: config.description || '',
        deploymentStatus: 'pending',
        deployedAt: new Date(),
        transactionSignature: '',
      });

      console.log('✅ Created pending deployment record');

      // Generate new mint keypair
      const mintKeypair = Keypair.generate();
      const mintAddress = mintKeypair.publicKey;
      console.log(`✓ Generated mint address: ${mintAddress.toString()}`);

      // Calculate mint account size with transfer fee extension
      const extensions = [ExtensionType.TransferFeeConfig];
      const mintLen = getMintLen(extensions);
      const lamports = await this.connection.getMinimumBalanceForRentExemption(mintLen);

      console.log(`   Mint account size: ${mintLen} bytes`);
      console.log(`   Rent: ${(lamports / LAMPORTS_PER_SOL).toFixed(6)} SOL`);

      // Create transaction
      const transaction = new Transaction();

      // 1. Create mint account
      transaction.add(
        SystemProgram.createAccount({
          fromPubkey: this.payer.publicKey,
          newAccountPubkey: mintAddress,
          space: mintLen,
          lamports,
          programId: TOKEN_2022_PROGRAM_ID,
        })
      );

      // 2. Initialize transfer fee config
      // This must be done BEFORE initializing the mint
      transaction.add(
        createInitializeTransferFeeConfigInstruction(
          mintAddress,
          this.payer.publicKey, // Transfer fee config authority
          this.payer.publicKey, // Withdraw withheld authority
          config.burnRateBasisPoints, // Fee basis points (100 = 1%)
          BigInt(config.maxSupply), // Maximum fee (use max supply as cap)
          TOKEN_2022_PROGRAM_ID
        )
      );

      // 3. Initialize mint
      transaction.add(
        createInitializeMintInstruction(
          mintAddress,
          config.decimals,
          this.payer.publicKey, // Mint authority
          this.payer.publicKey, // Freeze authority
          TOKEN_2022_PROGRAM_ID
        )
      );

      // Send and confirm transaction
      console.log('📡 Sending transaction...');
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.payer, mintKeypair],
        {
          commitment: 'confirmed',
          skipPreflight: false,
        }
      );

      console.log('✅ Token deployed successfully!');
      console.log(`   Mint: ${mintAddress.toString()}`);
      console.log(`   Signature: ${signature}`);
      console.log(`   Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

      // PHASE 2: Update pending row to deployed status
      const [dbRecord] = await db.update(tokenConfig)
        .set({
          mintAddress: mintAddress.toString(),
          totalSupply: config.maxSupply,
          currentSupply: '0',
          circulatingSupply: '0',
          treasuryWallet: this.payer.publicKey.toString(),
          mintAuthority: this.payer.publicKey.toString(),
          freezeAuthority: this.payer.publicKey.toString(),
          transferFeeConfigAuthority: this.payer.publicKey.toString(),
          deploymentStatus: 'deployed',
          deployedAt: new Date(),
          transactionSignature: signature,
        })
        .where(eq(tokenConfig.deploymentStatus, 'pending'))
        .returning();

      if (!dbRecord) {
        console.error('❌ Failed to update pending deployment record');
        throw new Error('Database update failed after successful on-chain deployment');
      }

      console.log('💾 Token configuration updated in database');

      return {
        success: true,
        mintAddress: mintAddress.toString(),
        signature,
        configId: dbRecord.id,
      };

    } catch (error) {
      console.error('❌ Token deployment failed:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // PHASE 2 (FAILURE): Update pending row to failed status
      try {
        await db.update(tokenConfig)
          .set({
            mintAddress: 'DEPLOYMENT_FAILED',
            deploymentStatus: 'failed',
            deploymentError: errorMessage,
            deployedAt: new Date(),
          })
          .where(eq(tokenConfig.deploymentStatus, 'pending'));
        
        console.log('💾 Failed deployment status saved to database');
      } catch (dbError) {
        console.error('Failed to update deployment error in database:', dbError);
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get current token configuration from database
   * Returns the most recent deployed config, or the latest record if none deployed
   */
  async getTokenConfig() {
    // First try to get a deployed config
    const deployed = await db.select().from(tokenConfig)
      .where(eq(tokenConfig.deploymentStatus, 'deployed'))
      .limit(1);
    
    if (deployed.length > 0) {
      return deployed[0];
    }

    // If no deployed config, return the most recent record (failed/pending)
    const latest = await db.select().from(tokenConfig)
      .orderBy(tokenConfig.deployedAt)
      .limit(1);
    
    return latest.length > 0 ? latest[0] : null;
  }

  /**
   * Verify token deployment on-chain
   */
  async verifyDeployment(mintAddress: string): Promise<boolean> {
    try {
      const mint = new PublicKey(mintAddress);
      const accountInfo = await this.connection.getAccountInfo(mint);
      
      if (!accountInfo) {
        console.error('❌ Mint account not found on-chain');
        return false;
      }

      console.log('✅ Token deployment verified on-chain');
      console.log(`   Owner: ${accountInfo.owner.toString()}`);
      console.log(`   Data size: ${accountInfo.data.length} bytes`);
      
      return true;
    } catch (error) {
      console.error('❌ Verification failed:', error);
      return false;
    }
  }
}
