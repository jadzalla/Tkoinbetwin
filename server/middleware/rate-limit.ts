import rateLimit from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

const platformRateLimitStore = new Map<string, Map<string, { count: number; resetTime: number }>>();

export async function platformRateLimiter(req: Request, res: Response, next: NextFunction) {
  try {
    const platformId = req.params.platformId || req.body.platformId;
    
    if (!platformId) {
      return next();
    }

    const platform = await storage.getSovereignPlatform(platformId);
    
    if (!platform || !platform.isActive) {
      return next();
    }

    // SECURITY: Treat missing or zero rateLimit as blocked, not unlimited
    const rateLimitValue = platform.rateLimit;
    if (!rateLimitValue || rateLimitValue <= 0) {
      console.warn(`[RateLimit] Platform ${platformId} has invalid rate limit (${rateLimitValue}), blocking request`);
      return res.status(403).json({
        message: 'Platform rate limit not configured or disabled',
      });
    }
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const windowMs = 60 * 60 * 1000;

    if (!platformRateLimitStore.has(platformId)) {
      platformRateLimitStore.set(platformId, new Map());
    }
    
    const platformStore = platformRateLimitStore.get(platformId)!;
    let ipEntry = platformStore.get(ip);
    
    if (!ipEntry || now > ipEntry.resetTime) {
      ipEntry = {
        count: 0,
        resetTime: now + windowMs,
      };
      platformStore.set(ip, ipEntry);
    }

    ipEntry.count++;

    if (ipEntry.count > rateLimitValue) {
      const retryAfter = Math.ceil((ipEntry.resetTime - now) / 1000);
      res.setHeader('X-RateLimit-Limit', rateLimitValue.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', new Date(ipEntry.resetTime).toISOString());
      res.setHeader('Retry-After', retryAfter.toString());
      
      return res.status(429).json({
        message: 'Rate limit exceeded for this platform',
        retryAfter: retryAfter,
        limit: rateLimitValue,
      });
    }

    res.setHeader('X-RateLimit-Limit', rateLimitValue.toString());
    res.setHeader('X-RateLimit-Remaining', (rateLimitValue - ipEntry.count).toString());
    res.setHeader('X-RateLimit-Reset', new Date(ipEntry.resetTime).toISOString());

    next();
  } catch (error) {
    console.error('Rate limiter error:', error);
    next();
  }
}

export const publicEndpointLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later',
  handler: (req, res) => {
    res.status(429).json({
      message: 'Too many requests from this IP, please try again later',
      retryAfter: Math.ceil(((req.rateLimit.resetTime?.getTime() || Date.now()) - Date.now()) / 1000),
    });
  },
});

export const authEndpointLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: 'Too many login attempts, please try again later',
});

// Store timer handle to avoid orphan intervals
const rateLimitCleanupTimer = setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [platformId, platformStore] of platformRateLimitStore.entries()) {
    for (const [ip, entry] of platformStore.entries()) {
      if (now > entry.resetTime) {
        platformStore.delete(ip);
        cleanedCount++;
      }
    }
    
    if (platformStore.size === 0) {
      platformRateLimitStore.delete(platformId);
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned up ${cleanedCount} expired rate limit entries`);
  }
}, 60 * 60 * 1000);

// Export cleanup function for server shutdown
export function cleanupRateLimitTimers() {
  clearInterval(rateLimitCleanupTimer);
}
