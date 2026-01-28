/**
 * Fractional Indexing Utility
 * 
 * Generates lexicographically sortable keys for manual ordering.
 * Based on the fractional indexing algorithm used by Linear.
 * 
 * Keys are base-62 strings that can always be bisected to insert
 * new items between existing ones without reindexing.
 */

// Base62 character set for generating keys
const BASE62_DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = 62;

// Default starting key (middle of the range)
const DEFAULT_FIRST_KEY = 'a0';

/**
 * Gets the index of a character in the base62 alphabet
 */
function getCharIndex(char: string): number {
  const index = BASE62_DIGITS.indexOf(char);
  if (index === -1) {
    throw new Error(`Invalid character in sort key: ${char}`);
  }
  return index;
}

/**
 * Gets the character at a given index in the base62 alphabet
 */
function getCharAt(index: number): string {
  if (index < 0 || index >= BASE) {
    throw new Error(`Index out of range: ${index}`);
  }
  // Safe to assert non-null after bounds check
  return BASE62_DIGITS[index]!;
}

/**
 * Generates the first key for an empty list
 */
export function generateFirstKey(): string {
  return DEFAULT_FIRST_KEY;
}

/**
 * Generates a key between two existing keys.
 * 
 * @param before - The key that should sort before the new key (null for start)
 * @param after - The key that should sort after the new key (null for end)
 * @returns A new key that sorts between before and after
 * 
 * @example
 * generateKeyBetween(null, null)     // Returns 'a0' (first key)
 * generateKeyBetween('a0', null)     // Returns something like 'a0V'
 * generateKeyBetween(null, 'a0')     // Returns something like 'Zz'
 * generateKeyBetween('a0', 'a1')     // Returns something like 'a0V'
 */
export function generateKeyBetween(
  before: string | null,
  after: string | null
): string {
  // Both null: generate first key
  if (before === null && after === null) {
    return generateFirstKey();
  }

  // Validate ordering if both provided
  if (before !== null && after !== null && before >= after) {
    throw new Error(`Invalid order: before (${before}) must be less than after (${after})`);
  }

  // Only after provided: generate key before it
  if (before === null && after !== null) {
    return generateKeyBefore(after);
  }

  // Only before provided: generate key after it
  if (before !== null && after === null) {
    return generateKeyAfter(before);
  }

  // Both provided: generate key between them
  return generateKeyBetweenImpl(before!, after!);
}

/**
 * Generates a key that sorts before the given key
 */
function generateKeyBefore(key: string): string {
  // Find the first non-zero character from the right
  for (let i = key.length - 1; i >= 0; i--) {
    const charIndex = getCharIndex(key[i]!);
    if (charIndex > 0) {
      // Decrement this character and return
      const midIndex = Math.floor(charIndex / 2);
      if (midIndex > 0) {
        return key.substring(0, i) + getCharAt(midIndex);
      }
      // If we can't go lower, use the previous char and add a suffix
      return key.substring(0, i) + getCharAt(charIndex - 1) + getCharAt(Math.floor(BASE / 2));
    }
  }
  
  // All characters are '0', prepend a character before '0' range
  // Use 'Z' range (before 'a') and add suffix
  return getCharAt(Math.floor(BASE / 2) - 1);
}

/**
 * Generates a key that sorts after the given key
 */
function generateKeyAfter(key: string): string {
  // Find the first non-max character from the right
  for (let i = key.length - 1; i >= 0; i--) {
    const charIndex = getCharIndex(key[i]!);
    if (charIndex < BASE - 1) {
      // Calculate midpoint between current and max
      const midIndex = Math.floor((charIndex + BASE) / 2);
      if (midIndex > charIndex) {
        return key.substring(0, i) + getCharAt(midIndex);
      }
    }
  }
  
  // All characters at max, append a middle character
  return key + getCharAt(Math.floor(BASE / 2));
}

/**
 * Generates a key between two existing keys
 */
function generateKeyBetweenImpl(before: string, after: string): string {
  // Pad keys to same length for comparison
  const maxLen = Math.max(before.length, after.length);
  const paddedBefore = before.padEnd(maxLen, BASE62_DIGITS[0]!);
  const paddedAfter = after.padEnd(maxLen, BASE62_DIGITS[0]!);

  // Find the first differing position
  let diffPos = 0;
  while (diffPos < maxLen && paddedBefore[diffPos] === paddedAfter[diffPos]) {
    diffPos++;
  }

  // Get the indices at the differing position
  const beforeIndex = diffPos < before.length ? getCharIndex(paddedBefore[diffPos]!) : 0;
  const afterIndex = getCharIndex(paddedAfter[diffPos]!);

  // Calculate midpoint
  const midIndex = Math.floor((beforeIndex + afterIndex) / 2);

  if (midIndex > beforeIndex) {
    // We can use the midpoint
    return paddedBefore.substring(0, diffPos) + getCharAt(midIndex);
  }

  // Need to go deeper - use the before character and generate suffix
  // Take everything up to and including the diff position from before
  const prefix = before.substring(0, diffPos + 1);
  
  // Generate a suffix between '' and the remaining part of after
  const afterSuffix = after.substring(diffPos + 1);
  
  if (afterSuffix.length === 0) {
    // No suffix in after, just append middle character
    return prefix + getCharAt(Math.floor(BASE / 2));
  }

  // Generate between '' and afterSuffix
  const suffixFirstIndex = getCharIndex(afterSuffix[0]!);
  const suffixMid = Math.floor(suffixFirstIndex / 2);
  
  if (suffixMid > 0) {
    return prefix + getCharAt(suffixMid);
  }
  
  // Edge case: append and continue
  return prefix + getCharAt(0) + getCharAt(Math.floor(BASE / 2));
}

/**
 * Generates N keys between two existing keys
 * 
 * @param before - The key that should sort before all new keys (null for start)
 * @param after - The key that should sort after all new keys (null for end)
 * @param n - Number of keys to generate
 * @returns Array of n keys in sorted order
 * 
 * @example
 * generateNKeysBetween('a0', 'a1', 3) // Returns 3 keys between 'a0' and 'a1'
 */
export function generateNKeysBetween(
  before: string | null,
  after: string | null,
  n: number
): string[] {
  if (n <= 0) {
    return [];
  }

  if (n === 1) {
    return [generateKeyBetween(before, after)];
  }

  const keys: string[] = [];
  let currentBefore = before;

  for (let i = 0; i < n; i++) {
    // For even distribution, we generate keys one at a time
    // Each new key becomes the "before" for the next iteration
    const newKey = generateKeyBetween(currentBefore, after);
    keys.push(newKey);
    currentBefore = newKey;
  }

  return keys;
}

/**
 * Validates that a sort key is properly formatted
 */
export function isValidSortKey(key: string): boolean {
  if (!key || key.length === 0) {
    return false;
  }
  
  for (const char of key) {
    if (BASE62_DIGITS.indexOf(char) === -1) {
      return false;
    }
  }
  
  return true;
}

/**
 * Compares two sort keys
 * Returns negative if a < b, positive if a > b, 0 if equal
 */
export function compareSortKeys(a: string, b: string): number {
  return a.localeCompare(b);
}


// =============================================================================
// Numeric Ordering Functions (for Float-based sortOrder)
// =============================================================================

/**
 * Default increment for numeric ordering
 */
const NUMERIC_INCREMENT = 1.0;

/**
 * Minimum gap between numeric sort orders before we should consider rebalancing
 */
const MIN_GAP = 0.000001;

/**
 * Generates a numeric sort order for the first item
 */
export function generateFirstSortOrder(): number {
  return NUMERIC_INCREMENT;
}

/**
 * Generates a numeric sort order between two existing values.
 * 
 * @param before - The sort order that should be less than the new one (null for start)
 * @param after - The sort order that should be greater than the new one (null for end)
 * @returns A new sort order between before and after
 */
export function generateSortOrderBetween(
  before: number | null,
  after: number | null
): number {
  // Both null: generate first sort order
  if (before === null && after === null) {
    return generateFirstSortOrder();
  }

  // Only after provided: place before it
  if (before === null && after !== null) {
    return after - NUMERIC_INCREMENT;
  }

  // Only before provided: place after it
  if (before !== null && after === null) {
    return before + NUMERIC_INCREMENT;
  }

  // Both provided: place in the middle
  const midpoint = (before! + after!) / 2;
  
  // Check if we're running out of precision
  if (Math.abs(after! - before!) < MIN_GAP) {
    throw new Error('Sort order gap too small - rebalancing required');
  }
  
  return midpoint;
}

/**
 * Generates N numeric sort orders between two existing values
 */
export function generateNSortOrdersBetween(
  before: number | null,
  after: number | null,
  n: number
): number[] {
  if (n <= 0) {
    return [];
  }

  const start = before ?? 0;
  const end = after ?? (start + (n + 1) * NUMERIC_INCREMENT);
  const step = (end - start) / (n + 1);
  
  const orders: number[] = [];
  for (let i = 1; i <= n; i++) {
    orders.push(start + step * i);
  }
  
  return orders;
}
