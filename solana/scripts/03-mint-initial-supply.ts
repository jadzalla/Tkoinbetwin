#!/usr/bin/env tsx

/**
 * Script 03: Mint Initial TKOIN Supply
 * 
 * Mints the initial 1 billion TKOIN supply to the treasury wallet
 * 
 * Prerequisites:
 * - Token already deployed (run 02-deploy-token.ts first)
 * - SOLANA_TREASURY_PRIVATE_KEY configured
 * - Treasury wallet has sufficient SOL for transaction fees
 */

import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { getAssociatedTokenAddress, getMint, mintTo, createAssociatedTokenAccountInstruction, getAccount, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { loadKeypairFromFile, loadKeypairFromEnv } from '../utils/wallet';
import path from 'path';
import fs from 'fs';

async function main() {
  console.log('💰 Minting Initial TKOIN Supply...');
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

  // Load treasury wallet from environment or file
  let treasuryWallet;
  
  if (process.env.SOLANA_TREASURY_PRIVATE_KEY) {
    console.log('🔑 Loading treasury wallet from environment...');
    treasuryWallet = loadKeypairFromEnv('SOLANA_TREASURY_PRIVATE_KEY');
  } else {
    const walletPath = path.join(process.cwd(), 'solana', 'wallets', 'treasury-wallet.json');
    
    if (!fs.existsSync(walletPath)) {
      console.error('❌ Treasury wallet not found!');
      console.error('   Set SOLANA_TREASURY_PRIVATE_KEY environment variable');
      console.error('   OR run: npm run generate:wallet');
      process.exit(1);
    }
    
    treasuryWallet = loadKeypairFromFile(walletPath);
  }
  
  console.log('💼 Treasury Wallet:', treasuryWallet.publicKey.toBase58());
  console.log('🪙 Mint Address:', mintAddress.toBase58());
  console.log('');

  // Get mint info (using Token-2022 program)
  const mintInfo = await getMint(connection, mintAddress, 'confirmed', TOKEN_2022_PROGRAM_ID);
  console.log('📊 Current Token Info:');
  console.log('   Decimals:', mintInfo.decimals);
  console.log('   Current Supply:', Number(mintInfo.supply) / Math.pow(10, mintInfo.decimals));
  console.log('');

  // Calculate amount to mint (1 billion tokens with decimals)
  const maxSupply = deployment.config.maxSupply;
  const currentSupply = Number(mintInfo.supply) / Math.pow(10, mintInfo.decimals);
  const amountToMint = maxSupply - currentSupply;

  if (amountToMint <= 0) {
    console.log('✅ Maximum supply already minted!');
    console.log('   Current Supply:', currentSupply.toLocaleString());
    console.log('   Max Supply:', maxSupply.toLocaleString());
    process.exit(0);
  }

  console.log('💰 Minting Details:');
  console.log('   Amount to Mint:', amountToMint.toLocaleString(), 'TKOIN');
  console.log('   Current Supply:', currentSupply.toLocaleString(), 'TKOIN');
  console.log('   New Supply:', maxSupply.toLocaleString(), 'TKOIN');
  console.log('');

  // Get or create associated token account for treasury (using Token-2022 program)
  const treasuryTokenAccount = await getAssociatedTokenAddress(
    mintAddress,
    treasuryWallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  console.log('📦 Treasury Token Account:', treasuryTokenAccount.toBase58());

  // Check if account exists (using Token-2022 program)
  let accountExists = false;
  try {
    await getAccount(connection, treasuryTokenAccount, 'confirmed', TOKEN_2022_PROGRAM_ID);
    accountExists = true;
    console.log('✅ Token account already exists');
  } catch (error) {
    console.log('📝 Creating associated token account...');
  }

  // Create account if it doesn't exist (using Token-2022 program)
  if (!accountExists) {
    const createAccountIx = createAssociatedTokenAccountInstruction(
      treasuryWallet.publicKey, // payer
      treasuryTokenAccount, // ata
      treasuryWallet.publicKey, // owner
      mintAddress, // mint
      TOKEN_2022_PROGRAM_ID
    );

    const { blockhash } = await connection.getLatestBlockhash();
    const tx = new (await import('@solana/web3.js')).Transaction();
    tx.recentBlockhash = blockhash;
    tx.feePayer = treasuryWallet.publicKey;
    tx.add(createAccountIx);

    const sig = await (await import('@solana/web3.js')).sendAndConfirmTransaction(
      connection,
      tx,
      [treasuryWallet]
    );

    console.log('✅ Token account created');
    console.log('   Transaction:', sig);
    console.log('');
  }

  // Mint tokens
  console.log('⚙️  Minting tokens...');
  const mintAmount = BigInt(amountToMint * Math.pow(10, mintInfo.decimals));

  const signature = await mintTo(
    connection,
    treasuryWallet, // payer
    mintAddress, // mint
    treasuryTokenAccount, // destination
    treasuryWallet, // authority
    mintAmount, // amount
    [],
    undefined,
    TOKEN_2022_PROGRAM_ID
  );

  console.log('✅ Tokens minted successfully!');
  console.log('   Transaction:', signature);
  console.log('');

  // Verify final supply (using Token-2022 program)
  const finalMintInfo = await getMint(connection, mintAddress, 'confirmed', TOKEN_2022_PROGRAM_ID);
  const finalSupply = Number(finalMintInfo.supply) / Math.pow(10, mintInfo.decimals);

  console.log('✅ Minting Complete!');
  console.log('');
  console.log('📋 Final Supply Summary:');
  console.log('   Total Supply:', finalSupply.toLocaleString(), 'TKOIN');
  console.log('   Max Supply:', maxSupply.toLocaleString(), 'TKOIN');
  console.log('   Treasury Balance:', amountToMint.toLocaleString(), 'TKOIN');
  console.log('');
  console.log('🔗 View on Solana Explorer:');
  console.log(`   https://explorer.solana.com/address/${mintAddress.toBase58()}?cluster=devnet`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Minting Error:', error);
    process.exit(1);
  });
