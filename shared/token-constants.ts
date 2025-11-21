/**
 * Tkoin Token Constants
 * 
 * Centralized configuration for the TKOIN Token-2022
 * Ensures consistency across frontend and backend
 */

// Token Identity
export const TOKEN_NAME = "Tkoin";
export const TOKEN_SYMBOL = "TK";

// Decimals (Solana standard: 9 decimals = 1 token = 10^9 base units)
export const TOKEN_DECIMALS = 9;

// Supply (in human-readable tokens)
export const TOKEN_MAX_SUPPLY_TOKENS = "1000000000"; // 1 billion tokens

// Burn Configuration (in basis points, 1% = 100 bp)
export const TOKEN_BURN_RATE_BP = 100; // 1%
export const TOKEN_MAX_BURN_RATE_BP = 200; // 2%

// Network - auto-detect based on RPC URL
const rpcUrl = typeof process !== 'undefined' ? process.env.SOLANA_RPC_URL : import.meta?.env?.VITE_SOLANA_RPC_URL;
export const TOKEN_NETWORK = rpcUrl?.includes('mainnet') ? 'mainnet-beta' : 'devnet';

// Token Mint Address (environment-based for devnet/mainnet compatibility)
// Backend uses process.env with validation, frontend uses Vite env var
const getMintAddress = (): string => {
  if (typeof process !== 'undefined') {
    // Server-side: require TKOIN_MINT_ADDRESS environment variable
    const mintAddress = process.env.TKOIN_MINT_ADDRESS;
    if (!mintAddress) {
      throw new Error(
        'CRITICAL: TKOIN_MINT_ADDRESS environment variable is not set. ' +
        'This is required for all blockchain operations. ' +
        'Please set it to the appropriate token mint address for your environment (devnet or mainnet).'
      );
    }
    return mintAddress;
  } else {
    // Client-side: use Vite environment variable or fallback to devnet
    return import.meta?.env?.VITE_TKOIN_MINT_ADDRESS || '9XPD1ZcAtNZgc1pGYYL3Z4W3mNqHKmqKDsUtsKKzAJE5';
  }
};

export const TKOIN_MINT_ADDRESS = getMintAddress();

// Description
export const TOKEN_DESCRIPTION = "Tkoin Protocol - Sovereignty Stack liquidity token";
