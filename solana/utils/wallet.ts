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
