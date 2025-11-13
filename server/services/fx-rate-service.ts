import { db } from "../db";
import { fxRates, type InsertFxRate } from "@shared/schema";
import { sql, desc, eq, and, gte } from "drizzle-orm";

export interface FxRateResponse {
  base: string;
  rates: Record<string, number>;
  date: string;
}

export interface FxRateWithMetadata {
  rate: number;
  ageHours: number;
  isStale: boolean;
  timestamp: Date;
}

export class FxRateService {
  private readonly DEFAULT_BASE_CURRENCY = "USD";
  private readonly SUPPORTED_BASE_CURRENCIES = ["USD"];
  private readonly SUPPORTED_CURRENCIES = ["PHP", "EUR", "GBP", "CAD", "AUD", "SGD"];
  private readonly CACHE_TTL_HOURS = 24;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 1000;

  private validateBaseCurrency(baseCurrency: string): void {
    if (!this.SUPPORTED_BASE_CURRENCIES.includes(baseCurrency.toUpperCase())) {
      throw new Error(`Unsupported base currency: ${baseCurrency}. Supported: ${this.SUPPORTED_BASE_CURRENCIES.join(", ")}`);
    }
  }

  private isCacheStale(createdAt: Date): boolean {
    const now = new Date();
    const ageHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    return ageHours >= this.CACHE_TTL_HOURS;
  }

  async getRate(baseCurrency: string, quoteCurrency: string): Promise<number> {
    const rateWithMetadata = await this.getRateWithMetadata(baseCurrency, quoteCurrency);
    return rateWithMetadata.rate;
  }

  async getRateWithMetadata(baseCurrency: string, quoteCurrency: string): Promise<FxRateWithMetadata> {
    this.validateBaseCurrency(baseCurrency);

    const cachedRate = await db
      .select()
      .from(fxRates)
      .where(
        and(
          eq(fxRates.baseCurrency, baseCurrency),
          eq(fxRates.quoteCurrency, quoteCurrency)
        )
      )
      .orderBy(desc(fxRates.createdAt))
      .limit(1);

    if (cachedRate.length > 0 && cachedRate[0].rate && cachedRate[0].createdAt) {
      const ageHours = (Date.now() - cachedRate[0].createdAt.getTime()) / (1000 * 60 * 60);
      const isStale = this.isCacheStale(cachedRate[0].createdAt);
      
      if (!isStale) {
        console.log(`[FX] Cache hit for ${baseCurrency}/${quoteCurrency}: ${cachedRate[0].rate} (age: ${Math.round(ageHours)}h)`);
        return {
          rate: parseFloat(cachedRate[0].rate),
          ageHours,
          isStale: false,
          timestamp: cachedRate[0].createdAt,
        };
      }
      
      console.log(`[FX] Cache stale for ${baseCurrency}/${quoteCurrency} (age: ${Math.round(ageHours)}h), refreshing...`);
      try {
        await this.fetchAndCacheRates(baseCurrency);
        
        const freshRate = await db
          .select()
          .from(fxRates)
          .where(
            and(
              eq(fxRates.baseCurrency, baseCurrency),
              eq(fxRates.quoteCurrency, quoteCurrency)
            )
          )
          .orderBy(desc(fxRates.createdAt))
          .limit(1);

        if (freshRate.length > 0 && freshRate[0].createdAt) {
          const freshAgeHours = (Date.now() - freshRate[0].createdAt.getTime()) / (1000 * 60 * 60);
          return {
            rate: parseFloat(freshRate[0].rate),
            ageHours: freshAgeHours,
            isStale: false,
            timestamp: freshRate[0].createdAt,
          };
        }
      } catch (error) {
        const maxStaleHours = this.CACHE_TTL_HOURS * 2;
        if (ageHours > maxStaleHours) {
          throw new Error(`Rate for ${baseCurrency}/${quoteCurrency} is too stale (${Math.round(ageHours)}h > ${maxStaleHours}h max) and refresh failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
        
        console.warn(`[FX] Failed to refresh rate, using last-known-good (${Math.round(ageHours)}h old): ${cachedRate[0].rate}`);
        return {
          rate: parseFloat(cachedRate[0].rate),
          ageHours,
          isStale: true,
          timestamp: cachedRate[0].createdAt,
        };
      }
    }

    console.log(`[FX] Cache miss for ${baseCurrency}/${quoteCurrency}, fetching fresh rate...`);
    try {
      await this.fetchAndCacheRates(baseCurrency);

      const freshRate = await db
        .select()
        .from(fxRates)
        .where(
          and(
            eq(fxRates.baseCurrency, baseCurrency),
            eq(fxRates.quoteCurrency, quoteCurrency)
          )
        )
        .orderBy(desc(fxRates.createdAt))
        .limit(1);

      if (freshRate.length === 0) {
        throw new Error(`No rate available for ${baseCurrency}/${quoteCurrency}`);
      }

      const freshAgeHours = freshRate[0].createdAt ? (Date.now() - freshRate[0].createdAt.getTime()) / (1000 * 60 * 60) : 0;
      return {
        rate: parseFloat(freshRate[0].rate),
        ageHours: freshAgeHours,
        isStale: false,
        timestamp: freshRate[0].createdAt || new Date(),
      };
    } catch (error) {
      if (cachedRate.length > 0 && cachedRate[0].rate && cachedRate[0].createdAt) {
        const ageHours = (Date.now() - cachedRate[0].createdAt.getTime()) / (1000 * 60 * 60);
        const maxStaleHours = this.CACHE_TTL_HOURS * 2;
        
        if (ageHours > maxStaleHours) {
          throw new Error(`No fresh rate available for ${baseCurrency}/${quoteCurrency} and cached rate is too stale (${Math.round(ageHours)}h > ${maxStaleHours}h max)`);
        }
        
        console.warn(`[FX] API failed, using last-known-good rate (${Math.round(ageHours)}h old): ${cachedRate[0].rate}`);
        return {
          rate: parseFloat(cachedRate[0].rate),
          ageHours,
          isStale: true,
          timestamp: cachedRate[0].createdAt,
        };
      }
      throw new Error(`Failed to fetch rate for ${baseCurrency}/${quoteCurrency}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async getAllRates(baseCurrency: string = this.DEFAULT_BASE_CURRENCY): Promise<Record<string, number>> {
    const ratesWithMetadata = await this.getAllRatesWithMetadata(baseCurrency);
    const simpleRates: Record<string, number> = {};
    for (const [currency, metadata] of Object.entries(ratesWithMetadata)) {
      simpleRates[currency] = metadata.rate;
    }
    return simpleRates;
  }

  async getAllRatesWithMetadata(baseCurrency: string = this.DEFAULT_BASE_CURRENCY): Promise<Record<string, FxRateWithMetadata>> {
    this.validateBaseCurrency(baseCurrency);

    const cachedRates = await db
      .select()
      .from(fxRates)
      .where(eq(fxRates.baseCurrency, baseCurrency))
      .orderBy(desc(fxRates.createdAt));

    const rateMap: Record<string, FxRateWithMetadata> = {};
    const maxStaleHours = this.CACHE_TTL_HOURS * 2;
    
    for (const rate of cachedRates) {
      if (!rateMap[rate.quoteCurrency] && rate.createdAt) {
        const ageHours = (Date.now() - rate.createdAt.getTime()) / (1000 * 60 * 60);
        const isStale = this.isCacheStale(rate.createdAt);
        
        rateMap[rate.quoteCurrency] = {
          rate: parseFloat(rate.rate),
          ageHours,
          isStale,
          timestamp: rate.createdAt,
        };
      }
    }

    const missingCurrencies = this.SUPPORTED_CURRENCIES.filter(
      (currency) => !rateMap[currency]
    );
    
    const staleCurrencies = Object.keys(rateMap).filter(
      (currency) => rateMap[currency].isStale
    );

    if (missingCurrencies.length > 0 || staleCurrencies.length > 0) {
      const needsRefresh = [...missingCurrencies, ...staleCurrencies];
      console.log(`[FX] Refreshing rates for: ${needsRefresh.join(", ")}`);
      
      try {
        await this.fetchAndCacheRates(baseCurrency);

        const freshRates = await db
          .select()
          .from(fxRates)
          .where(eq(fxRates.baseCurrency, baseCurrency))
          .orderBy(desc(fxRates.createdAt));

        const freshRateMap: Record<string, FxRateWithMetadata> = {};
        for (const rate of freshRates) {
          if (!freshRateMap[rate.quoteCurrency] && rate.createdAt) {
            const ageHours = (Date.now() - rate.createdAt.getTime()) / (1000 * 60 * 60);
            freshRateMap[rate.quoteCurrency] = {
              rate: parseFloat(rate.rate),
              ageHours,
              isStale: false,
              timestamp: rate.createdAt,
            };
          }
        }
        
        for (const currency of this.SUPPORTED_CURRENCIES) {
          if (!freshRateMap[currency]) {
            throw new Error(`Post-refresh validation failed: missing rate for ${baseCurrency}/${currency}`);
          }
          if (freshRateMap[currency].ageHours > maxStaleHours) {
            throw new Error(`Post-refresh validation failed: rate for ${baseCurrency}/${currency} is stale (${Math.round(freshRateMap[currency].ageHours)}h > ${maxStaleHours}h max)`);
          }
        }
        
        return freshRateMap;
      } catch (error) {
        console.warn(`[FX] Failed to refresh rates, checking completeness and staleness threshold...`);
        
        for (const currency of this.SUPPORTED_CURRENCIES) {
          if (!rateMap[currency]) {
            throw new Error(`Missing rate for ${baseCurrency}/${currency} and refresh failed: ${error instanceof Error ? error.message : "Unknown error"}`);
          }
          
          if (rateMap[currency].ageHours > maxStaleHours) {
            throw new Error(`Rate for ${baseCurrency}/${currency} is too stale (${Math.round(rateMap[currency].ageHours)}h > ${maxStaleHours}h max) and refresh failed: ${error instanceof Error ? error.message : "Unknown error"}`);
          }
        }
        
        console.warn(`[FX] Using last-known-good rates (all ${this.SUPPORTED_CURRENCIES.length} currencies present and within ${maxStaleHours}h tolerance)`);
        return rateMap;
      }
    }

    for (const currency of this.SUPPORTED_CURRENCIES) {
      if (!rateMap[currency]) {
        throw new Error(`Missing rate for ${baseCurrency}/${currency} - no cached data available`);
      }
    }

    return rateMap;
  }

  async fetchAndCacheRates(baseCurrency: string = this.DEFAULT_BASE_CURRENCY): Promise<void> {
    this.validateBaseCurrency(baseCurrency);
    
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const rates = await this.fetchRatesFromAPI(baseCurrency);

        const missingCurrencies = this.SUPPORTED_CURRENCIES.filter(
          (currency) => !rates.rates[currency]
        );
        
        if (missingCurrencies.length > 0) {
          throw new Error(`API response missing currencies: ${missingCurrencies.join(", ")}`);
        }

        await db.transaction(async (tx) => {
          for (const quoteCurrency of this.SUPPORTED_CURRENCIES) {
            const rate = rates.rates[quoteCurrency];
            if (!rate) {
              throw new Error(`Missing rate for ${quoteCurrency} in transaction`);
            }

            await tx
              .delete(fxRates)
              .where(
                and(
                  eq(fxRates.baseCurrency, baseCurrency),
                  eq(fxRates.quoteCurrency, quoteCurrency)
                )
              );

            await tx.insert(fxRates).values({
              baseCurrency: rates.base,
              quoteCurrency,
              rate: rate.toString(),
              source: "exchangerate-api",
            });
          }
        });

        const dbRates = await db
          .select()
          .from(fxRates)
          .where(eq(fxRates.baseCurrency, baseCurrency))
          .orderBy(desc(fxRates.createdAt));

        const rateMap = new Map<string, boolean>();
        for (const rate of dbRates) {
          if (!rateMap.has(rate.quoteCurrency)) {
            rateMap.set(rate.quoteCurrency, true);
          }
        }

        const missingAfterInsert = this.SUPPORTED_CURRENCIES.filter(
          (currency) => !rateMap.has(currency)
        );

        if (missingAfterInsert.length > 0) {
          throw new Error(`Post-insert validation failed: missing currencies ${missingAfterInsert.join(", ")}`);
        }

        console.log(`[FX] Refreshed ${this.SUPPORTED_CURRENCIES.length} rates for ${baseCurrency} (attempt ${attempt}/${this.MAX_RETRIES})`);
        
        await this.cleanupOldRates(30);
        
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error");
        console.warn(`[FX] Attempt ${attempt}/${this.MAX_RETRIES} failed: ${lastError.message}`);
        
        if (attempt < this.MAX_RETRIES) {
          const delay = this.RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          console.log(`[FX] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new Error(`Failed to fetch FX rates after ${this.MAX_RETRIES} attempts: ${lastError?.message}`);
  }

  private async fetchRatesFromAPI(baseCurrency: string): Promise<FxRateResponse> {
    const apiUrl = `https://api.exchangerate-api.com/v4/latest/${baseCurrency}`;

    console.log(`[FX] Fetching rates from ${apiUrl}`);

    const response = await fetch(apiUrl, {
      signal: AbortSignal.timeout(10000),
    });

    if (response.status === 429) {
      throw new Error("Rate limit exceeded");
    }

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      base: data.base,
      rates: data.rates,
      date: data.date,
    };
  }

  async warmCache(): Promise<void> {
    console.log("[FX] Warming cache with all supported rates...");
    await this.fetchAndCacheRates(this.DEFAULT_BASE_CURRENCY);
  }

  async cleanupOldRates(daysToKeep: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await db
      .delete(fxRates)
      .where(sql`${fxRates.createdAt} < ${cutoffDate}`);

    console.log(`[FX] Cleaned up FX rates older than ${daysToKeep} days`);
  }
}

export const fxRateService = new FxRateService();
