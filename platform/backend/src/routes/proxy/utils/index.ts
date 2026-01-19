import { LlmProxyModel } from "@/models";

/**
 * Get or create the default LLM proxy for an organization.
 * Note: This function requires organizationId context. For legacy compatibility,
 * the V1 handlers should use LlmProxyModel.getOrCreateDefault() directly with
 * the organizationId from the request context.
 *
 * @deprecated Use LlmProxyModel.getOrCreateDefault(organizationId) directly
 */
export const getLlmProxyIdFromRequest = async (
  organizationId: string,
): Promise<string> =>
  (await LlmProxyModel.getOrCreateDefault(organizationId)).id;

export * as tokenizers from "@/tokenizers";
export * as adapters from "./adapters";
export * as costOptimization from "./cost-optimization";
export * as externalAgentId from "./external-agent-id";
export * as sessionId from "./session-id";
export * as toolInvocation from "./tool-invocation";
export * as tools from "./tools";
export * as toonConversion from "./toon-conversion";
export * as tracing from "./tracing";
export * as trustedData from "./trusted-data";
export * as userId from "./user-id";
