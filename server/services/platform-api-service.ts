import { db } from "../db";
import { platformUserBalances, platformTransactions, sovereignPlatforms, type InsertPlatformTransaction, type PlatformTransaction } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "../utils/logger";
import crypto from "crypto";

const TKOIN_CREDIT_RATE = 100; // 1 TKOIN = 100 Credits

export interface DepositRequest {
  platformUserId: string;
  creditsAmount: number;
  platformSettlementId?: string;
  metadata?: Record<string, any>;
}

export interface WithdrawalRequest {
  platformUserId: string;
  creditsAmount: number;
  solanaAddress?: string;
  platformSettlementId?: string;
  metadata?: Record<string, any>;
}

export class PlatformAPIService {
  /**
   * Create deposit transaction and update balance
   */
  async createDeposit(platformId: string, request: DepositRequest): Promise<PlatformTransaction> {
    const { platformUserId, creditsAmount, platformSettlementId, metadata } = request;

    logger.info('Platform deposit initiated', {
      platformId,
      platformUserId,
      creditsAmount,
      platformSettlementId,
    });

    // Calculate TKOIN amount
    const tkoinAmount = creditsAmount / TKOIN_CREDIT_RATE;

    // Create transaction
    const [transaction] = await db.insert(platformTransactions).values({
      platformId,
      platformUserId,
      type: 'deposit',
      creditsAmount: creditsAmount.toString(),
      tkoinAmount: tkoinAmount.toString(),
      status: 'processing',
      platformSettlementId,
      metadata: metadata || {},
    }).returning();

    // Process deposit (simulate instant completion for now)
    await this.completeDeposit(transaction.id);

    return transaction;
  }

  /**
   * Complete deposit - Update balance and send webhook
   */
  private async completeDeposit(transactionId: string): Promise<void> {
    const transaction = await db.query.platformTransactions.findFirst({
      where: eq(platformTransactions.id, transactionId),
    });

    if (!transaction || transaction.status !== 'processing') {
      throw new Error('Transaction not found or not in processing state');
    }

    // Update or create user balance
    const existingBalance = await db.query.platformUserBalances.findFirst({
      where: and(
        eq(platformUserBalances.platformId, transaction.platformId),
        eq(platformUserBalances.platformUserId, transaction.platformUserId)
      ),
    });

    const newBalance = existingBalance
      ? (parseFloat(existingBalance.creditsBalance) + parseFloat(transaction.creditsAmount)).toFixed(2)
      : parseFloat(transaction.creditsAmount).toFixed(2);

    if (existingBalance) {
      await db.update(platformUserBalances)
        .set({
          creditsBalance: newBalance,
          lastTransactionAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(platformUserBalances.id, existingBalance.id));
    } else {
      await db.insert(platformUserBalances).values({
        platformId: transaction.platformId,
        platformUserId: transaction.platformUserId,
        creditsBalance: newBalance,
        lastTransactionAt: new Date(),
      });
    }

    // Mark transaction as completed
    await db.update(platformTransactions)
      .set({
        status: 'completed',
        completedAt: new Date(),
      })
      .where(eq(platformTransactions.id, transactionId));

    logger.info('Platform deposit completed', {
      transactionId,
      platformId: transaction.platformId,
      platformUserId: transaction.platformUserId,
      newBalance,
    });

    // Send webhook to platform
    await this.sendWebhook(transaction.platformId, transactionId);
  }

  /**
   * Create withdrawal transaction and update balance
   */
  async createWithdrawal(platformId: string, request: WithdrawalRequest): Promise<PlatformTransaction> {
    const { platformUserId, creditsAmount, solanaAddress, platformSettlementId, metadata } = request;

    logger.info('Platform withdrawal initiated', {
      platformId,
      platformUserId,
      creditsAmount,
      platformSettlementId,
    });

    // Check balance
    const balance = await this.getUserBalance(platformId, platformUserId);
    if (balance < creditsAmount) {
      throw new Error('Insufficient balance for withdrawal');
    }

    // Calculate TKOIN amount
    const tkoinAmount = creditsAmount / TKOIN_CREDIT_RATE;

    // Create transaction
    const [transaction] = await db.insert(platformTransactions).values({
      platformId,
      platformUserId,
      type: 'withdrawal',
      creditsAmount: creditsAmount.toString(),
      tkoinAmount: tkoinAmount.toString(),
      status: 'processing',
      platformSettlementId,
      metadata: { ...metadata, solanaAddress },
    }).returning();

    // Process withdrawal (simulate instant completion for now)
    await this.completeWithdrawal(transaction.id);

    return transaction;
  }

  /**
   * Complete withdrawal - Update balance and send webhook
   */
  private async completeWithdrawal(transactionId: string): Promise<void> {
    const transaction = await db.query.platformTransactions.findFirst({
      where: eq(platformTransactions.id, transactionId),
    });

    if (!transaction || transaction.status !== 'processing') {
      throw new Error('Transaction not found or not in processing state');
    }

    // Update user balance (deduct)
    const existingBalance = await db.query.platformUserBalances.findFirst({
      where: and(
        eq(platformUserBalances.platformId, transaction.platformId),
        eq(platformUserBalances.platformUserId, transaction.platformUserId)
      ),
    });

    if (!existingBalance) {
      throw new Error('User balance not found');
    }

    const newBalance = (parseFloat(existingBalance.creditsBalance) - parseFloat(transaction.creditsAmount)).toFixed(2);

    await db.update(platformUserBalances)
      .set({
        creditsBalance: newBalance,
        lastTransactionAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(platformUserBalances.id, existingBalance.id));

    // Mark transaction as completed
    await db.update(platformTransactions)
      .set({
        status: 'completed',
        completedAt: new Date(),
      })
      .where(eq(platformTransactions.id, transactionId));

    logger.info('Platform withdrawal completed', {
      transactionId,
      platformId: transaction.platformId,
      platformUserId: transaction.platformUserId,
      newBalance,
    });

    // Send webhook to platform
    await this.sendWebhook(transaction.platformId, transactionId);
  }

  /**
   * Get user balance
   */
  async getUserBalance(platformId: string, platformUserId: string): Promise<number> {
    const balance = await db.query.platformUserBalances.findFirst({
      where: and(
        eq(platformUserBalances.platformId, platformId),
        eq(platformUserBalances.platformUserId, platformUserId)
      ),
    });

    return balance ? parseFloat(balance.creditsBalance) : 0;
  }

  /**
   * Get user transaction history
   */
  async getUserTransactions(platformId: string, platformUserId: string, limit: number = 10): Promise<PlatformTransaction[]> {
    const transactions = await db.query.platformTransactions.findMany({
      where: and(
        eq(platformTransactions.platformId, platformId),
        eq(platformTransactions.platformUserId, platformUserId)
      ),
      orderBy: desc(platformTransactions.createdAt),
      limit,
    });

    return transactions;
  }

  /**
   * Send webhook to platform when transaction completes
   */
  private async sendWebhook(platformId: string, transactionId: string): Promise<void> {
    try {
      // Get platform details
      const platform = await db.query.sovereignPlatforms.findFirst({
        where: eq(sovereignPlatforms.id, platformId),
      });

      if (!platform || !platform.webhookUrl || !platform.webhookEnabled) {
        logger.warn('Webhook not configured or disabled for platform', { platformId });
        return;
      }

      // Get transaction
      const transaction = await db.query.platformTransactions.findFirst({
        where: eq(platformTransactions.id, transactionId),
      });

      if (!transaction) {
        logger.error('Transaction not found for webhook', { transactionId });
        return;
      }

      // Prepare webhook payload
      const payload = {
        event: transaction.type === 'deposit' ? 'settlement.completed' : 'settlement.completed',
        data: {
          settlement_id: transaction.platformSettlementId || transaction.id,
          transaction_id: transaction.id,
          type: transaction.type,
          status: transaction.status,
          credits_amount: parseFloat(transaction.creditsAmount),
          tkoin_amount: parseFloat(transaction.tkoinAmount),
          platform_user_id: transaction.platformUserId,
          completed_at: transaction.completedAt?.toISOString(),
          metadata: transaction.metadata,
        },
        timestamp: new Date().toISOString(),
      };

      const payloadString = JSON.stringify(payload);

      // Generate HMAC signature
      const signature = crypto
        .createHmac('sha256', platform.webhookSecret)
        .update(payloadString)
        .digest('hex');

      // Send webhook
      const response = await fetch(platform.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tkoin-Signature': signature,
          'X-Tkoin-Timestamp': payload.timestamp,
        },
        body: payloadString,
      });

      if (response.ok) {
        // Mark webhook as delivered
        await db.update(platformTransactions)
          .set({
            webhookDelivered: true,
            webhookAttempts: (transaction.webhookAttempts || 0) + 1,
          })
          .where(eq(platformTransactions.id, transactionId));

        logger.info('Webhook delivered successfully', {
          platformId,
          transactionId,
          statusCode: response.status,
        });
      } else {
        const errorText = await response.text();
        logger.error('Webhook delivery failed', {
          platformId,
          transactionId,
          statusCode: response.status,
          error: errorText,
        });

        // Update webhook attempts
        await db.update(platformTransactions)
          .set({
            webhookAttempts: (transaction.webhookAttempts || 0) + 1,
            webhookLastError: `HTTP ${response.status}: ${errorText}`,
          })
          .where(eq(platformTransactions.id, transactionId));
      }
    } catch (error) {
      logger.error('Webhook send failed', {
        platformId,
        transactionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Update webhook attempts
      const transaction = await db.query.platformTransactions.findFirst({
        where: eq(platformTransactions.id, transactionId),
      });

      if (transaction) {
        await db.update(platformTransactions)
          .set({
            webhookAttempts: (transaction.webhookAttempts || 0) + 1,
            webhookLastError: error instanceof Error ? error.message : 'Unknown error',
          })
          .where(eq(platformTransactions.id, transactionId));
      }
    }
  }
}

export const platformAPIService = new PlatformAPIService();
