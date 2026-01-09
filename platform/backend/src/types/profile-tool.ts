import { z } from "zod";
import { UuidIdSchema } from "./api";
import { ToolParametersContentSchema } from "./tool";

/**
 * Schema for a profile assignment on a tool
 */
export const ProfileToolAssignmentSchema = z.object({
  profileId: z.string(),
  profileName: z.string(),
  credentialSourceMcpServerId: z.string().nullable(),
  executionSourceMcpServerId: z.string().nullable(),
  useDynamicTeamCredential: z.boolean(),
});

/**
 * Schema for profile-tool data (tool-centric view)
 * One row per tool with aggregated profiles
 */
export const SelectProfileToolSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  parameters: ToolParametersContentSchema,
  catalogId: z.string().nullable(),
  mcpServerId: z.string().nullable(),
  mcpServerName: z.string().nullable(),
  mcpServerCatalogId: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  // Aggregated profiles
  profiles: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
    }),
  ),
  // Aggregated credentials (unique combinations)
  credentials: z.array(
    z.object({
      credentialSourceMcpServerId: z.string().nullable(),
      executionSourceMcpServerId: z.string().nullable(),
      useDynamicTeamCredential: z.boolean(),
    }),
  ),
  // Auto-config fields (from any assignment to this tool)
  policiesAutoConfiguredAt: z.date().nullable(),
  policiesAutoConfiguringStartedAt: z.date().nullable(),
  policiesAutoConfiguredReasoning: z.string().nullable(),
});

/**
 * Filter schema for profile tools query
 */
export const ProfileToolFilterSchema = z.object({
  search: z.string().optional(),
  profileId: UuidIdSchema.optional().describe(
    "Filter by profile (shows tools that include this profile)",
  ),
  origin: z.string().optional().describe("Can be 'llm-proxy' or a catalogId"),
  credentialSourceMcpServerId: UuidIdSchema.optional().describe(
    "Filter by credential source MCP server",
  ),
  mcpServerOwnerId: z
    .string()
    .optional()
    .describe("Filter by MCP server owner user ID"),
  excludeArchestraTools: z.coerce
    .boolean()
    .optional()
    .describe("For test isolation"),
});

/**
 * Sort options for profile tools (excludes 'agent' since tools can have multiple profiles)
 */
export const ProfileToolSortBySchema = z.enum(["name", "origin", "createdAt"]);

export const ProfileToolSortDirectionSchema = z.enum(["asc", "desc"]);

export type ProfileTool = z.infer<typeof SelectProfileToolSchema>;
export type ProfileToolAssignment = z.infer<typeof ProfileToolAssignmentSchema>;
export type ProfileToolFilters = z.infer<typeof ProfileToolFilterSchema>;
export type ProfileToolSortBy = z.infer<typeof ProfileToolSortBySchema>;
export type ProfileToolSortDirection = z.infer<
  typeof ProfileToolSortDirectionSchema
>;
