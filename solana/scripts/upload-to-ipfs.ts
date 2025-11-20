#!/usr/bin/env tsx

/**
 * Upload files to IPFS using NFT.Storage API
 * 
 * Usage: npx tsx solana/scripts/upload-to-ipfs.ts <file-path>
 */

import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';

async function uploadToIPFS(filePath: string): Promise<string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  console.log('📤 Uploading to IPFS via NFT.Storage...');
  console.log('   File:', filePath);
  console.log('');

  // Read file
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  
  // Create form data
  const formData = new FormData();
  formData.append('file', fileBuffer, fileName);

  // NFT.Storage public gateway endpoint (no API key needed for small files)
  // Alternative: use web3.storage or Pinata
  const response = await fetch('https://api.nft.storage/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.NFT_STORAGE_API_KEY || ''}`,
    },
    body: formData,
  });

  if (!response.ok) {
    // If NFT.Storage fails, try alternative approach
    console.log('⚠️  NFT.Storage upload failed, trying alternative...');
    return await uploadToInfuraIPFS(filePath, fileBuffer, fileName);
  }

  const data = await response.json() as { ok: boolean; value: { cid: string } };
  
  if (!data.ok) {
    throw new Error('Upload failed');
  }

  const ipfsHash = data.value.cid;
  const ipfsUrl = `ipfs://${ipfsHash}`;
  const gatewayUrl = `https://nftstorage.link/ipfs/${ipfsHash}`;

  console.log('✅ Upload successful!');
  console.log('   IPFS Hash:', ipfsHash);
  console.log('   IPFS URL:', ipfsUrl);
  console.log('   Gateway URL:', gatewayUrl);
  console.log('');

  // Verify accessibility
  console.log('🔍 Verifying accessibility...');
  const verifyResponse = await fetch(gatewayUrl);
  if (verifyResponse.ok) {
    console.log('✅ File is accessible via IPFS gateway');
  } else {
    console.log('⚠️  File may take a few moments to propagate to gateways');
  }

  return ipfsHash;
}

/**
 * Fallback: Upload to Infura IPFS (no auth required)
 */
async function uploadToInfuraIPFS(
  filePath: string,
  fileBuffer: Buffer,
  fileName: string
): Promise<string> {
  console.log('📤 Using Infura IPFS gateway...');
  
  const formData = new FormData();
  formData.append('file', fileBuffer, fileName);

  const response = await fetch('https://ipfs.infura.io:5001/api/v0/add', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Infura IPFS upload failed: ${response.statusText}`);
  }

  const data = await response.json() as { Hash: string };
  const ipfsHash = data.Hash;
  const ipfsUrl = `ipfs://${ipfsHash}`;
  const gatewayUrl = `https://ipfs.io/ipfs/${ipfsHash}`;

  console.log('✅ Upload successful!');
  console.log('   IPFS Hash:', ipfsHash);
  console.log('   IPFS URL:', ipfsUrl);
  console.log('   Gateway URL:', gatewayUrl);

  return ipfsHash;
}

// Main execution
const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: npx tsx solana/scripts/upload-to-ipfs.ts <file-path>');
  process.exit(1);
}

uploadToIPFS(filePath)
  .then((hash) => {
    console.log('');
    console.log('🎉 Done! IPFS Hash:', hash);
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Upload Error:', error.message);
    process.exit(1);
  });
