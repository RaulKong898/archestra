import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod";
import { schema } from "@/database";
import { AgentLabelWithDetailsSchema } from "./label";
import { SelectToolSchema } from "./tool";

// Team info schema for MCP Gateway responses (just id and name)
export const McpGatewayTeamInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const SelectMcpGatewaySchema = createSelectSchema(
  schema.mcpGatewaysTable,
).extend({
  tools: z.array(SelectToolSchema),
  teams: z.array(McpGatewayTeamInfoSchema),
  labels: z.array(AgentLabelWithDetailsSchema),
});

// Schema for model (includes organizationId)
const InsertMcpGatewayModelSchema = createInsertSchema(schema.mcpGatewaysTable)
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
export const InsertMcpGatewaySchema = InsertMcpGatewayModelSchema.omit({
  organizationId: true,
});

export type InsertMcpGateway = z.infer<typeof InsertMcpGatewayModelSchema>;

export const UpdateMcpGatewaySchema = createUpdateSchema(
  schema.mcpGatewaysTable,
)
  .extend({
    teams: z.array(z.string()),
    labels: z.array(AgentLabelWithDetailsSchema).optional(),
  })
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  });

export type McpGateway = z.infer<typeof SelectMcpGatewaySchema>;
export type UpdateMcpGateway = z.infer<typeof UpdateMcpGatewaySchema>;
