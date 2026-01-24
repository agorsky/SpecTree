import jwt, { SignOptions, JwtPayload } from "jsonwebtoken";

/**
 * JWT utility functions for token generation and verification.
 * Used for authentication in the SpecTree API.
 */

// Token expiration times
const ACCESS_TOKEN_EXPIRY = "15m"; // 15 minutes
const REFRESH_TOKEN_EXPIRY = "7d"; // 7 days

/**
 * Token payload structure returned by verifyToken.
 */
export interface TokenPayload {
  sub: string; // User ID
  iat: number; // Issued at timestamp
  exp: number; // Expiration timestamp
}

/**
 * Token types for distinguishing between access and refresh tokens.
 */
export type TokenType = "access" | "refresh";

/**
 * Extended payload that includes token type for internal use.
 */
interface InternalTokenPayload extends TokenPayload {
  type: TokenType;
}

/**
 * Gets the JWT secret from environment variables.
 * Throws an error if JWT_SECRET is not configured.
 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not configured");
  }
  return secret;
}

/**
 * Generates a JWT access token for the given user ID.
 * Access tokens are short-lived (15 minutes) and used for API authentication.
 *
 * @param userId - The user's unique identifier
 * @returns A signed JWT access token string
 */
export function generateAccessToken(userId: string): string {
  const secret = getJwtSecret();
  const options: SignOptions = {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  };

  const payload = {
    sub: userId,
    type: "access" as TokenType,
  };

  return jwt.sign(payload, secret, options);
}

/**
 * Generates a JWT refresh token for the given user ID.
 * Refresh tokens are longer-lived (7 days) and used to obtain new access tokens.
 *
 * @param userId - The user's unique identifier
 * @returns A signed JWT refresh token string
 */
export function generateRefreshToken(userId: string): string {
  const secret = getJwtSecret();
  const options: SignOptions = {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  };

  const payload = {
    sub: userId,
    type: "refresh" as TokenType,
  };

  return jwt.sign(payload, secret, options);
}

/**
 * Verifies a JWT token and returns the payload if valid.
 * Returns null for expired, malformed, or invalid tokens.
 *
 * @param token - The JWT token string to verify
 * @returns The token payload if valid, or null if invalid/expired
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret) as JwtPayload;

    // Ensure required fields are present
    if (!decoded.sub || typeof decoded.sub !== "string") {
      return null;
    }

    if (typeof decoded.iat !== "number" || typeof decoded.exp !== "number") {
      return null;
    }

    return {
      sub: decoded.sub,
      iat: decoded.iat,
      exp: decoded.exp,
    };
  } catch {
    // Token is invalid, expired, or malformed
    return null;
  }
}

/**
 * Verifies a token and checks if it's a specific type (access or refresh).
 * Useful for ensuring tokens are used for their intended purpose.
 *
 * @param token - The JWT token string to verify
 * @param expectedType - The expected token type ("access" or "refresh")
 * @returns The token payload if valid and matches type, or null otherwise
 */
export function verifyTokenWithType(
  token: string,
  expectedType: TokenType
): TokenPayload | null {
  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret) as JwtPayload & { type?: TokenType };

    // Ensure required fields are present
    if (!decoded.sub || typeof decoded.sub !== "string") {
      return null;
    }

    if (typeof decoded.iat !== "number" || typeof decoded.exp !== "number") {
      return null;
    }

    // Check token type matches expected
    if (decoded.type !== expectedType) {
      return null;
    }

    return {
      sub: decoded.sub,
      iat: decoded.iat,
      exp: decoded.exp,
    };
  } catch {
    // Token is invalid, expired, or malformed
    return null;
  }
}
