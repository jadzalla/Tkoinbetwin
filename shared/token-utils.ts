/**
 * Tkoin Token Utilities
 * 
 * Conversion helpers for working with token amounts
 * Ensures consistent handling of base units (lamports) and human-readable tokens
 * 
 * Storage Convention: All supply values in the database are stored in BASE UNITS
 * Example: 1 TKOIN (with 9 decimals) = 1,000,000,000 base units
 */

import { TOKEN_DECIMALS } from "./token-constants";

/**
 * Helper: Calculate 10^n using BigInt
 */
function powerOfTen(n: number): bigint {
  let result = BigInt(1);
  for (let i = 0; i < n; i++) {
    result = result * BigInt(10);
  }
  return result;
}

/**
 * Convert human-readable tokens to base units (lamports)
 * Supports both whole and fractional token amounts
 * 
 * @param tokens - Human-readable token amount (e.g., "1.5", "1000000000", "0.000000001")
 * @param decimals - Number of decimals (default: TOKEN_DECIMALS = 9)
 * @returns Base units as string
 * 
 * @example
 * tokensToBaseUnits("1", 9) // "1000000000" (1 token = 1B base units)
 * tokensToBaseUnits("1.5", 9) // "1500000000" (1.5 tokens)
 * tokensToBaseUnits("0.5", 9) // "500000000" (0.5 tokens)
 * tokensToBaseUnits("1000000000", 9) // "1000000000000000000" (1B tokens)
 */
export function tokensToBaseUnits(tokens: string | number, decimals: number = TOKEN_DECIMALS): string {
  try {
    // Handle number input
    if (typeof tokens === 'number') {
      tokens = tokens.toString();
    }
    
    // Validate input
    if (!tokens || tokens === '0' || tokens === '0.0') return '0';
    
    // Remove leading/trailing whitespace
    tokens = tokens.trim();
    
    // Split into integer and fractional parts
    const parts = tokens.split('.');
    const integerPart = parts[0] || '0';
    const fractionalPart = parts[1] || '';
    
    // Validate numeric parts
    if (!/^\d+$/.test(integerPart) || (fractionalPart && !/^\d+$/.test(fractionalPart))) {
      throw new Error(`Invalid token amount: "${tokens}"`);
    }
    
    // Truncate or pad fractional part to match decimals
    let adjustedFractional = fractionalPart;
    if (adjustedFractional.length > decimals) {
      // Truncate if too many decimal places
      adjustedFractional = adjustedFractional.substring(0, decimals);
    } else if (adjustedFractional.length < decimals) {
      // Pad with zeros if needed
      adjustedFractional = adjustedFractional.padEnd(decimals, '0');
    }
    
    // Convert to base units
    const integerBaseUnits = BigInt(integerPart) * powerOfTen(decimals);
    const fractionalBaseUnits = BigInt(adjustedFractional || '0');
    const totalBaseUnits = integerBaseUnits + fractionalBaseUnits;
    
    return totalBaseUnits.toString();
  } catch (error) {
    console.error('tokensToBaseUnits conversion error:', error, { tokens, decimals });
    throw error; // Re-throw instead of silent failure
  }
}

/**
 * Convert base units (lamports) to human-readable tokens
 * Preserves fractional precision
 * 
 * @param baseUnits - Base units amount (e.g., "1500000000" for 1.5 tokens with 9 decimals)
 * @param decimals - Number of decimals (default: TOKEN_DECIMALS = 9)
 * @returns Human-readable token amount as string with proper decimal places
 * 
 * @example
 * baseUnitsToTokens("1000000000", 9) // "1" (1B base units = 1 token)
 * baseUnitsToTokens("1500000000", 9) // "1.5" (1.5B base units = 1.5 tokens)
 * baseUnitsToTokens("500000000", 9) // "0.5" (500M base units = 0.5 tokens)
 * baseUnitsToTokens("1000000000000000000", 9) // "1000000000" (1B tokens)
 */
export function baseUnitsToTokens(baseUnits: string | number, decimals: number = TOKEN_DECIMALS): string {
  try {
    // Handle number input
    if (typeof baseUnits === 'number') {
      baseUnits = baseUnits.toString();
    }
    
    // Validate input
    if (!baseUnits || baseUnits === '0') return '0';
    
    // Parse as BigInt
    const baseAmount = BigInt(baseUnits);
    const divisor = powerOfTen(decimals);
    
    // Separate integer and remainder parts
    const integerPart = baseAmount / divisor;
    const remainder = baseAmount % divisor;
    
    // If no remainder, return integer part only
    if (remainder === BigInt(0)) {
      return integerPart.toString();
    }
    
    // Convert remainder to fractional string, padded to decimals length
    const fractionalStr = remainder.toString().padStart(decimals, '0');
    
    // Remove trailing zeros from fractional part
    const trimmedFractional = fractionalStr.replace(/0+$/, '');
    
    // Return combined result
    return `${integerPart}.${trimmedFractional}`;
  } catch (error) {
    console.error('baseUnitsToTokens conversion error:', error, { baseUnits, decimals });
    throw error; // Re-throw instead of silent failure
  }
}

/**
 * Format base units for display with thousands separators
 * Preserves fractional precision
 * 
 * @param baseUnits - Base units amount
 * @param decimals - Number of decimals (default: TOKEN_DECIMALS = 9)
 * @param options - Formatting options
 * @returns Formatted string with thousands separators
 * 
 * @example
 * formatBaseUnits("1000000000000000000", 9) // "1,000,000,000"
 * formatBaseUnits("1500000000000000000", 9) // "1,500,000,000"
 * formatBaseUnits("1500000000", 9) // "1.5"
 * formatBaseUnits("500000000", 9, { minimumFractionDigits: 2 }) // "0.50"
 */
export function formatBaseUnits(
  baseUnits: string | number,
  decimals: number = TOKEN_DECIMALS,
  options: Intl.NumberFormatOptions = {}
): string {
  try {
    const tokens = baseUnitsToTokens(baseUnits, decimals);
    const num = parseFloat(tokens);
    
    if (isNaN(num)) return '0';
    
    // Default to showing all significant fractional digits
    return num.toLocaleString(undefined, {
      maximumFractionDigits: decimals,
      ...options,
    });
  } catch (error) {
    console.error('formatBaseUnits error:', error, { baseUnits, decimals });
    return '0';
  }
}
