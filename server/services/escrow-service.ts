import type { IStorage } from '../storage';
import Decimal from 'decimal.js';

/**
 * TKOIN Escrow Service
 * 
 * Manages TKOIN inventory locking and unlocking for P2P orders.
 * Provides atomic operations to ensure consistent agent balances.
 */
export class EscrowService {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Lock TKOIN for a new P2P order
   * Atomically checks available balance and locks the amount using SQL-level atomicity
   * 
   * @param agentId - Agent selling TKOIN
   * @param amount - Amount of TKOIN to lock
   * @returns Success status and optional error message
   */
  async lockTkoin(agentId: string, amount: string): Promise<{
    success: boolean;
    error?: string;
    availableBalance?: string;
    requiredAmount?: string;
  }> {
    try {
      // Use atomic SQL update to prevent race conditions
      // This single UPDATE statement ensures no concurrent requests can oversell
      const result = await this.storage.lockAgentTkoin(agentId, amount);
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || "Insufficient TKOIN balance",
          availableBalance: result.availableBalance,
          requiredAmount: amount,
        };
      }

      console.log(`[Escrow] Locked ${amount} TKOIN for agent ${agentId}`);

      return { success: true };
    } catch (error) {
      console.error('[Escrow] Error locking TKOIN:', error);
      return { success: false, error: "Failed to lock TKOIN" };
    }
  }

  /**
   * Unlock TKOIN from a cancelled or expired order
   * Returns the locked TKOIN back to available balance
   * Uses atomic storage operation to prevent race conditions
   * 
   * @param agentId - Agent who had TKOIN locked
   * @param amount - Amount of TKOIN to unlock
   */
  async unlockTkoin(agentId: string, amount: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Use atomic storage operation for unlock
      const result = await this.storage.unlockAgentTkoin(agentId, amount);
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to unlock TKOIN",
        };
      }

      console.log(`[Escrow] Unlocked ${amount} TKOIN for agent ${agentId}`);

      return { success: true };
    } catch (error) {
      console.error('[Escrow] Error unlocking TKOIN:', error);
      return { success: false, error: "Failed to unlock TKOIN" };
    }
  }

  /**
   * Transfer TKOIN from agent to user on order completion
   * Deducts from agent's locked balance and total balance
   * 
   * @param agentId - Agent selling TKOIN
   * @param userId - User buying TKOIN
   * @param amount - Amount of TKOIN to transfer
   */
  async transferTkoin(agentId: string, userId: string, amount: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Use atomic storage operation for transfer
      const result = await this.storage.transferAgentTkoin(agentId, userId, amount);
      
      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to transfer TKOIN",
        };
      }

      console.log(`[Escrow] Transferred ${amount} TKOIN from agent ${agentId} to user ${userId}`);

      return { success: true };
    } catch (error) {
      console.error('[Escrow] Error transferring TKOIN:', error);
      return { success: false, error: "Failed to transfer TKOIN" };
    }
  }

  /**
   * Get agent's available TKOIN balance
   * 
   * @param agentId - Agent ID
   * @returns Available balance (total - locked)
   */
  async getAvailableBalance(agentId: string): Promise<string> {
    const agent = await this.storage.getAgent(agentId);
    if (!agent) {
      return '0';
    }

    const totalBalance = new Decimal(agent.tkoinBalance || '0');
    const lockedBalance = new Decimal(agent.lockedBalance || '0');
    return totalBalance.minus(lockedBalance).toString();
  }
}
