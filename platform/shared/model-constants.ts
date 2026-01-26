import { z } from "zod";

/**
 * Supported LLM providers
 */
export const SupportedProvidersSchema = z.enum([
  "openai",
  "gemini",
  "anthropic",
  "cohere",
  "cerebras",
  "vllm",
  "ollama",
  "zhipuai",
]);

export const SupportedProvidersDiscriminatorSchema = z.enum([
  "openai:chatCompletions",
  "gemini:generateContent",
  "anthropic:messages",
  "cohere:chat",
  "cerebras:chatCompletions",
  "vllm:chatCompletions",
  "ollama:chatCompletions",
  "zhipuai:chatCompletions",
]);

export const SupportedProviders = Object.values(SupportedProvidersSchema.enum);
export type SupportedProvider = z.infer<typeof SupportedProvidersSchema>;
export type SupportedProviderDiscriminator = z.infer<
  typeof SupportedProvidersDiscriminatorSchema
>;

export const providerDisplayNames: Record<SupportedProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Gemini",
  cohere: "Cohere",
  cerebras: "Cerebras",
  vllm: "vLLM",
  ollama: "Ollama",
  zhipuai: "Zhipu AI",
};

/**
 * Default models for each provider when using dynamic resolution.
 * Used by both backend (getSmartDefaultModel) and frontend (agent dialog).
 */
export const providerDefaultModels: Partial<Record<SupportedProvider, string>> =
  {
    anthropic: "claude-opus-4-1-20250805",
    gemini: "gemini-2.5-pro",
    openai: "gpt-4o",
    cohere: "command-r-08-2024",
  };
