import { Keypair } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

/**
 * Generate a new Solana keypair
 */
export function generateKeypair(): Keypair {
  return Keypair.generate();
}

/**
 * Save keypair to JSON file (Solana CLI format)
 */
export function saveKeypairToFile(keypair: Keypair, filepath: string): void {
  const secretKeyArray = Array.from(keypair.secretKey);
  fs.writeFileSync(filepath, JSON.stringify(secretKeyArray));
  console.log(`✅ Keypair saved to: ${filepath}`);
}

/**
 * Load keypair from JSON file
 */
export function loadKeypairFromFile(filepath: string): Keypair {
  const secretKeyString = fs.readFileSync(filepath, 'utf-8');
  const secretKeyArray = JSON.parse(secretKeyString);
  return Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
}

/**
 * Export keypair info (DO NOT LOG PRIVATE KEY IN PRODUCTION)
 */
export function exportKeypairInfo(keypair: Keypair): {
  publicKey: string;
  secretKeyBase58: string;
  secretKeyArray: number[];
} {
  return {
    publicKey: keypair.publicKey.toBase58(),
    secretKeyBase58: Buffer.from(keypair.secretKey).toString('base64'),
    secretKeyArray: Array.from(keypair.secretKey),
  };
}

/**
 * Create wallet directory if it doesn't exist
 */
export function ensureWalletDirectory(): string {
  const walletDir = path.join(process.cwd(), 'solana', 'wallets');
  if (!fs.existsSync(walletDir)) {
    fs.mkdirSync(walletDir, { recursive: true });
  }
  return walletDir;
}

/**
 * Load keypair from environment variable
 * Expects SOLANA_TREASURY_PRIVATE_KEY to be a JSON array of numbers
 */
export function loadKeypairFromEnv(envVarName: string = 'SOLANA_TREASURY_PRIVATE_KEY'): Keypair {
  const secretKeyString = process.env[envVarName];
  if (!secretKeyString) {
    throw new Error(`Environment variable ${envVarName} not found`);
  }
  
  // Clean up the string - remove extra quotes and trim
  let cleanedString = secretKeyString.trim();
  
  // If the string starts and ends with quotes, remove them
  if ((cleanedString.startsWith('"') && cleanedString.endsWith('"')) ||
      (cleanedString.startsWith("'") && cleanedString.endsWith("'"))) {
    cleanedString = cleanedString.slice(1, -1);
  }
  
  try {
    // If the string doesn't start with [, add brackets (for comma-separated format)
    if (!cleanedString.startsWith('[')) {
      cleanedString = `[${cleanedString}]`;
    }
    
    const secretKeyArray = JSON.parse(cleanedString);
    return Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
  } catch (error) {
    console.error('Failed to parse private key from environment variable');
    console.error('String length:', cleanedString.length);
    console.error('First 50 chars:', cleanedString.substring(0, 50));
    console.error('Last 50 chars:', cleanedString.substring(cleanedString.length - 50));
    throw new Error(`Invalid private key format in ${envVarName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
