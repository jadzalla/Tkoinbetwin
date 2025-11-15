import { PublicKey } from '@solana/web3.js';

/**
 * Agent Staking System Constants
 * 
 * Defines tier thresholds, staking parameters, and economic incentives
 * for the Tkoin Protocol agent network.
 */

// TKOIN Token Mint Address (Token-2022)
export const TKOIN_MINT = new PublicKey('J8ambbVjah5R8MSFzW7ykJ3QhcVjh4PTgKGrCzT9wPto');

// Staking Program Constants
export const STAKING_PROGRAM_ID = new PublicKey('11111111111111111111111111111111'); // TODO: Deploy staking program
export const STAKING_SEED = 'agent-stake';

// Tier Thresholds (in tokens, not base units)
export const TIER_THRESHOLDS = {
  basic: 0,           // 0 TKOIN - Entry level
  verified: 10_000,   // 10,000 TKOIN - Mid tier
  premium: 50_000,    // 50,000 TKOIN - Top tier
} as const;

// Tier Transaction Limits (daily USD volume)
export const TIER_LIMITS = {
  basic: {
    dailyLimit: 1_000,      // $1,000 per day
    monthlyLimit: 10_000,   // $10,000 per month
  },
  verified: {
    dailyLimit: 10_000,     // $10,000 per day
    monthlyLimit: 100_000,  // $100,000 per month
  },
  premium: {
    dailyLimit: 50_000,     // $50,000 per day
    monthlyLimit: 500_000,  // $500,000 per month
  },
} as const;

// Staking Parameters
export const STAKING_PARAMS = {
  lockupPeriodDays: 30,           // 30-day minimum stake period
  unstakingCooldownDays: 7,       // 7-day withdrawal delay
  minStakeAmount: 1_000,          // Minimum 1,000 TKOIN to stake
  earlyWithdrawalPenalty: 10,     // 10% penalty for early withdrawal
} as const;

// Slashing Parameters
export const SLASHING_PENALTIES = {
  minor: 10,      // 10% slash for minor violations
  major: 25,      // 25% slash for major violations
  critical: 50,   // 50% slash for critical violations
} as const;

// Tier Type
export type AgentTier = 'basic' | 'verified' | 'premium';

/**
 * Calculate tier based on staked amount (in tokens)
 */
export function calculateTier(stakedTokens: number): AgentTier {
  if (stakedTokens >= TIER_THRESHOLDS.premium) {
    return 'premium';
  } else if (stakedTokens >= TIER_THRESHOLDS.verified) {
    return 'verified';
  } else {
    return 'basic';
  }
}

/**
 * Get tier limits for a given tier
 */
export function getTierLimits(tier: AgentTier) {
  return TIER_LIMITS[tier];
}

/**
 * Check if user can upgrade to target tier with given stake
 */
export function canUpgradeToTier(stakedTokens: number, targetTier: AgentTier): boolean {
  const currentTier = calculateTier(stakedTokens);
  const tierOrder: AgentTier[] = ['basic', 'verified', 'premium'];
  
  const currentIndex = tierOrder.indexOf(currentTier);
  const targetIndex = tierOrder.indexOf(targetTier);
  
  return targetIndex <= currentIndex;
}

/**
 * Get tokens needed to reach target tier
 */
export function tokensNeededForTier(currentStake: number, targetTier: AgentTier): number {
  const threshold = TIER_THRESHOLDS[targetTier];
  return Math.max(0, threshold - currentStake);
}
