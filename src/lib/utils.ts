import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a numeric value. When the value equals 0 (or is null/undefined/NaN),
 * returns a plain "0" — no decimals, no padding. Otherwise formats with the
 * provided fraction digits using en-US locale (thousand separators).
 */
export function formatNumber(
  n: number | null | undefined,
  opts: { minimumFractionDigits?: number; maximumFractionDigits?: number } = {}
): string {
  const v = Number(n);
  if (!Number.isFinite(v) || v === 0) return '0';
  const { minimumFractionDigits = 2, maximumFractionDigits = 2 } = opts;
  return v.toLocaleString('en-US', { minimumFractionDigits, maximumFractionDigits });
}

/**
 * Format a money value. When the value equals 0 (or null/undefined/NaN),
 * returns plain "$0". Otherwise prefixes "$" and formats with 2 decimals
 * by default.
 */
export function formatMoney(
  n: number | null | undefined,
  opts: { minimumFractionDigits?: number; maximumFractionDigits?: number } = {}
): string {
  const v = Number(n);
  if (!Number.isFinite(v) || v === 0) return '$0';
  const { minimumFractionDigits = 2, maximumFractionDigits = 2 } = opts;
  return `$${v.toLocaleString('en-US', { minimumFractionDigits, maximumFractionDigits })}`;
}
