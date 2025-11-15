import { db } from "../db";
import { 
  slashingEvents, 
  agentStakes, 
  stakeHistory,
  agents,
  type InsertSlashingEvent,
  type SlashingEvent 
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { SLASHING_PENALTIES, calculateTier, getTierLimits } from "@shared/staking-constants";
import { baseUnitsToTokens, tokensToBaseUnits } from "@shared/token-utils";
import { TOKEN_DECIMALS } from "@shared/token-constants";

/**
 * SlashingService
 * 
 * Handles agent stake slashing for violations:
 * - Creates slashing events (pending review)
 * - Executes slashes (reduces stake, updates tier)
 * - Reverses slashes (if needed)
 * - Tracks all slashing history
 */
export class SlashingService {
  /**
   * Create a pending slashing event for admin review
   */
  static async createSlashingEvent(params: {
    agentId: string;
    violationType: string;
    severity: 'minor' | 'major' | 'critical';
    description: string;
    evidenceUrl?: string;
    createdBy: string;
  }): Promise<SlashingEvent> {
    const { agentId, violationType, severity, description, evidenceUrl, createdBy } = params;

    return await db.transaction(async (tx) => {
      // Get current stake
      const currentStake = await tx
        .select()
        .from(agentStakes)
        .where(eq(agentStakes.agentId, agentId))
        .then(rows => rows[0]);

      if (!currentStake) {
        throw new Error("Agent has no active stake");
      }

      // Calculate slash percentage based on severity
      const slashPercentage = SLASHING_PENALTIES[severity];
      
      // Calculate slashed amount
      const stakedAmountBigInt = BigInt(currentStake.stakedAmount);
      const slashedAmountBigInt = (stakedAmountBigInt * BigInt(slashPercentage)) / BigInt(100);
      const remainingStakeBigInt = stakedAmountBigInt - slashedAmountBigInt;

      // Create slashing event
      const [slashingEvent] = await tx.insert(slashingEvents).values({
        agentId,
        stakeId: currentStake.id,
        violationType,
        severity,
        description,
        evidenceUrl,
        slashPercentage: slashPercentage.toString(),
        slashedAmount: slashedAmountBigInt.toString(),
        remainingStake: remainingStakeBigInt.toString(),
        slashedTokensDestination: 'treasury',
        status: 'pending',
        createdBy,
      }).returning();

      return slashingEvent;
    });
  }

  /**
   * Execute a pending slash (admin approval)
   */
  static async executeSlash(params: {
    slashingEventId: string;
    executedBy: string;
  }): Promise<{ slashingEvent: SlashingEvent; newTier: string }> {
    const { slashingEventId, executedBy } = params;

    return await db.transaction(async (tx) => {
      // Get slashing event
      const slashingEvent = await tx
        .select()
        .from(slashingEvents)
        .where(eq(slashingEvents.id, slashingEventId))
        .then(rows => rows[0]);

      if (!slashingEvent) {
        throw new Error("Slashing event not found");
      }

      if (slashingEvent.status !== 'pending') {
        throw new Error(`Cannot execute slash with status: ${slashingEvent.status}`);
      }

      // Get current stake
      const currentStake = await tx
        .select()
        .from(agentStakes)
        .where(eq(agentStakes.id, slashingEvent.stakeId))
        .then(rows => rows[0]);

      if (!currentStake) {
        throw new Error("Stake not found");
      }

      // Calculate new values
      const previousStakeBigInt = BigInt(currentStake.stakedAmount);
      const slashedAmountBigInt = BigInt(slashingEvent.slashedAmount);
      const newStakeBigInt = previousStakeBigInt - slashedAmountBigInt;

      if (newStakeBigInt < BigInt(0)) {
        throw new Error("Slash amount exceeds current stake");
      }

      // Calculate new tier
      const newStakeTokens = parseFloat(baseUnitsToTokens(newStakeBigInt.toString(), TOKEN_DECIMALS));
      const previousTier = currentStake.currentTier;
      const newTier = calculateTier(newStakeTokens);
      const tierLimits = getTierLimits(newTier);

      // Update stake record
      await tx.update(agentStakes)
        .set({
          stakedAmount: newStakeBigInt.toString(),
          currentTier: newTier,
          updatedAt: new Date(),
        })
        .where(eq(agentStakes.id, currentStake.id));

      // Update agent limits if tier changed
      if (previousTier !== newTier) {
        await tx.update(agents)
          .set({
            verificationTier: newTier,
            dailyLimit: tierLimits.dailyLimit.toString(),
            monthlyLimit: tierLimits.monthlyLimit.toString(),
          })
          .where(eq(agents.id, slashingEvent.agentId));
      }

      // Record in stake history
      await tx.insert(stakeHistory).values({
        agentId: slashingEvent.agentId,
        stakeId: currentStake.id,
        operationType: 'slash',
        amount: slashedAmountBigInt.toString(),
        previousBalance: previousStakeBigInt.toString(),
        newBalance: newStakeBigInt.toString(),
        previousTier,
        newTier,
        notes: `Slashed for ${slashingEvent.violationType}: ${slashingEvent.description}`,
      });

      // Mark slashing event as executed
      const [updatedSlashing] = await tx.update(slashingEvents)
        .set({
          status: 'executed',
          executedAt: new Date(),
          executedBy,
        })
        .where(eq(slashingEvents.id, slashingEventId))
        .returning();

      return { slashingEvent: updatedSlashing, newTier };
    });
  }

  /**
   * Reverse a slashing event (restore stake)
   */
  static async reverseSlash(params: {
    slashingEventId: string;
    reversalReason: string;
    executedBy: string;
  }): Promise<SlashingEvent> {
    const { slashingEventId, reversalReason, executedBy } = params;

    return await db.transaction(async (tx) => {
      // Get slashing event
      const slashingEvent = await tx
        .select()
        .from(slashingEvents)
        .where(eq(slashingEvents.id, slashingEventId))
        .then(rows => rows[0]);

      if (!slashingEvent) {
        throw new Error("Slashing event not found");
      }

      if (slashingEvent.status !== 'executed') {
        throw new Error(`Cannot reverse slash with status: ${slashingEvent.status}`);
      }

      // Get current stake
      const currentStake = await tx
        .select()
        .from(agentStakes)
        .where(eq(agentStakes.id, slashingEvent.stakeId))
        .then(rows => rows[0]);

      if (!currentStake) {
        throw new Error("Stake not found");
      }

      // Restore slashed amount
      const currentStakeBigInt = BigInt(currentStake.stakedAmount);
      const slashedAmountBigInt = BigInt(slashingEvent.slashedAmount);
      const restoredStakeBigInt = currentStakeBigInt + slashedAmountBigInt;

      // Calculate new tier after restoration
      const restoredStakeTokens = parseFloat(baseUnitsToTokens(restoredStakeBigInt.toString(), TOKEN_DECIMALS));
      const previousTier = currentStake.currentTier;
      const newTier = calculateTier(restoredStakeTokens);
      const tierLimits = getTierLimits(newTier);

      // Update stake record
      await tx.update(agentStakes)
        .set({
          stakedAmount: restoredStakeBigInt.toString(),
          currentTier: newTier,
          updatedAt: new Date(),
        })
        .where(eq(agentStakes.id, currentStake.id));

      // Update agent limits if tier changed
      if (previousTier !== newTier) {
        await tx.update(agents)
          .set({
            verificationTier: newTier,
            dailyLimit: tierLimits.dailyLimit.toString(),
            monthlyLimit: tierLimits.monthlyLimit.toString(),
          })
          .where(eq(agents.id, slashingEvent.agentId));
      }

      // Record in stake history
      await tx.insert(stakeHistory).values({
        agentId: slashingEvent.agentId,
        stakeId: currentStake.id,
        operationType: 'slash',
        amount: slashedAmountBigInt.toString(),
        previousBalance: currentStakeBigInt.toString(),
        newBalance: restoredStakeBigInt.toString(),
        previousTier,
        newTier,
        notes: `Slash reversed: ${reversalReason}`,
      });

      // Mark slashing event as reversed
      const [updatedSlashing] = await tx.update(slashingEvents)
        .set({
          status: 'reversed',
          reversalReason,
          executedBy,
        })
        .where(eq(slashingEvents.id, slashingEventId))
        .returning();

      return updatedSlashing;
    });
  }

  /**
   * Get slashing events for an agent
   */
  static async getAgentSlashingHistory(agentId: string): Promise<SlashingEvent[]> {
    return await db
      .select()
      .from(slashingEvents)
      .where(eq(slashingEvents.agentId, agentId))
      .orderBy(desc(slashingEvents.createdAt));
  }

  /**
   * Get all pending slashing events (admin review queue)
   */
  static async getPendingSlashes(): Promise<Array<SlashingEvent & { agentEmail: string; agentName: string }>> {
    const results = await db
      .select({
        slashingEvent: slashingEvents,
        agent: agents,
      })
      .from(slashingEvents)
      .leftJoin(agents, eq(slashingEvents.agentId, agents.id))
      .where(eq(slashingEvents.status, 'pending'))
      .orderBy(desc(slashingEvents.createdAt));

    return results.map(r => ({
      ...r.slashingEvent,
      agentEmail: r.agent?.email || '',
      agentName: r.agent?.displayName || '',
    }));
  }

  /**
   * Get all slashing events (admin history)
   */
  static async getAllSlashingEvents(limit = 100): Promise<Array<SlashingEvent & { agentEmail: string; agentName: string }>> {
    const results = await db
      .select({
        slashingEvent: slashingEvents,
        agent: agents,
      })
      .from(slashingEvents)
      .leftJoin(agents, eq(slashingEvents.agentId, agents.id))
      .orderBy(desc(slashingEvents.createdAt))
      .limit(limit);

    return results.map(r => ({
      ...r.slashingEvent,
      agentEmail: r.agent?.email || '',
      agentName: r.agent?.displayName || '',
    }));
  }

  /**
   * Get a single slashing event by ID
   */
  static async getSlashingEvent(id: string): Promise<(SlashingEvent & { agentEmail: string; agentName: string }) | null> {
    const results = await db
      .select({
        slashingEvent: slashingEvents,
        agent: agents,
      })
      .from(slashingEvents)
      .leftJoin(agents, eq(slashingEvents.agentId, agents.id))
      .where(eq(slashingEvents.id, id));

    if (results.length === 0) return null;

    const r = results[0];
    return {
      ...r.slashingEvent,
      agentEmail: r.agent?.email || '',
      agentName: r.agent?.displayName || '',
    };
  }
}
