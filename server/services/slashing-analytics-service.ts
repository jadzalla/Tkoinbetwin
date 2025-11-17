import { db } from "../db";
import { slashingEvents, agents } from "@shared/schema";
import { eq, desc, sql, and, gte } from "drizzle-orm";

export interface SlashingOverview {
  totalSlashingEvents: number;
  totalSlashedAmount: string; // TKOIN
  averageSlashAmount: string; // TKOIN
  pendingEvents: number;
  executedEvents: number;
  reversedEvents: number;
}

export interface ViolationBreakdown {
  violationType: string;
  count: number;
  totalSlashed: string; // TKOIN
  averageSlashed: string; // TKOIN
}

export interface SeverityBreakdown {
  severity: string;
  count: number;
  totalSlashed: string; // TKOIN
  percentage: number;
}

export interface SlashingTrend {
  date: string;
  count: number;
  slashedAmount: string; // TKOIN
}

export interface AgentViolationHistory {
  agentId: string;
  agentName: string;
  totalViolations: number;
  totalSlashed: string; // TKOIN
  lastViolationDate: string | null;
  mostCommonViolation: string;
}

export class SlashingAnalyticsService {
  /**
   * Get overall slashing statistics
   */
  async getSlashingOverview(): Promise<SlashingOverview> {
    const [overview] = await db
      .select({
        total: sql<number>`count(*)::int`,
        totalSlashed: sql<string>`coalesce(sum(slashed_amount), 0)::text`,
        avgSlashed: sql<string>`coalesce(avg(slashed_amount), 0)::text`,
        pending: sql<number>`count(case when status = 'pending' then 1 end)::int`,
        executed: sql<number>`count(case when status = 'executed' then 1 end)::int`,
        reversed: sql<number>`count(case when status = 'reversed' then 1 end)::int`,
      })
      .from(slashingEvents);

    return {
      totalSlashingEvents: overview.total,
      totalSlashedAmount: overview.totalSlashed,
      averageSlashAmount: overview.avgSlashed,
      pendingEvents: overview.pending,
      executedEvents: overview.executed,
      reversedEvents: overview.reversed,
    };
  }

  /**
   * Get breakdown by violation type
   */
  async getViolationBreakdown(): Promise<ViolationBreakdown[]> {
    const results = await db
      .select({
        violationType: slashingEvents.violationType,
        count: sql<number>`count(*)::int`,
        totalSlashed: sql<string>`coalesce(sum(slashed_amount), 0)::text`,
        avgSlashed: sql<string>`coalesce(avg(slashed_amount), 0)::text`,
      })
      .from(slashingEvents)
      .where(eq(slashingEvents.status, "executed"))
      .groupBy(slashingEvents.violationType)
      .orderBy(desc(sql`count(*)`));

    return results.map((r) => ({
      violationType: r.violationType,
      count: r.count,
      totalSlashed: r.totalSlashed,
      averageSlashed: r.avgSlashed,
    }));
  }

  /**
   * Get breakdown by severity level
   */
  async getSeverityBreakdown(): Promise<SeverityBreakdown[]> {
    const results = await db
      .select({
        severity: slashingEvents.severity,
        count: sql<number>`count(*)::int`,
        totalSlashed: sql<string>`coalesce(sum(slashed_amount), 0)::text`,
      })
      .from(slashingEvents)
      .where(eq(slashingEvents.status, "executed"))
      .groupBy(slashingEvents.severity)
      .orderBy(desc(sql`count(*)`));

    // Calculate total for percentage
    const total = results.reduce((sum, r) => sum + r.count, 0);

    return results.map((r) => ({
      severity: r.severity,
      count: r.count,
      totalSlashed: r.totalSlashed,
      percentage: total > 0 ? (r.count / total) * 100 : 0,
    }));
  }

  /**
   * Get slashing trends over time
   */
  async getSlashingTrends(days: number = 30): Promise<SlashingTrend[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const results = await db
      .select({
        date: sql<string>`DATE(created_at)`,
        count: sql<number>`count(*)::int`,
        slashedAmount: sql<string>`coalesce(sum(slashed_amount), 0)::text`,
      })
      .from(slashingEvents)
      .where(
        and(
          eq(slashingEvents.status, "executed"),
          gte(slashingEvents.createdAt, startDate)
        )
      )
      .groupBy(sql`DATE(created_at)`)
      .orderBy(sql`DATE(created_at)`);

    return results.map((r) => ({
      date: r.date,
      count: r.count,
      slashedAmount: r.slashedAmount,
    }));
  }

  /**
   * Get agents with violation history
   */
  async getAgentViolationHistory(limit: number = 20): Promise<AgentViolationHistory[]> {
    const results = await db
      .select({
        agentId: agents.id,
        agentName: agents.displayName,
        totalViolations: sql<number>`count(${slashingEvents.id})::int`,
        totalSlashed: sql<string>`coalesce(sum(${slashingEvents.slashedAmount}), 0)::text`,
        lastViolationDate: sql<string>`max(${slashingEvents.createdAt})::text`,
        mostCommonViolation: sql<string>`
          (
            SELECT ${slashingEvents.violationType}
            FROM ${slashingEvents}
            WHERE ${slashingEvents.agentId} = ${agents.id}
              AND ${slashingEvents.status} = 'executed'
            GROUP BY ${slashingEvents.violationType}
            ORDER BY count(*) DESC
            LIMIT 1
          )
        `,
      })
      .from(agents)
      .leftJoin(
        slashingEvents,
        and(
          eq(slashingEvents.agentId, agents.id),
          eq(slashingEvents.status, "executed")
        )
      )
      .groupBy(agents.id, agents.displayName)
      .having(sql`count(${slashingEvents.id}) > 0`)
      .orderBy(desc(sql`count(${slashingEvents.id})`))
      .limit(limit);

    return results.map((r) => ({
      agentId: r.agentId,
      agentName: r.agentName || r.agentId,
      totalViolations: r.totalViolations,
      totalSlashed: r.totalSlashed,
      lastViolationDate: r.lastViolationDate,
      mostCommonViolation: r.mostCommonViolation || "N/A",
    }));
  }

  /**
   * Get recent slashing events
   */
  async getRecentSlashingEvents(limit: number = 10) {
    const results = await db
      .select({
        id: slashingEvents.id,
        agentId: slashingEvents.agentId,
        agentName: agents.displayName,
        violationType: slashingEvents.violationType,
        severity: slashingEvents.severity,
        slashedAmount: slashingEvents.slashedAmount,
        status: slashingEvents.status,
        createdAt: slashingEvents.createdAt,
      })
      .from(slashingEvents)
      .leftJoin(agents, eq(slashingEvents.agentId, agents.id))
      .orderBy(desc(slashingEvents.createdAt))
      .limit(limit);

    return results.map((r) => ({
      ...r,
      slashedAmount: r.slashedAmount.toString(),
    }));
  }
}

export const slashingAnalyticsService = new SlashingAnalyticsService();
