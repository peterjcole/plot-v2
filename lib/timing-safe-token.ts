import { timingSafeEqual } from 'crypto';

/**
 * Constant-time string comparison for shared-secret tokens (bearer headers,
 * query-param tokens). A plain `===`/`!==` check leaks timing information
 * proportional to the matching prefix length; this doesn't.
 */
export function tokensMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
