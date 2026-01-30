import type { SecretsProvider, SecretsProviderConfig, SecretName } from "./types.js";
import { SECRET_NAMES } from "./types.js";
import { EnvSecretsProvider } from "./env-provider.js";
import { AzureKeyVaultProvider } from "./azure-keyvault-provider.js";

// Singleton instance
let secretsProvider: SecretsProvider | null = null;
let currentConfig: SecretsProviderConfig | null = null;

/**
 * Creates and returns a secrets provider based on configuration.
 * Uses singleton pattern - subsequent calls return the same instance
 * unless configuration changes.
 */
export function getSecretsProvider(config?: SecretsProviderConfig): SecretsProvider {
  // Use default config if none provided
  const effectiveConfig = config ?? getDefaultConfig();

  // Return existing instance if config hasn't changed
  if (secretsProvider && configsEqual(currentConfig, effectiveConfig)) {
    return secretsProvider;
  }

  // Create new provider
  secretsProvider = createProvider(effectiveConfig);
  currentConfig = effectiveConfig;

  return secretsProvider;
}

/**
 * Gets the default configuration from environment variables.
 */
function getDefaultConfig(): SecretsProviderConfig {
  const provider = process.env.SECRETS_PROVIDER as "env" | "azure-keyvault" | undefined;
  const vaultUrl = process.env.AZURE_KEYVAULT_URL;

  if (provider === "azure-keyvault") {
    if (!vaultUrl) {
      throw new Error(
        "AZURE_KEYVAULT_URL environment variable is required when SECRETS_PROVIDER=azure-keyvault"
      );
    }
    return {
      provider: "azure-keyvault",
      azureKeyVault: { vaultUrl },
    };
  }

  // Default to env provider
  return { provider: "env" };
}

/**
 * Creates a provider instance from configuration.
 */
function createProvider(config: SecretsProviderConfig): SecretsProvider {
  switch (config.provider) {
    case "azure-keyvault":
      if (!config.azureKeyVault?.vaultUrl) {
        throw new Error("Azure Key Vault URL is required");
      }
      console.log(`[secrets] Using Azure Key Vault provider: ${config.azureKeyVault.vaultUrl}`);
      return new AzureKeyVaultProvider(config.azureKeyVault.vaultUrl);

    case "env":
    default:
      console.log("[secrets] Using environment variables provider");
      return new EnvSecretsProvider();
  }
}

/**
 * Compares two configurations for equality.
 */
function configsEqual(
  a: SecretsProviderConfig | null,
  b: SecretsProviderConfig
): boolean {
  if (!a) return false;
  if (a.provider !== b.provider) return false;
  if (a.provider === "azure-keyvault" && b.provider === "azure-keyvault") {
    return a.azureKeyVault?.vaultUrl === b.azureKeyVault?.vaultUrl;
  }
  return true;
}

/**
 * Gets a named secret using the appropriate key for the current provider.
 * Handles the mapping between application secret names and provider-specific names.
 *
 * @param name - The application secret name (e.g., "JWT_SECRET")
 * @returns The secret value
 */
export async function getSecret(name: SecretName): Promise<string> {
  const provider = getSecretsProvider();
  const mapping = SECRET_NAMES[name];

  // Use provider-specific name
  const providerKey =
    provider.providerName === "azure-keyvault" ? mapping.keyVault : mapping.env;

  return provider.getSecret(providerKey);
}

/**
 * Gets a named secret, returning undefined if not found.
 */
export async function getSecretOptional(name: SecretName): Promise<string | undefined> {
  const provider = getSecretsProvider();
  const mapping = SECRET_NAMES[name];

  const providerKey =
    provider.providerName === "azure-keyvault" ? mapping.keyVault : mapping.env;

  return provider.getSecretOptional(providerKey);
}

/**
 * Resets the singleton provider. Useful for testing.
 */
export function resetSecretsProvider(): void {
  secretsProvider = null;
  currentConfig = null;
}

// Re-export types and providers
export type { SecretsProvider, SecretsProviderConfig, SecretName };
export { SECRET_NAMES } from "./types.js";
export { EnvSecretsProvider } from "./env-provider.js";
export { AzureKeyVaultProvider } from "./azure-keyvault-provider.js";
