import logger from "@/logging";
import { LlmProxyTeamModel, OrganizationModel, TeamModel } from "@/models";

// Stats we expect to get from the compression from each LLM provider
// TODO: ideally compression itself should live somewhere here too, but it's far away for now.
export interface CompressionStats {
  toonTokensBefore: number | null;
  toonTokensAfter: number | null;
  toonCostSavings: number | null;
}

/**
 * Determine if TOON compression should be applied based on organization/team settings
 * Follows the same pattern as cost optimization: uses LLM Proxy's teams or fallback to first org
 */
export async function shouldApplyToonCompression(
  llmProxyId: string,
): Promise<boolean> {
  // Get organizationId the same way cost optimization does: from LLM Proxy's teams OR fallback
  let organizationId: string | null = null;
  const llmProxyTeamIds =
    await LlmProxyTeamModel.getTeamsForLlmProxy(llmProxyId);

  if (llmProxyTeamIds.length > 0) {
    // Get organizationId from LLM Proxy's first team
    const teams = await TeamModel.findByIds(llmProxyTeamIds);
    if (teams.length > 0 && teams[0].organizationId) {
      organizationId = teams[0].organizationId;
      logger.info(
        { llmProxyId, organizationId },
        "TOON compression: resolved organizationId from team",
      );
    }
  } else {
    // If LLM Proxy has no teams, use fallback to first organization in database
    const firstOrg = await OrganizationModel.getFirst();

    if (firstOrg) {
      organizationId = firstOrg.id;
      logger.info(
        { llmProxyId, organizationId },
        "TOON compression: LLM Proxy has no teams - using fallback organization",
      );
    }
  }

  if (!organizationId) {
    logger.warn(
      { llmProxyId },
      "TOON compression: could not resolve organizationId",
    );
    return false;
  }

  // Fetch the organization to get compression settings
  const organization = await OrganizationModel.getById(organizationId);
  if (!organization) {
    logger.warn(
      { llmProxyId, organizationId },
      "TOON compression: organization not found",
    );
    return false;
  }

  // Check compression scope and determine if TOON should be applied
  if (organization.compressionScope === "organization") {
    logger.info(
      { llmProxyId, enabled: organization.convertToolResultsToToon },
      "TOON compression: organization-level scope",
    );
    return organization.convertToolResultsToToon;
  }

  if (organization.compressionScope === "team") {
    // Team-level: check if ANY of the LLM Proxy's teams have compression enabled
    const llmProxyTeams = await TeamModel.getTeamsForLlmProxy(llmProxyId);
    const shouldApply = llmProxyTeams.some(
      (team) => team.convertToolResultsToToon,
    );
    logger.info(
      { llmProxyId, teamsCount: llmProxyTeams.length, enabled: shouldApply },
      "TOON compression: team-level scope",
    );
    return shouldApply;
  }

  // Default: compression disabled
  logger.info(
    { llmProxyId },
    "TOON compression: disabled (no scope configured)",
  );
  return false;
}
