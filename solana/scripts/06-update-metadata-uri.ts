#!/usr/bin/env tsx

/**
 * Script 06: Update Metaplex Metadata URI
 * 
 * Updates the metadata URI for an existing token to point to corrected metadata JSON
 * 
 * Prerequisites:
 * - Metadata PDA already exists (run 05-add-metaplex-metadata.ts first)
 * - SOLANA_TREASURY_PRIVATE_KEY configured
 * - New metadata JSON uploaded to IPFS
 */

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { 
  updateV1,
  findMetadataPda,
  fetchMetadataFromSeeds
} from "@metaplex-foundation/mpl-token-metadata";
import { 
  publicKey as umiPublicKey,
  createSignerFromKeypair,
  signerIdentity
} from "@metaplex-foundation/umi";
import { clusterApiUrl } from '@solana/web3.js';
import { loadKeypairFromEnv } from '../utils/wallet';
import path from 'path';
import fs from 'fs';

// New metadata URI (with optimized centered logo)
const NEW_METADATA_URI = 'https://coral-occasional-jackal-975.mypinata.cloud/ipfs/QmfJUZVJ8x1hCHHiVHPvBXopMJNmRfEQHD4iTnMt21L4Ae';

async function main() {
  console.log('🔄 Updating Metaplex Metadata URI...');
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
  const metadataPda = findMetadataPda(umi, { mint: mintPublicKey });

  console.log('📋 Update Configuration:');
  console.log('   Metadata PDA:', metadataPda[0]);
  console.log('   New URI:', NEW_METADATA_URI);
  console.log('');

  // Fetch existing metadata first
  console.log('📥 Fetching current metadata...');
  const currentMetadata = await fetchMetadataFromSeeds(umi, { mint: mintPublicKey });
  console.log('   Current URI:', currentMetadata.uri);
  console.log('');

  // Update metadata
  console.log('⚙️  Updating metadata URI...');
  console.log('');

  try {
    const result = await updateV1(umi, {
      mint: mintPublicKey,
      authority: umiSigner,
      data: {
        ...currentMetadata,
        uri: NEW_METADATA_URI,
      },
    }).sendAndConfirm(umi);

    console.log('✅ Metadata updated successfully!');
    console.log('   Transaction:', Buffer.from(result.signature).toString('base64'));
    console.log('');

    console.log('✅ Metadata Update Complete!');
    console.log('');
    console.log('📋 Summary:');
    console.log('   Mint Address:', mintAddressString);
    console.log('   Metadata PDA:', metadataPda[0]);
    console.log('   Updated URI:', NEW_METADATA_URI);
    console.log('');
    console.log('🔗 View on Solana Explorer:');
    console.log(`   https://explorer.solana.com/address/${mintAddressString}?cluster=devnet`);
    console.log('');
    console.log('💡 Next Steps:');
    console.log('   1. Refresh Solana Explorer to see updated metadata');
    console.log('   2. Check Phantom wallet - logo should now display correctly');
    console.log('   3. Allow a few minutes for wallets to refresh cached metadata');

  } catch (error) {
    console.error('❌ Metadata Update Error:', error);
    
    if (error instanceof Error) {
      console.error('   Message:', error.message);
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
