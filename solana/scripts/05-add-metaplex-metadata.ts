#!/usr/bin/env tsx

/**
 * Script 05: Add Metaplex Metadata to Existing TKOIN Token
 * 
 * Creates a Metaplex metadata PDA (Program Derived Address) for the deployed token
 * This allows wallets and explorers to display the token name, symbol, and logo
 * 
 * Prerequisites:
 * - Token already deployed (run 02-deploy-token.ts first)
 * - SOLANA_TREASURY_PRIVATE_KEY configured
 * - Metadata JSON uploaded to IPFS
 */

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { 
  createV1,
  TokenStandard,
  findMetadataPda
} from "@metaplex-foundation/mpl-token-metadata";
import { 
  publicKey as umiPublicKey,
  percentAmount,
  createSignerFromKeypair,
  signerIdentity
} from "@metaplex-foundation/umi";
import { Connection, clusterApiUrl } from '@solana/web3.js';
import { loadKeypairFromEnv } from '../utils/wallet';
import path from 'path';
import fs from 'fs';

// Metadata configuration
const METADATA_CONFIG = {
  name: 'Tkoin',
  symbol: 'TK',
  uri: 'https://gateway.pinata.cloud/ipfs/QmPz1rkDzUEKhqM7eXtPHDhMDFLJKSA8hRo5Gh5msqZNA8',
  sellerFeeBasisPoints: 0, // No royalties for fungible token
};

async function main() {
  console.log('🏷️  Adding Metaplex Metadata to TKOIN Token...');
  console.log('');

  // Get RPC URL from env or use devnet
  const rpcUrl = process.env.SOLANA_RPC_URL || clusterApiUrl('devnet');
  
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
  const mintAddressString = deployment.mintAddress;

  // Load treasury wallet
  console.log('🔑 Loading treasury wallet from environment...');
  const treasuryWallet = loadKeypairFromEnv('SOLANA_TREASURY_PRIVATE_KEY');
  
  console.log('💼 Treasury Wallet:', treasuryWallet.publicKey.toBase58());
  console.log('🪙 Mint Address:', mintAddressString);
  console.log('');

  // Create UMI instance
  const umi = createUmi(rpcUrl);
  
  // Convert Solana keypair to UMI signer
  const umiKeypair = umi.eddsa.createKeypairFromSecretKey(treasuryWallet.secretKey);
  const umiSigner = createSignerFromKeypair(umi, umiKeypair);
  
  umi.use(signerIdentity(umiSigner));

  const mintPublicKey = umiPublicKey(mintAddressString);

  console.log('📋 Metadata Configuration:');
  console.log('   Name:', METADATA_CONFIG.name);
  console.log('   Symbol:', METADATA_CONFIG.symbol);
  console.log('   URI:', METADATA_CONFIG.uri);
  console.log('');

  // Check if metadata already exists
  const metadataPda = findMetadataPda(umi, { mint: mintPublicKey });
  console.log('📦 Metadata PDA:', metadataPda[0]);
  console.log('');

  try {
    const connection = new Connection(rpcUrl, 'confirmed');
    const accountInfo = await connection.getAccountInfo(
      new (await import('@solana/web3.js')).PublicKey(metadataPda[0])
    );
    
    if (accountInfo) {
      console.log('⚠️  Metadata account already exists!');
      console.log('   Skipping metadata creation...');
      console.log('');
      console.log('✅ Token already has metadata');
      console.log('   View on Solana Explorer:');
      console.log(`   https://explorer.solana.com/address/${mintAddressString}?cluster=devnet`);
      process.exit(0);
    }
  } catch (error) {
    // Account doesn't exist, continue with creation
    console.log('📝 Creating new metadata account...');
  }

  // Create metadata
  console.log('⚙️  Creating Metaplex metadata...');
  console.log('');

  try {
    const result = await createV1(umi, {
      mint: mintPublicKey,
      name: METADATA_CONFIG.name,
      symbol: METADATA_CONFIG.symbol,
      uri: METADATA_CONFIG.uri,
      sellerFeeBasisPoints: percentAmount(METADATA_CONFIG.sellerFeeBasisPoints),
      decimals: 9,
      tokenStandard: TokenStandard.Fungible,
      // Specify Token-2022 program
      splTokenProgram: umiPublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'),
    }).sendAndConfirm(umi);

    console.log('✅ Metadata created successfully!');
    console.log('   Transaction:', Buffer.from(result.signature).toString('base64'));
    console.log('   Metadata PDA:', metadataPda[0]);
    console.log('');

    console.log('✅ Metadata Deployment Complete!');
    console.log('');
    console.log('📋 Summary:');
    console.log('   Mint Address:', mintAddressString);
    console.log('   Metadata PDA:', metadataPda[0]);
    console.log('   Name:', METADATA_CONFIG.name);
    console.log('   Symbol:', METADATA_CONFIG.symbol);
    console.log('   Logo IPFS:', 'ipfs://QmP3Ykv9MpE9Qcay9WHd8p1uVuUj2EA9egx87CtYFcU5Hj');
    console.log('   Metadata URI:', METADATA_CONFIG.uri);
    console.log('');
    console.log('🔗 View on Solana Explorer:');
    console.log(`   https://explorer.solana.com/address/${mintAddressString}?cluster=devnet`);
    console.log('');
    console.log('💡 Next Steps:');
    console.log('   1. Refresh Solana Explorer to see token name and logo');
    console.log('   2. Check Phantom wallet - token should display as "Tkoin (TK)"');
    console.log('   3. Verify logo displays correctly');

  } catch (error) {
    console.error('❌ Metadata Creation Error:', error);
    
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      
      // Provide helpful error messages
      if (error.message.includes('already in use')) {
        console.error('   Metadata account already exists for this mint');
      } else if (error.message.includes('insufficient funds')) {
        console.error('   Insufficient SOL for transaction fees');
      }
    }
    
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal Error:', error);
    process.exit(1);
  });
