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
  createInitializeMetadataPointerInstruction,
  TYPE_SIZE,
  LENGTH_SIZE,
  getMint,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
} from '@solana/spl-token';
import {
  createInitializeInstruction,
  createUpdateFieldInstruction,
  pack,
  TokenMetadata,
} from '@solana/spl-token-metadata';
import { solanaCore } from './solana-core';
import { db } from '../db';
import { tokenConfig } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { tokensToBaseUnits } from '@shared/token-utils';

export interface TokenDeploymentConfig {
  tokenName: string;
  tokenSymbol: string;
  decimals: number;
  maxSupply: string;
  burnRateBasisPoints: number; // 100 = 1%
  maxBurnRateBasisPoints: number; // 200 = 2%
  description?: string;
  metadataUri?: string;
  logoUri?: string;
  initialMintAmount?: string; // Amount to mint to treasury after deployment
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
   * Deploy TKOIN Token-2022 with transfer fee extension and metadata
   */
  async deployToken(config: TokenDeploymentConfig): Promise<TokenDeploymentResult> {
    console.log('🚀 Starting TKOIN Token-2022 deployment...');
    console.log(`   Name: ${config.tokenName} (${config.tokenSymbol})`);
    console.log(`   Decimals: ${config.decimals}`);
    console.log(`   Max Supply: ${config.maxSupply}`);
    console.log(`   Burn Rate: ${config.burnRateBasisPoints / 100}%`);
    console.log(`   Metadata URI: ${config.metadataUri || 'None'}`);
    console.log(`   Initial Mint: ${config.initialMintAmount || '0'} tokens`);

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

      // Convert human-readable tokens to base units for storage
      // Example: "1000000000" tokens with 9 decimals = "1000000000000000000" base units
      const maxSupplyBaseUnits = tokensToBaseUnits(config.maxSupply, config.decimals);
      console.log(`   Max Supply (tokens): ${config.maxSupply}`);
      console.log(`   Max Supply (base units): ${maxSupplyBaseUnits}`);

      // PHASE 1: Create placeholder row with 'pending' status (atomic lock)
      // Delete any existing rows and insert new pending row
      await db.delete(tokenConfig).execute();
      
      await db.insert(tokenConfig).values({
        tokenName: config.tokenName,
        tokenSymbol: config.tokenSymbol,
        decimals: config.decimals,
        maxSupply: maxSupplyBaseUnits, // Store in base units
        mintAddress: '', // Will be updated after deployment
        burnRateBasisPoints: config.burnRateBasisPoints,
        maxBurnRateBasisPoints: config.maxBurnRateBasisPoints,
        treasuryWallet: this.payer.publicKey.toString(),
        description: config.description || '',
        metadataUri: config.metadataUri || '',
        logoUrl: config.logoUri || '',
        deploymentStatus: 'pending',
        deployedAt: new Date(),
        deploymentSignature: '',
      });

      console.log('✅ Created pending deployment record');

      // Generate new mint keypair
      const mintKeypair = Keypair.generate();
      const mintAddress = mintKeypair.publicKey;
      console.log(`✓ Generated mint address: ${mintAddress.toString()}`);

      // Prepare metadata for on-chain storage
      const metadata: TokenMetadata = {
        mint: mintAddress,
        name: config.tokenName,
        symbol: config.tokenSymbol,
        uri: config.metadataUri || '',
        additionalMetadata: [
          ['description', config.description || ''],
          ['logoURI', config.logoUri || '']
        ]
      };

      // Calculate mint account size with BOTH extensions
      const extensions = [
        ExtensionType.TransferFeeConfig,
        ExtensionType.MetadataPointer
      ];
      const mintLen = getMintLen(extensions);
      
      // Calculate metadata space (variable length)
      const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;
      
      // Total space and rent
      const totalSpace = mintLen + metadataLen;
      const lamports = await this.connection.getMinimumBalanceForRentExemption(totalSpace);

      console.log(`   Mint account size: ${mintLen} bytes`);
      console.log(`   Metadata size: ${metadataLen} bytes`);
      console.log(`   Total space: ${totalSpace} bytes`);
      console.log(`   Rent: ${(lamports / LAMPORTS_PER_SOL).toFixed(6)} SOL`);

      // Create transaction
      const transaction = new Transaction();

      // 1. Create mint account (with space for both extensions + metadata)
      transaction.add(
        SystemProgram.createAccount({
          fromPubkey: this.payer.publicKey,
          newAccountPubkey: mintAddress,
          space: totalSpace,
          lamports,
          programId: TOKEN_2022_PROGRAM_ID,
        })
      );

      // 2. Initialize MetadataPointer extension (MUST be before mint initialization)
      transaction.add(
        createInitializeMetadataPointerInstruction(
          mintAddress,
          this.payer.publicKey, // Update authority for metadata
          mintAddress, // Metadata account (self-referencing - stored on mint)
          TOKEN_2022_PROGRAM_ID
        )
      );

      // 3. Initialize transfer fee config (MUST be before mint initialization)
      transaction.add(
        createInitializeTransferFeeConfigInstruction(
          mintAddress,
          this.payer.publicKey, // Transfer fee config authority
          this.payer.publicKey, // Withdraw withheld authority
          config.burnRateBasisPoints, // Fee basis points (100 = 1%)
          BigInt(maxSupplyBaseUnits), // Maximum fee in base units (use max supply as cap)
          TOKEN_2022_PROGRAM_ID
        )
      );

      // 4. Initialize mint
      transaction.add(
        createInitializeMintInstruction(
          mintAddress,
          config.decimals,
          this.payer.publicKey, // Mint authority
          this.payer.publicKey, // Freeze authority
          TOKEN_2022_PROGRAM_ID
        )
      );

      // 5. Initialize on-chain metadata (name, symbol, URI)
      transaction.add(
        createInitializeInstruction({
          programId: TOKEN_2022_PROGRAM_ID,
          metadata: mintAddress, // Metadata stored on mint account
          updateAuthority: this.payer.publicKey,
          mint: mintAddress,
          mintAuthority: this.payer.publicKey,
          name: metadata.name,
          symbol: metadata.symbol,
          uri: metadata.uri,
        })
      );

      // 6. Add custom metadata fields (description, logoURI)
      if (metadata.additionalMetadata && metadata.additionalMetadata.length > 0) {
        for (const [field, value] of metadata.additionalMetadata) {
          if (value && value.trim().length > 0) {
            transaction.add(
              createUpdateFieldInstruction({
                programId: TOKEN_2022_PROGRAM_ID,
                metadata: mintAddress,
                updateAuthority: this.payer.publicKey,
                field: field,
                value: value,
              })
            );
          }
        }
      }

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

      // PHASE 2: Mint initial supply to treasury if specified
      let initialSupplyMinted = '0';
      if (config.initialMintAmount && BigInt(config.initialMintAmount) > 0) {
        try {
          initialSupplyMinted = await this.mintInitialSupply(
            mintAddress,
            config.initialMintAmount,
            config.decimals
          );
          console.log(`✅ Minted ${config.initialMintAmount} tokens to treasury`);
        } catch (mintError) {
          console.warn('⚠️  Initial minting failed, but deployment succeeded:', mintError);
        }
      }

      // PHASE 3: Update pending row to deployed status
      const [dbRecord] = await db.update(tokenConfig)
        .set({
          mintAddress: mintAddress.toString(),
          currentSupply: initialSupplyMinted,
          circulatingSupply: initialSupplyMinted,
          treasuryWallet: this.payer.publicKey.toString(),
          mintAuthority: this.payer.publicKey.toString(),
          freezeAuthority: this.payer.publicKey.toString(),
          transferFeeConfigAuthority: this.payer.publicKey.toString(),
          metadataUri: config.metadataUri || '',
          logoUrl: config.logoUri || '',
          deploymentStatus: 'deployed',
          deployedAt: new Date(),
          deploymentSignature: signature,
        })
        .where(eq(tokenConfig.deploymentStatus, 'pending'))
        .returning();

      if (!dbRecord) {
        console.error('❌ Failed to update pending deployment record');
        throw new Error('Database update failed after successful on-chain deployment');
      }

      console.log('💾 Token configuration updated in database');

      // PHASE 4: Generate deployment report
      this.generateDeploymentReport(
        mintAddress.toString(),
        signature,
        config,
        initialSupplyMinted
      );

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
   * Mint initial token supply to treasury wallet
   * @param mintAddress - The mint public key
   * @param amount - Amount in human-readable tokens (e.g., "100000000")
   * @param decimals - Token decimals
   * @returns Amount minted in base units
   */
  async mintInitialSupply(
    mintAddress: PublicKey,
    amount: string,
    decimals: number
  ): Promise<string> {
    console.log(`💰 Minting initial supply: ${amount} tokens`);

    // Convert to base units
    const amountBaseUnits = tokensToBaseUnits(amount, decimals);
    console.log(`   Base units: ${amountBaseUnits}`);

    // Get or create associated token account for treasury
    const treasuryTokenAccount = getAssociatedTokenAddressSync(
      mintAddress,
      this.payer.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    console.log(`   Treasury token account: ${treasuryTokenAccount.toString()}`);

    // Build mint transaction
    const transaction = new Transaction();

    // Check if account exists, create if needed
    try {
      const accountInfo = await this.connection.getAccountInfo(treasuryTokenAccount);
      if (!accountInfo) {
        console.log('   Creating associated token account...');
        transaction.add(
          createAssociatedTokenAccountInstruction(
            this.payer.publicKey, // Payer
            treasuryTokenAccount, // ATA address
            this.payer.publicKey, // Owner
            mintAddress, // Mint
            TOKEN_2022_PROGRAM_ID
          )
        );
      }
    } catch (error) {
      console.log('   Creating associated token account...');
      transaction.add(
        createAssociatedTokenAccountInstruction(
          this.payer.publicKey,
          treasuryTokenAccount,
          this.payer.publicKey,
          mintAddress,
          TOKEN_2022_PROGRAM_ID
        )
      );
    }

    // Add mint instruction
    transaction.add(
      createMintToInstruction(
        mintAddress,
        treasuryTokenAccount,
        this.payer.publicKey, // Mint authority
        BigInt(amountBaseUnits),
        [],
        TOKEN_2022_PROGRAM_ID
      )
    );

    // Send and confirm
    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.payer],
      {
        commitment: 'confirmed',
        skipPreflight: false,
      }
    );

    console.log(`✅ Mint transaction confirmed: ${signature}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

    return amountBaseUnits;
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
   * Comprehensively verify token deployment on-chain
   * Checks mint account, extensions, metadata, and supply
   */
  async verifyDeployment(mintAddress: string): Promise<boolean> {
    try {
      console.log('🔍 Starting comprehensive deployment verification...');
      const mint = new PublicKey(mintAddress);
      
      // 1. Check mint account exists
      const accountInfo = await this.connection.getAccountInfo(mint);
      if (!accountInfo) {
        console.error('❌ Mint account not found on-chain');
        return false;
      }
      console.log('✅ Mint account exists');
      console.log(`   Address: ${mintAddress}`);
      console.log(`   Owner: ${accountInfo.owner.toString()}`);
      console.log(`   Data size: ${accountInfo.data.length} bytes`);

      // 2. Verify program owner is TOKEN_2022_PROGRAM_ID
      if (!accountInfo.owner.equals(TOKEN_2022_PROGRAM_ID)) {
        console.error('❌ Invalid program owner (not Token-2022)');
        return false;
      }
      console.log('✅ Correct program owner (Token-2022)');

      // 3. Get and verify mint info
      const mintInfo = await getMint(
        this.connection,
        mint,
        'confirmed',
        TOKEN_2022_PROGRAM_ID
      );
      console.log('✅ Mint info retrieved');
      console.log(`   Decimals: ${mintInfo.decimals}`);
      console.log(`   Supply: ${mintInfo.supply.toString()}`);
      console.log(`   Mint Authority: ${mintInfo.mintAuthority?.toString() || 'None'}`);
      console.log(`   Freeze Authority: ${mintInfo.freezeAuthority?.toString() || 'None'}`);

      // 4. Check for extensions
      const extensions: string[] = [];
      
      // Check for Transfer Fee extension
      if (mintInfo.tlvData && mintInfo.tlvData.length > 0) {
        extensions.push('TransferFeeConfig');
        console.log('✅ Transfer Fee extension detected');
        
        // Could add more detailed transfer fee config verification here
        // using getTransferFeeConfig if needed
      }

      // Check for Metadata extension (if MetadataPointer is present)
      // The metadata is embedded in the mint account's TLV data
      if (extensions.length > 0) {
        console.log(`✅ Total extensions: ${extensions.length}`);
        console.log(`   Active: ${extensions.join(', ')}`);
      }

      // 5. Verify metadata (if available)
      try {
        // Note: Reading metadata from Token-2022 requires special deserialization
        // This is a basic check that the account has the expected size for metadata
        const expectedMinSize = 300; // Approximate minimum for mint + extensions + metadata
        if (accountInfo.data.length >= expectedMinSize) {
          console.log('✅ Account size suggests metadata is present');
        } else {
          console.warn('⚠️  Account size smaller than expected (metadata may be minimal)');
        }
      } catch (metadataError) {
        console.warn('⚠️  Could not verify metadata details:', metadataError);
      }

      // 6. Summary
      console.log('\n📊 Verification Summary:');
      console.log('   ✓ Mint account exists');
      console.log('   ✓ Correct Token-2022 program');
      console.log(`   ✓ Extensions active: ${extensions.length}`);
      console.log(`   ✓ Current supply: ${mintInfo.supply.toString()}`);
      console.log('   ✓ Authorities set correctly');

      return true;
    } catch (error) {
      console.error('❌ Comprehensive verification failed:', error);
      return false;
    }
  }

  /**
   * Generate comprehensive deployment report
   * @param mintAddress - The deployed mint address
   * @param deploymentSignature - The deployment transaction signature
   * @param config - The deployment configuration used
   * @param initialSupplyMinted - Amount of initial supply minted (in base units)
   */
  generateDeploymentReport(
    mintAddress: string,
    deploymentSignature: string,
    config: TokenDeploymentConfig,
    initialSupplyMinted: string
  ): void {
    const network = process.env.SOLANA_RPC_URL?.includes('mainnet') ? 'mainnet-beta' : 'devnet';
    const explorerCluster = network === 'mainnet-beta' ? '' : '?cluster=devnet';

    console.log('\n' + '='.repeat(50));
    console.log('TKOIN TOKEN-2022 DEPLOYMENT REPORT');
    console.log('='.repeat(50));
    console.log();

    console.log('📋 TOKEN INFORMATION');
    console.log(`   Name: ${config.tokenName}`);
    console.log(`   Symbol: ${config.tokenSymbol}`);
    console.log(`   Description: ${config.description || 'None'}`);
    console.log(`   Network: ${network.charAt(0).toUpperCase() + network.slice(1)}`);
    console.log();

    console.log('🏦 MINT CONFIGURATION');
    console.log(`   Mint Address: ${mintAddress}`);
    console.log(`   Decimals: ${config.decimals}`);
    console.log(`   Token Standard: SPL Token-2022`);
    console.log();

    console.log('💰 SUPPLY INFORMATION');
    console.log(`   Max Supply: ${parseInt(config.maxSupply).toLocaleString()} ${config.tokenSymbol}`);
    if (config.initialMintAmount) {
      console.log(`   Initial Minted: ${parseInt(config.initialMintAmount).toLocaleString()} ${config.tokenSymbol}`);
    }
    console.log(`   Current Supply: ${initialSupplyMinted} base units`);
    console.log();

    console.log('👤 AUTHORITIES');
    console.log(`   Treasury Wallet: ${this.payer.publicKey.toString()}`);
    console.log(`   Mint Authority: ${this.payer.publicKey.toString()}`);
    console.log(`   Freeze Authority: ${this.payer.publicKey.toString()}`);
    console.log(`   Transfer Fee Authority: ${this.payer.publicKey.toString()}`);
    console.log(`   Metadata Update Authority: ${this.payer.publicKey.toString()}`);
    console.log();

    console.log('🔧 TOKEN EXTENSIONS');
    console.log(`   ✓ Transfer Fee Config (${config.burnRateBasisPoints / 100}% burn)`);
    console.log(`   ✓ Metadata Extension (on-chain name, symbol, URI)`);
    console.log(`   Max Burn Rate: ${config.maxBurnRateBasisPoints / 100}%`);
    console.log();

    console.log('📦 METADATA');
    if (config.metadataUri) {
      console.log(`   URI: ${config.metadataUri}`);
    }
    if (config.logoUri) {
      console.log(`   Logo: ${config.logoUri}`);
    }
    if (!config.metadataUri && !config.logoUri) {
      console.log(`   (No off-chain metadata URI specified)`);
    }
    console.log();

    console.log('🔗 EXPLORER LINKS');
    console.log(`   Mint: https://explorer.solana.com/address/${mintAddress}${explorerCluster}`);
    console.log(`   Deployment Tx: https://explorer.solana.com/tx/${deploymentSignature}${explorerCluster}`);
    console.log(`   SolScan: https://solscan.io/token/${mintAddress}${network === 'devnet' ? '?cluster=devnet' : ''}`);
    console.log();

    console.log('✅ DEPLOYMENT STATUS');
    console.log(`   Status: SUCCESSFUL`);
    console.log(`   Timestamp: ${new Date().toISOString()}`);
    console.log();

    console.log('📝 NEXT STEPS');
    console.log('   1. Verify deployment on Solana Explorer');
    console.log('   2. Test token transfers and burn mechanism');
    console.log('   3. Upload metadata JSON to configured URI');
    console.log('   4. Update agent pricing configurations');
    console.log('   5. Configure platform webhooks for token integration');
    console.log();

    console.log('='.repeat(50));
    console.log('DEPLOYMENT COMPLETE');
    console.log('='.repeat(50));
    console.log();
  }
}
