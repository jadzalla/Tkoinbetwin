import { db } from "../db";
import { agentApplications, agents, users } from "@shared/schema";
import type { InsertAgentApplication, AgentApplication } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export class ApplicationService {
  /**
   * Submit new agent application
   */
  async createApplication(data: Omit<InsertAgentApplication, "replitUserId" | "email">, replitUserId: string, email: string): Promise<AgentApplication> {
    // Check for existing pending application
    const existingPending = await db.select()
      .from(agentApplications)
      .where(eq(agentApplications.replitUserId, replitUserId));
    
    const hasPending = existingPending.some(app => app.status === "pending");
    if (hasPending) {
      throw new Error("You already have a pending application");
    }

    // Validate required fields
    if (!data.businessName || !data.businessType || !data.country || !data.city || !data.address || !data.phoneNumber) {
      throw new Error("All business information fields are required");
    }

    const [application] = await db.insert(agentApplications).values({
      ...data,
      replitUserId,
      email,
      status: "pending",
      kycStatus: "pending",
      kycDocuments: data.kycDocuments || [],
    }).returning();

    return application;
  }

  /**
   * Get all applications with filters
   */
  async getApplications(filters?: { status?: string; kycStatus?: string }): Promise<AgentApplication[]> {
    let query = db.select().from(agentApplications);

    if (filters?.status) {
      query = query.where(eq(agentApplications.status, filters.status)) as any;
    }

    const results = await query.orderBy(desc(agentApplications.createdAt));
    return results;
  }

  /**
   * Get application by ID
   */
  async getApplicationById(id: string): Promise<AgentApplication | null> {
    const [application] = await db.select()
      .from(agentApplications)
      .where(eq(agentApplications.id, id));

    return application || null;
  }

  /**
   * Get application by Replit user ID
   */
  async getApplicationByUserId(replitUserId: string): Promise<AgentApplication | null> {
    const [application] = await db.select()
      .from(agentApplications)
      .where(eq(agentApplications.replitUserId, replitUserId))
      .orderBy(desc(agentApplications.createdAt));

    return application || null;
  }

  /**
   * Update KYC documents
   */
  async updateKycDocuments(id: string, documents: any[]): Promise<AgentApplication> {
    const [application] = await db.update(agentApplications)
      .set({
        kycDocuments: documents,
        kycStatus: "under_review",
        updatedAt: new Date(),
      })
      .where(eq(agentApplications.id, id))
      .returning();

    if (!application) {
      throw new Error("Application not found");
    }

    return application;
  }

  /**
   * Approve application - creates agent account
   */
  async approveApplication(
    applicationId: string,
    adminUserId: string,
    reviewNotes?: string
  ): Promise<{ application: AgentApplication; agent: any }> {
    return await db.transaction(async (tx) => {
      const [application] = await tx.select()
        .from(agentApplications)
        .where(eq(agentApplications.id, applicationId));

      if (!application) {
        throw new Error("Application not found");
      }

      if (application.status !== "pending") {
        throw new Error("Application already processed");
      }

      const [user] = await tx.select()
        .from(users)
        .where(eq(users.id, application.replitUserId));

      if (!user) {
        throw new Error("User not found");
      }

      const [agent] = await tx.insert(agents).values({
        replitUserId: application.replitUserId,
        email: application.email,
        username: user.email?.split("@")[0] || application.replitUserId,
        displayName: application.businessName,
        country: application.country,
        city: application.city,
        verificationTier: application.requestedTier,
        status: "pending",
        solanaWallet: "WALLET_NOT_CONFIGURED",
        dailyLimit: application.requestedTier === "premium" ? "50000" : application.requestedTier === "verified" ? "20000" : "5000",
        monthlyLimit: application.requestedTier === "premium" ? "500000" : application.requestedTier === "verified" ? "200000" : "50000",
        approvedAt: new Date(),
        approvedBy: adminUserId,
      }).returning();

      await tx.update(users)
        .set({ role: "agent" })
        .where(eq(users.id, application.replitUserId));

      const [updatedApplication] = await tx.update(agentApplications)
        .set({
          status: "approved",
          kycStatus: "approved",
          reviewedAt: new Date(),
          reviewedBy: adminUserId,
          reviewNotes,
          agentId: agent.id,
          updatedAt: new Date(),
        })
        .where(eq(agentApplications.id, applicationId))
        .returning();

      return { application: updatedApplication, agent };
    });
  }

  /**
   * Reject application
   */
  async rejectApplication(
    applicationId: string,
    adminUserId: string,
    rejectionReason: string
  ): Promise<AgentApplication> {
    const [application] = await db.update(agentApplications)
      .set({
        status: "rejected",
        kycStatus: "rejected",
        reviewedAt: new Date(),
        reviewedBy: adminUserId,
        rejectionReason,
        updatedAt: new Date(),
      })
      .where(eq(agentApplications.id, applicationId))
      .returning();

    if (!application) {
      throw new Error("Application not found");
    }

    return application;
  }

  /**
   * Get application statistics
   */
  async getApplicationStats(): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    kycPending: number;
  }> {
    const allApps = await db.select().from(agentApplications);

    return {
      total: allApps.length,
      pending: allApps.filter((a: AgentApplication) => a.status === "pending").length,
      approved: allApps.filter((a: AgentApplication) => a.status === "approved").length,
      rejected: allApps.filter((a: AgentApplication) => a.status === "rejected").length,
      kycPending: allApps.filter((a: AgentApplication) => a.kycStatus === "pending" || a.kycStatus === "under_review").length,
    };
  }
}

export const applicationService = new ApplicationService();
