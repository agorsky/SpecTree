import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read version from root package.json at module load time (build-time bundling)
let packageVersion: string;
try {
  // Navigate from packages/api/src/routes to root
  const rootPackageJsonPath = join(__dirname, "../../../../package.json");
  const packageJson = JSON.parse(readFileSync(rootPackageJsonPath, "utf-8"));
  packageVersion = packageJson.version || "unknown";
} catch (error) {
  console.error("Failed to read version from package.json:", error);
  packageVersion = "unknown";
}

/**
 * Version routes plugin
 * Prefix: /api/v1/version
 */
export default function versionRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): void {
  /**
   * GET /api/v1/version
   * Returns the current application version and timestamp
   */
  fastify.get("/", () => {
    return {
      version: packageVersion,
      timestamp: new Date().toISOString(),
    };
  });
}
