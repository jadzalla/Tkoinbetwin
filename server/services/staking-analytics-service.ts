import { db } from "../db";
import { agentStakes, agents, slashingEvents, stakeHistory } from "@shared/schema";
import { eq, sql, desc, and, gte } from "drizzle-orm";
import { baseUnitsToTokens } from "@shared/token-utils";

/**
 * Staking Analytics Service
 * Provides comprehensive analytics for the agent staking system
 */
export class StakingAnalyticsService {
  /**
   * Get high-level staking overview metrics
   */
  static async getStakingOverview() {
    // Get total staked across all agents
    const totalStakedResult = await db
      .select({ total: sql<string>`SUM(${agentStakes.stakedAmount})` })
      .from(agentStakes);

    const totalStakedBaseUnits = BigInt(totalStakedResult[0]?.total || "0");
    const totalStakedTokens = parseFloat(baseUnitsToTokens(totalStakedBaseUnits.toString()));

    // Get active agents count
    const activeAgentsResult = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${agentStakes.agentId})` })
      .from(agentStakes)
      .innerJoin(agents, eq(agentStakes.agentId, agents.id))
      .where(eq(agents.status, 'active'));

    const activeAgents = activeAgentsResult[0]?.count || 0;

    // Get tier distribution
    const tierDistribution = await db
      .select({
        tier: agentStakes.currentTier,
        count: sql<number>`COUNT(*)`,
        totalStaked: sql<string>`SUM(${agentStakes.stakedAmount})`,
      })
      .from(agentStakes)
      .innerJoin(agents, eq(agentStakes.agentId, agents.id))
      .where(eq(agents.status, 'active'))
      .groupBy(agentStakes.currentTier);

    // Convert tier data to tokens
    const tierData = tierDistribution.map(t => ({
      tier: t.tier,
      count: t.count,
      totalStaked: parseFloat(baseUnitsToTokens(t.totalStaked)),
    }));

    // Get average stake per agent
    const avgStake = activeAgents > 0 ? totalStakedTokens / activeAgents : 0;

    return {
      totalStaked: totalStakedTokens,
      activeAgents,
      averageStake: avgStake,
      tierDistribution: tierData,
    };
  }

  /**
   * Get staking trends over time (last 30 days)
   */
  static async getStakingTrends(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get daily stake snapshots from history
    const trends = await db
      .select({
        date: sql<string>`DATE(${stakeHistory.createdAt})`,
        totalStaked: sql<string>`SUM(CAST(${stakeHistory.amount} AS BIGINT))`,
        count: sql<number>`COUNT(DISTINCT ${stakeHistory.agentId})`,
      })
      .from(stakeHistory)
      .where(and(
        gte(stakeHistory.createdAt, startDate),
        eq(stakeHistory.operationType, 'stake')
      ))
      .groupBy(sql`DATE(${stakeHistory.createdAt})`)
      .orderBy(sql`DATE(${stakeHistory.createdAt})`);

    return trends.map(t => ({
      date: t.date,
      totalStaked: parseFloat(baseUnitsToTokens(t.totalStaked)),
      activeAgents: t.count,
    }));
  }

  /**
   * Get agent health metrics (at-risk agents)
   */
  static async getAgentHealthMetrics() {
    // Get agents close to tier downgrade (within 10% of threshold)
    const atRiskAgents = await db
      .select({
        agentId: agentStakes.agentId,
        agentEmail: agents.email,
        agentName: agents.displayName,
        currentTier: agentStakes.currentTier,
        stakedAmount: agentStakes.stakedAmount,
      })
      .from(agentStakes)
      .innerJoin(agents, eq(agentStakes.agentId, agents.id))
      .where(eq(agents.status, 'active'));

    // Calculate risk for each agent
    const riskAnalysis = atRiskAgents.map(agent => {
      const stakedTokens = parseFloat(baseUnitsToTokens(agent.stakedAmount));
      let riskLevel = 'low';
      let distanceFromDowngrade = 0;

      // Basic tier (0-9,999 TKOIN)
      if (agent.currentTier === 'basic') {
        distanceFromDowngrade = stakedTokens;
        riskLevel = stakedTokens < 1000 ? 'high' : 'low';
      }
      // Verified tier (10,000-49,999 TKOIN)
      else if (agent.currentTier === 'verified') {
        distanceFromDowngrade = stakedTokens - 10000;
        if (stakedTokens < 11000) riskLevel = 'high';
        else if (stakedTokens < 12000) riskLevel = 'medium';
        else riskLevel = 'low';
      }
      // Premium tier (50,000+ TKOIN)
      else if (agent.currentTier === 'premium') {
        distanceFromDowngrade = stakedTokens - 50000;
        if (stakedTokens < 52000) riskLevel = 'high';
        else if (stakedTokens < 55000) riskLevel = 'medium';
        else riskLevel = 'low';
      }

      return {
        agentId: agent.agentId,
        agentEmail: agent.agentEmail,
        agentName: agent.agentName,
        currentTier: agent.currentTier as string,
        stakedTokens,
        riskLevel,
        distanceFromDowngrade,
      };
    });

    // Filter to only at-risk agents
    const atRisk = riskAnalysis.filter(a => a.riskLevel === 'high' || a.riskLevel === 'medium');

    return {
      totalAtRisk: atRisk.length,
      highRisk: atRisk.filter(a => a.riskLevel === 'high').length,
      mediumRisk: atRisk.filter(a => a.riskLevel === 'medium').length,
      agents: atRisk.slice(0, 10), // Return top 10 at-risk agents
    };
  }

  /**
   * Get recent staking activity
   */
  static async getRecentActivity(limit: number = 20) {
    const activity = await db
      .select({
        id: stakeHistory.id,
        agentId: stakeHistory.agentId,
        agentEmail: agents.email,
        agentName: agents.displayName,
        operationType: stakeHistory.operationType,
        amount: stakeHistory.amount,
        previousBalance: stakeHistory.previousBalance,
        newBalance: stakeHistory.newBalance,
        previousTier: stakeHistory.previousTier,
        newTier: stakeHistory.newTier,
        timestamp: stakeHistory.createdAt,
      })
      .from(stakeHistory)
      .innerJoin(agents, eq(stakeHistory.agentId, agents.id))
      .orderBy(desc(stakeHistory.createdAt))
      .limit(limit);

    return activity.map(a => ({
      ...a,
      amountTokens: parseFloat(baseUnitsToTokens(a.amount)),
    }));
  }
}
