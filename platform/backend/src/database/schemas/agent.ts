import type { IncomingEmailSecurityMode } from "@shared";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { SupportedChatProvider } from "@/types/chat-api-key";
import type { ChatOpsProviderType } from "@/types/chatops";
import chatApiKeysTable from "./chat-api-key";

/**
 * Represents a historical version of an agent's prompt stored in the prompt_history JSONB array.
 * Only used when agent_type is 'agent'.
 */
export interface AgentHistoryEntry {
  version: number;
  userPrompt: string | null;
  systemPrompt: string | null;
  createdAt: string; // ISO timestamp
}

/**
 * Agent type enum:
 * - profile: External profiles for API gateway routing
 * - mcp_gateway: MCP gateway specific configuration
 * - llm_proxy: LLM proxy specific configuration
 * - agent: Internal agents with prompts for chat
 */
export const agentTypeEnum = pgEnum("agent_type", [
  "profile",
  "mcp_gateway",
  "llm_proxy",
  "agent",
]);

export type AgentType = (typeof agentTypeEnum.enumValues)[number];

/**
 * LLM API key resolution strategy for internal agents.
 * - dynamic: Uses user-based priority chain (personal → team → org → env)
 * - static: Uses a specific chat API key configured on the agent
 */
export type LlmApiKeyStrategy = "dynamic" | "static";

/**
 * Unified agents table supporting both external profiles and internal agents.
 *
 * External profiles (agent_type = 'profile'):
 *   - API gateway profiles for routing LLM traffic
 *   - Used for tool assignment and policy enforcement
 *   - Prompt fields are null
 *
 * MCP Gateway (agent_type = 'mcp_gateway'):
 *   - MCP gateway specific configuration
 *
 * LLM Proxy (agent_type = 'llm_proxy'):
 *   - LLM proxy specific configuration
 *
 * Internal agents (agent_type = 'agent'):
 *   - Chat agents with system/user prompts
 *   - Support version history and rollback
 *   - Can delegate to other internal agents via delegation tools
 *   - Can be triggered by ChatOps providers
 */
const agentsTable = pgTable(
  "agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    name: text("name").notNull(),
    isDemo: boolean("is_demo").notNull().default(false),
    isDefault: boolean("is_default").notNull().default(false),
    considerContextUntrusted: boolean("consider_context_untrusted")
      .notNull()
      .default(false),

    // Agent type: 'profile' (external profile), 'mcp_gateway', 'llm_proxy', or 'agent' (internal agent)
    agentType: agentTypeEnum("agent_type").notNull().default("mcp_gateway"),

    // Prompt fields (only used when agentType = 'agent')
    systemPrompt: text("system_prompt"),
    userPrompt: text("user_prompt"),
    promptVersion: integer("prompt_version").default(1),
    promptHistory: jsonb("prompt_history")
      .$type<AgentHistoryEntry[]>()
      .default([]),
    /** Which chatops providers can trigger this agent (empty = none, only for internal agents) */
    allowedChatops: jsonb("allowed_chatops")
      .$type<ChatOpsProviderType[]>()
      .default([]),

    // Incoming email settings (only used when agentType = 'agent')
    /** Whether incoming email invocation is enabled for this agent */
    incomingEmailEnabled: boolean("incoming_email_enabled")
      .notNull()
      .default(false),
    /** Security mode for incoming email: 'private', 'internal', or 'public' */
    incomingEmailSecurityMode: text("incoming_email_security_mode")
      .$type<IncomingEmailSecurityMode>()
      .notNull()
      .default("private"),
    /** Allowed domain for 'internal' security mode (e.g., 'example.com') */
    incomingEmailAllowedDomain: text("incoming_email_allowed_domain"),

    // LLM Configuration (only used when agentType = 'agent')
    /** LLM provider for this agent (anthropic, openai, gemini, etc.) */
    llmProvider: text("llm_provider").$type<SupportedChatProvider>(),
    /** Model name for this agent (e.g., claude-opus-4-1-20250805, gpt-4o) */
    llmModel: text("llm_model"),
    /** API key resolution strategy: 'dynamic' uses user-based priority chain, 'static' uses a specific key */
    llmApiKeyStrategy: text("llm_api_key_strategy")
      .$type<"dynamic" | "static">()
      .notNull()
      .default("dynamic"),
    /** Static API key ID to use when llmApiKeyStrategy is 'static' */
    llmStaticApiKeyId: uuid("llm_static_api_key_id").references(
      () => chatApiKeysTable.id,
      { onDelete: "set null" },
    ),

    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("agents_organization_id_idx").on(table.organizationId),
    index("agents_agent_type_idx").on(table.agentType),
    index("agents_llm_static_api_key_id_idx").on(table.llmStaticApiKeyId),
  ],
);

export default agentsTable;
