import {
  archestraApiSdk,
  type archestraApiTypes,
  type ErrorExtended,
} from "@shared";

import { ServerErrorFallback } from "@/components/error-fallback";
import { getServerApiHeaders } from "@/lib/server-utils";
import {
  DEFAULT_AGENTS_PAGE_SIZE,
  DEFAULT_SORT_BY,
  DEFAULT_SORT_DIRECTION,
} from "@/lib/utils";
import McpGatewaysPage from "./page.client";

export const dynamic = "force-dynamic";

export default async function McpGatewaysPageServer() {
  let initialData: {
    mcpGateways: archestraApiTypes.GetMcpGatewayEntitiesResponses["200"] | null;
    teams: archestraApiTypes.GetTeamsResponses["200"];
  } = {
    mcpGateways: null,
    teams: [],
  };
  try {
    const headers = await getServerApiHeaders();
    initialData = {
      mcpGateways:
        (
          await archestraApiSdk.getMcpGatewayEntities({
            headers,
            query: {
              limit: DEFAULT_AGENTS_PAGE_SIZE,
              offset: 0,
              sortBy: DEFAULT_SORT_BY,
              sortDirection: DEFAULT_SORT_DIRECTION,
            },
          })
        ).data || null,
      teams: (await archestraApiSdk.getTeams({ headers })).data || [],
    };
  } catch (error) {
    console.error(error);
    return <ServerErrorFallback error={error as ErrorExtended} />;
  }
  return <McpGatewaysPage initialData={initialData} />;
}
