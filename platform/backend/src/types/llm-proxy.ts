import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod";
import { schema } from "@/database";
import { AgentLabelWithDetailsSchema } from "./label";
import { SelectToolSchema } from "./tool";

// Team info schema for LLM Proxy responses (just id and name)
export const LlmProxyTeamInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const SelectLlmProxySchema = createSelectSchema(
  schema.llmProxiesTable,
).extend({
  // Auto-discovered tools associated with this LLM Proxy
  tools: z.array(SelectToolSchema),
  teams: z.array(LlmProxyTeamInfoSchema),
  labels: z.array(AgentLabelWithDetailsSchema),
});

// Schema for model (includes organizationId)
const InsertLlmProxyModelSchema = createInsertSchema(schema.llmProxiesTable)
  .extend({
    teams: z.array(z.string()),
    labels: z.array(AgentLabelWithDetailsSchema).optional(),
  })
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  });

// Schema for API (omits organizationId since it comes from request context)
export const InsertLlmProxySchema = InsertLlmProxyModelSchema.omit({
  organizationId: true,
});

export type InsertLlmProxy = z.infer<typeof InsertLlmProxyModelSchema>;

export const UpdateLlmProxySchema = createUpdateSchema(schema.llmProxiesTable)
  .extend({
    teams: z.array(z.string()),
    labels: z.array(AgentLabelWithDetailsSchema).optional(),
  })
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  });

export type LlmProxy = z.infer<typeof SelectLlmProxySchema>;
export type UpdateLlmProxy = z.infer<typeof UpdateLlmProxySchema>;
