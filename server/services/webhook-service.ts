import crypto from 'crypto';

export interface WebhookPayload {
  event: string;
  timestamp: number;
  data: any;
}

export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  response?: any;
  error?: string;
  attempts: number;
  deliveredAt?: Date;
}

export interface WebhookConfig {
  url: string;
  secret: string;
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

export class WebhookService {
  private static readonly DEFAULT_MAX_RETRIES = 3;
  private static readonly DEFAULT_RETRY_DELAY_MS = 1000;
  private static readonly DEFAULT_TIMEOUT_MS = 30000;

  /**
   * Generate HMAC-SHA256 signature for webhook payload
   * Includes timestamp to prevent replay attacks
   */
  static generateSignature(payload: string, timestamp: number, secret: string): string {
    const signatureInput = `${timestamp}.${payload}`;
    return crypto
      .createHmac('sha256', secret)
      .update(signatureInput)
      .digest('hex');
  }

  /**
   * Verify HMAC-SHA256 signature
   * Validates timestamp is included in signature to prevent replay attacks
   */
  static verifySignature(payload: string, timestamp: number, signature: string, secret: string): boolean {
    try {
      const expectedSignature = this.generateSignature(payload, timestamp, secret);
      
      // Constant-time length check to prevent DoS via mismatched buffer lengths
      const signatureBuffer = Buffer.from(signature, 'hex');
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');
      
      if (signatureBuffer.length !== expectedBuffer.length) {
        return false;
      }
      
      return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
    } catch (error) {
      // Log error but return false (don't leak information)
      console.error('[Webhook] Signature verification error:', error);
      return false;
    }
  }

  /**
   * Deliver webhook with automatic retries and exponential backoff
   */
  static async deliverWebhook(
    config: WebhookConfig,
    payload: WebhookPayload
  ): Promise<WebhookDeliveryResult> {
    const maxRetries = config.maxRetries ?? this.DEFAULT_MAX_RETRIES;
    const baseDelay = config.retryDelayMs ?? this.DEFAULT_RETRY_DELAY_MS;
    const timeout = config.timeoutMs ?? this.DEFAULT_TIMEOUT_MS;

    let lastError: string = '';
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Webhook] Attempt ${attempt}/${maxRetries} to ${config.url}`);
        
        const payloadString = JSON.stringify(payload);
        const signature = this.generateSignature(payloadString, payload.timestamp, config.secret);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(config.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tkoin-Signature': signature,
            'X-Tkoin-Timestamp': payload.timestamp.toString(),
            'User-Agent': 'Tkoin-Webhook/1.0',
          },
          body: payloadString,
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        const responseText = await response.text();
        let responseData: any;
        
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = { raw: responseText };
        }
        
        if (response.ok) {
          console.log(`[Webhook] Success on attempt ${attempt}: ${response.status}`);
          return {
            success: true,
            statusCode: response.status,
            response: responseData,
            attempts: attempt,
            deliveredAt: new Date(),
          };
        }
        
        lastError = `HTTP ${response.status}: ${responseText}`;
        console.warn(`[Webhook] Attempt ${attempt} failed: ${lastError}`);
        
        // Don't retry on client errors (4xx), except 429 (rate limit)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          console.log(`[Webhook] Client error ${response.status}, not retrying`);
          return {
            success: false,
            statusCode: response.status,
            response: responseData,
            error: lastError,
            attempts: attempt,
          };
        }
        
      } catch (error: any) {
        lastError = error.message || String(error);
        console.warn(`[Webhook] Attempt ${attempt} error: ${lastError}`);
        
        // Don't retry on abort (timeout)
        if (error.name === 'AbortError') {
          return {
            success: false,
            error: `Request timeout after ${timeout}ms`,
            attempts: attempt,
          };
        }
      }
      
      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`[Webhook] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return {
      success: false,
      error: lastError || 'All retry attempts failed',
      attempts: maxRetries,
    };
  }

  /**
   * Send credit notification to 1Stake platform
   */
  static async sendCreditNotification(
    webhookUrl: string,
    secret: string,
    data: {
      userId: string;
      depositId: string;
      tkoinAmount: string;
      creditsAmount: string;
      burnAmount: string;
      solanaSignature: string;
      memo?: string;
    }
  ): Promise<WebhookDeliveryResult> {
    const payload: WebhookPayload = {
      event: 'tkoin.deposit.credit',
      timestamp: Date.now(),
      data: {
        user_id: data.userId,
        deposit_id: data.depositId,
        tkoin_amount: data.tkoinAmount,
        credits_amount: data.creditsAmount,
        burn_amount: data.burnAmount,
        solana_signature: data.solanaSignature,
        memo: data.memo,
      },
    };

    return this.deliverWebhook({ url: webhookUrl, secret }, payload);
  }

  /**
   * Send withdrawal confirmation to 1Stake platform
   */
  static async sendWithdrawalConfirmation(
    webhookUrl: string,
    secret: string,
    data: {
      withdrawalId: string;
      userId: string;
      tkoinAmount: string;
      creditsAmount: string;
      status: string;
      solanaSignature?: string;
      errorMessage?: string;
    }
  ): Promise<WebhookDeliveryResult> {
    const payload: WebhookPayload = {
      event: 'tkoin.withdrawal.confirmed',
      timestamp: Date.now(),
      data: {
        withdrawal_id: data.withdrawalId,
        user_id: data.userId,
        tkoin_amount: data.tkoinAmount,
        credits_amount: data.creditsAmount,
        status: data.status,
        solana_signature: data.solanaSignature,
        error_message: data.errorMessage,
      },
    };

    return this.deliverWebhook({ url: webhookUrl, secret }, payload);
  }
}
