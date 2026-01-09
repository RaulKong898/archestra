import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  inArray,
  type SQL,
  sql,
} from "drizzle-orm";
import db, { schema } from "@/database";
import {
  createPaginatedResult,
  type PaginatedResult,
} from "@/database/utils/pagination";
import type {
  PaginationQuery,
  ProfileTool,
  ProfileToolFilters,
  ProfileToolSortBy,
  ProfileToolSortDirection,
} from "@/types";
import AgentTeamModel from "./agent-team";

class ProfileToolModel {
  /**
   * Find all tools with aggregated profile data (tool-centric view).
   * Each row represents a unique tool with all its assigned profiles and credentials.
   */
  static async findAll(params: {
    pagination?: PaginationQuery;
    sorting?: {
      sortBy?: ProfileToolSortBy;
      sortDirection?: ProfileToolSortDirection;
    };
    filters?: ProfileToolFilters;
    userId?: string;
    isAgentAdmin?: boolean;
    skipPagination?: boolean;
  }): Promise<PaginatedResult<ProfileTool>> {
    const {
      pagination = { limit: 20, offset: 0 },
      sorting,
      filters,
      userId,
      isAgentAdmin,
      skipPagination = false,
    } = params;

    // Build WHERE conditions for tools
    const whereConditions: SQL[] = [];

    // Exclude Archestra built-in tools
    if (filters?.excludeArchestraTools) {
      whereConditions.push(
        sql`${schema.toolsTable.name} NOT LIKE 'archestra__%'`,
      );
    }

    // Filter by origin (either "llm-proxy" or a catalogId)
    if (filters?.origin) {
      if (filters.origin === "llm-proxy") {
        whereConditions.push(sql`${schema.toolsTable.catalogId} IS NULL`);
      } else {
        whereConditions.push(eq(schema.toolsTable.catalogId, filters.origin));
      }
    }

    // Filter by search query (tool name)
    if (filters?.search) {
      whereConditions.push(
        sql`LOWER(${schema.toolsTable.name}) LIKE ${`%${filters.search.toLowerCase()}%`}`,
      );
    }

    // Filter by profile - show tools that include this profile
    if (filters?.profileId) {
      whereConditions.push(
        exists(
          db
            .select({ one: sql`1` })
            .from(schema.agentToolsTable)
            .where(
              and(
                eq(schema.agentToolsTable.toolId, schema.toolsTable.id),
                eq(schema.agentToolsTable.agentId, filters.profileId),
              ),
            ),
        ),
      );
    }

    // Filter by credential source MCP server
    if (filters?.credentialSourceMcpServerId) {
      whereConditions.push(
        exists(
          db
            .select({ one: sql`1` })
            .from(schema.agentToolsTable)
            .where(
              and(
                eq(schema.agentToolsTable.toolId, schema.toolsTable.id),
                eq(
                  schema.agentToolsTable.credentialSourceMcpServerId,
                  filters.credentialSourceMcpServerId,
                ),
              ),
            ),
        ),
      );
    }

    // Filter by MCP server owner
    if (filters?.mcpServerOwnerId) {
      const mcpServerIds = await db
        .select({ id: schema.mcpServersTable.id })
        .from(schema.mcpServersTable)
        .where(eq(schema.mcpServersTable.ownerId, filters.mcpServerOwnerId))
        .then((rows) => rows.map((r) => r.id));

      if (mcpServerIds.length > 0) {
        whereConditions.push(
          exists(
            db
              .select({ one: sql`1` })
              .from(schema.agentToolsTable)
              .where(
                and(
                  eq(schema.agentToolsTable.toolId, schema.toolsTable.id),
                  sql`(${schema.agentToolsTable.credentialSourceMcpServerId} = ANY(${mcpServerIds}) OR ${schema.agentToolsTable.executionSourceMcpServerId} = ANY(${mcpServerIds}))`,
                ),
              ),
          ),
        );
      }
    }

    // Access control - only show tools assigned to accessible profiles
    let accessibleAgentIds: string[] | undefined;
    if (userId && !isAgentAdmin) {
      accessibleAgentIds = await AgentTeamModel.getUserAccessibleAgentIds(
        userId,
        false,
      );

      if (accessibleAgentIds.length === 0) {
        return createPaginatedResult([], 0, pagination);
      }

      // Tool must have at least one assignment to an accessible agent
      whereConditions.push(
        exists(
          db
            .select({ one: sql`1` })
            .from(schema.agentToolsTable)
            .where(
              and(
                eq(schema.agentToolsTable.toolId, schema.toolsTable.id),
                inArray(schema.agentToolsTable.agentId, accessibleAgentIds),
              ),
            ),
        ),
      );
    }

    const whereClause =
      whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Determine ORDER BY clause
    const direction = sorting?.sortDirection === "asc" ? asc : desc;
    let orderByClause: SQL;

    switch (sorting?.sortBy) {
      case "name":
        orderByClause = direction(schema.toolsTable.name);
        break;
      case "origin":
        orderByClause = direction(
          sql`CASE WHEN ${schema.toolsTable.catalogId} IS NULL THEN '2-llm-proxy' ELSE '1-mcp' END`,
        );
        break;
      default:
        orderByClause = direction(schema.toolsTable.createdAt);
        break;
    }

    // Build agent filter for aggregation subqueries (for access control)
    const agentFilterCondition =
      accessibleAgentIds && accessibleAgentIds.length > 0
        ? sql`AND ${schema.agentToolsTable.agentId} = ANY(${accessibleAgentIds})`
        : sql``;

    // Main query with aggregation
    const baseDataQuery = db
      .select({
        id: schema.toolsTable.id,
        name: schema.toolsTable.name,
        description: schema.toolsTable.description,
        parameters: schema.toolsTable.parameters,
        catalogId: schema.toolsTable.catalogId,
        mcpServerId: schema.toolsTable.mcpServerId,
        mcpServerName: schema.mcpServersTable.name,
        mcpServerCatalogId: schema.mcpServersTable.catalogId,
        createdAt: schema.toolsTable.createdAt,
        updatedAt: schema.toolsTable.updatedAt,
        // Aggregate profiles
        profiles: sql<Array<{ id: string; name: string }>>`COALESCE((
          SELECT json_agg(DISTINCT jsonb_build_object('id', a.id, 'name', a.name))
          FROM ${schema.agentToolsTable} at
          INNER JOIN ${schema.agentsTable} a ON at.agent_id = a.id
          WHERE at.tool_id = ${schema.toolsTable.id} ${agentFilterCondition}
        ), '[]'::json)`,
        // Aggregate credentials
        credentials: sql<
          Array<{
            credentialSourceMcpServerId: string | null;
            executionSourceMcpServerId: string | null;
            useDynamicTeamCredential: boolean;
          }>
        >`COALESCE((
          SELECT json_agg(DISTINCT jsonb_build_object(
            'credentialSourceMcpServerId', at.credential_source_mcp_server_id,
            'executionSourceMcpServerId', at.execution_source_mcp_server_id,
            'useDynamicTeamCredential', at.use_dynamic_team_credential
          ))
          FROM ${schema.agentToolsTable} at
          WHERE at.tool_id = ${schema.toolsTable.id} ${agentFilterCondition}
        ), '[]'::json)`,
        // Auto-config fields (take first non-null)
        policiesAutoConfiguredAt: sql<Date | null>`(
          SELECT MAX(at.policies_auto_configured_at)
          FROM ${schema.agentToolsTable} at
          WHERE at.tool_id = ${schema.toolsTable.id} ${agentFilterCondition}
        )`,
        policiesAutoConfiguringStartedAt: sql<Date | null>`(
          SELECT MAX(at.policies_auto_configuring_started_at)
          FROM ${schema.agentToolsTable} at
          WHERE at.tool_id = ${schema.toolsTable.id} ${agentFilterCondition}
        )`,
        policiesAutoConfiguredReasoning: sql<string | null>`(
          SELECT at.policies_auto_configured_reasoning
          FROM ${schema.agentToolsTable} at
          WHERE at.tool_id = ${schema.toolsTable.id} ${agentFilterCondition}
            AND at.policies_auto_configured_reasoning IS NOT NULL
          LIMIT 1
        )`,
      })
      .from(schema.toolsTable)
      .leftJoin(
        schema.mcpServersTable,
        eq(schema.toolsTable.mcpServerId, schema.mcpServersTable.id),
      )
      .where(whereClause)
      .orderBy(orderByClause)
      .$dynamic();

    // Apply pagination only if not skipped
    const dataQuery = skipPagination
      ? baseDataQuery
      : baseDataQuery.limit(pagination.limit).offset(pagination.offset);

    // Count query
    const countQuery = db
      .select({ total: count() })
      .from(schema.toolsTable)
      .leftJoin(
        schema.mcpServersTable,
        eq(schema.toolsTable.mcpServerId, schema.mcpServersTable.id),
      )
      .where(whereClause);

    // Run both queries in parallel
    const [data, [{ total }]] = await Promise.all([dataQuery, countQuery]);

    // When skipping pagination, return all data with correct metadata
    if (skipPagination) {
      return createPaginatedResult(data as ProfileTool[], data.length, {
        limit: Math.max(1, data.length),
        offset: 0,
      });
    }

    return createPaginatedResult(
      data as ProfileTool[],
      Number(total),
      pagination,
    );
  }
}

export default ProfileToolModel;
