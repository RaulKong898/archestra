import { and, eq, inArray } from "drizzle-orm";
import db, { schema } from "@/database";
import logger from "@/logging";

class LlmProxyTeamModel {
  /**
   * Get all LLM Proxy IDs that a user has access to (through team membership)
   */
  static async getUserAccessibleLlmProxyIds(
    userId: string,
    isLlmProxyAdmin: boolean,
  ): Promise<string[]> {
    logger.debug(
      { userId, isLlmProxyAdmin },
      "LlmProxyTeamModel.getUserAccessibleLlmProxyIds: starting",
    );
    // Admins have access to all LLM Proxies
    if (isLlmProxyAdmin) {
      const allProxies = await db
        .select({ id: schema.llmProxiesTable.id })
        .from(schema.llmProxiesTable);

      logger.debug(
        { userId, count: allProxies.length },
        "LlmProxyTeamModel.getUserAccessibleLlmProxyIds: admin access to all",
      );
      return allProxies.map((proxy) => proxy.id);
    }

    // Get all team IDs the user is a member of
    const userTeams = await db
      .select({ teamId: schema.teamMembersTable.teamId })
      .from(schema.teamMembersTable)
      .where(eq(schema.teamMembersTable.userId, userId));

    const teamIds = userTeams.map((t) => t.teamId);

    logger.debug(
      { userId, teamCount: teamIds.length },
      "LlmProxyTeamModel.getUserAccessibleLlmProxyIds: found user teams",
    );

    if (teamIds.length === 0) {
      logger.debug(
        { userId },
        "LlmProxyTeamModel.getUserAccessibleLlmProxyIds: user has no team memberships",
      );
      return [];
    }

    // Get all LLM Proxies assigned to these teams
    const proxyTeams = await db
      .select({ llmProxyId: schema.llmProxyTeamsTable.llmProxyId })
      .from(schema.llmProxyTeamsTable)
      .where(inArray(schema.llmProxyTeamsTable.teamId, teamIds));

    const accessibleIds = proxyTeams.map((pt) => pt.llmProxyId);

    logger.debug(
      { userId, proxyCount: accessibleIds.length },
      "LlmProxyTeamModel.getUserAccessibleLlmProxyIds: completed",
    );
    return accessibleIds;
  }

  /**
   * Check if a user has access to a specific LLM Proxy (through team membership)
   */
  static async userHasLlmProxyAccess(
    userId: string,
    llmProxyId: string,
    isLlmProxyAdmin: boolean,
  ): Promise<boolean> {
    logger.debug(
      { userId, llmProxyId, isLlmProxyAdmin },
      "LlmProxyTeamModel.userHasLlmProxyAccess: checking access",
    );
    // Admins have access to all LLM Proxies
    if (isLlmProxyAdmin) {
      logger.debug(
        { userId, llmProxyId },
        "LlmProxyTeamModel.userHasLlmProxyAccess: admin has access",
      );
      return true;
    }

    // Get all team IDs the user is a member of
    const userTeams = await db
      .select({ teamId: schema.teamMembersTable.teamId })
      .from(schema.teamMembersTable)
      .where(eq(schema.teamMembersTable.userId, userId));

    const teamIds = userTeams.map((t) => t.teamId);

    if (teamIds.length === 0) {
      logger.debug(
        { userId, llmProxyId },
        "LlmProxyTeamModel.userHasLlmProxyAccess: user has no teams",
      );
      return false;
    }

    // Check if the LLM Proxy is assigned to any of the user's teams
    const proxyTeam = await db
      .select()
      .from(schema.llmProxyTeamsTable)
      .where(
        and(
          eq(schema.llmProxyTeamsTable.llmProxyId, llmProxyId),
          inArray(schema.llmProxyTeamsTable.teamId, teamIds),
        ),
      )
      .limit(1);

    const hasAccess = proxyTeam.length > 0;
    logger.debug(
      { userId, llmProxyId, hasAccess },
      "LlmProxyTeamModel.userHasLlmProxyAccess: completed",
    );
    return hasAccess;
  }

  /**
   * Get team details (id and name) for a specific LLM Proxy
   */
  static async getTeamDetailsForLlmProxy(
    llmProxyId: string,
  ): Promise<Array<{ id: string; name: string }>> {
    logger.debug(
      { llmProxyId },
      "LlmProxyTeamModel.getTeamDetailsForLlmProxy: fetching team details",
    );
    const proxyTeams = await db
      .select({
        teamId: schema.llmProxyTeamsTable.teamId,
        teamName: schema.teamsTable.name,
      })
      .from(schema.llmProxyTeamsTable)
      .innerJoin(
        schema.teamsTable,
        eq(schema.llmProxyTeamsTable.teamId, schema.teamsTable.id),
      )
      .where(eq(schema.llmProxyTeamsTable.llmProxyId, llmProxyId));

    const teams = proxyTeams.map((pt) => ({
      id: pt.teamId,
      name: pt.teamName,
    }));
    logger.debug(
      { llmProxyId, count: teams.length },
      "LlmProxyTeamModel.getTeamDetailsForLlmProxy: completed",
    );
    return teams;
  }

  /**
   * Sync team assignments for an LLM Proxy (replaces all existing assignments)
   */
  static async syncLlmProxyTeams(
    llmProxyId: string,
    teamIds: string[],
  ): Promise<number> {
    logger.debug(
      { llmProxyId, teamCount: teamIds.length },
      "LlmProxyTeamModel.syncLlmProxyTeams: syncing teams",
    );
    await db.transaction(async (tx) => {
      // Delete all existing team assignments
      await tx
        .delete(schema.llmProxyTeamsTable)
        .where(eq(schema.llmProxyTeamsTable.llmProxyId, llmProxyId));

      // Insert new team assignments (if any teams provided)
      if (teamIds.length > 0) {
        await tx.insert(schema.llmProxyTeamsTable).values(
          teamIds.map((teamId) => ({
            llmProxyId,
            teamId,
          })),
        );
      }
    });

    logger.debug(
      { llmProxyId, assignedCount: teamIds.length },
      "LlmProxyTeamModel.syncLlmProxyTeams: completed",
    );
    return teamIds.length;
  }

  /**
   * Assign teams to an LLM Proxy (idempotent)
   */
  static async assignTeamsToLlmProxy(
    llmProxyId: string,
    teamIds: string[],
  ): Promise<void> {
    logger.debug(
      { llmProxyId, teamCount: teamIds.length },
      "LlmProxyTeamModel.assignTeamsToLlmProxy: assigning teams",
    );
    if (teamIds.length === 0) {
      logger.debug(
        { llmProxyId },
        "LlmProxyTeamModel.assignTeamsToLlmProxy: no teams to assign",
      );
      return;
    }

    await db
      .insert(schema.llmProxyTeamsTable)
      .values(
        teamIds.map((teamId) => ({
          llmProxyId,
          teamId,
        })),
      )
      .onConflictDoNothing();

    logger.debug(
      { llmProxyId },
      "LlmProxyTeamModel.assignTeamsToLlmProxy: completed",
    );
  }

  /**
   * Get team IDs for a specific LLM Proxy
   * Returns array of team IDs (strings)
   */
  static async getTeamsForLlmProxy(llmProxyId: string): Promise<string[]> {
    logger.debug(
      { llmProxyId },
      "LlmProxyTeamModel.getTeamsForLlmProxy: fetching teams",
    );
    const proxyTeams = await db
      .select({ teamId: schema.llmProxyTeamsTable.teamId })
      .from(schema.llmProxyTeamsTable)
      .where(eq(schema.llmProxyTeamsTable.llmProxyId, llmProxyId));

    const teamIds = proxyTeams.map((pt) => pt.teamId);
    logger.debug(
      { llmProxyId, count: teamIds.length },
      "LlmProxyTeamModel.getTeamsForLlmProxy: completed",
    );
    return teamIds;
  }

  /**
   * Get team details for multiple LLM Proxies in one query to avoid N+1
   */
  static async getTeamDetailsForLlmProxies(
    llmProxyIds: string[],
  ): Promise<Map<string, Array<{ id: string; name: string }>>> {
    logger.debug(
      { proxyCount: llmProxyIds.length },
      "LlmProxyTeamModel.getTeamDetailsForLlmProxies: fetching team details",
    );
    if (llmProxyIds.length === 0) {
      logger.debug(
        "LlmProxyTeamModel.getTeamDetailsForLlmProxies: no proxies provided",
      );
      return new Map();
    }

    const proxyTeams = await db
      .select({
        llmProxyId: schema.llmProxyTeamsTable.llmProxyId,
        teamId: schema.llmProxyTeamsTable.teamId,
        teamName: schema.teamsTable.name,
      })
      .from(schema.llmProxyTeamsTable)
      .innerJoin(
        schema.teamsTable,
        eq(schema.llmProxyTeamsTable.teamId, schema.teamsTable.id),
      )
      .where(inArray(schema.llmProxyTeamsTable.llmProxyId, llmProxyIds));

    const teamsMap = new Map<string, Array<{ id: string; name: string }>>();

    // Initialize all proxy IDs with empty arrays
    for (const llmProxyId of llmProxyIds) {
      teamsMap.set(llmProxyId, []);
    }

    // Populate the map with team details
    for (const { llmProxyId, teamId, teamName } of proxyTeams) {
      const teams = teamsMap.get(llmProxyId) || [];
      teams.push({ id: teamId, name: teamName });
      teamsMap.set(llmProxyId, teams);
    }

    logger.debug(
      { proxyCount: llmProxyIds.length, assignmentCount: proxyTeams.length },
      "LlmProxyTeamModel.getTeamDetailsForLlmProxies: completed",
    );
    return teamsMap;
  }
}

export default LlmProxyTeamModel;
