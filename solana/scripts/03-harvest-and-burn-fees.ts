#!/usr/bin/env tsx
/**
 * Harvest and Burn Withheld Transfer Fees
 * 
 * This script implements the actual 2% burn mechanism by:
 * 1. Harvesting withheld transfer fees from treasury token account
 * 2. Burning the harvested fees to reduce total supply
 * 
 * Run this periodically (e.g., daily via cron) to maintain the burn mechanism.
 * 
 * Prerequisites:
 * - Token deployed with transfer fee extension
 * - Treasury wallet with authority to harvest and burn fees
 */

import { Connection, Keypair, PublicKey, clusterApiUrl } from '@solana/web3.js';
import {
  harvestWithheldTokensToMint,
  withdrawWithheldTokensFromAccounts,
  burnChecked,
  getMint,
  getAccount,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import { loadKeypairFromFile } from '../utils/wallet';
import path from 'path';
import fs from 'fs';

async function main() {
  console.log('🔥 Harvesting and Burning Withheld Transfer Fees...\n');

  // Load configuration
  const deploymentPath = path.join(process.cwd(), 'solana', 'deployment.json');
  if (!fs.existsSync(deploymentPath)) {
    console.error('❌ Deployment file not found!');
    console.error('   Run: tsx solana/scripts/02-deploy-token.ts');
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
  const mintAddress = new PublicKey(deployment.mintAddress);

  // Get RPC URL
  const rpcUrl = process.env.SOLANA_RPC_URL || deployment.network || clusterApiUrl('devnet');
  const connection = new Connection(rpcUrl, 'confirmed');

  console.log('🔗 Network:', rpcUrl);
  console.log('💎 Mint:', mintAddress.toBase58());
  console.log('');

  // Load treasury wallet (has authority to harvest and burn)
  const walletPath = path.join(process.cwd(), 'solana', 'wallets', 'treasury-wallet.json');
  const treasuryWallet = loadKeypairFromFile(walletPath);
  console.log('💼 Treasury Authority:', treasuryWallet.publicKey.toBase58());

  // Get mint info
  const mintInfo = await getMint(
    connection,
    mintAddress,
    'confirmed',
    TOKEN_2022_PROGRAM_ID
  );

  console.log('📊 Current Supply:', Number(mintInfo.supply) / 10 ** mintInfo.decimals, 'TKOIN');
  console.log('');

  // Get treasury token account
  const { getAssociatedTokenAddress } = await import('@solana/spl-token');
  const treasuryTokenAccount = await getAssociatedTokenAddress(
    mintAddress,
    treasuryWallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  console.log('📥 Treasury Token Account:', treasuryTokenAccount.toBase58());

  // Check withheld amount
  try {
    const accountInfo = await getAccount(
      connection,
      treasuryTokenAccount,
      'confirmed',
      TOKEN_2022_PROGRAM_ID
    );

    // Note: Token-2022 accounts with transfer fee have withheld amount in extensions
    console.log('💰 Account Balance:', Number(accountInfo.amount) / 10 ** mintInfo.decimals, 'TKOIN');
    
    // Step 1: Harvest withheld fees to mint
    console.log('\n🌾 Harvesting withheld fees...');
    
    try {
      const harvestSignature = await harvestWithheldTokensToMint(
        connection,
        treasuryWallet,
        mintAddress,
        [treasuryTokenAccount], // Can include multiple accounts
        [], // multiSigners
        { commitment: 'confirmed' },
        TOKEN_2022_PROGRAM_ID
      );

      console.log('✅ Fees harvested!');
      console.log('   Transaction:', harvestSignature);
    } catch (harvestError: any) {
      if (harvestError.message?.includes('nothing to harvest')) {
        console.log('ℹ️  No withheld fees to harvest (this is normal if no recent deposits)');
      } else {
        throw harvestError;
      }
    }

    // Step 2: Get updated mint info to see harvested fees
    const updatedMintInfo = await getMint(
      connection,
      mintAddress,
      'confirmed',
      TOKEN_2022_PROGRAM_ID
    );

    console.log('\n📊 Supply After Harvest:', Number(updatedMintInfo.supply) / 10 ** updatedMintInfo.decimals, 'TKOIN');

    // Step 3: Withdraw withheld tokens from mint to fee vault for burning
    console.log('\n💸 Withdrawing withheld fees from mint...');
    
    const { withdrawWithheldTokensFromMint, getAssociatedTokenAddress } = await import('@solana/spl-token');
    
    // Create/get fee vault (treasury's token account)
    const feeVault = await getAssociatedTokenAddress(
      mintAddress,
      treasuryWallet.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    console.log('   Fee vault:', feeVault.toBase58());

    try {
      // Get balance before withdrawal to calculate delta
      const feeVaultBefore = await getAccount(
        connection,
        feeVault,
        'confirmed',
        TOKEN_2022_PROGRAM_ID
      );
      const balanceBefore = feeVaultBefore.amount;

      const withdrawSignature = await withdrawWithheldTokensFromMint(
        connection,
        treasuryWallet,
        mintAddress,
        feeVault,
        treasuryWallet.publicKey,
        [],
        { commitment: 'confirmed' },
        TOKEN_2022_PROGRAM_ID
      );

      console.log('   ✅ Withdrew fees from mint:', withdrawSignature);

      // Get balance after withdrawal
      const feeVaultAfter = await getAccount(
        connection,
        feeVault,
        'confirmed',
        TOKEN_2022_PROGRAM_ID
      );
      const balanceAfter = feeVaultAfter.amount;

      // Calculate the actual withdrawn fee amount (delta)
      const feeAmount = balanceAfter - balanceBefore;
      const feeAmountDisplay = Number(feeAmount) / 10 ** mintInfo.decimals;

      console.log('   💰 Balance before:', Number(balanceBefore) / 10 ** mintInfo.decimals, 'TKOIN');
      console.log('   💰 Balance after:', Number(balanceAfter) / 10 ** mintInfo.decimals, 'TKOIN');
      console.log('   💰 Withdrawn fees:', feeAmountDisplay, 'TKOIN');

      if (feeAmount > 0n) {
        // Step 4: Burn the withdrawn fees
        console.log('\n🔥 Burning withdrawn fees...');

        const burnSignature = await burnChecked(
          connection,
          treasuryWallet,
          feeVault,
          mintAddress,
          treasuryWallet,
          feeAmount,
          mintInfo.decimals,
          [],
          { commitment: 'confirmed' },
          TOKEN_2022_PROGRAM_ID
        );

        console.log('   ✅ BURNED:', feeAmountDisplay, 'TKOIN');
        console.log('   📝 Burn signature:', burnSignature);

        // Get final supply
        const finalMintInfo = await getMint(
          connection,
          mintAddress,
          'confirmed',
          TOKEN_2022_PROGRAM_ID
        );

        const supplyReduction = (Number(updatedMintInfo.supply) - Number(finalMintInfo.supply)) / 10 ** mintInfo.decimals;

        console.log('\n📊 Final Supply:', Number(finalMintInfo.supply) / 10 ** mintInfo.decimals, 'TKOIN');
        console.log('   🔥 Total Supply Reduction:', supplyReduction, 'TKOIN');
      } else {
        console.log('   ℹ️  No fees to burn');
      }

    } catch (withdrawError: any) {
      if (withdrawError.message?.includes('nothing to withdraw')) {
        console.log('   ℹ️  No withheld fees in mint to withdraw');
      } else {
        throw withdrawError;
      }
    }

  } catch (error: any) {
    if (error.message?.includes('could not find account')) {
      console.log('ℹ️  Treasury token account not yet created.');
      console.log('   This is normal before the first mint operation.');
    } else {
      throw error;
    }
  }

  console.log('\n✅ Harvest and burn process completed!');
  console.log('\n📝 Recommendations:');
  console.log('   1. Run this script daily via cron to maintain burn rate');
  console.log('   2. Monitor total supply reduction over time');
  console.log('   3. Alert on unexpected supply changes');
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
