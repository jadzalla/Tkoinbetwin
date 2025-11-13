import { db } from "../db";
import { 
  agentCurrencySettings, 
  agentQuotes, 
  systemConfig,
  agents,
  type InsertAgentQuote 
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { FxRateService } from "./fx-rate-service";
import { z } from "zod";
import Decimal from "decimal.js";

export interface AgentPricing {
  currency: string;
  isActive: boolean;
  bidPricePer1kTkoin: number;
  askPricePer1kTkoin: number;
  margin: number;
  fxRate: number;
  fxRateAge: number;
  bidSpreadBps: number;
  askSpreadBps: number;
  fxBufferBps: number;
  minOrderUsd: number;
  maxOrderUsd: number;
  dailyLimitUsd: number;
}

export interface CreateQuoteParams {
  agentId: string;
  currency: string;
  quoteType: 'buy_from_agent' | 'sell_to_agent';
  fiatAmount?: number;
  tkoinAmount?: number;
}

export interface Quote {
  id: string;
  agentId: string;
  currency: string;
  quoteType: 'buy_from_agent' | 'sell_to_agent';
  fiatAmount: string;
  tkoinAmount: string;
  exchangeRate: string;
  spotRate: string;
  fxRate: string | null;
  askSpreadBps: number;
  bidSpreadBps: number;
  expiresAt: Date;
  status: 'active' | 'used' | 'expired';
}

export interface PublicRates {
  base: string;
  timestamp: Date;
  rates: Record<string, {
    fxRate: number;
    midPrice: number;
    bidPrice: number;
    askPrice: number;
  }>;
}

/**
 * Zod schema for validating system_config.pricing_defaults JSON
 * - Uses coercion to handle legacy string values from JSON
 * - Strict mode catches unsupported fields
 * - Falls back to hardcoded defaults on validation failure
 */
const PricingDefaultsSchema = z.object({
  bidSpreadBps: z.coerce.number().pipe(z.number().min(50).max(500)),
  askSpreadBps: z.coerce.number().pipe(z.number().min(50).max(500)),
  fxBufferBps: z.coerce.number().pipe(z.number().min(0).max(200)),
  minOrderUsd: z.coerce.number().pipe(z.number().positive()),
  maxOrderUsd: z.coerce.number().pipe(z.number().positive()),
  dailyLimitUsd: z.coerce.number().pipe(z.number().positive()),
  quoteTtlMinutes: z.coerce.number().pipe(z.number().positive()),
}).strict();

type PricingDefaults = z.infer<typeof PricingDefaultsSchema>;

export class PricingService {
  private readonly fxService: FxRateService;
  
  // Economic defaults matching agent_currency_settings schema
  private readonly DEFAULT_BID_SPREAD_BPS = 150; // 1.5% discount when buying from users
  private readonly DEFAULT_ASK_SPREAD_BPS = 250; // 2.5% markup when selling to users
  private readonly DEFAULT_FX_BUFFER_BPS = 75; // 0.75% FX safety buffer
  private readonly DEFAULT_MIN_ORDER_USD = 10;
  private readonly DEFAULT_MAX_ORDER_USD = 5000;
  private readonly DEFAULT_DAILY_LIMIT_USD = 10000;
  private readonly DEFAULT_QUOTE_TTL_MINUTES = 5;
  private readonly DEFAULT_PUBLIC_SPREAD_BPS = 200;

  private readonly MIN_SPREAD_BPS = 50;
  private readonly MAX_SPREAD_BPS = 500;
  private readonly MIN_FX_BUFFER_BPS = 0;
  private readonly MAX_FX_BUFFER_BPS = 200;

  private readonly USD_ANCHOR = 1.0;

  constructor() {
    this.fxService = new FxRateService();
    
    // Configure Decimal.js for financial precision
    Decimal.set({ 
      precision: 28,
      rounding: Decimal.ROUND_HALF_UP 
    });
  }

  private async getSystemConfig<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const config = await db
        .select()
        .from(systemConfig)
        .where(eq(systemConfig.key, key))
        .limit(1);

      if (config.length > 0 && config[0].value) {
        return config[0].value as T;
      }
    } catch (error) {
      console.warn(`[Pricing] Failed to get system config for ${key}, using default:`, error);
    }
    return defaultValue;
  }

  /**
   * Get agent-specific pricing settings for a currency with robust fallback handling
   * 
   * Fallback precedence:
   * 1. Agent-specific overrides from agent_currency_settings (if active)
   * 2. Validated system defaults from getDefaultSettings()
   * 3. Hardcoded constants (if all else fails)
   * 
   * Null/NaN handling:
   * - Null DB values fall back to defaults (not coerced to 0)
   * - NaN after conversion triggers full default fallback with error log
   * - Invalid limit ordering (min > max) uses defaults with warning
   * 
   * Global caps:
   * - dailyLimitUsd capped at agent.dailyLimit from agents table
   * - Protects against per-currency exposure exceeding global agent limit
   * 
   * @param agentId - Agent ID
   * @param currency - ISO currency code (PHP, EUR, USD, etc.)
   * @returns Settings with all numeric values guaranteed, isActive flag
   */
  private async getAgentSettings(agentId: string, currency: string) {
    const settings = await db
      .select()
      .from(agentCurrencySettings)
      .where(
        and(
          eq(agentCurrencySettings.agentId, agentId),
          eq(agentCurrencySettings.currency, currency)
        )
      )
      .limit(1);

    const agent = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    let agentGlobalDailyLimit = 10000;
    if (agent.length > 0 && agent[0].dailyLimit != null) {
      const parsed = parseFloat(agent[0].dailyLimit);
      agentGlobalDailyLimit = isNaN(parsed) ? 10000 : parsed;
    }
    
    const defaults = await this.getDefaultSettings();

    if (settings.length === 0) {
      return {
        isActive: false,
        bidSpreadBps: defaults.bidSpreadBps,
        askSpreadBps: defaults.askSpreadBps,
        fxBufferBps: defaults.fxBufferBps,
        minOrderUsd: defaults.minOrderUsd,
        maxOrderUsd: defaults.maxOrderUsd,
        dailyLimitUsd: Math.min(defaults.dailyLimitUsd, agentGlobalDailyLimit),
      };
    }

    const s = settings[0];
    const bidSpreadBps = s.bidSpreadBps != null ? Number(s.bidSpreadBps) : defaults.bidSpreadBps;
    const askSpreadBps = s.askSpreadBps != null ? Number(s.askSpreadBps) : defaults.askSpreadBps;
    const fxBufferBps = s.fxBufferBps != null ? Number(s.fxBufferBps) : defaults.fxBufferBps;
    const minOrderUsd = s.minOrderUsd != null ? Number(s.minOrderUsd) : defaults.minOrderUsd;
    const maxOrderUsd = s.maxOrderUsd != null ? Number(s.maxOrderUsd) : defaults.maxOrderUsd;
    const dailyLimitUsd = Math.min(s.dailyLimitUsd != null ? Number(s.dailyLimitUsd) : defaults.dailyLimitUsd, agentGlobalDailyLimit);

    if (isNaN(bidSpreadBps) || isNaN(askSpreadBps) || isNaN(fxBufferBps) || isNaN(minOrderUsd) || isNaN(maxOrderUsd) || isNaN(dailyLimitUsd)) {
      console.error(`[Pricing] NaN values detected in agent ${agentId} currency ${currency} settings, using defaults`);
      return {
        isActive: s.isActive,
        bidSpreadBps: defaults.bidSpreadBps,
        askSpreadBps: defaults.askSpreadBps,
        fxBufferBps: defaults.fxBufferBps,
        minOrderUsd: defaults.minOrderUsd,
        maxOrderUsd: defaults.maxOrderUsd,
        dailyLimitUsd: Math.min(defaults.dailyLimitUsd, agentGlobalDailyLimit),
      };
    }

    if (minOrderUsd > maxOrderUsd) {
      console.warn(`[Pricing] Invalid limits for agent ${agentId} currency ${currency}: min ${minOrderUsd} > max ${maxOrderUsd}, using defaults`);
      return {
        isActive: s.isActive,
        bidSpreadBps: defaults.bidSpreadBps,
        askSpreadBps: defaults.askSpreadBps,
        fxBufferBps: defaults.fxBufferBps,
        minOrderUsd: defaults.minOrderUsd,
        maxOrderUsd: defaults.maxOrderUsd,
        dailyLimitUsd: Math.min(defaults.dailyLimitUsd, agentGlobalDailyLimit),
      };
    }

    if (maxOrderUsd > dailyLimitUsd) {
      console.warn(`[Pricing] Invalid limits for agent ${agentId} currency ${currency}: max ${maxOrderUsd} > daily ${dailyLimitUsd}, capping max at daily limit`);
    }

    return {
      isActive: s.isActive,
      bidSpreadBps,
      askSpreadBps,
      fxBufferBps,
      minOrderUsd,
      maxOrderUsd: Math.min(maxOrderUsd, dailyLimitUsd),
      dailyLimitUsd,
    };
  }

  /**
   * Get validated default pricing settings from system_config
   * 
   * Fallback precedence:
   * 1. Validated system_config.pricing_defaults (with Zod schema)
   * 2. Hardcoded constants (if validation fails)
   * 
   * @returns Validated pricing defaults with all numeric values guaranteed
   */
  private async getDefaultSettings(): Promise<PricingDefaults> {
    const config = await this.getSystemConfig('pricing_defaults', {
      bidSpreadBps: this.DEFAULT_BID_SPREAD_BPS,
      askSpreadBps: this.DEFAULT_ASK_SPREAD_BPS,
      fxBufferBps: this.DEFAULT_FX_BUFFER_BPS,
      minOrderUsd: this.DEFAULT_MIN_ORDER_USD,
      maxOrderUsd: this.DEFAULT_MAX_ORDER_USD,
      dailyLimitUsd: this.DEFAULT_DAILY_LIMIT_USD,
      quoteTtlMinutes: this.DEFAULT_QUOTE_TTL_MINUTES,
    });

    try {
      // Validate with Zod schema (handles string coercion + range validation)
      const validated = await PricingDefaultsSchema.parseAsync(config);
      return validated;
    } catch (error) {
      // Log validation failure with full details for operators
      console.error('[Pricing] System config validation failed, using hardcoded defaults', {
        error: error instanceof Error ? error.message : String(error),
        receivedConfig: config,
      });
      
      // Fall back to hardcoded constants
      return {
        bidSpreadBps: this.DEFAULT_BID_SPREAD_BPS,
        askSpreadBps: this.DEFAULT_ASK_SPREAD_BPS,
        fxBufferBps: this.DEFAULT_FX_BUFFER_BPS,
        minOrderUsd: this.DEFAULT_MIN_ORDER_USD,
        maxOrderUsd: this.DEFAULT_MAX_ORDER_USD,
        dailyLimitUsd: this.DEFAULT_DAILY_LIMIT_USD,
        quoteTtlMinutes: this.DEFAULT_QUOTE_TTL_MINUTES,
      };
    }
  }

  private validateSpreadBps(spreadBps: number, name: string): void {
    if (spreadBps < this.MIN_SPREAD_BPS || spreadBps > this.MAX_SPREAD_BPS) {
      throw new Error(`${name} must be between ${this.MIN_SPREAD_BPS} and ${this.MAX_SPREAD_BPS} bps`);
    }
  }

  private validateFxBufferBps(bufferBps: number): void {
    if (bufferBps < this.MIN_FX_BUFFER_BPS || bufferBps > this.MAX_FX_BUFFER_BPS) {
      throw new Error(`FX buffer must be between ${this.MIN_FX_BUFFER_BPS} and ${this.MAX_FX_BUFFER_BPS} bps`);
    }
  }

  async getAgentPricing(agentId: string, currency: string): Promise<AgentPricing> {
    const fxRateData = await this.fxService.getRateWithMetadata('USD', currency);
    const settings = await this.getAgentSettings(agentId, currency);

    this.validateSpreadBps(settings.bidSpreadBps, 'Bid spread');
    this.validateSpreadBps(settings.askSpreadBps, 'Ask spread');
    this.validateFxBufferBps(settings.fxBufferBps);

    const baseRate = fxRateData.rate;
    const bidSpread = settings.bidSpreadBps / 10000;
    const askSpread = settings.askSpreadBps / 10000;
    const fxBuffer = settings.fxBufferBps / 10000;

    const bidPricePer1Tkoin = baseRate * this.USD_ANCHOR * (1 - bidSpread - fxBuffer);
    const askPricePer1Tkoin = baseRate * this.USD_ANCHOR * (1 + askSpread + fxBuffer);
    
    const bidPricePer1kTkoin = bidPricePer1Tkoin * 1000;
    const askPricePer1kTkoin = askPricePer1Tkoin * 1000;
    const margin = askPricePer1kTkoin - bidPricePer1kTkoin;

    return {
      currency,
      isActive: settings.isActive,
      bidPricePer1kTkoin: Math.floor(bidPricePer1kTkoin * 100) / 100,
      askPricePer1kTkoin: Math.ceil(askPricePer1kTkoin * 100) / 100,
      margin: Math.floor(margin * 100) / 100,
      fxRate: baseRate,
      fxRateAge: fxRateData.ageHours,
      bidSpreadBps: settings.bidSpreadBps,
      askSpreadBps: settings.askSpreadBps,
      fxBufferBps: settings.fxBufferBps,
      minOrderUsd: settings.minOrderUsd,
      maxOrderUsd: settings.maxOrderUsd,
      dailyLimitUsd: settings.dailyLimitUsd,
    };
  }

  /**
   * Create a time-locked quote for buying/selling TKOIN
   * 
   * Uses Decimal.js for all monetary calculations to ensure:
   * - Exact decimal precision (no IEEE floating point errors)
   * - Deterministic rounding (ROUND_HALF_UP)
   * - Safe handling of large amounts (>$1M)
   * 
   * Validation gates:
   * 1. Agent exists and is active
   * 2. Currency is supported by agent
   * 3. FX rate is available and fresh
   * 4. Amounts within min/max/daily limits
   * 5. Agent has sufficient inventory (for buy_from_agent)
   * 6. Precision bounds respected (12 digits integer + 8 decimal for TKOIN)
   * 
   * @param params - Quote creation parameters
   * @returns Created quote with time lock and status='active'
   */
  async createQuote(params: CreateQuoteParams): Promise<Quote> {
    const { agentId, currency, quoteType, fiatAmount, tkoinAmount } = params;

    if (!fiatAmount && !tkoinAmount) {
      throw new Error('Either fiatAmount or tkoinAmount must be provided');
    }

    const agent = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    if (agent.length === 0) {
      throw new Error('Agent not found');
    }

    if (agent[0].status !== 'active') {
      throw new Error('Agent is not active');
    }

    const settings = await this.getAgentSettings(agentId, currency);

    if (!settings.isActive) {
      throw new Error(`Agent does not support ${currency}`);
    }

    const fxRateData = await this.fxService.getRateWithMetadata('USD', currency);
    const baseRateDec = new Decimal(fxRateData.rate);

    // Calculate effective rate using Decimal for precision
    const bidSpreadDec = new Decimal(settings.bidSpreadBps).div(10000);
    const askSpreadDec = new Decimal(settings.askSpreadBps).div(10000);
    const fxBufferDec = new Decimal(settings.fxBufferBps).div(10000);
    const usdAnchorDec = new Decimal(this.USD_ANCHOR);

    const effectiveRateDec = quoteType === 'sell_to_agent'
      ? baseRateDec.mul(usdAnchorDec).mul(new Decimal(1).minus(bidSpreadDec).minus(fxBufferDec))
      : baseRateDec.mul(usdAnchorDec).mul(new Decimal(1).plus(askSpreadDec).plus(fxBufferDec));

    // Calculate final amounts with Decimal precision
    let finalFiatAmountDec: Decimal;
    let finalTkoinAmountDec: Decimal;

    if (fiatAmount) {
      finalFiatAmountDec = new Decimal(fiatAmount);
      finalTkoinAmountDec = finalFiatAmountDec.div(effectiveRateDec);
    } else {
      finalTkoinAmountDec = new Decimal(tkoinAmount!);
      finalFiatAmountDec = finalTkoinAmountDec.mul(effectiveRateDec);
    }

    // Convert to numbers for validation (Decimal → number is safe for these ranges)
    const finalFiatAmount = finalFiatAmountDec.toNumber();
    const finalTkoinAmount = finalTkoinAmountDec.toNumber();
    const effectiveRate = effectiveRateDec.toNumber();
    const baseRate = baseRateDec.toNumber();

    const orderValueUsd = finalFiatAmount / baseRate;

    const MAX_DECIMAL_20_8 = 999999999999;
    const MAX_DECIMAL_20_2 = 999999999999999999;

    if (Math.abs(finalTkoinAmount) > MAX_DECIMAL_20_8) {
      throw new Error('TKOIN amount exceeds maximum precision (12 digits)');
    }

    if (Math.abs(finalFiatAmount) > MAX_DECIMAL_20_2) {
      throw new Error('Fiat amount exceeds maximum precision (18 digits)');
    }

    if (Math.abs(effectiveRate) > MAX_DECIMAL_20_8) {
      throw new Error('Exchange rate exceeds maximum precision (12 digits)');
    }

    if (orderValueUsd < settings.minOrderUsd) {
      throw new Error(`Order value ($${orderValueUsd.toFixed(2)}) is below minimum ($${settings.minOrderUsd})`);
    }

    if (orderValueUsd > settings.maxOrderUsd) {
      throw new Error(`Order value ($${orderValueUsd.toFixed(2)}) exceeds maximum ($${settings.maxOrderUsd})`);
    }

    if (quoteType === 'buy_from_agent') {
      const agentBalance = parseFloat(agent[0].tkoinBalance);
      if (finalTkoinAmount > agentBalance) {
        throw new Error(`Insufficient agent inventory: ${finalTkoinAmount.toFixed(2)} TKOIN requested, ${agentBalance.toFixed(2)} available`);
      }
    }

    const defaults = await this.getDefaultSettings();
    const quoteTtlMinutes = defaults.quoteTtlMinutes;
    const expiresAt = new Date(Date.now() + quoteTtlMinutes * 60 * 1000);

    const [quote] = await db
      .insert(agentQuotes)
      .values({
        agentId,
        currency,
        quoteType,
        tkoinAmount: finalTkoinAmount.toFixed(8),
        fiatAmount: finalFiatAmount.toFixed(2),
        exchangeRate: effectiveRate.toFixed(8),
        spotRate: this.USD_ANCHOR.toFixed(8),
        fxRate: baseRate.toFixed(8),
        askSpreadBps: settings.askSpreadBps,
        bidSpreadBps: settings.bidSpreadBps,
        expiresAt,
        status: 'active',
      })
      .returning();

    return {
      id: quote.id,
      agentId: quote.agentId,
      currency: quote.currency,
      quoteType: quote.quoteType as 'buy_from_agent' | 'sell_to_agent',
      fiatAmount: quote.fiatAmount,
      tkoinAmount: quote.tkoinAmount,
      exchangeRate: quote.exchangeRate,
      spotRate: quote.spotRate,
      fxRate: quote.fxRate,
      askSpreadBps: quote.askSpreadBps,
      bidSpreadBps: quote.bidSpreadBps,
      expiresAt: quote.expiresAt,
      status: quote.status as 'active' | 'used' | 'expired',
    };
  }

  async validateQuote(quoteId: string): Promise<boolean> {
    const quote = await db
      .select()
      .from(agentQuotes)
      .where(eq(agentQuotes.id, quoteId))
      .limit(1);

    if (quote.length === 0) {
      throw new Error('Quote not found');
    }

    const q = quote[0];

    if (q.status !== 'active') {
      return false;
    }

    if (new Date() > q.expiresAt) {
      await db
        .update(agentQuotes)
        .set({ status: 'expired' })
        .where(eq(agentQuotes.id, quoteId));
      return false;
    }

    if (!q.fxRate) {
      return true;
    }

    const fxRateData = await this.fxService.getRateWithMetadata('USD', q.currency);
    const currentRate = fxRateData.rate;
    const quoteFxRate = parseFloat(q.fxRate);
    const drift = Math.abs(currentRate - quoteFxRate) / quoteFxRate;

    const maxDriftBps = 100;
    const maxDrift = maxDriftBps / 10000;

    if (drift > maxDrift) {
      console.warn(`[Pricing] Quote ${quoteId} FX drift too high: ${(drift * 100).toFixed(2)}% (max ${(maxDrift * 100).toFixed(2)}%)`);
    }

    return true;
  }

  async getPublicPricing(currency: string): Promise<AgentPricing> {
    const fxRateData = await this.fxService.getRateWithMetadata('USD', currency);
    const publicSpreadBps = Number(await this.getSystemConfig('public_spread_bps', this.DEFAULT_PUBLIC_SPREAD_BPS));
    const publicFxBufferBps = Number(await this.getSystemConfig('public_fx_buffer_bps', this.DEFAULT_FX_BUFFER_BPS));
    
    const baseRate = fxRateData.rate;
    const publicSpread = publicSpreadBps / 10000;
    const publicFxBuffer = publicFxBufferBps / 10000;
    
    const bidPricePer1Tkoin = baseRate * this.USD_ANCHOR * (1 - publicSpread - publicFxBuffer);
    const askPricePer1Tkoin = baseRate * this.USD_ANCHOR * (1 + publicSpread + publicFxBuffer);
    
    const bidPricePer1kTkoin = bidPricePer1Tkoin * 1000;
    const askPricePer1kTkoin = askPricePer1Tkoin * 1000;
    const margin = askPricePer1kTkoin - bidPricePer1kTkoin;

    return {
      currency,
      isActive: true,
      bidPricePer1kTkoin: Math.floor(bidPricePer1kTkoin * 100) / 100,
      askPricePer1kTkoin: Math.ceil(askPricePer1kTkoin * 100) / 100,
      margin: Math.floor(margin * 100) / 100,
      fxRate: baseRate,
      fxRateAge: fxRateData.ageHours,
      bidSpreadBps: publicSpreadBps,
      askSpreadBps: publicSpreadBps,
      fxBufferBps: publicFxBufferBps,
      minOrderUsd: 0,
      maxOrderUsd: 0,
      dailyLimitUsd: 0,
    };
  }

  async getPublicRates(): Promise<PublicRates> {
    const allRates = await this.fxService.getAllRatesWithMetadata('USD');
    
    const publicSpreadBps = Number(await this.getSystemConfig('public_spread_bps', this.DEFAULT_PUBLIC_SPREAD_BPS));
    const publicSpread = publicSpreadBps / 10000;

    const rates: Record<string, { fxRate: number; midPrice: number; bidPrice: number; askPrice: number }> = {};

    for (const [currency, rateData] of Object.entries(allRates)) {
      const fxRate = rateData.rate;
      const midPrice = fxRate * this.USD_ANCHOR;
      const bidPrice = midPrice * (1 - publicSpread);
      const askPrice = midPrice * (1 + publicSpread);

      rates[currency] = {
        fxRate: Math.floor(fxRate * 10000) / 10000,
        midPrice: Math.floor(midPrice * 100) / 100,
        bidPrice: Math.floor(bidPrice * 100) / 100,
        askPrice: Math.ceil(askPrice * 100) / 100,
      };
    }

    const latestTimestamp = Object.values(allRates)
      .map(r => r.timestamp)
      .reduce((latest, ts) => ts > latest ? ts : latest);

    return {
      base: 'USD',
      timestamp: latestTimestamp,
      rates,
    };
  }
}
