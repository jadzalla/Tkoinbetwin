#!/usr/bin/env tsx
/**
 * Generate Treasury Wallet for Tkoin
 * 
 * This script generates a new Solana wallet that will serve as the
 * treasury wallet for receiving all Tkoin deposits from users.
 * 
 * ⚠️  SECURITY WARNING:
 * - Store the generated wallet file securely
 * - Never commit wallet files to version control
 * - Back up the wallet in multiple secure locations
 * - Use hardware wallet for production
 */

import { generateKeypair, saveKeypairToFile, exportKeypairInfo, ensureWalletDirectory } from '../utils/wallet';
import path from 'path';

async function main() {
  console.log('🔐 Generating Tkoin Treasury Wallet...\n');

  // Ensure wallet directory exists
  const walletDir = ensureWalletDirectory();

  // Generate new keypair
  const treasuryKeypair = generateKeypair();
  const info = exportKeypairInfo(treasuryKeypair);

  console.log('✅ Treasury Wallet Generated!\n');
  console.log('📋 Wallet Information:');
  console.log('   Public Address:', info.publicKey);
  console.log('\n⚠️  KEEP THIS PRIVATE KEY SECURE:');
  console.log('   Secret Key (Base64):', info.secretKeyBase58);
  console.log('\n');

  // Save to file
  const filepath = path.join(walletDir, 'treasury-wallet.json');
  saveKeypairToFile(treasuryKeypair, filepath);

  console.log('\n📝 Next Steps:');
  console.log('   1. Back up the wallet file to secure location(s)');
  console.log('   2. Add public address to .env as SOLANA_TREASURY_WALLET');
  console.log('   3. Add secret key array to .env as SOLANA_TREASURY_PRIVATE_KEY');
  console.log('   4. Fund the wallet with SOL for transaction fees');
  console.log('   5. Run deployment script: npm run deploy:token');
  console.log('\n⚠️  WARNING: Never share the private key or commit wallet files!');
  console.log('\n');

  // Output .env format
  console.log('📄 Add to your .env file:');
  console.log('```');
  console.log(`SOLANA_TREASURY_WALLET=${info.publicKey}`);
  console.log(`SOLANA_TREASURY_PRIVATE_KEY=${JSON.stringify(info.secretKeyArray)}`);
  console.log('```');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
