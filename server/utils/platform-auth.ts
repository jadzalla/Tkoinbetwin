import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { SovereignPlatform, PlatformApiToken, platformApiTokens, webhookNonces } from '../../shared/schema';
import { db } from '../db';
import { eq } from 'drizzle-orm';

/**
 * Generate a secure platform API token
 * Format: ptk_<base62>_<random>
 */
export function generatePlatformApiToken(): {
  token: string;
  tokenHash: string;
  maskedToken: string;
} {
  const randomBytes = crypto.randomBytes(32);
  const token = `ptk_${randomBytes.toString('base64url')}`;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const maskedToken = `${token.slice(0, 8)}...${token.slice(-8)}`;
  
  return { token, tokenHash, maskedToken };
}

/**
 * Verify HMAC-SHA256 signature for platform API requests
 * with replay attack prevention via nonce tracking
 * 
 * Expected headers:
 * - X-Platform-Token: ptk_...
 * - X-Timestamp: Unix timestamp (must be within 5 minutes)
 * - X-Nonce: Unique request identifier (UUID recommended)
 * - X-Signature: sha256=<hex> HMAC of timestamp.body using apiSecret
 */
export async function verifyPlatformSignature(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const platformToken = req.headers['x-platform-token'] as string;
    const timestamp = req.headers['x-timestamp'] as string;
    const signature = req.headers['x-signature'] as string;
    const nonce = req.headers['x-nonce'] as string;
    
    // Validate required headers
    if (!platformToken || !timestamp || !signature || !nonce) {
      res.status(401).json({ 
        error: 'Missing required headers', 
        required: ['X-Platform-Token', 'X-Timestamp', 'X-Signature', 'X-Nonce'] 
      });
      return;
    }
    
    // Validate timestamp (must be within 5 minutes)
    const requestTime = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    const timeDiff = Math.abs(now - requestTime);
    
    if (timeDiff > 300) { // 5 minutes
      res.status(401).json({ 
        error: 'Request timestamp expired',
        maxAge: 300,
        timeDiff
      });
      return;
    }
    
    // Find platform API token (need platformId for nonce check)
    const tokenHash = crypto.createHash('sha256').update(platformToken).digest('hex');
    const allTokens = await db.select()
      .from(platformApiTokens)
      .where(eq(platformApiTokens.tokenHash, tokenHash))
      .limit(1);
    
    const apiToken = allTokens[0];
    if (!apiToken) {
      res.status(401).json({ error: 'Invalid API token' });
      return;
    }
    
    if (!apiToken.isActive) {
      res.status(401).json({ error: 'API token is inactive' });
      return;
    }
    
    // Check token expiration
    if (apiToken.expiresAt && new Date(apiToken.expiresAt) < new Date()) {
      res.status(401).json({ error: 'API token expired' });
      return;
    }
    
    // Get platform details
    const platform = await storage.getSovereignPlatform(apiToken.platformId);
    if (!platform) {
      res.status(404).json({ error: 'Platform not found' });
      return;
    }
    
    if (!platform.isActive) {
      res.status(403).json({ error: 'Platform is inactive' });
      return;
    }
    
    // Check nonce to prevent replay attacks
    try {
      const existingNonce = await db.select()
        .from(webhookNonces)
        .where(eq(webhookNonces.nonce, nonce))
        .limit(1);
      
      if (existingNonce.length > 0) {
        res.status(401).json({ 
          error: 'Nonce already used (replay attack detected)',
          nonce 
        });
        return;
      }
      
      // Store nonce to prevent replay (expires in 5 minutes)
      const requestTimestamp = new Date(requestTime * 1000);
      const expiresAt = new Date(requestTime * 1000 + 300000); // 5 minutes
      
      await db.insert(webhookNonces).values({
        nonce,
        platformId: platform.id,
        requestPath: req.path,
        requestTimestamp,
        expiresAt,
      });
    } catch (error: any) {
      // If unique constraint violation, it's a replay attack
      if (error.code === '23505') { // PostgreSQL unique violation
        res.status(401).json({ 
          error: 'Nonce already used (replay attack detected)',
          nonce 
        });
        return;
      }
      throw error; // Re-throw other errors
    }
    
    // Verify HMAC signature using apiSecret (for Platform → Tkoin requests)
    const body = JSON.stringify(req.body);
    const payload = `${timestamp}.${body}`;
    const expectedSignature = crypto
      .createHmac('sha256', platform.apiSecret)
      .update(payload)
      .digest('hex');
    
    const providedSignature = signature.replace('sha256=', '');
    
    if (!crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    )) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }
    
    // Update last used timestamp
    await storage.updatePlatformApiToken(apiToken.id, {
      lastUsedAt: new Date(),
    });
    
    // Attach platform and token to request
    (req as any).platform = platform;
    (req as any).apiToken = apiToken;
    
    next();
  } catch (error) {
    console.error('Platform signature verification error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Middleware to require platform API authentication
 * Must be used after verifyPlatformSignature
 */
export function requirePlatformAuth(req: Request, res: Response, next: NextFunction) {
  if (!(req as any).platform) {
    return res.status(401).json({ error: 'Platform authentication required' });
  }
  next();
}

/**
 * Extract platform ID from request (set by verifyPlatformSignature middleware)
 */
export function getPlatformFromRequest(req: Request): SovereignPlatform | null {
  return (req as any).platform || null;
}

/**
 * Generate HMAC signature for outgoing webhooks
 */
export function generateWebhookSignature(
  payload: any,
  secret: string,
  timestamp?: number
): { signature: string; timestamp: number } {
  const ts = timestamp || Math.floor(Date.now() / 1000);
  const body = JSON.stringify(payload);
  const data = `${ts}.${body}`;
  const signature = crypto.createHmac('sha256', secret).update(data).digest('hex');
  
  return {
    signature: `sha256=${signature}`,
    timestamp: ts
  };
}
