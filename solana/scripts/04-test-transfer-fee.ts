#!/usr/bin/env tsx

/**
 * Script 04: Test TKOIN Transfer Fee Mechanics
 * 
 * Tests that the 1% transfer fee is correctly applied on token transfers
 * 
 * Prerequisites:
 * - Token deployed and initial supply minted
 * - SOLANA_TREASURY_PRIVATE_KEY configured
 */

import { Connection, PublicKey, clusterApiUrl, Keypair } from '@solana/web3.js';
import { getAssociatedTokenAddress, getMint, getAccount, createAssociatedTokenAccountInstruction, transferChecked, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { loadKeypairFromEnv } from '../utils/wallet';
import path from 'path';
import fs from 'fs';
import { Transaction, sendAndConfirmTransaction } from '@solana/web3.js';

async function main() {
  console.log('🧪 Testing TKOIN Transfer Fee Mechanics...');
  console.log('');

  // Get RPC URL from env or use devnet
  const rpcUrl = process.env.SOLANA_RPC_URL || clusterApiUrl('devnet');
  const connection = new Connection(rpcUrl, 'confirmed');

  console.log('🔗 Network:', rpcUrl);
  console.log('');

  // Load deployment info
  const deploymentPath = path.join(process.cwd(), 'solana', 'deployment.json');
  
  if (!fs.existsSync(deploymentPath)) {
    console.error('❌ deployment.json not found!');
    console.error('   Run: npm run deploy:token');
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
  const mintAddress = new PublicKey(deployment.mintAddress);

  // Load treasury wallet
  console.log('🔑 Loading treasury wallet from environment...');
  const treasuryWallet = loadKeypairFromEnv('SOLANA_TREASURY_PRIVATE_KEY');
  
  console.log('💼 Treasury Wallet:', treasuryWallet.publicKey.toBase58());
  console.log('🪙 Mint Address:', mintAddress.toBase58());
  console.log('');

  // Create a test recipient wallet
  const recipientWallet = Keypair.generate();
  console.log('👤 Test Recipient:', recipientWallet.publicKey.toBase58());
  console.log('');

  // Get treasury token account
  const treasuryTokenAccount = await getAssociatedTokenAddress(
    mintAddress,
    treasuryWallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  // Get recipient token account
  const recipientTokenAccount = await getAssociatedTokenAddress(
    mintAddress,
    recipientWallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  // Get mint info
  const mintInfo = await getMint(connection, mintAddress, 'confirmed', TOKEN_2022_PROGRAM_ID);
  const decimals = mintInfo.decimals;

  // Check treasury balance before
  const treasuryAccountBefore = await getAccount(connection, treasuryTokenAccount, 'confirmed', TOKEN_2022_PROGRAM_ID);
  const treasuryBalanceBefore = Number(treasuryAccountBefore.amount) / Math.pow(10, decimals);

  console.log('📊 Pre-Transfer Balances:');
  console.log('   Treasury:', treasuryBalanceBefore.toLocaleString(), 'TKOIN');
  console.log('');

  // Create recipient token account
  console.log('📝 Creating recipient token account...');
  const createAccountIx = createAssociatedTokenAccountInstruction(
    treasuryWallet.publicKey,
    recipientTokenAccount,
    recipientWallet.publicKey,
    mintAddress,
    TOKEN_2022_PROGRAM_ID
  );

  const { blockhash: createBlockhash } = await connection.getLatestBlockhash();
  const createTx = new Transaction();
  createTx.recentBlockhash = createBlockhash;
  createTx.feePayer = treasuryWallet.publicKey;
  createTx.add(createAccountIx);

  const createSig = await sendAndConfirmTransaction(connection, createTx, [treasuryWallet]);
  console.log('✅ Recipient account created');
  console.log('   Transaction:', createSig);
  console.log('');

  // Transfer test amount (10,000 TKOIN)
  const transferAmount = 10_000;
  const transferAmountRaw = BigInt(transferAmount * Math.pow(10, decimals));

  console.log('💸 Transferring Test Amount:');
  console.log('   Amount:', transferAmount.toLocaleString(), 'TKOIN');
  console.log('   Expected Fee (1%):', (transferAmount * 0.01).toLocaleString(), 'TKOIN');
  console.log('   Expected Recipient:', (transferAmount * 0.99).toLocaleString(), 'TKOIN');
  console.log('');

  // Perform transfer (using transferChecked for Token-2022)
  console.log('⚙️  Executing transfer...');
  const transferSig = await transferChecked(
    connection,
    treasuryWallet,
    treasuryTokenAccount,
    mintAddress,
    recipientTokenAccount,
    treasuryWallet.publicKey,
    transferAmountRaw,
    decimals,
    [],
    undefined,
    TOKEN_2022_PROGRAM_ID
  );

  console.log('✅ Transfer complete');
  console.log('   Transaction:', transferSig);
  console.log('');

  // Check balances after
  const treasuryAccountAfter = await getAccount(connection, treasuryTokenAccount, 'confirmed', TOKEN_2022_PROGRAM_ID);
  const recipientAccountAfter = await getAccount(connection, recipientTokenAccount, 'confirmed', TOKEN_2022_PROGRAM_ID);

  const treasuryBalanceAfter = Number(treasuryAccountAfter.amount) / Math.pow(10, decimals);
  const recipientBalanceAfter = Number(recipientAccountAfter.amount) / Math.pow(10, decimals);

  // Calculate actual fee
  const expectedRecipientBalance = transferAmount * 0.99; // 99% after 1% fee
  const actualFee = transferAmount - recipientBalanceAfter;
  const actualFeePercent = (actualFee / transferAmount) * 100;

  console.log('📊 Post-Transfer Balances:');
  console.log('   Treasury:', treasuryBalanceAfter.toLocaleString(), 'TKOIN');
  console.log('   Recipient:', recipientBalanceAfter.toLocaleString(), 'TKOIN');
  console.log('');

  console.log('🔍 Transfer Fee Analysis:');
  console.log('   Sent Amount:', transferAmount.toLocaleString(), 'TKOIN');
  console.log('   Received Amount:', recipientBalanceAfter.toLocaleString(), 'TKOIN');
  console.log('   Fee Deducted:', actualFee.toLocaleString(), 'TKOIN');
  console.log('   Fee Percentage:', actualFeePercent.toFixed(4) + '%');
  console.log('');

  // Verify fee is correct (allowing for rounding)
  const feeIsCorrect = Math.abs(recipientBalanceAfter - expectedRecipientBalance) < 0.001;

  if (feeIsCorrect) {
    console.log('✅ Transfer Fee Test PASSED');
    console.log('   1% transfer fee is working correctly!');
  } else {
    console.log('❌ Transfer Fee Test FAILED');
    console.log('   Expected recipient balance:', expectedRecipientBalance.toLocaleString());
    console.log('   Actual recipient balance:', recipientBalanceAfter.toLocaleString());
  }

  console.log('');
  console.log('🔗 View transactions on Solana Explorer:');
  console.log(`   Create Account: https://explorer.solana.com/tx/${createSig}?cluster=devnet`);
  console.log(`   Transfer: https://explorer.solana.com/tx/${transferSig}?cluster=devnet`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Test Error:', error);
    process.exit(1);
  });
