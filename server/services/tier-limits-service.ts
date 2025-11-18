import { storage } from '../storage';
import { TIER_LIMITS } from '@shared/staking-constants';
import type { AgentTier } from '@shared/staking-constants';

// Type for tier limits
type TierLimitsType = {
  basic: { dailyLimit: number; monthlyLimit: number };
  verified: { dailyLimit: number; monthlyLimit: number };
  premium: { dailyLimit: number; monthlyLimit: number };
};

// Cache tier limits for 5 minutes to reduce database queries
const CACHE_DURATION_MS = 5 * 60 * 1000;
let cachedLimits: TierLimitsType | null = null;
let cacheTimestamp = 0;

/**
 * Get tier limits from database with in-memory caching
 * Falls back to hardcoded constants if database is unavailable
 */
export async function getTierLimits(): Promise<TierLimitsType> {
  const now = Date.now();
  
  // Return cached value if still valid
  if (cachedLimits && (now - cacheTimestamp) < CACHE_DURATION_MS) {
    return cachedLimits;
  }

  try {
    // Fetch all tier limits from database
    const [basicDaily, basicMonthly, verifiedDaily, verifiedMonthly, premiumDaily, premiumMonthly] = await Promise.all([
      storage.getSystemConfig('tier_limits_basic_daily'),
      storage.getSystemConfig('tier_limits_basic_monthly'),
      storage.getSystemConfig('tier_limits_verified_daily'),
      storage.getSystemConfig('tier_limits_verified_monthly'),
      storage.getSystemConfig('tier_limits_premium_daily'),
      storage.getSystemConfig('tier_limits_premium_monthly'),
    ]);

    // Build tier limits object
    const limits = {
      basic: {
        dailyLimit: Number(basicDaily?.value || TIER_LIMITS.basic.dailyLimit),
        monthlyLimit: Number(basicMonthly?.value || TIER_LIMITS.basic.monthlyLimit),
      },
      verified: {
        dailyLimit: Number(verifiedDaily?.value || TIER_LIMITS.verified.dailyLimit),
        monthlyLimit: Number(verifiedMonthly?.value || TIER_LIMITS.verified.monthlyLimit),
      },
      premium: {
        dailyLimit: Number(premiumDaily?.value || TIER_LIMITS.premium.dailyLimit),
        monthlyLimit: Number(premiumMonthly?.value || TIER_LIMITS.premium.monthlyLimit),
      },
    };

    // Update cache
    cachedLimits = limits;
    cacheTimestamp = now;

    return limits;
  } catch (error) {
    console.error('[TierLimitsService] Error fetching limits from database, using fallback:', error);
    
    // Return hardcoded constants as fallback
    return TIER_LIMITS;
  }
}

/**
 * Get limits for a specific tier
 */
export async function getLimitsForTier(tier: AgentTier) {
  const allLimits = await getTierLimits();
  return allLimits[tier];
}

/**
 * Invalidate cache (called when tier limits are updated)
 */
export function invalidateTierLimitsCache() {
  cachedLimits = null;
  cacheTimestamp = 0;
}
