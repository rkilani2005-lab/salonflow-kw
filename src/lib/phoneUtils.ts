/**
 * Kuwait phone number utilities
 * Normalises to +965XXXXXXXX format for consistent storage & lookup
 */

/**
 * Strip everything except digits and leading +
 */
const digitsOnly = (s: string) => s.replace(/[^\d]/g, '');

/**
 * Normalise any Kuwait phone to +965XXXXXXXX
 * Handles: 99999999, 965 9999 9999, +965-9999-9999, 0096599999999
 * Returns null if not recognisable as a Kuwait number
 */
export function normalizeKuwaitPhone(raw: string): string | null {
  if (!raw) return null;
  const digits = digitsOnly(raw);

  if (digits.length === 8) return `+965${digits}`;           // 99999999
  if (digits.length === 11 && digits.startsWith('965')) return `+${digits}`; // 96599999999
  if (digits.length === 13 && digits.startsWith('00965')) return `+${digits.slice(2)}`; // 0096599999999
  if (digits.length === 12 && digits.startsWith('0965')) return `+${digits.slice(1)}`; // 096599999999 (rare)

  // If already has correct length with + prefix
  const withPlus = raw.trim();
  if (withPlus.startsWith('+965') && digitsOnly(withPlus).length === 11) return `+${digitsOnly(withPlus)}`;

  return null; // cannot normalize
}

/**
 * Generate all plausible variants of a phone to try in DB lookup
 * e.g. +96599876543 → ['+96599876543', '96599876543', '99876543']
 */
export function phoneVariants(raw: string): string[] {
  const digits = digitsOnly(raw);
  const variants = new Set<string>();

  // Add the raw (spaces stripped) as-is
  variants.add(raw.trim());
  variants.add(raw.replace(/\s/g, ''));

  // Add with + prefix
  if (!raw.trim().startsWith('+')) variants.add(`+${raw.trim()}`);

  // Normalized form
  const normalized = normalizeKuwaitPhone(raw);
  if (normalized) variants.add(normalized);

  // 8-digit local form (last 8 digits for Kuwait numbers)
  if (digits.length >= 8) variants.add(digits.slice(-8));

  // Without country code
  if (digits.startsWith('965') && digits.length === 11) variants.add(digits.slice(3));

  return [...variants].filter(v => v.length >= 8);
}

/**
 * Auto-format a phone input value for Kuwait numbers.
 * Call this inside an onChange handler.
 * Returns the formatted value to set as input state.
 */
export function formatPhoneInput(raw: string): string {
  const digits = digitsOnly(raw);

  // Empty → keep just the prefix
  if (!digits || digits === '965') return '+965 ';
  if (digits.length <= 3 && '965'.startsWith(digits)) return `+${digits} `;

  // Extract local digits (after 965 country code)
  let local = digits.startsWith('965') ? digits.slice(3) : digits;
  local = local.slice(0, 8); // Kuwait numbers are 8 digits

  // Format as: +965 XXXX XXXX
  if (local.length <= 4) return `+965 ${local}`;
  return `+965 ${local.slice(0, 4)} ${local.slice(4)}`;
}

/**
 * Returns true if the input is a complete Kuwait phone number
 */
export function isValidKuwaitPhone(raw: string): boolean {
  return digitsOnly(raw).length === 11 && digitsOnly(raw).startsWith('965');
}
