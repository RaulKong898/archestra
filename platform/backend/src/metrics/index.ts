/**
 * Metrics module - exports all observability metrics for the platform.
 */

export {
  initializeLlmMetrics,
  reportLLMTokens,
  reportLLMCost,
  reportTimeToFirstToken,
  reportTokensPerSecond,
  getObservableFetch,
  getObservableGenAI,
  buildMetricLabels,
  sanitizeLabelKey,
} from "./llm";

export {
  initializeMcpMetrics,
  reportMcpToolCall,
  type McpToolCallMetricContext,
} from "./mcp";
