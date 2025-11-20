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

  console.log('📤 Uploading to IPFS via Pinata...');
  console.log('   File:', filePath);
  console.log('');

  // Verify Pinata credentials
  const apiKey = process.env.PINATA_API_KEY;
  const apiSecret = process.env.PINATA_SECRET_API_KEY;

  if (!apiKey || !apiSecret) {
    throw new Error('Missing Pinata credentials. Set PINATA_API_KEY and PINATA_SECRET_API_KEY');
  }

  // Read file
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  
  // Create form data
  const formData = new FormData();
  formData.append('file', fileBuffer, fileName);

  // Upload to Pinata
  const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: {
      'pinata_api_key': apiKey,
      'pinata_secret_api_key': apiSecret,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Pinata upload failed: ${response.statusText} - ${errorText}`);
  }

  const data = await response.json() as { IpfsHash: string; PinSize: number; Timestamp: string };
  
  const ipfsHash = data.IpfsHash;
  const ipfsUrl = `ipfs://${ipfsHash}`;
  const gatewayUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;

  console.log('✅ Upload successful!');
  console.log('   IPFS Hash:', ipfsHash);
  console.log('   IPFS URL:', ipfsUrl);
  console.log('   Gateway URL:', gatewayUrl);
  console.log('   Pin Size:', data.PinSize, 'bytes');
  console.log('');

  // Verify accessibility
  console.log('🔍 Verifying accessibility...');
  const verifyResponse = await fetch(gatewayUrl);
  if (verifyResponse.ok) {
    console.log('✅ File is accessible via Pinata gateway');
  } else {
    console.log('⚠️  File may take a few moments to propagate');
  }

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
