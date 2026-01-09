import { archestraApiSdk, type archestraApiTypes } from "@shared";
import { useQuery } from "@tanstack/react-query";

const { getAllProfileTools } = archestraApiSdk;

type GetAllProfileToolsQueryParams = NonNullable<
  archestraApiTypes.GetAllProfileToolsData["query"]
>;

export type ProfileToolData =
  archestraApiTypes.GetAllProfileToolsResponses["200"]["data"][number];

export function useProfileTools({
  initialData,
  pagination,
  sorting,
  filters,
  skipPagination,
}: {
  initialData?: archestraApiTypes.GetAllProfileToolsResponses["200"];
  pagination?: {
    limit?: number;
    offset?: number;
  };
  sorting?: {
    sortBy?: NonNullable<GetAllProfileToolsQueryParams["sortBy"]>;
    sortDirection?: NonNullable<GetAllProfileToolsQueryParams["sortDirection"]>;
  };
  filters?: {
    search?: string;
    profileId?: string;
    origin?: string;
    credentialSourceMcpServerId?: string;
    mcpServerOwnerId?: string;
  };
  skipPagination?: boolean;
}) {
  return useQuery({
    queryKey: [
      "profile-tools",
      {
        limit: pagination?.limit,
        offset: pagination?.offset,
        sortBy: sorting?.sortBy,
        sortDirection: sorting?.sortDirection,
        search: filters?.search,
        profileId: filters?.profileId,
        origin: filters?.origin,
        credentialSourceMcpServerId: filters?.credentialSourceMcpServerId,
        mcpServerOwnerId: filters?.mcpServerOwnerId,
        skipPagination,
      },
    ],
    queryFn: async () => {
      const result = await getAllProfileTools({
        query: {
          limit: pagination?.limit,
          offset: pagination?.offset,
          sortBy: sorting?.sortBy,
          sortDirection: sorting?.sortDirection,
          search: filters?.search,
          profileId: filters?.profileId,
          origin: filters?.origin,
          mcpServerOwnerId: filters?.mcpServerOwnerId,
          excludeArchestraTools: true,
          skipPagination,
        },
      });
      return (
        result.data ?? {
          data: [],
          pagination: {
            currentPage: 1,
            limit: 20,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        }
      );
    },
    initialData,
  });
}
