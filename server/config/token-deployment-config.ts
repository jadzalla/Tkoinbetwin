/**
 * TKOIN Token-2022 Deployment Configuration
 * 
 * Complete configuration for professional Token-2022 deployment with:
 * - Transfer Fee Extension (configurable burn mechanism)
 * - Metadata Extension (on-chain name, symbol, URI, logo)
 * - Initial supply minting to treasury
 * - Comprehensive authority management
 */

import { TOKEN_DECIMALS, TOKEN_MAX_SUPPLY_TOKENS, TOKEN_BURN_RATE_BP, TOKEN_MAX_BURN_RATE_BP } from '@shared/token-constants';

export interface TokenMetadataConfig {
  name: string;
  symbol: string;
  description: string;
  uri: string;
  logoURI: string;
  website?: string;
  twitter?: string;
  discord?: string;
}

export interface TokenSupplyConfig {
  maxSupply: string; // In human-readable tokens (e.g., "1000000000")
  initialMintAmount: string; // Initial amount to mint to treasury (e.g., "100000000")
  decimals: number; // Token decimals (9 for Solana standard)
}

export interface TokenFeeConfig {
  transferFeeBasisPoints: number; // 100 = 1%
  maxFeeBasisPoints: number; // Maximum allowed fee
}

export interface TokenAuthoritiesConfig {
  treasuryWallet: string; // Will be set at runtime from env
  mintAuthority?: string; // Defaults to treasury
  freezeAuthority?: string; // Defaults to treasury
  transferFeeAuthority?: string; // Defaults to treasury
  metadataUpdateAuthority?: string; // Defaults to treasury
}

export interface CompleteTokenDeploymentConfig {
  metadata: TokenMetadataConfig;
  supply: TokenSupplyConfig;
  fees: TokenFeeConfig;
  authorities: TokenAuthoritiesConfig;
  network: 'devnet' | 'mainnet-beta';
}

/**
 * Official TKOIN Token-2022 Deployment Configuration
 * 
 * This configuration will be used for deploying the production TKOIN token
 * with all Token-2022 extensions and proper metadata.
 */
export const TKOIN_DEPLOYMENT_CONFIG: CompleteTokenDeploymentConfig = {
  // Token Metadata (on-chain + off-chain)
  metadata: {
    name: "Tkoin",
    symbol: "TK",
    description: "The foundational liquidity layer for sovereign digital economies. Built on Solana Token-2022.",
    uri: "https://tkoin.finance/metadata.json", // Off-chain JSON metadata
    logoURI: "https://betwin.tkoin.finance/logo.png", // Direct logo URL
    website: "https://tkoin.finance",
    twitter: "https://twitter.com/tkoinprotocol",
    discord: "https://discord.gg/tkoin"
  },

  // Token Supply Configuration
  supply: {
    maxSupply: TOKEN_MAX_SUPPLY_TOKENS, // 1,000,000,000 tokens (1 billion)
    initialMintAmount: "100000000", // 100,000,000 tokens (100 million initial circulation)
    decimals: TOKEN_DECIMALS // 9 decimals (Solana standard)
  },

  // Transfer Fee Configuration (Burn Mechanism)
  fees: {
    transferFeeBasisPoints: TOKEN_BURN_RATE_BP, // 100 = 1% burn on transfers
    maxFeeBasisPoints: TOKEN_MAX_BURN_RATE_BP // 200 = 2% maximum fee cap
  },

  // Authority Configuration
  // All authorities default to treasury wallet for security
  // Can be updated post-deployment if needed
  authorities: {
    treasuryWallet: '', // Will be set from process.env.SOLANA_TREASURY_WALLET at runtime
    // All other authorities default to treasury wallet
    // mintAuthority: undefined,     // Defaults to treasury
    // freezeAuthority: undefined,   // Defaults to treasury
    // transferFeeAuthority: undefined, // Defaults to treasury
    // metadataUpdateAuthority: undefined // Defaults to treasury
  },

  // Deployment Network
  network: 'devnet' // Change to 'mainnet-beta' for production
};

/**
 * Get deployment configuration with runtime values (treasury wallet from env)
 * @param treasuryWallet - Treasury wallet public key from environment
 * @returns Complete deployment configuration
 */
export function getDeploymentConfig(treasuryWallet: string): CompleteTokenDeploymentConfig {
  return {
    ...TKOIN_DEPLOYMENT_CONFIG,
    authorities: {
      treasuryWallet,
      mintAuthority: treasuryWallet,
      freezeAuthority: treasuryWallet,
      transferFeeAuthority: treasuryWallet,
      metadataUpdateAuthority: treasuryWallet
    }
  };
}

/**
 * Validate deployment configuration
 * Ensures all required fields are present and valid
 */
export function validateDeploymentConfig(config: CompleteTokenDeploymentConfig): boolean {
  // Validate metadata
  if (!config.metadata.name || !config.metadata.symbol) {
    throw new Error('Token name and symbol are required');
  }

  // Validate supply
  if (!config.supply.maxSupply || BigInt(config.supply.maxSupply) <= 0) {
    throw new Error('Max supply must be greater than 0');
  }

  if (!config.supply.initialMintAmount || BigInt(config.supply.initialMintAmount) < 0) {
    throw new Error('Initial mint amount must be non-negative');
  }

  if (BigInt(config.supply.initialMintAmount) > BigInt(config.supply.maxSupply)) {
    throw new Error('Initial mint amount cannot exceed max supply');
  }

  // Validate decimals
  if (config.supply.decimals < 0 || config.supply.decimals > 9) {
    throw new Error('Decimals must be between 0 and 9');
  }

  // Validate fees
  if (config.fees.transferFeeBasisPoints < 0 || config.fees.transferFeeBasisPoints > config.fees.maxFeeBasisPoints) {
    throw new Error('Transfer fee must be between 0 and max fee');
  }

  if (config.fees.maxFeeBasisPoints > 10000) {
    throw new Error('Max fee cannot exceed 100% (10000 basis points)');
  }

  // Validate authorities
  if (!config.authorities.treasuryWallet) {
    throw new Error('Treasury wallet is required');
  }

  return true;
}

/**
 * Generate off-chain JSON metadata for the token
 * This should be hosted at the URI specified in metadata.uri
 * 
 * Format follows Token Metadata standard
 */
export function generateOffChainMetadata(config: CompleteTokenDeploymentConfig) {
  return {
    name: config.metadata.name,
    symbol: config.metadata.symbol,
    description: config.metadata.description,
    image: config.metadata.logoURI,
    external_url: config.metadata.website,
    attributes: [
      {
        trait_type: "Token Standard",
        value: "SPL Token-2022"
      },
      {
        trait_type: "Network",
        value: config.network === 'mainnet-beta' ? 'Mainnet' : 'Devnet'
      },
      {
        trait_type: "Max Supply",
        value: `${parseInt(config.supply.maxSupply).toLocaleString()} ${config.metadata.symbol}`
      },
      {
        trait_type: "Decimals",
        value: config.supply.decimals.toString()
      },
      {
        trait_type: "Transfer Fee",
        value: `${config.fees.transferFeeBasisPoints / 100}%`
      }
    ],
    properties: {
      files: [
        {
          uri: config.metadata.logoURI,
          type: "image/png"
        }
      ],
      category: "fungible",
      creators: []
    },
    links: {
      website: config.metadata.website,
      twitter: config.metadata.twitter,
      discord: config.metadata.discord
    }
  };
}
