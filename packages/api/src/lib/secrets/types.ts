/**
 * Secrets provider interface for abstracting secret retrieval.
 * Allows swapping between different secret sources (env vars, Azure Key Vault, etc.)
 */
export interface SecretsProvider {
  /**
   * Retrieves a secret by name.
   * @param name - The secret name/key
   * @returns The secret value
   * @throws Error if the secret is not found or cannot be retrieved
   */
  getSecret(name: string): Promise<string>;

  /**
   * Retrieves a secret by name, returning undefined if not found.
   * @param name - The secret name/key
   * @returns The secret value or undefined if not found
   */
  getSecretOptional(name: string): Promise<string | undefined>;

  /**
   * Provider name for logging/debugging purposes.
   */
  readonly providerName: string;
}

/**
 * Configuration for the secrets provider.
 */
export interface SecretsProviderConfig {
  /**
   * The provider type to use.
   * - 'env': Read from environment variables (default)
   * - 'azure-keyvault': Read from Azure Key Vault
   */
  provider: "env" | "azure-keyvault";

  /**
   * Azure Key Vault configuration (required when provider is 'azure-keyvault').
   */
  azureKeyVault?: {
    /**
     * The Key Vault URL (e.g., https://kv-spectree-dev.vault.azure.net)
     */
    vaultUrl: string;
  };
}

/**
 * Secret name mappings from application names to provider-specific names.
 * Key Vault uses hyphens, env vars use underscores.
 */
export const SECRET_NAMES = {
  JWT_SECRET: {
    env: "JWT_SECRET",
    keyVault: "JWT-SECRET",
  },
  DATABASE_URL: {
    env: "DATABASE_URL",
    keyVault: "DATABASE-URL",
  },
} as const;

export type SecretName = keyof typeof SECRET_NAMES;
