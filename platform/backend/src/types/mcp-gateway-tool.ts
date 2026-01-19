import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod";
import { schema } from "@/database";
import { UuidIdSchema } from "./api";
import { ToolParametersContentSchema } from "./tool";

export const SelectMcpGatewayToolSchema = createSelectSchema(
  schema.mcpGatewayToolsTable,
)
  .omit({
    mcpGatewayId: true,
    toolId: true,
  })
  .extend({
    mcpGateway: z.object({
      id: z.string(),
      name: z.string(),
    }),
    tool: z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      parameters: ToolParametersContentSchema,
      createdAt: z.date(),
      updatedAt: z.date(),
      catalogId: z.string().nullable(),
      mcpServerId: z.string().nullable(),
      mcpServerName: z.string().nullable(),
      mcpServerCatalogId: z.string().nullable(),
    }),
  });

export const InsertMcpGatewayToolSchema = createInsertSchema(
  schema.mcpGatewayToolsTable,
);
export const UpdateMcpGatewayToolSchema = createUpdateSchema(
  schema.mcpGatewayToolsTable,
);

export const McpGatewayToolFilterSchema = z.object({
  search: z.string().optional(),
  mcpGatewayId: UuidIdSchema.optional(),
  origin: z.string().optional().describe("Can be 'llm-proxy' or a catalogId"),
  mcpServerOwnerId: z
    .string()
    .optional()
    .describe("Filter by MCP server owner user ID"),
  excludeArchestraTools: z.coerce
    .boolean()
    .optional()
    .describe("For test isolation"),
});
export const McpGatewayToolSortBySchema = z.enum([
  "name",
  "mcpGateway",
  "origin",
  "createdAt",
]);
export const McpGatewayToolSortDirectionSchema = z.enum(["asc", "desc"]);

export type McpGatewayTool = z.infer<typeof SelectMcpGatewayToolSchema>;
export type InsertMcpGatewayTool = z.infer<typeof InsertMcpGatewayToolSchema>;
export type UpdateMcpGatewayTool = z.infer<typeof UpdateMcpGatewayToolSchema>;

export type McpGatewayToolFilters = z.infer<typeof McpGatewayToolFilterSchema>;
export type McpGatewayToolSortBy = z.infer<typeof McpGatewayToolSortBySchema>;
export type McpGatewayToolSortDirection = z.infer<
  typeof McpGatewayToolSortDirectionSchema
>;
