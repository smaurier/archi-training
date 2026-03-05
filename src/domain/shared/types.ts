/**
 * Branded types pour éviter les confusions entre strings.
 * Un UUID n'est pas un slug, un Email n'est pas une adresse.
 */

declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

/** UUID v4 brandé — empêche de passer un string quelconque */
export type UUID = Brand<string, 'UUID'>;

/** Date ISO 8601 brandée */
export type ISO8601 = Brand<string, 'ISO8601'>;

/** Currency code ISO 4217 (EUR, USD, GBP...) */
export type CurrencyCode = Brand<string, 'CurrencyCode'>;

// Helpers de création (validation incluse)

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createUUID(value?: string): UUID {
  const id = value ?? crypto.randomUUID();
  if (!UUID_REGEX.test(id)) {
    throw new Error(`Invalid UUID: ${id}`);
  }
  return id as UUID;
}

const ISO8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

export function createISO8601(date: Date = new Date()): ISO8601 {
  const iso = date.toISOString();
  if (!ISO8601_REGEX.test(iso)) {
    throw new Error(`Invalid ISO8601: ${iso}`);
  }
  return iso as ISO8601;
}

const VALID_CURRENCIES = new Set(['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'JPY']);

export function createCurrencyCode(code: string): CurrencyCode {
  const upper = code.toUpperCase();
  if (upper.length !== 3 || !VALID_CURRENCIES.has(upper)) {
    throw new Error(`Invalid currency code: ${code}`);
  }
  return upper as CurrencyCode;
}
