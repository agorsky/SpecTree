import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import jwt from "jsonwebtoken";

// Store original env
const originalEnv = process.env;

// Mock modules before imports
vi.mock("jsonwebtoken", async () => {
  const actual = await vi.importActual<typeof import("jsonwebtoken")>("jsonwebtoken");
  return {
    ...actual,
    default: actual,
  };
});

describe("JWT Utilities", () => {
  const TEST_SECRET = "test-jwt-secret-for-testing-purposes-only";
  const TEST_USER_ID = "user-123-abc-456-def";

  beforeEach(() => {
    // Reset env before each test
    vi.resetModules();
    process.env = { ...originalEnv, JWT_SECRET: TEST_SECRET };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("generateAccessToken", () => {
    it("should generate a valid JWT access token", async () => {
      const { generateAccessToken } = await import("../../src/utils/jwt.js");

      const token = generateAccessToken(TEST_USER_ID);

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3); // JWT has 3 parts
    });

    it("should include correct payload in access token", async () => {
      const { generateAccessToken } = await import("../../src/utils/jwt.js");

      const token = generateAccessToken(TEST_USER_ID);
      const decoded = jwt.decode(token) as jwt.JwtPayload;

      expect(decoded.sub).toBe(TEST_USER_ID);
      expect(decoded.type).toBe("access");
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });

    it("should set expiration to approximately 15 minutes", async () => {
      const { generateAccessToken } = await import("../../src/utils/jwt.js");

      const token = generateAccessToken(TEST_USER_ID);
      const decoded = jwt.decode(token) as jwt.JwtPayload;

      const expiresInSeconds = decoded.exp! - decoded.iat!;
      expect(expiresInSeconds).toBe(15 * 60); // 15 minutes in seconds
    });

    it("should throw error when JWT_SECRET is not configured", async () => {
      delete process.env.JWT_SECRET;
      vi.resetModules();

      const { generateAccessToken } = await import("../../src/utils/jwt.js");

      expect(() => generateAccessToken(TEST_USER_ID)).toThrow(
        "JWT_SECRET environment variable is not configured"
      );
    });
  });

  describe("generateRefreshToken", () => {
    it("should generate a valid JWT refresh token", async () => {
      const { generateRefreshToken } = await import("../../src/utils/jwt.js");

      const token = generateRefreshToken(TEST_USER_ID);

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);
    });

    it("should include correct payload in refresh token", async () => {
      const { generateRefreshToken } = await import("../../src/utils/jwt.js");

      const token = generateRefreshToken(TEST_USER_ID);
      const decoded = jwt.decode(token) as jwt.JwtPayload;

      expect(decoded.sub).toBe(TEST_USER_ID);
      expect(decoded.type).toBe("refresh");
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });

    it("should set expiration to approximately 7 days", async () => {
      const { generateRefreshToken } = await import("../../src/utils/jwt.js");

      const token = generateRefreshToken(TEST_USER_ID);
      const decoded = jwt.decode(token) as jwt.JwtPayload;

      const expiresInSeconds = decoded.exp! - decoded.iat!;
      expect(expiresInSeconds).toBe(7 * 24 * 60 * 60); // 7 days in seconds
    });

    it("should throw error when JWT_SECRET is not configured", async () => {
      delete process.env.JWT_SECRET;
      vi.resetModules();

      const { generateRefreshToken } = await import("../../src/utils/jwt.js");

      expect(() => generateRefreshToken(TEST_USER_ID)).toThrow(
        "JWT_SECRET environment variable is not configured"
      );
    });
  });

  describe("verifyToken", () => {
    it("should return payload for valid access token", async () => {
      const { generateAccessToken, verifyToken } = await import("../../src/utils/jwt.js");

      const token = generateAccessToken(TEST_USER_ID);
      const payload = verifyToken(token);

      expect(payload).not.toBeNull();
      expect(payload!.sub).toBe(TEST_USER_ID);
      expect(typeof payload!.iat).toBe("number");
      expect(typeof payload!.exp).toBe("number");
    });

    it("should return payload for valid refresh token", async () => {
      const { generateRefreshToken, verifyToken } = await import("../../src/utils/jwt.js");

      const token = generateRefreshToken(TEST_USER_ID);
      const payload = verifyToken(token);

      expect(payload).not.toBeNull();
      expect(payload!.sub).toBe(TEST_USER_ID);
    });

    it("should return null for expired token", async () => {
      const { verifyToken } = await import("../../src/utils/jwt.js");

      // Create an already expired token
      const expiredToken = jwt.sign(
        { sub: TEST_USER_ID, type: "access" },
        TEST_SECRET,
        { expiresIn: "-1s" }
      );

      const payload = verifyToken(expiredToken);

      expect(payload).toBeNull();
    });

    it("should return null for malformed token", async () => {
      const { verifyToken } = await import("../../src/utils/jwt.js");

      const payload = verifyToken("not-a-valid-jwt-token");

      expect(payload).toBeNull();
    });

    it("should return null for token signed with wrong secret", async () => {
      const { verifyToken } = await import("../../src/utils/jwt.js");

      const tokenWithWrongSecret = jwt.sign(
        { sub: TEST_USER_ID, type: "access" },
        "wrong-secret",
        { expiresIn: "15m" }
      );

      const payload = verifyToken(tokenWithWrongSecret);

      expect(payload).toBeNull();
    });

    it("should return null for token without sub field", async () => {
      const { verifyToken } = await import("../../src/utils/jwt.js");

      const tokenWithoutSub = jwt.sign(
        { type: "access" },
        TEST_SECRET,
        { expiresIn: "15m" }
      );

      const payload = verifyToken(tokenWithoutSub);

      expect(payload).toBeNull();
    });

    it("should return null for token with non-string sub field", async () => {
      const { verifyToken } = await import("../../src/utils/jwt.js");

      const tokenWithNumericSub = jwt.sign(
        { sub: 12345, type: "access" },
        TEST_SECRET,
        { expiresIn: "15m" }
      );

      const payload = verifyToken(tokenWithNumericSub);

      expect(payload).toBeNull();
    });

    it("should return null when JWT_SECRET is not configured (error caught internally)", async () => {
      delete process.env.JWT_SECRET;
      vi.resetModules();

      const { verifyToken } = await import("../../src/utils/jwt.js");

      // verifyToken catches all errors and returns null for any verification failure
      // including missing JWT_SECRET - this is by design to avoid exposing internal errors
      const result = verifyToken("some-token");
      expect(result).toBeNull();
    });
  });

  describe("verifyTokenWithType", () => {
    it("should return payload when token type matches expected type (access)", async () => {
      const { generateAccessToken, verifyTokenWithType } = await import("../../src/utils/jwt.js");

      const token = generateAccessToken(TEST_USER_ID);
      const payload = verifyTokenWithType(token, "access");

      expect(payload).not.toBeNull();
      expect(payload!.sub).toBe(TEST_USER_ID);
    });

    it("should return payload when token type matches expected type (refresh)", async () => {
      const { generateRefreshToken, verifyTokenWithType } = await import("../../src/utils/jwt.js");

      const token = generateRefreshToken(TEST_USER_ID);
      const payload = verifyTokenWithType(token, "refresh");

      expect(payload).not.toBeNull();
      expect(payload!.sub).toBe(TEST_USER_ID);
    });

    it("should return null when access token is verified as refresh", async () => {
      const { generateAccessToken, verifyTokenWithType } = await import("../../src/utils/jwt.js");

      const token = generateAccessToken(TEST_USER_ID);
      const payload = verifyTokenWithType(token, "refresh");

      expect(payload).toBeNull();
    });

    it("should return null when refresh token is verified as access", async () => {
      const { generateRefreshToken, verifyTokenWithType } = await import("../../src/utils/jwt.js");

      const token = generateRefreshToken(TEST_USER_ID);
      const payload = verifyTokenWithType(token, "access");

      expect(payload).toBeNull();
    });

    it("should return null for token without type field", async () => {
      const { verifyTokenWithType } = await import("../../src/utils/jwt.js");

      const tokenWithoutType = jwt.sign(
        { sub: TEST_USER_ID },
        TEST_SECRET,
        { expiresIn: "15m" }
      );

      const payload = verifyTokenWithType(tokenWithoutType, "access");

      expect(payload).toBeNull();
    });

    it("should return null for expired token", async () => {
      const { verifyTokenWithType } = await import("../../src/utils/jwt.js");

      const expiredToken = jwt.sign(
        { sub: TEST_USER_ID, type: "access" },
        TEST_SECRET,
        { expiresIn: "-1s" }
      );

      const payload = verifyTokenWithType(expiredToken, "access");

      expect(payload).toBeNull();
    });

    it("should return null for malformed token", async () => {
      const { verifyTokenWithType } = await import("../../src/utils/jwt.js");

      const payload = verifyTokenWithType("invalid-token", "access");

      expect(payload).toBeNull();
    });

    it("should return null for token with invalid sub field", async () => {
      const { verifyTokenWithType } = await import("../../src/utils/jwt.js");

      const tokenWithInvalidSub = jwt.sign(
        { sub: null, type: "access" },
        TEST_SECRET,
        { expiresIn: "15m" }
      );

      const payload = verifyTokenWithType(tokenWithInvalidSub, "access");

      expect(payload).toBeNull();
    });

    it("should return null when JWT_SECRET is not configured (error caught internally)", async () => {
      delete process.env.JWT_SECRET;
      vi.resetModules();

      const { verifyTokenWithType } = await import("../../src/utils/jwt.js");

      // verifyTokenWithType catches all errors and returns null for any verification failure
      // including missing JWT_SECRET - this is by design to avoid exposing internal errors
      const result = verifyTokenWithType("some-token", "access");
      expect(result).toBeNull();
    });
  });
});
