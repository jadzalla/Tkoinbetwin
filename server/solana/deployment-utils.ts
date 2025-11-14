/**
 * Token Deployment Utilities
 * 
 * Helper functions for token deployment, validation, and verification
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID, getMint } from '@solana/spl-token';

/**
 * Validate a Solana public key string
 * @param address - Public key string to validate
 * @returns true if valid, false otherwise
 */
export function validatePublicKey(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate mint address exists and is owned by Token-2022 program
 * @param connection - Solana connection
 * @param mintAddress - Mint public key
 * @returns true if valid Token-2022 mint, false otherwise
 */
export async function validateMintAccount(
  connection: Connection,
  mintAddress: PublicKey
): Promise<boolean> {
  try {
    const accountInfo = await connection.getAccountInfo(mintAddress);
    
    if (!accountInfo) {
      return false;
    }

    return accountInfo.owner.equals(TOKEN_2022_PROGRAM_ID);
  } catch {
    return false;
  }
}

/**
 * Generate Solana Explorer URLs for a given address or transaction
 * @param addressOrSignature - Mint address or transaction signature
 * @param type - Type of explorer link ('address' or 'tx')
 * @param network - Solana network ('devnet' or 'mainnet-beta')
 * @returns Object with multiple explorer URLs
 */
export function generateExplorerUrls(
  addressOrSignature: string,
  type: 'address' | 'tx',
  network: 'devnet' | 'mainnet-beta' = 'devnet'
) {
  const cluster = network === 'mainnet-beta' ? '' : '?cluster=devnet';
  const solscanCluster = network === 'mainnet-beta' ? '' : '?cluster=devnet';

  if (type === 'address') {
    return {
      solanaExplorer: `https://explorer.solana.com/address/${addressOrSignature}${cluster}`,
      solscan: `https://solscan.io/token/${addressOrSignature}${solscanCluster}`,
      solanafm: `https://solana.fm/address/${addressOrSignature}${network === 'devnet' ? '?cluster=devnet-solana' : ''}`,
    };
  } else {
    return {
      solanaExplorer: `https://explorer.solana.com/tx/${addressOrSignature}${cluster}`,
      solscan: `https://solscan.io/tx/${addressOrSignature}${solscanCluster}`,
      solanafm: `https://solana.fm/tx/${addressOrSignature}${network === 'devnet' ? '?cluster=devnet-solana' : ''}`,
    };
  }
}

/**
 * Get comprehensive mint information from on-chain
 * @param connection - Solana connection
 * @param mintAddress - Mint public key
 * @returns Mint info or null if not found
 */
export async function getMintInfo(connection: Connection, mintAddress: PublicKey) {
  try {
    const mintInfo = await getMint(
      connection,
      mintAddress,
      'confirmed',
      TOKEN_2022_PROGRAM_ID
    );

    return {
      address: mintAddress.toString(),
      decimals: mintInfo.decimals,
      supply: mintInfo.supply.toString(),
      mintAuthority: mintInfo.mintAuthority?.toString() || null,
      freezeAuthority: mintInfo.freezeAuthority?.toString() || null,
      isInitialized: mintInfo.isInitialized,
      hasTransferFeeExtension: mintInfo.tlvData && mintInfo.tlvData.length > 0,
    };
  } catch (error) {
    console.error('Failed to get mint info:', error);
    return null;
  }
}

/**
 * Parse network from RPC URL
 * @param rpcUrl - Solana RPC URL
 * @returns Network identifier
 */
export function parseNetworkFromRpcUrl(rpcUrl: string): 'devnet' | 'mainnet-beta' | 'testnet' | 'unknown' {
  if (rpcUrl.includes('mainnet')) {
    return 'mainnet-beta';
  } else if (rpcUrl.includes('devnet')) {
    return 'devnet';
  } else if (rpcUrl.includes('testnet')) {
    return 'testnet';
  } else {
    return 'unknown';
  }
}

/**
 * Format token amount from base units to human-readable
 * @param baseUnits - Amount in base units (lamports)
 * @param decimals - Token decimals
 * @returns Human-readable token amount
 */
export function formatTokenAmount(baseUnits: string | bigint, decimals: number): string {
  const amount = typeof baseUnits === 'string' ? BigInt(baseUnits) : baseUnits;
  const divisor = BigInt(10 ** decimals);
  const tokens = amount / divisor;
  const remainder = amount % divisor;
  
  if (remainder === BigInt(0)) {
    return tokens.toString();
  }
  
  const fractional = remainder.toString().padStart(decimals, '0');
  return `${tokens}.${fractional}`.replace(/\.?0+$/, '');
}

/**
 * Validate token deployment configuration
 * @param config - Token deployment configuration
 * @returns Validation result with errors if any
 */
export function validateTokenConfig(config: {
  tokenName: string;
  tokenSymbol: string;
  decimals: number;
  maxSupply: string;
  burnRateBasisPoints: number;
  maxBurnRateBasisPoints: number;
  initialMintAmount?: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate token name
  if (!config.tokenName || config.tokenName.trim().length === 0) {
    errors.push('Token name is required');
  } else if (config.tokenName.length > 32) {
    errors.push('Token name must be 32 characters or less');
  }

  // Validate token symbol
  if (!config.tokenSymbol || config.tokenSymbol.trim().length === 0) {
    errors.push('Token symbol is required');
  } else if (config.tokenSymbol.length > 10) {
    errors.push('Token symbol must be 10 characters or less');
  }

  // Validate decimals
  if (config.decimals < 0 || config.decimals > 9) {
    errors.push('Decimals must be between 0 and 9');
  }

  // Validate max supply
  try {
    const maxSupply = BigInt(config.maxSupply);
    if (maxSupply <= BigInt(0)) {
      errors.push('Max supply must be greater than 0');
    }
  } catch {
    errors.push('Max supply must be a valid number');
  }

  // Validate burn rates
  if (config.burnRateBasisPoints < 0 || config.burnRateBasisPoints > 10000) {
    errors.push('Burn rate must be between 0 and 10000 basis points');
  }

  if (config.maxBurnRateBasisPoints < 0 || config.maxBurnRateBasisPoints > 10000) {
    errors.push('Max burn rate must be between 0 and 10000 basis points');
  }

  if (config.burnRateBasisPoints > config.maxBurnRateBasisPoints) {
    errors.push('Burn rate cannot exceed max burn rate');
  }

  // Validate initial mint amount (if provided)
  if (config.initialMintAmount) {
    try {
      const initialMint = BigInt(config.initialMintAmount);
      const maxSupply = BigInt(config.maxSupply);
      
      if (initialMint < BigInt(0)) {
        errors.push('Initial mint amount cannot be negative');
      }
      
      if (initialMint > maxSupply) {
        errors.push('Initial mint amount cannot exceed max supply');
      }
    } catch {
      errors.push('Initial mint amount must be a valid number');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate rent exemption for a mint account with extensions
 * @param connection - Solana connection
 * @param accountSize - Size of the account in bytes
 * @returns Rent exemption amount in lamports
 */
export async function calculateRentExemption(
  connection: Connection,
  accountSize: number
): Promise<number> {
  try {
    return await connection.getMinimumBalanceForRentExemption(accountSize);
  } catch (error) {
    console.error('Failed to calculate rent exemption:', error);
    throw error;
  }
}

/**
 * Wait for transaction confirmation with timeout
 * @param connection - Solana connection
 * @param signature - Transaction signature
 * @param timeoutMs - Timeout in milliseconds (default: 60000)
 * @returns true if confirmed, false if timeout
 */
export async function waitForConfirmation(
  connection: Connection,
  signature: string,
  timeoutMs: number = 60000
): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const status = await connection.getSignatureStatus(signature);
      
      if (status?.value?.confirmationStatus === 'confirmed' || 
          status?.value?.confirmationStatus === 'finalized') {
        return true;
      }
      
      if (status?.value?.err) {
        return false;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Error checking confirmation status:', error);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return false;
}
