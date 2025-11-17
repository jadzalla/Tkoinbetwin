import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID, getAccount, burnChecked, getMint } from '@solana/spl-token';
import { db } from '../db';
import { burnConfig, burnProposals, burnHistory, tokenConfig, auditLogs } from '@shared/schema';
import type { BurnConfig, InsertBurnProposal, BurnProposal, InsertBurnHistory } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { baseUnitsToTokens, tokensToBaseUnits } from '@shared/token-utils';
import { TOKEN_DECIMALS } from '@shared/token-constants';

/**
 * Burn Proposal Service - Manual burn approval workflow for maximum safety
 * 
 * This service implements a manual approval workflow for token burns,
 * separate from the automated burn service. Provides:
 * - Network safety (devnet-first approach)
 * - Multiple approval gates
 * - Configurable safety limits
 * - Complete audit trail
 * - On-chain verification
 */
export class BurnProposalService {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Get or create burn configuration
   */
  async getConfig(): Promise<BurnConfig> {
    const configs = await db.select().from(burnConfig).limit(1);

    if (configs.length > 0) {
      return configs[0];
    }

    const [newConfig] = await db.insert(burnConfig).values({
      enabled: false,
      network: "devnet",
      burnRatePercentage: "1.00",
      minBurnAmount: "1000000000",
      maxBurnAmount: "100000000000000",
      maxTreasuryBurnPercentage: "5.00",
      cooldownPeriodHours: 24,
      requiresApproval: true,
    }).returning();

    return newConfig;
  }

  /**
   * Update burn configuration (admin only)
   */
  async updateConfig(updates: Partial<BurnConfig>, updatedBy: string): Promise<BurnConfig> {
    const config = await this.getConfig();

    const [updated] = await db.update(burnConfig)
      .set({
        ...updates,
        updatedAt: new Date(),
        updatedBy,
      })
      .where(eq(burnConfig.id, config.id))
      .returning();

    return updated;
  }

  /**
   * Calculate proposed burn amount based on treasury balance
   */
  async calculateProposedBurn(treasuryWallet: string): Promise<{
    proposedAmount: string;
    treasuryBalance: string;
    burnPercentage: string;
    withinLimits: boolean;
    reasons: string[];
  }> {
    const config = await this.getConfig();
    const reasons: string[] = [];

    if (!config.enabled) {
      reasons.push("Burn proposal service is disabled");
      return {
        proposedAmount: "0",
        treasuryBalance: "0",
        burnPercentage: "0",
        withinLimits: false,
        reasons,
      };
    }

    const tokenConfigs = await db.select().from(tokenConfig).limit(1);
    if (!tokenConfigs[0]?.mintAddress) {
      reasons.push("Token not deployed");
      return {
        proposedAmount: "0",
        treasuryBalance: "0",
        burnPercentage: "0",
        withinLimits: false,
        reasons,
      };
    }

    const mintAddress = new PublicKey(tokenConfigs[0].mintAddress);
    const treasuryAddress = new PublicKey(treasuryWallet);

    try {
      const treasuryAccount = await getAccount(
        this.connection,
        treasuryAddress,
        undefined,
        TOKEN_2022_PROGRAM_ID
      );

      const treasuryBalanceBaseUnits = treasuryAccount.amount.toString();
      const treasuryBalanceTokens = parseFloat(baseUnitsToTokens(treasuryBalanceBaseUnits));

      const burnRate = parseFloat(config.burnRatePercentage);
      const proposedBurnTokens = treasuryBalanceTokens * (burnRate / 100);
      const proposedBurnBaseUnits = tokensToBaseUnits(proposedBurnTokens.toString(), TOKEN_DECIMALS);

      const minBurn = BigInt(config.minBurnAmount);
      const maxBurn = BigInt(config.maxBurnAmount);
      const proposedBurnBigInt = BigInt(proposedBurnBaseUnits);

      const maxTreasuryBurnPercent = parseFloat(config.maxTreasuryBurnPercentage);
      const maxAllowedBurn = treasuryBalanceTokens * (maxTreasuryBurnPercent / 100);
      const maxAllowedBurnBaseUnits = BigInt(tokensToBaseUnits(maxAllowedBurn.toString(), TOKEN_DECIMALS));

      let withinLimits = true;

      if (proposedBurnBigInt < minBurn) {
        withinLimits = false;
        reasons.push(`Proposed burn (${baseUnitsToTokens(proposedBurnBaseUnits)} TKOIN) is below minimum (${baseUnitsToTokens(config.minBurnAmount)} TKOIN)`);
      }

      if (proposedBurnBigInt > maxBurn) {
        withinLimits = false;
        reasons.push(`Proposed burn (${baseUnitsToTokens(proposedBurnBaseUnits)} TKOIN) exceeds maximum (${baseUnitsToTokens(config.maxBurnAmount)} TKOIN)`);
      }

      if (proposedBurnBigInt > maxAllowedBurnBaseUnits) {
        withinLimits = false;
        reasons.push(`Proposed burn (${proposedBurnTokens.toFixed(2)} TKOIN) exceeds ${maxTreasuryBurnPercent}% of treasury`);
      }

      const lastProposals = await db.select()
        .from(burnProposals)
        .where(eq(burnProposals.status, "executed"))
        .orderBy(desc(burnProposals.executedAt))
        .limit(1);

      if (lastProposals.length > 0 && lastProposals[0].executedAt) {
        const hoursSinceLastBurn = (Date.now() - lastProposals[0].executedAt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastBurn < config.cooldownPeriodHours) {
          withinLimits = false;
          reasons.push(`Cooldown period not met (${hoursSinceLastBurn.toFixed(1)}h / ${config.cooldownPeriodHours}h)`);
        }
      }

      return {
        proposedAmount: proposedBurnBaseUnits,
        treasuryBalance: treasuryBalanceBaseUnits,
        burnPercentage: burnRate.toString(),
        withinLimits,
        reasons: withinLimits ? ["All safety checks passed"] : reasons,
      };
    } catch (error: any) {
      reasons.push(`Failed to fetch treasury balance: ${error.message}`);
      return {
        proposedAmount: "0",
        treasuryBalance: "0",
        burnPercentage: "0",
        withinLimits: false,
        reasons,
      };
    }
  }

  /**
   * Create burn proposal
   */
  async createProposal(
    proposedBy: string,
    reason: string,
    treasuryWallet: string
  ): Promise<BurnProposal> {
    const calculation = await this.calculateProposedBurn(treasuryWallet);

    if (!calculation.withinLimits) {
      throw new Error(`Burn proposal violates safety limits: ${calculation.reasons.join(", ")}`);
    }

    const [proposal] = await db.insert(burnProposals).values({
      proposedAmount: calculation.proposedAmount,
      treasuryBalanceAtProposal: calculation.treasuryBalance,
      burnPercentageOfTreasury: calculation.burnPercentage,
      harvestedFeesAmount: "0",
      reason,
      proposedBy,
      status: "pending",
    }).returning();

    await db.insert(auditLogs).values({
      eventType: 'burn_proposal_created',
      entityType: 'burn_proposal',
      entityId: proposal.id,
      actorType: 'admin',
      actorId: proposedBy,
      metadata: {
        proposedAmount: baseUnitsToTokens(calculation.proposedAmount),
        treasuryBalance: baseUnitsToTokens(calculation.treasuryBalance),
        reason,
      },
    });

    return proposal;
  }

  /**
   * Get all proposals with optional filter
   */
  async getProposals(status?: string): Promise<BurnProposal[]> {
    let query = db.select().from(burnProposals);

    if (status) {
      query = query.where(eq(burnProposals.status, status)) as any;
    }

    return await query.orderBy(desc(burnProposals.createdAt));
  }

  /**
   * Get proposal by ID
   */
  async getProposalById(id: string): Promise<BurnProposal | null> {
    const [proposal] = await db.select()
      .from(burnProposals)
      .where(eq(burnProposals.id, id));

    return proposal || null;
  }

  /**
   * Approve burn proposal
   */
  async approveProposal(proposalId: string, approvedBy: string): Promise<BurnProposal> {
    const [proposal] = await db.update(burnProposals)
      .set({
        status: "approved",
        approvedAt: new Date(),
        approvedBy,
      })
      .where(eq(burnProposals.id, proposalId))
      .returning();

    if (!proposal) {
      throw new Error("Proposal not found");
    }

    await db.insert(auditLogs).values({
      eventType: 'burn_proposal_approved',
      entityType: 'burn_proposal',
      entityId: proposal.id,
      actorType: 'admin',
      actorId: approvedBy,
      metadata: {
        proposedAmount: baseUnitsToTokens(proposal.proposedAmount),
      },
    });

    return proposal;
  }

  /**
   * Reject burn proposal
   */
  async rejectProposal(
    proposalId: string,
    rejectedBy: string,
    rejectionReason: string
  ): Promise<BurnProposal> {
    const [proposal] = await db.update(burnProposals)
      .set({
        status: "rejected",
        rejectedAt: new Date(),
        rejectedBy,
        rejectionReason,
      })
      .where(eq(burnProposals.id, proposalId))
      .returning();

    if (!proposal) {
      throw new Error("Proposal not found");
    }

    await db.insert(auditLogs).values({
      eventType: 'burn_proposal_rejected',
      entityType: 'burn_proposal',
      entityId: proposal.id,
      actorType: 'admin',
      actorId: rejectedBy,
      metadata: {
        rejectionReason,
      },
    });

    return proposal;
  }

  /**
   * Get burn history
   */
  async getBurnHistory(limit: number = 50): Promise<any[]> {
    const history = await db.select()
      .from(burnHistory)
      .orderBy(desc(burnHistory.executedAt))
      .limit(limit);

    return history.map(h => ({
      ...h,
      burnedAmountTokens: baseUnitsToTokens(h.burnedAmount),
      treasuryBalanceBeforeTokens: baseUnitsToTokens(h.treasuryBalanceBefore),
      treasuryBalanceAfterTokens: baseUnitsToTokens(h.treasuryBalanceAfter),
    }));
  }

  /**
   * Get burn statistics
   */
  async getBurnStats(): Promise<{
    totalBurned: string;
    totalBurns: number;
    averageBurnAmount: string;
    lastBurnDate: Date | null;
  }> {
    const history = await db.select().from(burnHistory);

    const totalBurnedBaseUnits = history.reduce((sum, h) => {
      return sum + BigInt(h.burnedAmount);
    }, BigInt(0));

    const averageBurnBaseUnits = history.length > 0
      ? totalBurnedBaseUnits / BigInt(history.length)
      : BigInt(0);

    return {
      totalBurned: baseUnitsToTokens(totalBurnedBaseUnits.toString()),
      totalBurns: history.length,
      averageBurnAmount: baseUnitsToTokens(averageBurnBaseUnits.toString()),
      lastBurnDate: history.length > 0 ? history[0].executedAt : null,
    };
  }
}
