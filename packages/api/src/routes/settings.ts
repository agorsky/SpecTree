import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authenticate } from "../middleware/authenticate.js";

let webhookUrl: string | null = process.env.DISPATCHER_WEBHOOK_URL ?? null;

/**
 * Settings routes plugin
 * Prefix: /api/v1/settings
 */
export default function settingsRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): void {
  /**
   * GET /api/v1/settings/webhook
   * Returns the current webhook URL configuration
   */
  fastify.get(
    "/webhook",
    { preHandler: [authenticate] },
    async (_request, reply) => {
      return reply.send({ url: webhookUrl });
    }
  );

  /**
   * PUT /api/v1/settings/webhook
   * Updates the webhook URL configuration
   */
  fastify.put<{ Body: { url: string } }>(
    "/webhook",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { url } = request.body;
      webhookUrl = url;
      process.env.DISPATCHER_WEBHOOK_URL = url;
      return reply.send({ url: webhookUrl });
    }
  );
}

// Exported for testing
export function _getWebhookUrl(): string | null {
  return webhookUrl;
}

export function _setWebhookUrl(url: string | null): void {
  webhookUrl = url;
}
