import type { SecretsProvider } from "./types.js";

/**
 * Environment variables secrets provider.
 * Reads secrets from process.env - the default/fallback provider.
 */
export class EnvSecretsProvider implements SecretsProvider {
  readonly providerName = "environment";

  async getSecret(name: string): Promise<string> {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Secret '${name}' not found in environment variables`);
    }
    return value;
  }

  async getSecretOptional(name: string): Promise<string | undefined> {
    return process.env[name];
  }
}
