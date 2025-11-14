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

// Network
export const TOKEN_NETWORK = "devnet"; // devnet | mainnet-beta

// Description
export const TOKEN_DESCRIPTION = "Tkoin Protocol - Sovereignty Stack liquidity token";
