import { Connection, PublicKey } from '@solana/web3.js';
import { db } from '../db';
import { agentStakes, stakeHistory, agents } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { 
  calculateTier,
  getTierLimits,
  TIER_THRESHOLDS,
  STAKING_PARAMS,
  AgentTier,
} from '@shared/staking-constants';
import { baseUnitsToTokens, tokensToBaseUnits } from '@shared/token-utils';
import { TOKEN_DECIMALS } from '@shared/token-constants';
import { deriveStakePDA, getStakedBalance, getAvailableBalance } from '../solana/staking-pda';

/**
 * Service for managing agent staking operations
 * 
 * Handles database tracking of stakes while preparing for
 * future on-chain staking program integration.
 */
export class StakingService {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Get or create stake record for an agent
   */
  async getOrCreateStake(agentId: string, solanaWallet: string) {
    // Check for existing stake
    const existing = await db
      .select()
      .from(agentStakes)
      .where(eq(agentStakes.agentId, agentId))
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }

    // Derive PDA for future on-chain integration
    const walletPubkey = new PublicKey(solanaWallet);
    const [stakePDA] = await deriveStakePDA(walletPubkey);

    // Create new stake record
    const [newStake] = await db
      .insert(agentStakes)
      .values({
        agentId,
        solanaWallet,
        stakedAmount: '0',
        currentTier: 'basic',
        stakePda: stakePDA.toString(),
        lockupPeriodDays: STAKING_PARAMS.lockupPeriodDays,
        status: 'active',
      })
      .returning();

    return newStake;
  }

  /**
   * Stake TKOIN tokens
   * 
   * @param agentId - Agent ID
   * @param solanaWallet - Agent's Solana wallet
   * @param amountTokens - Amount to stake in tokens (not base units)
   * @returns Updated stake record
   */
  async stake(agentId: string, solanaWallet: string, amountTokens: number) {
    // Validate minimum stake
    if (amountTokens < STAKING_PARAMS.minStakeAmount) {
      throw new Error(`Minimum stake is ${STAKING_PARAMS.minStakeAmount} TKOIN`);
    }

    // Convert to base units
    const amountBaseUnits = tokensToBaseUnits(amountTokens.toString(), TOKEN_DECIMALS);
    const amountBigInt = BigInt(amountBaseUnits);

    // Get or create stake record
    const stake = await this.getOrCreateStake(agentId, solanaWallet);
    const currentStaked = BigInt(stake.stakedAmount || '0');

    // CRITICAL: Verify on-chain balance covers ALL stakes (prevents double-counting)
    // Since we don't transfer tokens yet, we must ensure wallet has enough to cover
    // both existing stakes AND the new stake amount
    const walletPubkey = new PublicKey(solanaWallet);
    const availableBalance = await getAvailableBalance(this.connection, walletPubkey);
    const totalRequiredBalance = currentStaked + amountBigInt;
    
    if (availableBalance < totalRequiredBalance) {
      const availableTokens = baseUnitsToTokens(availableBalance.toString(), TOKEN_DECIMALS);
      const requiredTokens = baseUnitsToTokens(totalRequiredBalance.toString(), TOKEN_DECIMALS);
      const currentStakedTokens = baseUnitsToTokens(currentStaked.toString(), TOKEN_DECIMALS);
      throw new Error(
        `Insufficient balance to cover all stakes. You have ${availableTokens} TKOIN, already staked ${currentStakedTokens} TKOIN, and need ${requiredTokens} TKOIN total to stake ${amountTokens} more.`
      );
    }

    // Calculate new staked amount
    const newStaked = currentStaked + amountBigInt;
    const newStakedTokens = parseFloat(baseUnitsToTokens(newStaked.toString(), TOKEN_DECIMALS));

    // Calculate new tier
    const newTier = calculateTier(newStakedTokens);
    const previousTier = stake.currentTier as AgentTier;

    // Calculate lock-up end date
    const lockedUntil = new Date();
    lockedUntil.setDate(lockedUntil.getDate() + STAKING_PARAMS.lockupPeriodDays);

    // Use database transaction for atomicity
    return await db.transaction(async (tx) => {
      // Update stake record
      const [updatedStake] = await tx
        .update(agentStakes)
        .set({
          stakedAmount: newStaked.toString(),
          currentTier: newTier,
          lockedUntil,
          updatedAt: new Date(),
        })
        .where(eq(agentStakes.id, stake.id))
        .returning();

      // Record history
      await tx.insert(stakeHistory).values({
        agentId,
        stakeId: stake.id,
        operationType: 'stake',
        amount: amountBaseUnits,
        previousBalance: currentStaked.toString(),
        newBalance: newStaked.toString(),
        previousTier,
        newTier,
        stakePda: stake.stakePda,
        notes: `Staked ${amountTokens} TKOIN`,
      });

      // Update agent tier and limits
      const limits = getTierLimits(newTier);
      await tx
        .update(agents)
        .set({ 
          verificationTier: newTier,
          dailyLimit: limits.dailyLimit.toString(),
          monthlyLimit: limits.monthlyLimit.toString(),
          updatedAt: new Date(),
        })
        .where(eq(agents.id, agentId));

      return updatedStake;
    });
  }

  /**
   * Unstake TKOIN tokens
   * 
   * @param agentId - Agent ID
   * @param amountTokens - Amount to unstake in tokens
   * @param force - Force unstake before lock-up ends (with penalty)
   * @returns Updated stake record
   */
  async unstake(agentId: string, amountTokens: number, force: boolean = false) {
    const stake = await db
      .select()
      .from(agentStakes)
      .where(eq(agentStakes.agentId, agentId))
      .limit(1);

    if (stake.length === 0) {
      throw new Error('No stake found for this agent');
    }

    const currentStake = stake[0];
    const amountBaseUnits = BigInt(tokensToBaseUnits(amountTokens.toString(), TOKEN_DECIMALS));
    const currentStaked = BigInt(currentStake.stakedAmount || '0');

    // Validate sufficient balance
    if (amountBaseUnits > currentStaked) {
      throw new Error('Insufficient staked balance');
    }

    // Check lock-up period
    const now = new Date();
    const isLocked = currentStake.lockedUntil && currentStake.lockedUntil > now;

    if (isLocked && !force) {
      const daysRemaining = Math.ceil(
        (currentStake.lockedUntil!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      throw new Error(`Stake is locked for ${daysRemaining} more days. Use force=true to unstake with penalty.`);
    }

    // Calculate penalty if forcing early withdrawal
    let finalAmount = amountBaseUnits;
    let penalty = BigInt(0);
    if (isLocked && force) {
      penalty = (amountBaseUnits * BigInt(STAKING_PARAMS.earlyWithdrawalPenalty)) / BigInt(100);
      finalAmount = amountBaseUnits - penalty;
    }

    // Calculate new staked amount
    const newStaked = currentStaked - amountBaseUnits;
    const newStakedTokens = parseFloat(baseUnitsToTokens(newStaked.toString(), TOKEN_DECIMALS));

    // Calculate new tier
    const newTier = calculateTier(newStakedTokens);
    const previousTier = currentStake.currentTier as AgentTier;

    // Use database transaction for atomicity
    return await db.transaction(async (tx) => {
      // Update stake record
      const [updatedStake] = await tx
        .update(agentStakes)
        .set({
          stakedAmount: newStaked.toString(),
          currentTier: newTier,
          status: newStaked === BigInt(0) ? 'unstaking' : 'active',
          updatedAt: new Date(),
        })
        .where(eq(agentStakes.id, currentStake.id))
        .returning();

      // Record history
      await tx.insert(stakeHistory).values({
        agentId,
        stakeId: currentStake.id,
        operationType: 'unstake',
        amount: amountBaseUnits.toString(),
        previousBalance: currentStaked.toString(),
        newBalance: newStaked.toString(),
        previousTier,
        newTier,
        stakePda: currentStake.stakePda,
        notes: force 
          ? `Forced unstake of ${amountTokens} TKOIN with ${STAKING_PARAMS.earlyWithdrawalPenalty}% penalty (${baseUnitsToTokens(penalty.toString(), TOKEN_DECIMALS)} TKOIN)`
          : `Unstaked ${amountTokens} TKOIN`,
      });

      // Update agent tier and limits
      const limits = getTierLimits(newTier);
      await tx
        .update(agents)
        .set({ 
          verificationTier: newTier,
          dailyLimit: limits.dailyLimit.toString(),
          monthlyLimit: limits.monthlyLimit.toString(),
          updatedAt: new Date(),
        })
        .where(eq(agents.id, agentId));

      return {
        stake: updatedStake,
        penalty: penalty > 0 ? baseUnitsToTokens(penalty.toString(), TOKEN_DECIMALS) : null,
        finalAmount: baseUnitsToTokens(finalAmount.toString(), TOKEN_DECIMALS),
      };
    });
  }

  /**
   * Get stake information for an agent
   */
  async getStakeInfo(agentId: string) {
    const stake = await db
      .select()
      .from(agentStakes)
      .where(eq(agentStakes.agentId, agentId))
      .limit(1);

    if (stake.length === 0) {
      return null;
    }

    const stakeRecord = stake[0];
    const stakedTokens = parseFloat(baseUnitsToTokens(stakeRecord.stakedAmount || '0', TOKEN_DECIMALS));
    const tier = calculateTier(stakedTokens);
    const limits = getTierLimits(tier);

    // Calculate lock-up status
    const now = new Date();
    const isLocked = stakeRecord.lockedUntil && stakeRecord.lockedUntil > now;
    const daysRemaining = isLocked 
      ? Math.ceil((stakeRecord.lockedUntil!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // Calculate tokens needed for next tier
    let nextTier: AgentTier | null = null;
    let tokensNeeded = 0;

    if (tier === 'basic') {
      nextTier = 'verified';
      tokensNeeded = TIER_THRESHOLDS.verified - stakedTokens;
    } else if (tier === 'verified') {
      nextTier = 'premium';
      tokensNeeded = TIER_THRESHOLDS.premium - stakedTokens;
    }

    return {
      ...stakeRecord,
      stakedTokens,
      tier,
      limits,
      isLocked,
      daysRemaining,
      nextTier,
      tokensNeeded: Math.max(0, tokensNeeded),
    };
  }

  /**
   * Sync on-chain stake balance to database
   * 
   * For future use when staking program is deployed
   */
  async syncOnChainBalance(agentId: string, solanaWallet: string) {
    const walletPubkey = new PublicKey(solanaWallet);
    const onChainBalance = await getStakedBalance(this.connection, walletPubkey);

    const stake = await this.getOrCreateStake(agentId, solanaWallet);

    await db
      .update(agentStakes)
      .set({
        onChainBalance: onChainBalance.toString(),
        lastSyncedAt: new Date(),
      })
      .where(eq(agentStakes.id, stake.id));

    return {
      databaseBalance: stake.stakedAmount,
      onChainBalance: onChainBalance.toString(),
      inSync: stake.stakedAmount === onChainBalance.toString(),
    };
  }

  /**
   * Update agent's verification tier based on stake
   */
  private async updateAgentTier(agentId: string, tier: AgentTier) {
    const limits = getTierLimits(tier);

    await db
      .update(agents)
      .set({
        verificationTier: tier,
        dailyLimit: limits.dailyLimit.toString(),
        monthlyLimit: limits.monthlyLimit.toString(),
        updatedAt: new Date(),
      })
      .where(eq(agents.id, agentId));
  }

  /**
   * Get stake history for an agent
   */
  async getStakeHistory(agentId: string, limit: number = 50) {
    return await db
      .select()
      .from(stakeHistory)
      .where(eq(stakeHistory.agentId, agentId))
      .orderBy(stakeHistory.createdAt)
      .limit(limit);
  }
}
