import { db } from "../db";
import { agents, agentStakes, users, tokenConfig } from "@shared/schema";
import { eq, or } from "drizzle-orm";
import { PublicKey } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddress } from "@solana/spl-token";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { baseUnitsToTokens } from "@shared/token-utils";
import { solanaCore } from "../solana/solana-core";

const MINIMUM_STAKE_REQUIREMENT = 10000; // 10,000 TKOIN for Basic tier

interface PermissionlessRegistrationData {
  walletAddress: string;
  signature: string;
  message: string;
  replitUserId: string;
  email: string;
  username: string;
}

export class PermissionlessRegistrationService {
  /**
   * Register a new agent via permissionless path
   * Returns status object for graceful error handling
   * 
   * Requirements:
   * - Valid wallet signature
   * - Minimum 10,000 TKOIN staked on-chain
   * - No existing agent with same wallet or Replit user
   */
  async registerAgent(data: PermissionlessRegistrationData): Promise<{
    success: boolean;
    agent?: any;
    message?: string;
    error?: string;
    blockchainAvailable?: boolean;
  }> {
    try {
      // 1. Verify wallet signature
      const isValid = await this.verifyWalletSignature(
        data.walletAddress,
        data.message,
        data.signature
      );
      
      if (!isValid) {
        return {
          success: false,
          error: "Invalid wallet signature. Please sign the message with your wallet.",
          blockchainAvailable: true // Signature check doesn't require blockchain
        };
      }

      // 2. Check for existing agent
      const duplicateError = await this.checkDuplicatesStatus(data.walletAddress, data.replitUserId);
      if (duplicateError) {
        return {
          success: false,
          error: duplicateError,
          blockchainAvailable: true // Duplicate check doesn't require blockchain
        };
      }

      // 3. Verify on-chain TKOIN balance (real-time blockchain verification)
      const balanceResult = await this.getOnChainTokenBalance(data.walletAddress);
      
      if (!balanceResult.success) {
        return {
          success: false,
          error: balanceResult.reason || "Failed to verify on-chain balance",
          blockchainAvailable: false
        };
      }
      
      if (balanceResult.balance < MINIMUM_STAKE_REQUIREMENT) {
        return {
          success: false,
          error: `Insufficient stake balance. You need at least ${MINIMUM_STAKE_REQUIREMENT.toLocaleString()} TKOIN in your wallet. Current balance: ${balanceResult.balance.toLocaleString()} TKOIN`,
          blockchainAvailable: true
        };
      }

      // 4. Create agent account
      try {
        const agent = await this.createAgentAccount({
          ...data,
          stakeBalance: balanceResult.balance,
        });

        return {
          success: true,
          agent,
          message: "Agent account created successfully via permissionless registration",
          blockchainAvailable: true
        };
      } catch (createError) {
        // Handle agent creation errors gracefully
        const errorMessage = createError instanceof Error 
          ? createError.message 
          : "Failed to create agent account";
        
        return {
          success: false,
          error: errorMessage,
          blockchainAvailable: true // Blockchain was available, creation failed for other reason
        };
      }
    } catch (error) {
      console.error("Permissionless registration error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Registration failed. Please try again.",
        blockchainAvailable: true // Default to true for unexpected errors
      };
    }
  }

  /**
   * Verify wallet signature using Solana's nacl signing
   */
  private async verifyWalletSignature(
    walletAddress: string,
    message: string,
    signatureBase58: string
  ): Promise<boolean> {
    try {
      // Decode the wallet public key
      const publicKey = new PublicKey(walletAddress);
      
      // Decode the signature from base58
      const signatureUint8 = bs58.decode(signatureBase58);
      
      // Encode message as Uint8Array
      const messageUint8 = new TextEncoder().encode(message);
      
      // Verify signature
      const verified = nacl.sign.detached.verify(
        messageUint8,
        signatureUint8,
        publicKey.toBytes()
      );
      
      return verified;
    } catch (error) {
      console.error("Wallet signature verification error:", error);
      return false;
    }
  }

  /**
   * Check for duplicate wallet or Replit user registrations (status version)
   * Returns error message if duplicate found, null otherwise
   */
  private async checkDuplicatesStatus(walletAddress: string, replitUserId: string): Promise<string | null> {
    const existingAgents = await db
      .select()
      .from(agents)
      .where(
        or(
          eq(agents.solanaWallet, walletAddress),
          eq(agents.replitUserId, replitUserId)
        )
      );

    if (existingAgents.length > 0) {
      const byWallet = existingAgents.find((a: any) => a.solanaWallet === walletAddress);
      const byReplit = existingAgents.find((a: any) => a.replitUserId === replitUserId);
      
      if (byWallet) {
        return "This wallet address is already registered as an agent.";
      }
      if (byReplit) {
        return "You already have an agent account.";
      }
    }
    
    return null;
  }

  /**
   * Get TKOIN token balance from Solana blockchain (real-time on-chain verification)
   * Returns status object to handle unconfigured/unavailable blockchain gracefully
   * 
   * @param walletAddress - Solana wallet public key
   * @returns Status object with balance and availability info
   */
  private async getOnChainTokenBalance(walletAddress: string): Promise<{
    success: boolean;
    balance: number;
    reason?: string;
  }> {
    try {
      // 0. Check if Solana services are configured
      if (!solanaCore.isReady()) {
        return {
          success: false,
          balance: 0,
          reason: "Blockchain services not configured. Permissionless registration requires on-chain verification. Please use the permissioned application path or contact the administrator."
        };
      }

      // 1. Get TKOIN mint address from database
      const [config] = await db.select().from(tokenConfig).limit(1);
      
      if (!config || !config.mintAddress) {
        return {
          success: false,
          balance: 0,
          reason: "TKOIN token not deployed yet. Please wait for token deployment or use the permissioned application path."
        };
      }

      const mintPublicKey = new PublicKey(config.mintAddress);
      const walletPublicKey = new PublicKey(walletAddress);

      // 2. Get associated token account address
      const connection = solanaCore.getConnection();
      const associatedTokenAccount = await getAssociatedTokenAddress(
        mintPublicKey,
        walletPublicKey
      );

      // 3. Query on-chain token account balance
      try {
        const tokenAccount = await getAccount(connection, associatedTokenAccount);
        
        // Convert lamports to tokens
        const balanceStr = tokenAccount.amount.toString();
        const tokensStr = baseUnitsToTokens(balanceStr);
        const balance = parseFloat(tokensStr);
        
        return {
          success: true,
          balance,
        };
      } catch (error) {
        // Token account doesn't exist = no tokens
        if (error instanceof Error && error.message.includes("could not find account")) {
          return {
            success: true,
            balance: 0,
          };
        }
        throw error;
      }
    } catch (error) {
      console.error("Error querying on-chain token balance:", error);
      
      return {
        success: false,
        balance: 0,
        reason: error instanceof Error 
          ? `Failed to verify on-chain balance: ${error.message}`
          : "Failed to verify on-chain token balance. Please try again later."
      };
    }
  }

  /**
   * Create agent account with Basic tier defaults
   */
  private async createAgentAccount(data: {
    walletAddress: string;
    signature: string;
    message: string;
    replitUserId: string;
    email: string;
    username: string;
    stakeBalance: number;
  }) {
    return await db.transaction(async (tx: any) => {
      // 1. Ensure user exists and update role to 'agent'
      const [existingUser] = await tx
        .select()
        .from(users)
        .where(eq(users.id, data.replitUserId));

      if (!existingUser) {
        throw new Error("User account not found. Please ensure you are logged in.");
      }

      // Update user role to agent
      await tx
        .update(users)
        .set({ role: "agent" })
        .where(eq(users.id, data.replitUserId));

      // 2. Create agent account
      const [newAgent] = await tx
        .insert(agents)
        .values({
          replitUserId: data.replitUserId,
          email: data.email,
          username: data.username,
          solanaWallet: data.walletAddress,
          walletSignature: data.signature,
          registrationType: "permissionless",
          verificationTier: "basic",
          status: "active", // Instant activation for permissionless
          
          // Basic tier defaults
          dailyLimit: "10000",
          monthlyLimit: "100000",
          markup: "0.5",
          
          // Display info
          displayName: data.username,
          
          // Set approval timestamp since instant
          approvedAt: new Date(),
          approvedBy: "system:permissionless",
        })
        .returning();

      return newAgent;
    });
  }

  /**
   * Get registration eligibility status for a wallet
   */
  async checkEligibility(walletAddress: string, replitUserId: string) {
    try {
      // Check duplicates
      const existingAgents = await db
        .select()
        .from(agents)
        .where(
          or(
            eq(agents.solanaWallet, walletAddress),
            eq(agents.replitUserId, replitUserId)
          )
        );

      if (existingAgents.length > 0) {
        return {
          eligible: false,
          reason: "Already registered as an agent",
          stakeBalance: 0,
          minimumRequired: MINIMUM_STAKE_REQUIREMENT,
          blockchainAvailable: true, // Duplicate check doesn't require blockchain
        };
      }

      // Check on-chain token balance
      const balanceResult = await this.getOnChainTokenBalance(walletAddress);
      
      // If blockchain unavailable, return clear status
      if (!balanceResult.success) {
        return {
          eligible: false,
          reason: balanceResult.reason || "Blockchain verification unavailable",
          stakeBalance: 0,
          minimumRequired: MINIMUM_STAKE_REQUIREMENT,
          blockchainAvailable: false,
        };
      }
      
      const eligible = balanceResult.balance >= MINIMUM_STAKE_REQUIREMENT;

      return {
        eligible,
        reason: eligible 
          ? "Eligible for permissionless registration" 
          : `Insufficient stake. Need ${MINIMUM_STAKE_REQUIREMENT.toLocaleString()} TKOIN, have ${balanceResult.balance.toLocaleString()} TKOIN`,
        stakeBalance: balanceResult.balance,
        minimumRequired: MINIMUM_STAKE_REQUIREMENT,
        blockchainAvailable: true,
      };
    } catch (error) {
      console.error("Error checking eligibility:", error);
      return {
        eligible: false,
        reason: error instanceof Error ? error.message : "Error checking eligibility",
        stakeBalance: 0,
        minimumRequired: MINIMUM_STAKE_REQUIREMENT,
        blockchainAvailable: false,
      };
    }
  }
}

export const permissionlessRegistrationService = new PermissionlessRegistrationService();
