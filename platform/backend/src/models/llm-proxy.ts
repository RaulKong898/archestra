import { DEFAULT_PROFILE_NAME } from "@shared";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  min,
  type SQL,
  sql,
} from "drizzle-orm";
import db, { schema } from "@/database";
import {
  createPaginatedResult,
  type PaginatedResult,
} from "@/database/utils/pagination";
import type {
  InsertLlmProxy,
  LlmProxy,
  PaginationQuery,
  SortingQuery,
  UpdateLlmProxy,
} from "@/types";
import LlmProxyLabelModel from "./llm-proxy-label";
import LlmProxyTeamModel from "./llm-proxy-team";

class LlmProxyModel {
  static async create({
    teams,
    labels,
    ...llmProxy
  }: InsertLlmProxy): Promise<LlmProxy> {
    const [createdProxy] = await db
      .insert(schema.llmProxiesTable)
      .values(llmProxy)
      .returning();

    // Assign teams to the LLM Proxy if provided
    if (teams && teams.length > 0) {
      await LlmProxyTeamModel.assignTeamsToLlmProxy(createdProxy.id, teams);
    }

    // Assign labels to the LLM Proxy if provided
    if (labels && labels.length > 0) {
      await LlmProxyLabelModel.syncLlmProxyLabels(createdProxy.id, labels);
    }

    // Get team details for the created LLM Proxy
    const teamDetails =
      teams && teams.length > 0
        ? await LlmProxyTeamModel.getTeamDetailsForLlmProxy(createdProxy.id)
        : [];

    // Get auto-discovered tools (tools with llmProxyId set to this proxy)
    const autoDiscoveredTools = await db
      .select()
      .from(schema.toolsTable)
      .where(eq(schema.toolsTable.llmProxyId, createdProxy.id));

    return {
      ...createdProxy,
      tools: autoDiscoveredTools,
      teams: teamDetails,
      labels: await LlmProxyLabelModel.getLabelsForLlmProxy(createdProxy.id),
    };
  }

  static async findAll(
    organizationId: string,
    userId?: string,
    isLlmProxyAdmin?: boolean,
  ): Promise<LlmProxy[]> {
    // Build where conditions
    const whereConditions: SQL[] = [
      eq(schema.llmProxiesTable.organizationId, organizationId),
    ];

    // Apply access control filtering for non-admins
    if (userId && !isLlmProxyAdmin) {
      const accessibleIds =
        await LlmProxyTeamModel.getUserAccessibleLlmProxyIds(userId, false);

      if (accessibleIds.length === 0) {
        return [];
      }

      whereConditions.push(inArray(schema.llmProxiesTable.id, accessibleIds));
    }

    const proxies = await db
      .select()
      .from(schema.llmProxiesTable)
      .where(and(...whereConditions));

    const proxyIds = proxies.map((proxy) => proxy.id);

    // Get auto-discovered tools for all proxies
    const autoDiscoveredTools =
      proxyIds.length > 0
        ? await db
            .select()
            .from(schema.toolsTable)
            .where(inArray(schema.toolsTable.llmProxyId, proxyIds))
        : [];

    // Group tools by proxy ID
    const toolsByProxyId = new Map<string, typeof autoDiscoveredTools>();
    for (const tool of autoDiscoveredTools) {
      if (tool.llmProxyId) {
        const tools = toolsByProxyId.get(tool.llmProxyId) || [];
        tools.push(tool);
        toolsByProxyId.set(tool.llmProxyId, tools);
      }
    }

    // Populate teams and labels for all proxies with bulk queries to avoid N+1
    const [teamsMap, labelsMap] = await Promise.all([
      LlmProxyTeamModel.getTeamDetailsForLlmProxies(proxyIds),
      LlmProxyLabelModel.getLabelsForLlmProxies(proxyIds),
    ]);

    return proxies.map((proxy) => ({
      ...proxy,
      tools: toolsByProxyId.get(proxy.id) || [],
      teams: teamsMap.get(proxy.id) || [],
      labels: labelsMap.get(proxy.id) || [],
    }));
  }

  /**
   * Find all LLM Proxies with pagination, sorting, and filtering support
   */
  static async findAllPaginated(
    organizationId: string,
    pagination: PaginationQuery,
    sorting?: SortingQuery,
    filters?: { name?: string },
    userId?: string,
    isLlmProxyAdmin?: boolean,
  ): Promise<PaginatedResult<LlmProxy>> {
    // Determine the ORDER BY clause based on sorting params
    const orderByClause = LlmProxyModel.getOrderByClause(sorting);

    // Build where clause for filters and access control
    const whereConditions: SQL[] = [
      eq(schema.llmProxiesTable.organizationId, organizationId),
    ];

    // Add name filter if provided
    if (filters?.name) {
      whereConditions.push(
        ilike(schema.llmProxiesTable.name, `%${filters.name}%`),
      );
    }

    // Apply access control filtering for non-admins
    if (userId && !isLlmProxyAdmin) {
      const accessibleIds =
        await LlmProxyTeamModel.getUserAccessibleLlmProxyIds(userId, false);

      if (accessibleIds.length === 0) {
        return createPaginatedResult([], 0, pagination);
      }

      whereConditions.push(inArray(schema.llmProxiesTable.id, accessibleIds));
    }

    const whereClause = and(...whereConditions);

    // Step 1: Get paginated proxy IDs with proper sorting
    let query = db
      .select({ id: schema.llmProxiesTable.id })
      .from(schema.llmProxiesTable)
      .where(whereClause)
      .$dynamic();

    const direction = sorting?.sortDirection === "asc" ? asc : desc;

    // Add sorting-specific joins and order by
    if (sorting?.sortBy === "toolsCount") {
      const toolsCountSubquery = db
        .select({
          llmProxyId: schema.toolsTable.llmProxyId,
          toolsCount: count(schema.toolsTable.id).as("toolsCount"),
        })
        .from(schema.toolsTable)
        .where(sql`${schema.toolsTable.llmProxyId} IS NOT NULL`)
        .groupBy(schema.toolsTable.llmProxyId)
        .as("toolsCounts");

      query = query
        .leftJoin(
          toolsCountSubquery,
          eq(schema.llmProxiesTable.id, toolsCountSubquery.llmProxyId),
        )
        .orderBy(direction(sql`COALESCE(${toolsCountSubquery.toolsCount}, 0)`));
    } else if (sorting?.sortBy === "team") {
      const teamNameSubquery = db
        .select({
          llmProxyId: schema.llmProxyTeamsTable.llmProxyId,
          teamName: min(schema.teamsTable.name).as("teamName"),
        })
        .from(schema.llmProxyTeamsTable)
        .leftJoin(
          schema.teamsTable,
          eq(schema.llmProxyTeamsTable.teamId, schema.teamsTable.id),
        )
        .groupBy(schema.llmProxyTeamsTable.llmProxyId)
        .as("teamNames");

      query = query
        .leftJoin(
          teamNameSubquery,
          eq(schema.llmProxiesTable.id, teamNameSubquery.llmProxyId),
        )
        .orderBy(direction(sql`COALESCE(${teamNameSubquery.teamName}, '')`));
    } else {
      query = query.orderBy(orderByClause);
    }

    const sortedProxies = await query
      .limit(pagination.limit)
      .offset(pagination.offset);

    const sortedProxyIds = sortedProxies.map((p) => p.id);

    // If no proxies match, return early
    if (sortedProxyIds.length === 0) {
      const [{ total }] = await db
        .select({ total: count() })
        .from(schema.llmProxiesTable)
        .where(whereClause);
      return createPaginatedResult([], Number(total), pagination);
    }

    // Step 2: Get full proxy data for the paginated proxy IDs
    const [proxiesData, [{ total: totalResult }]] = await Promise.all([
      db
        .select()
        .from(schema.llmProxiesTable)
        .where(inArray(schema.llmProxiesTable.id, sortedProxyIds)),
      db
        .select({ total: count() })
        .from(schema.llmProxiesTable)
        .where(whereClause),
    ]);

    // Sort in memory to maintain the order from the sorted query
    const orderMap = new Map(sortedProxyIds.map((id, index) => [id, index]));
    proxiesData.sort(
      (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
    );

    const proxyIds = proxiesData.map((proxy) => proxy.id);

    // Get auto-discovered tools for all proxies
    const autoDiscoveredTools = await db
      .select()
      .from(schema.toolsTable)
      .where(inArray(schema.toolsTable.llmProxyId, proxyIds));

    // Group tools by proxy ID
    const toolsByProxyId = new Map<string, typeof autoDiscoveredTools>();
    for (const tool of autoDiscoveredTools) {
      if (tool.llmProxyId) {
        const tools = toolsByProxyId.get(tool.llmProxyId) || [];
        tools.push(tool);
        toolsByProxyId.set(tool.llmProxyId, tools);
      }
    }

    // Populate teams and labels for all proxies with bulk queries to avoid N+1
    const [teamsMap, labelsMap] = await Promise.all([
      LlmProxyTeamModel.getTeamDetailsForLlmProxies(proxyIds),
      LlmProxyLabelModel.getLabelsForLlmProxies(proxyIds),
    ]);

    const proxies = proxiesData.map((proxy) => ({
      ...proxy,
      tools: toolsByProxyId.get(proxy.id) || [],
      teams: teamsMap.get(proxy.id) || [],
      labels: labelsMap.get(proxy.id) || [],
    }));

    return createPaginatedResult(proxies, Number(totalResult), pagination);
  }

  /**
   * Helper to get the appropriate ORDER BY clause based on sorting params
   */
  private static getOrderByClause(sorting?: SortingQuery) {
    const direction = sorting?.sortDirection === "asc" ? asc : desc;

    switch (sorting?.sortBy) {
      case "name":
        return direction(schema.llmProxiesTable.name);
      case "createdAt":
        return direction(schema.llmProxiesTable.createdAt);
      case "toolsCount":
      case "team":
        // These use separate query paths
        return direction(schema.llmProxiesTable.createdAt); // Fallback
      default:
        // Default: newest first
        return desc(schema.llmProxiesTable.createdAt);
    }
  }

  /**
   * Check if an LLM Proxy exists without loading related data
   */
  static async exists(id: string): Promise<boolean> {
    const [result] = await db
      .select({ id: schema.llmProxiesTable.id })
      .from(schema.llmProxiesTable)
      .where(eq(schema.llmProxiesTable.id, id))
      .limit(1);

    return result !== undefined;
  }

  static async findById(
    id: string,
    userId?: string,
    isLlmProxyAdmin?: boolean,
  ): Promise<LlmProxy | null> {
    // Check access control for non-admins
    if (userId && !isLlmProxyAdmin) {
      const hasAccess = await LlmProxyTeamModel.userHasLlmProxyAccess(
        userId,
        id,
        false,
      );
      if (!hasAccess) {
        return null;
      }
    }

    const [proxy] = await db
      .select()
      .from(schema.llmProxiesTable)
      .where(eq(schema.llmProxiesTable.id, id));

    if (!proxy) {
      return null;
    }

    // Get auto-discovered tools
    const autoDiscoveredTools = await db
      .select()
      .from(schema.toolsTable)
      .where(eq(schema.toolsTable.llmProxyId, id));

    const teams = await LlmProxyTeamModel.getTeamDetailsForLlmProxy(id);
    const labels = await LlmProxyLabelModel.getLabelsForLlmProxy(id);

    return {
      ...proxy,
      tools: autoDiscoveredTools,
      teams,
      labels,
    };
  }

  static async getOrCreateDefault(
    organizationId: string,
    name?: string,
  ): Promise<LlmProxy> {
    // First, try to find an LLM Proxy with isDefault=true
    const [existingProxy] = await db
      .select()
      .from(schema.llmProxiesTable)
      .where(
        and(
          eq(schema.llmProxiesTable.organizationId, organizationId),
          eq(schema.llmProxiesTable.isDefault, true),
        ),
      );

    if (existingProxy) {
      // Get auto-discovered tools
      const autoDiscoveredTools = await db
        .select()
        .from(schema.toolsTable)
        .where(eq(schema.toolsTable.llmProxyId, existingProxy.id));

      return {
        ...existingProxy,
        tools: autoDiscoveredTools,
        teams: await LlmProxyTeamModel.getTeamDetailsForLlmProxy(
          existingProxy.id,
        ),
        labels: await LlmProxyLabelModel.getLabelsForLlmProxy(existingProxy.id),
      };
    }

    // No default proxy exists, create one
    return LlmProxyModel.create({
      organizationId,
      name: name || DEFAULT_PROFILE_NAME,
      isDefault: true,
      teams: [],
      labels: [],
    });
  }

  static async update(
    id: string,
    { teams, labels, ...proxy }: Partial<UpdateLlmProxy>,
  ): Promise<LlmProxy | null> {
    let updatedProxy: Omit<LlmProxy, "tools" | "teams" | "labels"> | undefined;

    // If setting isDefault to true, unset all other proxies' isDefault first
    if (proxy.isDefault === true) {
      // Get the organization ID for this proxy
      const [existing] = await db
        .select({ organizationId: schema.llmProxiesTable.organizationId })
        .from(schema.llmProxiesTable)
        .where(eq(schema.llmProxiesTable.id, id));

      if (existing) {
        await db
          .update(schema.llmProxiesTable)
          .set({ isDefault: false })
          .where(
            and(
              eq(
                schema.llmProxiesTable.organizationId,
                existing.organizationId,
              ),
              eq(schema.llmProxiesTable.isDefault, true),
            ),
          );
      }
    }

    // Only update proxy table if there are fields to update
    if (Object.keys(proxy).length > 0) {
      [updatedProxy] = await db
        .update(schema.llmProxiesTable)
        .set(proxy)
        .where(eq(schema.llmProxiesTable.id, id))
        .returning();

      if (!updatedProxy) {
        return null;
      }
    } else {
      // If only updating teams/labels, fetch the existing proxy
      const [existingProxy] = await db
        .select()
        .from(schema.llmProxiesTable)
        .where(eq(schema.llmProxiesTable.id, id));

      if (!existingProxy) {
        return null;
      }

      updatedProxy = existingProxy;
    }

    // Sync team assignments if teams is provided
    if (teams !== undefined) {
      await LlmProxyTeamModel.syncLlmProxyTeams(id, teams);
    }

    // Sync label assignments if labels is provided
    if (labels !== undefined) {
      await LlmProxyLabelModel.syncLlmProxyLabels(id, labels);
    }

    // Get auto-discovered tools for the updated proxy
    const autoDiscoveredTools = await db
      .select()
      .from(schema.toolsTable)
      .where(eq(schema.toolsTable.llmProxyId, id));

    // Fetch current teams and labels
    const currentTeams = await LlmProxyTeamModel.getTeamDetailsForLlmProxy(id);
    const currentLabels = await LlmProxyLabelModel.getLabelsForLlmProxy(id);

    return {
      ...updatedProxy,
      tools: autoDiscoveredTools,
      teams: currentTeams,
      labels: currentLabels,
    };
  }

  static async delete(id: string): Promise<boolean> {
    const result = await db
      .delete(schema.llmProxiesTable)
      .where(eq(schema.llmProxiesTable.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
}

export default LlmProxyModel;
