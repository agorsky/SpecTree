import { SecretClient } from "@azure/keyvault-secrets";
import { DefaultAzureCredential } from "@azure/identity";
import type { SecretsProvider } from "./types.js";

/**
 * Azure Key Vault secrets provider.
 * Uses DefaultAzureCredential for authentication, which supports:
 * - Managed Identity (when running in Azure)
 * - Azure CLI credentials (for local development)
 * - Environment variables (AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID)
 */
export class AzureKeyVaultProvider implements SecretsProvider {
  readonly providerName = "azure-keyvault";
  private client: SecretClient;
  private cache = new Map<string, string>();

  /**
   * Creates a new Azure Key Vault provider.
   * @param vaultUrl - The Key Vault URL (e.g., https://kv-spectree-dev.vault.azure.net)
   */
  constructor(vaultUrl: string) {
    const credential = new DefaultAzureCredential();
    this.client = new SecretClient(vaultUrl, credential);
  }

  async getSecret(name: string): Promise<string> {
    // Check cache first
    const cached = this.cache.get(name);
    if (cached !== undefined) {
      return cached;
    }

    try {
      const secret = await this.client.getSecret(name);
      if (!secret.value) {
        throw new Error(`Secret '${name}' exists but has no value`);
      }
      
      // Cache the secret
      this.cache.set(name, secret.value);
      return secret.value;
    } catch (error) {
      if (error instanceof Error && error.message.includes("SecretNotFound")) {
        throw new Error(`Secret '${name}' not found in Azure Key Vault`);
      }
      throw error;
    }
  }

  async getSecretOptional(name: string): Promise<string | undefined> {
    try {
      return await this.getSecret(name);
    } catch {
      return undefined;
    }
  }

  /**
   * Clears the secret cache. Useful for testing or forcing a refresh.
   */
  clearCache(): void {
    this.cache.clear();
  }
}
