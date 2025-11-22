import { db } from "../db";
import { platformUserBalances, platformTransactions, sovereignPlatforms, type InsertPlatformTransaction, type PlatformTransaction } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "../utils/logger";
import crypto from "crypto";
import Decimal from "decimal.js";

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

class PlatformAPIService {
  /**
   * Create deposit transaction and update balance (ATOMIC)
   */
  async createDeposit(platformId: string, request: DepositRequest): Promise<PlatformTransaction> {
    const { platformUserId, creditsAmount, platformSettlementId, metadata } = request;

    logger.info('Platform deposit initiated', {
      platformId,
      platformUserId,
      creditsAmount,
      platformSettlementId,
    });

    // Use Decimal.js for precision-safe calculations
    const creditsDecimal = new Decimal(creditsAmount);
    const tkoinDecimal = creditsDecimal.dividedBy(TKOIN_CREDIT_RATE);

    // Execute entire deposit flow in atomic transaction
    return await db.transaction(async (tx) => {
      // 1. Create transaction record
      const [transaction] = await tx.insert(platformTransactions).values({
        platformId,
        platformUserId,
        type: 'deposit',
        creditsAmount: creditsDecimal.toFixed(2),
        tkoinAmount: tkoinDecimal.toFixed(8),
        status: 'processing',
        platformSettlementId,
        metadata: metadata || {},
      }).returning();

      // 2. Update or create user balance
      const existingBalance = await tx.query.platformUserBalances.findFirst({
        where: and(
          eq(platformUserBalances.platformId, platformId),
          eq(platformUserBalances.platformUserId, platformUserId)
        ),
      });

      const newBalanceDecimal = existingBalance
        ? new Decimal(existingBalance.creditsBalance).plus(creditsDecimal)
        : creditsDecimal;

      if (existingBalance) {
        await tx.update(platformUserBalances)
          .set({
            creditsBalance: newBalanceDecimal.toFixed(2),
            lastTransactionAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(platformUserBalances.id, existingBalance.id));
      } else {
        await tx.insert(platformUserBalances).values({
          platformId,
          platformUserId,
          creditsBalance: newBalanceDecimal.toFixed(2),
          lastTransactionAt: new Date(),
        });
      }

      // 3. Mark transaction as completed
      const [completedTransaction] = await tx.update(platformTransactions)
        .set({
          status: 'completed',
          completedAt: new Date(),
        })
        .where(eq(platformTransactions.id, transaction.id))
        .returning();

      logger.info('Platform deposit completed (atomic)', {
        transactionId: transaction.id,
        platformId,
        platformUserId,
        newBalance: newBalanceDecimal.toFixed(2),
      });

      // 4. Send webhook (after transaction commits)
      setImmediate(() => {
        this.sendWebhook(platformId, transaction.id).catch((error) => {
          logger.error('Webhook send failed after deposit', {
            transactionId: transaction.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        });
      });

      return completedTransaction;
    });
  }

  /**
   * Create withdrawal transaction and update balance (ATOMIC)
   */
  async createWithdrawal(platformId: string, request: WithdrawalRequest): Promise<PlatformTransaction> {
    const { platformUserId, creditsAmount, solanaAddress, platformSettlementId, metadata } = request;

    logger.info('Platform withdrawal initiated', {
      platformId,
      platformUserId,
      creditsAmount,
      platformSettlementId,
    });

    // Use Decimal.js for precision-safe calculations
    const creditsDecimal = new Decimal(creditsAmount);
    const tkoinDecimal = creditsDecimal.dividedBy(TKOIN_CREDIT_RATE);

    // Execute entire withdrawal flow in atomic transaction
    return await db.transaction(async (tx) => {
      // 1. Check balance first
      const existingBalance = await tx.query.platformUserBalances.findFirst({
        where: and(
          eq(platformUserBalances.platformId, platformId),
          eq(platformUserBalances.platformUserId, platformUserId)
        ),
      });

      if (!existingBalance) {
        throw new Error('User balance not found');
      }

      const currentBalanceDecimal = new Decimal(existingBalance.creditsBalance);
      if (currentBalanceDecimal.lessThan(creditsDecimal)) {
        throw new Error(`Insufficient balance: have ${currentBalanceDecimal.toFixed(2)}, need ${creditsDecimal.toFixed(2)}`);
      }

      // 2. Create transaction record
      const [transaction] = await tx.insert(platformTransactions).values({
        platformId,
        platformUserId,
        type: 'withdrawal',
        creditsAmount: creditsDecimal.toFixed(2),
        tkoinAmount: tkoinDecimal.toFixed(8),
        status: 'processing',
        platformSettlementId,
        metadata: metadata ? { ...metadata, solanaAddress } : { solanaAddress },
      }).returning();

      // 3. Deduct from user balance
      const newBalanceDecimal = currentBalanceDecimal.minus(creditsDecimal);

      await tx.update(platformUserBalances)
        .set({
          creditsBalance: newBalanceDecimal.toFixed(2),
          lastTransactionAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(platformUserBalances.id, existingBalance.id));

      // 4. Mark transaction as completed
      const [completedTransaction] = await tx.update(platformTransactions)
        .set({
          status: 'completed',
          completedAt: new Date(),
        })
        .where(eq(platformTransactions.id, transaction.id))
        .returning();

      logger.info('Platform withdrawal completed (atomic)', {
        transactionId: transaction.id,
        platformId,
        platformUserId,
        newBalance: newBalanceDecimal.toFixed(2),
      });

      // 5. Send webhook (after transaction commits)
      setImmediate(() => {
        this.sendWebhook(platformId, transaction.id).catch((error) => {
          logger.error('Webhook send failed after withdrawal', {
            transactionId: transaction.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        });
      });

      return completedTransaction;
    });
  }

  /**
   * Get user balance (precision-safe)
   */
  async getUserBalance(platformId: string, platformUserId: string): Promise<number> {
    const balance = await db.query.platformUserBalances.findFirst({
      where: and(
        eq(platformUserBalances.platformId, platformId),
        eq(platformUserBalances.platformUserId, platformUserId)
      ),
    });

    // Use Decimal.js for precision, then convert to number for API compatibility
    return balance ? new Decimal(balance.creditsBalance).toNumber() : 0;
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

// Export singleton instance
export const platformAPIService = new PlatformAPIService();
export { PlatformAPIService };
