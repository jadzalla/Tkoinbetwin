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
// Backend uses process.env, frontend will use hardcoded value for now
// When migrating to mainnet, update both TKOIN_MINT_ADDRESS env var and this constant
export const TKOIN_MINT_ADDRESS = 
  typeof process !== 'undefined' 
    ? process.env.TKOIN_MINT_ADDRESS! 
    : '9XPD1ZcAtNZgc1pGYYL3Z4W3mNqHKmqKDsUtsKKzAJE5'; // Devnet mint

// Description
export const TOKEN_DESCRIPTION = "Tkoin Protocol - Sovereignty Stack liquidity token";
