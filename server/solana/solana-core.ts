import { Connection, Keypair, PublicKey, clusterApiUrl } from '@solana/web3.js';

/**
 * SolanaCore - Singleton service for Solana connection and keypair management
 * 
 * Provides:
 * - Shared connection pool to Solana RPC
 * - Cached treasury keypair for transaction signing
 * - Environment configuration
 */
export class SolanaCore {
  private static instance: SolanaCore;
  private connection: Connection;
  private treasuryKeypair: Keypair | null = null;
  private treasuryPublicKey: PublicKey | null = null;
  private isConfigured: boolean = false;

  private constructor() {
    // Initialize connection (will be updated in configure())
    this.connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): SolanaCore {
    if (!SolanaCore.instance) {
      SolanaCore.instance = new SolanaCore();
    }
    return SolanaCore.instance;
  }

  /**
   * Configure the Solana service with environment variables
   * Should be called once at application startup
   */
  public configure(): void {
    const rpcUrl = process.env.SOLANA_RPC_URL;
    const treasuryPrivateKey = process.env.SOLANA_TREASURY_PRIVATE_KEY;
    const treasuryWallet = process.env.SOLANA_TREASURY_WALLET;

    if (!rpcUrl || !treasuryPrivateKey || !treasuryWallet) {
      console.warn('⚠️  Solana services not configured (missing environment variables)');
      console.warn('   To enable blockchain monitoring and burn service:');
      console.warn('   - SOLANA_RPC_URL');
      console.warn('   - SOLANA_TREASURY_WALLET');
      console.warn('   - SOLANA_TREASURY_PRIVATE_KEY');
      this.isConfigured = false;
      return;
    }

    try {
      // Setup connection
      this.connection = new Connection(rpcUrl, 'confirmed');

      // Parse treasury keypair from private key
      // Supports multiple formats:
      // - JSON array: [1,2,3,...,64]
      // - Base58 string: "base58string..."
      // - Comma-separated: "1,2,3,...,64"
      let secretKey: number[];
      
      try {
        // Try parsing as JSON array first
        secretKey = JSON.parse(treasuryPrivateKey);
      } catch (e) {
        // If not JSON, try comma-separated or other formats
        if (treasuryPrivateKey.includes(',')) {
          // Comma-separated numbers
          secretKey = treasuryPrivateKey.split(',').map(n => parseInt(n.trim()));
        } else if (treasuryPrivateKey.startsWith('[')) {
          // Malformed JSON, try to fix
          const cleaned = treasuryPrivateKey.trim();
          secretKey = JSON.parse(cleaned);
        } else {
          throw new Error(
            'Invalid SOLANA_TREASURY_PRIVATE_KEY format. ' +
            'Expected JSON array like [1,2,3,...,64] or comma-separated numbers.'
          );
        }
      }
      
      if (!Array.isArray(secretKey) || secretKey.length !== 64) {
        throw new Error(
          `Invalid private key length. Expected 64 bytes, got ${secretKey?.length || 0}`
        );
      }
      
      this.treasuryKeypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
      
      // Verify the public key matches
      this.treasuryPublicKey = new PublicKey(treasuryWallet);
      
      if (this.treasuryKeypair.publicKey.toString() !== treasuryWallet) {
        throw new Error(
          `Treasury keypair mismatch! ` +
          `Expected: ${treasuryWallet}, ` +
          `Got: ${this.treasuryKeypair.publicKey.toString()}`
        );
      }

      this.isConfigured = true;
      console.log('✅ Solana services configured successfully');
      console.log(`   RPC: ${rpcUrl}`);
      console.log(`   Treasury: ${treasuryWallet}`);
    } catch (error) {
      console.error('❌ Failed to configure Solana services:', error);
      this.isConfigured = false;
      throw error;
    }
  }

  /**
   * Get the Solana RPC connection
   */
  public getConnection(): Connection {
    if (!this.isConfigured) {
      throw new Error('Solana services not configured. Call configure() first.');
    }
    return this.connection;
  }

  /**
   * Get the treasury keypair for signing transactions
   */
  public getTreasuryKeypair(): Keypair {
    if (!this.isConfigured || !this.treasuryKeypair) {
      throw new Error('Solana services not configured or treasury keypair not loaded');
    }
    return this.treasuryKeypair;
  }

  /**
   * Get the treasury public key
   */
  public getTreasuryPublicKey(): PublicKey {
    if (!this.isConfigured || !this.treasuryPublicKey) {
      throw new Error('Solana services not configured or treasury public key not loaded');
    }
    return this.treasuryPublicKey;
  }

  /**
   * Check if Solana services are properly configured
   */
  public isReady(): boolean {
    return this.isConfigured;
  }

  /**
   * Get current cluster endpoint
   */
  public getClusterEndpoint(): string {
    return this.connection.rpcEndpoint;
  }

  /**
   * Test connection to Solana network
   */
  public async testConnection(): Promise<{ success: boolean; slot?: number; error?: string }> {
    try {
      const slot = await this.connection.getSlot();
      return { success: true, slot };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get treasury SOL balance
   */
  public async getTreasuryBalance(): Promise<number> {
    if (!this.isConfigured || !this.treasuryPublicKey) {
      throw new Error('Solana services not configured');
    }

    const balance = await this.connection.getBalance(this.treasuryPublicKey);
    return balance / 1e9; // Convert lamports to SOL
  }
}

// Export singleton instance
export const solanaCore = SolanaCore.getInstance();
