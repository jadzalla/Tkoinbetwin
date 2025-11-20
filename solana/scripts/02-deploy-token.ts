#!/usr/bin/env tsx
/**
 * Deploy Tkoin Token-2022 with Transfer Fee Extension
 * 
 * This script deploys the Tkoin token on Solana with:
 * - Token-2022 standard (latest SPL token implementation)
 * - Transfer fee extension (1% burn on deposits - configurable via system config)
 * - 1,000,000,000 max supply (1 billion tokens)
 * - 9 decimal places (Solana standard)
 * - No freeze authority (maintains sovereignty)
 * 
 * Prerequisites:
 * - Treasury wallet generated (run 01-generate-treasury-wallet.ts)
 * - SOL in treasury wallet for deployment fees
 * - SOLANA_RPC_URL configured in .env
 */

import { Connection, Keypair, clusterApiUrl } from '@solana/web3.js';
import { createTokenWithTransferFee, airdropSol } from '../utils/token';
import { loadKeypairFromFile } from '../utils/wallet';
import path from 'path';
import fs from 'fs';

// Token configuration
const TOKEN_CONFIG = {
  name: 'Tkoin',
  symbol: 'TK',
  decimals: 9,
  maxSupply: 1_000_000_000, // 1 billion
  transferFeeBasisPoints: 100, // 1% = 100 basis points (configurable via system_config)
  maxTransferFee: BigInt(1_000_000 * 10 ** 9), // 1M TKOIN max fee
};

async function main() {
  console.log('🚀 Deploying Tkoin Token-2022...\n');

  // Get RPC URL from env or use devnet
  const rpcUrl = process.env.SOLANA_RPC_URL || clusterApiUrl('devnet');
  const connection = new Connection(rpcUrl, 'confirmed');

  console.log('🔗 Network:', rpcUrl);
  console.log('');

  // Load treasury wallet
  const walletPath = path.join(process.cwd(), 'solana', 'wallets', 'treasury-wallet.json');
  
  if (!fs.existsSync(walletPath)) {
    console.error('❌ Treasury wallet not found!');
    console.error('   Run: npm run generate:wallet');
    process.exit(1);
  }

  const treasuryWallet = loadKeypairFromFile(walletPath);
  console.log('💼 Treasury Wallet:', treasuryWallet.publicKey.toBase58());

  // Check balance
  const balance = await connection.getBalance(treasuryWallet.publicKey);
  console.log('💰 Balance:', balance / 10 ** 9, 'SOL');

  // Airdrop if on devnet and balance is low
  if (rpcUrl.includes('devnet') && balance < 0.5 * 10 ** 9) {
    console.log('');
    await airdropSol(connection, treasuryWallet.publicKey, 2);
  }

  console.log('\n📋 Token Configuration:');
  console.log('   Name:', TOKEN_CONFIG.name);
  console.log('   Symbol:', TOKEN_CONFIG.symbol);
  console.log('   Decimals:', TOKEN_CONFIG.decimals);
  console.log('   Max Supply:', TOKEN_CONFIG.maxSupply.toLocaleString());
  console.log('   Transfer Fee:', `${TOKEN_CONFIG.transferFeeBasisPoints / 100}%`);
  console.log('');

  // Deploy token
  const mintAddress = await createTokenWithTransferFee(
    connection,
    treasuryWallet,
    treasuryWallet.publicKey, // Treasury is mint authority
    TOKEN_CONFIG.decimals,
    TOKEN_CONFIG.transferFeeBasisPoints,
    TOKEN_CONFIG.maxTransferFee,
  );

  console.log('\n✅ Token Deployed Successfully!\n');
  console.log('📋 Deployment Summary:');
  console.log('   Mint Address:', mintAddress.toBase58());
  console.log('   Treasury Wallet:', treasuryWallet.publicKey.toBase58());
  console.log('   Network:', rpcUrl);
  console.log('');

  // Save deployment info
  const deploymentInfo = {
    mintAddress: mintAddress.toBase58(),
    treasuryWallet: treasuryWallet.publicKey.toBase58(),
    network: rpcUrl,
    deployedAt: new Date().toISOString(),
    config: TOKEN_CONFIG,
  };

  const deploymentPath = path.join(process.cwd(), 'solana', 'deployment.json');
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log('💾 Deployment info saved to:', deploymentPath);
  console.log('');

  console.log('📄 Add to your .env file:');
  console.log('```');
  console.log(`TKOIN_MINT_ADDRESS=${mintAddress.toBase58()}`);
  console.log('```');
  console.log('');

  console.log('📝 Next Steps:');
  console.log('   1. Verify token on Solana Explorer');
  console.log('   2. (Optional) Add token metadata using Metaplex');
  console.log('   3. Mint initial supply if needed');
  console.log('   4. Configure blockchain monitoring service');
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Deployment Error:', error);
    process.exit(1);
  });
