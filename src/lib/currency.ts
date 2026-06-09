// Currency formatting for ZAINA / SalonFlow KW.
// Kuwait uses the Kuwaiti Dinar (KWD), conventionally written with 3
// decimal places (1 KD = 1000 fils). We deliberately avoid the "$" glyph
// anywhere — prices are shown as "12.500 KD" so the currency is
// unambiguous and never mixed with a dollar sign.

const DEFAULT_CODE = 'KWD';

// Symbols we are willing to render. KWD has no widely-recognised single
// glyph, so we use the short Latin code "KD" which Kuwaiti businesses use
// in everyday pricing. Other currencies fall back to their code.
const SYMBOLS: Record<string, string> = {
  KWD: 'KD',
  USD: '$',
  SAR: 'SAR',
  AED: 'AED',
  BHD: 'BD',
  QAR: 'QAR',
  OMR: 'OMR',
};

const DECIMALS: Record<string, number> = {
  KWD: 3, BHD: 3, OMR: 3, // Gulf 3-decimal currencies
};

export function currencySymbol(code: string = DEFAULT_CODE): string {
  return SYMBOLS[code] ?? code;
}

export function currencyDecimals(code: string = DEFAULT_CODE): number {
  return DECIMALS[code] ?? 2;
}

/**
 * Format a numeric amount as a currency string, e.g. formatCurrency(18) -> "18.000 KD".
 * The symbol trails the number, matching common KWD presentation.
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  code: string = DEFAULT_CODE,
): string {
  const n = Number(amount ?? 0);
  const value = (isNaN(n) ? 0 : n).toLocaleString('en-US', {
    minimumFractionDigits: currencyDecimals(code),
    maximumFractionDigits: currencyDecimals(code),
  });
  return `${value} ${currencySymbol(code)}`;
}
