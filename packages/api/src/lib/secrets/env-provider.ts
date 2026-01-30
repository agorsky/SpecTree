import type { SecretsProvider } from "./types.js";

/**
 * Environment variables secrets provider.
 * Reads secrets from process.env - the default/fallback provider.
 */
export class EnvSecretsProvider implements SecretsProvider {
  readonly providerName = "environment";

  getSecret(name: string): Promise<string> {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Secret '${name}' not found in environment variables`);
    }
    return Promise.resolve(value);
  }

  getSecretOptional(name: string): Promise<string | undefined> {
    return Promise.resolve(process.env[name]);
  }
}
