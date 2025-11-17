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
   * Requirements:
   * - Valid wallet signature
   * - Minimum 10,000 TKOIN staked on-chain
   * - No existing agent with same wallet or Replit user
   */
  async registerAgent(data: PermissionlessRegistrationData) {
    // 1. Verify wallet signature
    const isValid = await this.verifyWalletSignature(
      data.walletAddress,
      data.message,
      data.signature
    );
    
    if (!isValid) {
      throw new Error("Invalid wallet signature. Please sign the message with your wallet.");
    }

    // 2. Check for existing agent
    await this.checkDuplicates(data.walletAddress, data.replitUserId);

    // 3. Verify on-chain TKOIN balance (real-time blockchain verification)
    const stakeBalance = await this.getOnChainTokenBalance(data.walletAddress);
    
    if (stakeBalance < MINIMUM_STAKE_REQUIREMENT) {
      throw new Error(
        `Insufficient stake balance. You need at least ${MINIMUM_STAKE_REQUIREMENT.toLocaleString()} TKOIN staked. Current balance: ${stakeBalance.toLocaleString()} TKOIN`
      );
    }

    // 4. Create agent account
    const agent = await this.createAgentAccount({
      ...data,
      stakeBalance,
    });

    return {
      agent,
      message: "Agent account created successfully via permissionless registration",
    };
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
   * Check for duplicate wallet or Replit user registrations
   */
  private async checkDuplicates(walletAddress: string, replitUserId: string) {
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
        throw new Error("This wallet address is already registered as an agent.");
      }
      if (byReplit) {
        throw new Error("You already have an agent account.");
      }
    }
  }

  /**
   * Get TKOIN token balance from Solana blockchain (real-time on-chain verification)
   * This queries the wallet's associated token account directly from the chain
   * 
   * @param walletAddress - Solana wallet public key
   * @returns Token balance in TKOIN (not base units)
   * @throws Error if token not deployed or RPC query fails
   */
  private async getOnChainTokenBalance(walletAddress: string): Promise<number> {
    try {
      // 0. Check if Solana services are configured
      if (!solanaCore.isReady()) {
        throw new Error(
          "Solana blockchain services are not configured. " +
          "Permissionless registration requires on-chain verification. " +
          "Please contact the administrator to enable blockchain connectivity."
        );
      }

      // 1. Get TKOIN mint address from database
      const [config] = await db.select().from(tokenConfig).limit(1);
      
      if (!config || !config.mintAddress) {
        throw new Error(
          "TKOIN token not deployed yet. Please wait for token deployment before registering as an agent."
        );
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
        
        return parseFloat(tokensStr);
      } catch (error) {
        // Token account doesn't exist = no tokens
        if (error instanceof Error && error.message.includes("could not find account")) {
          return 0;
        }
        throw error;
      }
    } catch (error) {
      console.error("Error querying on-chain token balance:", error);
      
      // Re-throw with user-friendly message
      if (error instanceof Error) {
        if (error.message.includes("not deployed")) {
          throw error; // Already user-friendly
        }
        throw new Error(
          `Failed to verify on-chain token balance: ${error.message}. ` +
          `Please ensure you have a valid Solana wallet with TKOIN tokens.`
        );
      }
      
      throw new Error("Failed to verify on-chain token balance. Please try again later.");
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
        };
      }

      // Check on-chain token balance
      const stakeBalance = await this.getOnChainTokenBalance(walletAddress);
      const eligible = stakeBalance >= MINIMUM_STAKE_REQUIREMENT;

      return {
        eligible,
        reason: eligible 
          ? "Eligible for permissionless registration" 
          : `Insufficient stake. Need ${MINIMUM_STAKE_REQUIREMENT.toLocaleString()} TKOIN, have ${stakeBalance.toLocaleString()} TKOIN`,
        stakeBalance,
        minimumRequired: MINIMUM_STAKE_REQUIREMENT,
      };
    } catch (error) {
      console.error("Error checking eligibility:", error);
      return {
        eligible: false,
        reason: "Error checking eligibility",
        stakeBalance: 0,
      };
    }
  }
}

export const permissionlessRegistrationService = new PermissionlessRegistrationService();
