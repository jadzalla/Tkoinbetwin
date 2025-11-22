import { storage } from '../storage';
import { generateWebhookSignature } from '../utils/platform-auth';
import { logger } from '../utils/logger';

/**
 * Webhook Emitter Service
 * 
 * Sends webhooks from Tkoin Protocol → Sovereign Platforms
 * with retry logic and exponential backoff
 */

interface WebhookPayload {
  event: string;
  data: any;
  timestamp?: number;
}

interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  baseDelayMs: 1000, // 1 second
  maxDelayMs: 60000, // 1 minute
};

/**
 * Send webhook to platform with retry logic
 */
export async function sendWebhook(
  platformId: string,
  payload: WebhookPayload,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<{
  success: boolean;
  attempts: number;
  lastError?: string;
}> {
  const platform = await storage.getSovereignPlatform(platformId);
  
  if (!platform) {
    logger.error('Webhook platform not found', { platformId });
    return {
      success: false,
      attempts: 0,
      lastError: `Platform '${platformId}' not found`,
    };
  }
  
  if (!platform.webhookUrl) {
    logger.warn('Platform has no webhook URL configured', { platformId });
    return {
      success: false,
      attempts: 0,
      lastError: 'No webhook URL configured',
    };
  }
  
  if (!platform.webhookEnabled) {
    logger.warn('Webhooks disabled for platform', { platformId });
    return {
      success: false,
      attempts: 0,
      lastError: 'Webhooks disabled for platform',
    };
  }
  
  let lastError: string | undefined;
  let attempts = 0;
  
  for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
    attempts = attempt;
    
    try {
      // Generate signature using platform's webhookSecret
      const { signature, timestamp } = generateWebhookSignature(
        payload,
        platform.webhookSecret
      );
      
      const webhookPayload = {
        ...payload,
        timestamp,
      };
      
      // Send webhook
      const response = await fetch(platform.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Platform-Id': platformId,
          'X-Timestamp': timestamp.toString(),
          'X-Signature': signature,
          'User-Agent': 'Tkoin-Protocol/1.0',
        },
        body: JSON.stringify(webhookPayload),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });
      
      if (response.ok) {
        logger.info('Webhook delivered successfully', {
          platformId,
          event: payload.event,
          attempts,
          statusCode: response.status,
        });
        
        return {
          success: true,
          attempts,
        };
      }
      
      // Non-200 response
      const errorText = await response.text().catch(() => 'Unknown error');
      lastError = `HTTP ${response.status}: ${errorText}`;
      
      logger.warn('Webhook delivery failed', {
        platformId,
        event: payload.event,
        attempt,
        statusCode: response.status,
        error: lastError,
      });
      
      // Don't retry on 4xx errors (client errors)
      if (response.status >= 400 && response.status < 500) {
        logger.error('Webhook delivery failed with client error, not retrying', {
          platformId,
          event: payload.event,
          statusCode: response.status,
        });
        break;
      }
      
    } catch (error: any) {
      lastError = error.message || 'Unknown error';
      
      logger.warn('Webhook delivery error', {
        platformId,
        event: payload.event,
        attempt,
        error: lastError,
      });
    }
    
    // Calculate exponential backoff delay
    if (attempt < retryConfig.maxAttempts) {
      const delay = Math.min(
        retryConfig.baseDelayMs * Math.pow(2, attempt - 1),
        retryConfig.maxDelayMs
      );
      
      logger.info('Retrying webhook after delay', {
        platformId,
        event: payload.event,
        attempt,
        delayMs: delay,
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  logger.error('Webhook delivery failed after all retries', {
    platformId,
    event: payload.event,
    attempts,
    lastError,
  });
  
  return {
    success: false,
    attempts,
    lastError,
  };
}

/**
 * Send deposit completion webhook
 */
export async function sendDepositWebhook(
  platformId: string,
  userId: string,
  amount: string,
  settlementId: string
): Promise<void> {
  await sendWebhook(platformId, {
    event: 'deposit.completed',
    data: {
      userId,
      amount,
      settlementId,
      currency: 'TKOIN',
      status: 'completed',
    },
  });
}

/**
 * Send withdrawal completion webhook
 */
export async function sendWithdrawalWebhook(
  platformId: string,
  userId: string,
  amount: string,
  settlementId: string
): Promise<void> {
  await sendWebhook(platformId, {
    event: 'withdrawal.completed',
    data: {
      userId,
      amount,
      settlementId,
      currency: 'TKOIN',
      status: 'completed',
    },
  });
}

/**
 * Send transaction status webhook
 */
export async function sendTransactionStatusWebhook(
  platformId: string,
  transactionId: string,
  status: string,
  metadata?: any
): Promise<void> {
  await sendWebhook(platformId, {
    event: 'transaction.status_changed',
    data: {
      transactionId,
      status,
      metadata,
    },
  });
}
