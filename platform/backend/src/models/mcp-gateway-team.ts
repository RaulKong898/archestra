import { and, eq, inArray } from "drizzle-orm";
import db, { schema } from "@/database";
import logger from "@/logging";

class McpGatewayTeamModel {
  /**
   * Get all MCP Gateway IDs that a user has access to (through team membership)
   */
  static async getUserAccessibleMcpGatewayIds(
    userId: string,
    isMcpGatewayAdmin: boolean,
  ): Promise<string[]> {
    logger.debug(
      { userId, isMcpGatewayAdmin },
      "McpGatewayTeamModel.getUserAccessibleMcpGatewayIds: starting",
    );
    // Admins have access to all MCP Gateways
    if (isMcpGatewayAdmin) {
      const allGateways = await db
        .select({ id: schema.mcpGatewaysTable.id })
        .from(schema.mcpGatewaysTable);

      logger.debug(
        { userId, count: allGateways.length },
        "McpGatewayTeamModel.getUserAccessibleMcpGatewayIds: admin access to all",
      );
      return allGateways.map((gateway) => gateway.id);
    }

    // Get all team IDs the user is a member of
    const userTeams = await db
      .select({ teamId: schema.teamMembersTable.teamId })
      .from(schema.teamMembersTable)
      .where(eq(schema.teamMembersTable.userId, userId));

    const teamIds = userTeams.map((t) => t.teamId);

    logger.debug(
      { userId, teamCount: teamIds.length },
      "McpGatewayTeamModel.getUserAccessibleMcpGatewayIds: found user teams",
    );

    if (teamIds.length === 0) {
      logger.debug(
        { userId },
        "McpGatewayTeamModel.getUserAccessibleMcpGatewayIds: user has no team memberships",
      );
      return [];
    }

    // Get all MCP Gateways assigned to these teams
    const gatewayTeams = await db
      .select({ mcpGatewayId: schema.mcpGatewayTeamsTable.mcpGatewayId })
      .from(schema.mcpGatewayTeamsTable)
      .where(inArray(schema.mcpGatewayTeamsTable.teamId, teamIds));

    const accessibleIds = gatewayTeams.map((gt) => gt.mcpGatewayId);

    logger.debug(
      { userId, gatewayCount: accessibleIds.length },
      "McpGatewayTeamModel.getUserAccessibleMcpGatewayIds: completed",
    );
    return accessibleIds;
  }

  /**
   * Check if a user has access to a specific MCP Gateway (through team membership)
   */
  static async userHasMcpGatewayAccess(
    userId: string,
    mcpGatewayId: string,
    isMcpGatewayAdmin: boolean,
  ): Promise<boolean> {
    logger.debug(
      { userId, mcpGatewayId, isMcpGatewayAdmin },
      "McpGatewayTeamModel.userHasMcpGatewayAccess: checking access",
    );
    // Admins have access to all MCP Gateways
    if (isMcpGatewayAdmin) {
      logger.debug(
        { userId, mcpGatewayId },
        "McpGatewayTeamModel.userHasMcpGatewayAccess: admin has access",
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
        { userId, mcpGatewayId },
        "McpGatewayTeamModel.userHasMcpGatewayAccess: user has no teams",
      );
      return false;
    }

    // Check if the MCP Gateway is assigned to any of the user's teams
    const gatewayTeam = await db
      .select()
      .from(schema.mcpGatewayTeamsTable)
      .where(
        and(
          eq(schema.mcpGatewayTeamsTable.mcpGatewayId, mcpGatewayId),
          inArray(schema.mcpGatewayTeamsTable.teamId, teamIds),
        ),
      )
      .limit(1);

    const hasAccess = gatewayTeam.length > 0;
    logger.debug(
      { userId, mcpGatewayId, hasAccess },
      "McpGatewayTeamModel.userHasMcpGatewayAccess: completed",
    );
    return hasAccess;
  }

  /**
   * Get team details (id and name) for a specific MCP Gateway
   */
  static async getTeamDetailsForMcpGateway(
    mcpGatewayId: string,
  ): Promise<Array<{ id: string; name: string }>> {
    logger.debug(
      { mcpGatewayId },
      "McpGatewayTeamModel.getTeamDetailsForMcpGateway: fetching team details",
    );
    const gatewayTeams = await db
      .select({
        teamId: schema.mcpGatewayTeamsTable.teamId,
        teamName: schema.teamsTable.name,
      })
      .from(schema.mcpGatewayTeamsTable)
      .innerJoin(
        schema.teamsTable,
        eq(schema.mcpGatewayTeamsTable.teamId, schema.teamsTable.id),
      )
      .where(eq(schema.mcpGatewayTeamsTable.mcpGatewayId, mcpGatewayId));

    const teams = gatewayTeams.map((gt) => ({
      id: gt.teamId,
      name: gt.teamName,
    }));
    logger.debug(
      { mcpGatewayId, count: teams.length },
      "McpGatewayTeamModel.getTeamDetailsForMcpGateway: completed",
    );
    return teams;
  }

  /**
   * Sync team assignments for an MCP Gateway (replaces all existing assignments)
   */
  static async syncMcpGatewayTeams(
    mcpGatewayId: string,
    teamIds: string[],
  ): Promise<number> {
    logger.debug(
      { mcpGatewayId, teamCount: teamIds.length },
      "McpGatewayTeamModel.syncMcpGatewayTeams: syncing teams",
    );
    await db.transaction(async (tx) => {
      // Delete all existing team assignments
      await tx
        .delete(schema.mcpGatewayTeamsTable)
        .where(eq(schema.mcpGatewayTeamsTable.mcpGatewayId, mcpGatewayId));

      // Insert new team assignments (if any teams provided)
      if (teamIds.length > 0) {
        await tx.insert(schema.mcpGatewayTeamsTable).values(
          teamIds.map((teamId) => ({
            mcpGatewayId,
            teamId,
          })),
        );
      }
    });

    logger.debug(
      { mcpGatewayId, assignedCount: teamIds.length },
      "McpGatewayTeamModel.syncMcpGatewayTeams: completed",
    );
    return teamIds.length;
  }

  /**
   * Assign teams to an MCP Gateway (idempotent)
   */
  static async assignTeamsToMcpGateway(
    mcpGatewayId: string,
    teamIds: string[],
  ): Promise<void> {
    logger.debug(
      { mcpGatewayId, teamCount: teamIds.length },
      "McpGatewayTeamModel.assignTeamsToMcpGateway: assigning teams",
    );
    if (teamIds.length === 0) {
      logger.debug(
        { mcpGatewayId },
        "McpGatewayTeamModel.assignTeamsToMcpGateway: no teams to assign",
      );
      return;
    }

    await db
      .insert(schema.mcpGatewayTeamsTable)
      .values(
        teamIds.map((teamId) => ({
          mcpGatewayId,
          teamId,
        })),
      )
      .onConflictDoNothing();

    logger.debug(
      { mcpGatewayId },
      "McpGatewayTeamModel.assignTeamsToMcpGateway: completed",
    );
  }

  /**
   * Get team details for multiple MCP Gateways in one query to avoid N+1
   */
  static async getTeamDetailsForMcpGateways(
    mcpGatewayIds: string[],
  ): Promise<Map<string, Array<{ id: string; name: string }>>> {
    logger.debug(
      { gatewayCount: mcpGatewayIds.length },
      "McpGatewayTeamModel.getTeamDetailsForMcpGateways: fetching team details",
    );
    if (mcpGatewayIds.length === 0) {
      logger.debug(
        "McpGatewayTeamModel.getTeamDetailsForMcpGateways: no gateways provided",
      );
      return new Map();
    }

    const gatewayTeams = await db
      .select({
        mcpGatewayId: schema.mcpGatewayTeamsTable.mcpGatewayId,
        teamId: schema.mcpGatewayTeamsTable.teamId,
        teamName: schema.teamsTable.name,
      })
      .from(schema.mcpGatewayTeamsTable)
      .innerJoin(
        schema.teamsTable,
        eq(schema.mcpGatewayTeamsTable.teamId, schema.teamsTable.id),
      )
      .where(inArray(schema.mcpGatewayTeamsTable.mcpGatewayId, mcpGatewayIds));

    const teamsMap = new Map<string, Array<{ id: string; name: string }>>();

    // Initialize all gateway IDs with empty arrays
    for (const mcpGatewayId of mcpGatewayIds) {
      teamsMap.set(mcpGatewayId, []);
    }

    // Populate the map with team details
    for (const { mcpGatewayId, teamId, teamName } of gatewayTeams) {
      const teams = teamsMap.get(mcpGatewayId) || [];
      teams.push({ id: teamId, name: teamName });
      teamsMap.set(mcpGatewayId, teams);
    }

    logger.debug(
      {
        gatewayCount: mcpGatewayIds.length,
        assignmentCount: gatewayTeams.length,
      },
      "McpGatewayTeamModel.getTeamDetailsForMcpGateways: completed",
    );
    return teamsMap;
  }

  /**
   * Check if an MCP Gateway and MCP server share any teams
   */
  static async mcpGatewayAndMcpServerShareTeam(
    mcpGatewayId: string,
    mcpServerId: string,
  ): Promise<boolean> {
    logger.debug(
      { mcpGatewayId, mcpServerId },
      "McpGatewayTeamModel.mcpGatewayAndMcpServerShareTeam: checking shared teams",
    );
    const result = await db
      .select({ teamId: schema.mcpGatewayTeamsTable.teamId })
      .from(schema.mcpGatewayTeamsTable)
      .innerJoin(
        schema.mcpServersTable,
        eq(schema.mcpGatewayTeamsTable.teamId, schema.mcpServersTable.teamId),
      )
      .where(
        and(
          eq(schema.mcpGatewayTeamsTable.mcpGatewayId, mcpGatewayId),
          eq(schema.mcpServersTable.id, mcpServerId),
        ),
      )
      .limit(1);

    const shareTeam = result.length > 0;
    logger.debug(
      { mcpGatewayId, mcpServerId, shareTeam },
      "McpGatewayTeamModel.mcpGatewayAndMcpServerShareTeam: completed",
    );
    return shareTeam;
  }
}

export default McpGatewayTeamModel;
