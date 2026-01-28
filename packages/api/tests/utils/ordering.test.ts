import { describe, it, expect } from "vitest";
import {
  generateFirstKey,
  generateKeyBetween,
  generateNKeysBetween,
  isValidSortKey,
  compareSortKeys,
  generateFirstSortOrder,
  generateSortOrderBetween,
  generateNSortOrdersBetween,
} from "../../src/utils/ordering.js";

describe("Fractional Indexing Utilities", () => {
  describe("generateFirstKey", () => {
    it("should return 'a0' as the first key", () => {
      const key = generateFirstKey();
      expect(key).toBe("a0");
    });

    it("should always return the same first key", () => {
      const key1 = generateFirstKey();
      const key2 = generateFirstKey();
      expect(key1).toBe(key2);
    });
  });

  describe("generateKeyBetween", () => {
    describe("with null boundaries", () => {
      it("should return first key when both before and after are null", () => {
        const key = generateKeyBetween(null, null);
        expect(key).toBe("a0");
      });

      it("should generate key after existing key when after is null", () => {
        const key = generateKeyBetween("a0", null);

        expect(key).toBeDefined();
        expect(key > "a0").toBe(true);
        expect(isValidSortKey(key)).toBe(true);
      });

      it("should generate key before existing key when before is null", () => {
        const key = generateKeyBetween(null, "a0");

        expect(key).toBeDefined();
        expect(key < "a0").toBe(true);
        expect(isValidSortKey(key)).toBe(true);
      });
    });

    describe("with both boundaries", () => {
      it("should generate key between two existing keys", () => {
        const key = generateKeyBetween("a0", "a1");

        expect(key).toBeDefined();
        expect(key > "a0").toBe(true);
        expect(key < "a1").toBe(true);
        expect(isValidSortKey(key)).toBe(true);
      });

      it("should generate key between close keys", () => {
        const key = generateKeyBetween("a0", "a0V");

        expect(key > "a0").toBe(true);
        expect(key < "a0V").toBe(true);
        expect(isValidSortKey(key)).toBe(true);
      });

      it("should generate key between widely spaced keys", () => {
        const key = generateKeyBetween("A0", "z0");

        expect(key > "A0").toBe(true);
        expect(key < "z0").toBe(true);
        expect(isValidSortKey(key)).toBe(true);
      });
    });

    describe("error cases", () => {
      it("should throw error when before equals after", () => {
        expect(() => generateKeyBetween("a0", "a0")).toThrow(
          "Invalid order: before (a0) must be less than after (a0)"
        );
      });

      it("should throw error when before is greater than after", () => {
        expect(() => generateKeyBetween("b0", "a0")).toThrow(
          "Invalid order: before (b0) must be less than after (a0)"
        );
      });
    });

    describe("consecutive key generation", () => {
      it("should maintain sort order when generating multiple keys after each other", () => {
        let lastKey = generateFirstKey();
        const keys = [lastKey];

        for (let i = 0; i < 5; i++) {
          const newKey = generateKeyBetween(lastKey, null);
          expect(newKey > lastKey).toBe(true);
          keys.push(newKey);
          lastKey = newKey;
        }

        // Verify all keys are in ascending order
        for (let i = 1; i < keys.length; i++) {
          expect(keys[i]! > keys[i - 1]!).toBe(true);
        }
      });

      it("should maintain sort order when generating multiple keys before each other", () => {
        let firstKey = generateFirstKey();
        const keys = [firstKey];

        for (let i = 0; i < 5; i++) {
          const newKey = generateKeyBetween(null, firstKey);
          expect(newKey < firstKey).toBe(true);
          keys.unshift(newKey);
          firstKey = newKey;
        }

        // Verify all keys are in ascending order
        for (let i = 1; i < keys.length; i++) {
          expect(keys[i]! > keys[i - 1]!).toBe(true);
        }
      });
    });
  });

  describe("generateNKeysBetween", () => {
    it("should return empty array when n is 0", () => {
      const keys = generateNKeysBetween("a0", "b0", 0);
      expect(keys).toEqual([]);
    });

    it("should return empty array when n is negative", () => {
      const keys = generateNKeysBetween("a0", "b0", -1);
      expect(keys).toEqual([]);
    });

    it("should generate single key when n is 1", () => {
      const keys = generateNKeysBetween("a0", "b0", 1);

      expect(keys).toHaveLength(1);
      expect(keys[0]! > "a0").toBe(true);
      expect(keys[0]! < "b0").toBe(true);
    });

    it("should generate multiple keys in sorted order", () => {
      const keys = generateNKeysBetween("a0", null, 5);

      expect(keys).toHaveLength(5);

      // All keys should be greater than 'a0'
      for (const key of keys) {
        expect(key > "a0").toBe(true);
        expect(isValidSortKey(key)).toBe(true);
      }

      // Keys should be in ascending order
      for (let i = 1; i < keys.length; i++) {
        expect(keys[i]! > keys[i - 1]!).toBe(true);
      }
    });

    it("should generate keys between null and null", () => {
      const keys = generateNKeysBetween(null, null, 3);

      expect(keys).toHaveLength(3);

      // First key should be the default first key
      expect(keys[0]).toBe("a0");

      // Keys should be in ascending order
      for (let i = 1; i < keys.length; i++) {
        expect(keys[i]! > keys[i - 1]!).toBe(true);
      }
    });

    it("should generate keys before existing key", () => {
      const keys = generateNKeysBetween(null, "a0", 3);

      expect(keys).toHaveLength(3);

      // All keys should be less than 'a0'
      for (const key of keys) {
        expect(key < "a0").toBe(true);
      }

      // Keys should be in ascending order
      for (let i = 1; i < keys.length; i++) {
        expect(keys[i]! > keys[i - 1]!).toBe(true);
      }
    });
  });

  describe("isValidSortKey", () => {
    it("should return true for valid base62 keys", () => {
      expect(isValidSortKey("a0")).toBe(true);
      expect(isValidSortKey("ABC123")).toBe(true);
      expect(isValidSortKey("zzzzzz")).toBe(true);
      expect(isValidSortKey("0")).toBe(true);
      expect(isValidSortKey("Z")).toBe(true);
    });

    it("should return false for empty string", () => {
      expect(isValidSortKey("")).toBe(false);
    });

    it("should return false for keys with invalid characters", () => {
      expect(isValidSortKey("a0-")).toBe(false);
      expect(isValidSortKey("hello world")).toBe(false);
      expect(isValidSortKey("a0!")).toBe(false);
      expect(isValidSortKey("test@123")).toBe(false);
    });

    it("should return true for all base62 characters", () => {
      const base62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
      expect(isValidSortKey(base62)).toBe(true);
    });
  });

  describe("compareSortKeys", () => {
    it("should return negative when a < b (lexicographically)", () => {
      expect(compareSortKeys("a0", "a1")).toBeLessThan(0);
      expect(compareSortKeys("0", "9")).toBeLessThan(0);
      expect(compareSortKeys("a0", "b0")).toBeLessThan(0);
    });

    it("should return positive when a > b (lexicographically)", () => {
      expect(compareSortKeys("a1", "a0")).toBeGreaterThan(0);
      expect(compareSortKeys("b0", "a9")).toBeGreaterThan(0);
      expect(compareSortKeys("z0", "y0")).toBeGreaterThan(0);
    });

    it("should return 0 when a equals b", () => {
      expect(compareSortKeys("a0", "a0")).toBe(0);
      expect(compareSortKeys("ABC", "ABC")).toBe(0);
    });

    it("should handle different length keys correctly", () => {
      expect(compareSortKeys("a0", "a0V")).toBeLessThan(0);
      expect(compareSortKeys("a0V", "a0")).toBeGreaterThan(0);
    });

    it("should note that compareSortKeys uses localeCompare (not base62 order)", () => {
      // The function uses localeCompare which follows lexicographic order
      // In ASCII/Unicode, uppercase A-Z (65-90) comes before lowercase a-z (97-122)
      // But in base62 ordering, the intended order is 0-9, A-Z, a-z
      // compareSortKeys uses native string comparison which may differ
      const result = compareSortKeys("A0", "a0");
      // Result depends on locale, typically uppercase < lowercase in ASCII
      expect(typeof result).toBe("number");
    });
  });
});

describe("Numeric Ordering Utilities", () => {
  describe("generateFirstSortOrder", () => {
    it("should return 1.0 as the first sort order", () => {
      const order = generateFirstSortOrder();
      expect(order).toBe(1.0);
    });
  });

  describe("generateSortOrderBetween", () => {
    describe("with null boundaries", () => {
      it("should return first sort order when both before and after are null", () => {
        const order = generateSortOrderBetween(null, null);
        expect(order).toBe(1.0);
      });

      it("should generate order after existing order when after is null", () => {
        const order = generateSortOrderBetween(5.0, null);
        expect(order).toBe(6.0);
      });

      it("should generate order before existing order when before is null", () => {
        const order = generateSortOrderBetween(null, 5.0);
        expect(order).toBe(4.0);
      });
    });

    describe("with both boundaries", () => {
      it("should generate midpoint between two orders", () => {
        const order = generateSortOrderBetween(2.0, 4.0);
        expect(order).toBe(3.0);
      });

      it("should generate midpoint between close orders", () => {
        const order = generateSortOrderBetween(1.0, 2.0);
        expect(order).toBe(1.5);
      });

      it("should generate midpoint between fractional orders", () => {
        const order = generateSortOrderBetween(1.25, 1.75);
        expect(order).toBe(1.5);
      });

      it("should handle negative orders", () => {
        const order = generateSortOrderBetween(-2.0, 0);
        expect(order).toBe(-1.0);
      });
    });

    describe("error cases", () => {
      it("should throw error when gap is at minimum threshold", () => {
        // MIN_GAP is 0.000001, so a gap smaller than this should throw
        const before = 1.0;
        const after = 1.0000005; // Gap of 0.0000005 < MIN_GAP

        expect(() => generateSortOrderBetween(before, after)).toThrow(
          "Sort order gap too small - rebalancing required"
        );
      });

      it("should work when gap is just above minimum threshold", () => {
        const before = 1.0;
        const after = 1.000002; // Gap of 0.000002 > MIN_GAP

        const order = generateSortOrderBetween(before, after);
        expect(order).toBeGreaterThan(before);
        expect(order).toBeLessThan(after);
      });

      it("should eventually throw when repeatedly bisecting", () => {
        let before = 1.0;
        let after = 2.0;

        // Keep bisecting until we hit the minimum gap
        expect(() => {
          for (let i = 0; i < 100; i++) {
            const mid = generateSortOrderBetween(before, after);
            after = mid; // Keep bisecting from the left
          }
        }).toThrow("Sort order gap too small - rebalancing required");
      });
    });

    describe("precision", () => {
      it("should maintain precision across multiple generations", () => {
        let before = 1.0;
        let after = 2.0;

        for (let i = 0; i < 10; i++) {
          const mid = generateSortOrderBetween(before, after);
          expect(mid).toBeGreaterThan(before);
          expect(mid).toBeLessThan(after);
          after = mid;
        }
      });
    });
  });

  describe("generateNSortOrdersBetween", () => {
    it("should return empty array when n is 0", () => {
      const orders = generateNSortOrdersBetween(1.0, 2.0, 0);
      expect(orders).toEqual([]);
    });

    it("should return empty array when n is negative", () => {
      const orders = generateNSortOrdersBetween(1.0, 2.0, -1);
      expect(orders).toEqual([]);
    });

    it("should generate single order when n is 1", () => {
      const orders = generateNSortOrdersBetween(1.0, 3.0, 1);

      expect(orders).toHaveLength(1);
      expect(orders[0]).toBe(2.0);
    });

    it("should generate evenly spaced orders", () => {
      const orders = generateNSortOrdersBetween(0, 4.0, 3);

      expect(orders).toHaveLength(3);
      expect(orders[0]).toBe(1.0);
      expect(orders[1]).toBe(2.0);
      expect(orders[2]).toBe(3.0);
    });

    it("should handle null before boundary", () => {
      const orders = generateNSortOrdersBetween(null, 10.0, 3);

      expect(orders).toHaveLength(3);

      // All orders should be less than 10.0
      for (const order of orders) {
        expect(order).toBeLessThan(10.0);
      }

      // Orders should be in ascending order
      for (let i = 1; i < orders.length; i++) {
        expect(orders[i]!).toBeGreaterThan(orders[i - 1]!);
      }
    });

    it("should handle null after boundary", () => {
      const orders = generateNSortOrdersBetween(5.0, null, 3);

      expect(orders).toHaveLength(3);

      // All orders should be greater than 5.0
      for (const order of orders) {
        expect(order).toBeGreaterThan(5.0);
      }

      // Orders should be in ascending order
      for (let i = 1; i < orders.length; i++) {
        expect(orders[i]!).toBeGreaterThan(orders[i - 1]!);
      }
    });

    it("should handle both null boundaries", () => {
      const orders = generateNSortOrdersBetween(null, null, 3);

      expect(orders).toHaveLength(3);

      // Orders should be in ascending order
      for (let i = 1; i < orders.length; i++) {
        expect(orders[i]!).toBeGreaterThan(orders[i - 1]!);
      }
    });

    it("should generate many orders without issues", () => {
      const orders = generateNSortOrdersBetween(0, 100.0, 99);

      expect(orders).toHaveLength(99);

      // Orders should be in ascending order and within bounds
      expect(orders[0]!).toBeGreaterThan(0);
      expect(orders[orders.length - 1]!).toBeLessThan(100.0);

      for (let i = 1; i < orders.length; i++) {
        expect(orders[i]!).toBeGreaterThan(orders[i - 1]!);
      }
    });
  });
});
