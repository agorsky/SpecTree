/**
 * Shared utility functions for MCP tools
 */

/**
 * UUID v4 regex pattern for validation
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Checks if a string is a valid UUID format.
 * This prevents SQL Server errors when attempting to use a non-UUID string
 * in a findUnique query on a UUID column.
 * 
 * @param value - The string to check
 * @returns true if the string is a valid UUID format
 */
export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}
