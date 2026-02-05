/**
 * Auth command - Authenticate with SpecTree API
 */

import chalk from "chalk";
import ora from "ora";
import Conf from "conf";

interface AuthOptions {
  token?: string;
}

// Configuration store for credentials
const config = new Conf({
  projectName: "spectree-orchestrator",
  schema: {
    apiToken: { type: "string" },
    apiUrl: { type: "string", default: "http://localhost:3001" },
  },
});

export async function authCommand(options: AuthOptions): Promise<void> {
  console.log(chalk.cyan("\n🔐 SpecTree Authentication\n"));

  if (options.token) {
    // Direct token provided
    const spinner = ora("Validating token...").start();

    try {
      // TODO: Validate token against SpecTree API
      // const isValid = await validateToken(options.token);

      // For now, just store it
      config.set("apiToken", options.token);
      spinner.succeed("Token saved successfully");

      console.log(chalk.green("\n✓ Authentication configured\n"));
      console.log(chalk.gray(`  Token stored in: ${config.path}\n`));
    } catch (error) {
      spinner.fail("Token validation failed");
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  } else {
    // Interactive authentication
    console.log(chalk.gray("To authenticate, you need a SpecTree API token.\n"));
    console.log(chalk.white("Option 1: Generate token in SpecTree web UI"));
    console.log(chalk.gray("  1. Open SpecTree web application"));
    console.log(chalk.gray("  2. Navigate to Settings → API Tokens"));
    console.log(chalk.gray("  3. Click 'Generate New Token'"));
    console.log(chalk.gray("  4. Run: spectree-agent auth --token <your-token>\n"));

    console.log(chalk.white("Option 2: Direct token input"));
    console.log(chalk.gray("  spectree-agent auth --token st_your-token-here\n"));

    // Check if already authenticated
    const existingToken = config.get("apiToken") as string | undefined;
    if (existingToken) {
      console.log(chalk.green("✓ Already authenticated"));
      console.log(chalk.gray(`  Token: ${existingToken.substring(0, 10)}...`));
      console.log(chalk.gray(`  Config: ${config.path}\n`));
    }
  }
}

/**
 * Get the stored API token
 */
export function getApiToken(): string | undefined {
  return config.get("apiToken") as string | undefined;
}

/**
 * Get the API URL
 */
export function getApiUrl(): string {
  return (config.get("apiUrl") as string) || "http://localhost:3001";
}

/**
 * Check if authenticated
 */
export function isAuthenticated(): boolean {
  const token = getApiToken();
  return !!token && token.startsWith("st_");
}
