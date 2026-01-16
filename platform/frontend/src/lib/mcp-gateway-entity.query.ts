import { archestraApiSdk, type archestraApiTypes } from "@shared";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DEFAULT_AGENTS_PAGE_SIZE,
  DEFAULT_SORT_BY,
  DEFAULT_SORT_DIRECTION,
} from "./utils";

const {
  createMcpGatewayEntity,
  deleteMcpGatewayEntity,
  getMcpGatewayEntities,
  getAllMcpGatewayEntities,
  getDefaultMcpGatewayEntity,
  getMcpGatewayEntity,
  updateMcpGatewayEntity,
  getMcpGatewayEntityLabelKeys,
  getMcpGatewayEntityLabelValues,
} = archestraApiSdk;

// Returns all MCP Gateway entries as an array (no pagination)
export function useMcpGateways(
  params: {
    initialData?: archestraApiTypes.GetAllMcpGatewayEntitiesResponses["200"];
    filters?: archestraApiTypes.GetAllMcpGatewayEntitiesData["query"];
  } = {},
) {
  return useSuspenseQuery({
    queryKey: ["mcpGateways", "all", params?.filters],
    queryFn: async () => {
      const response = await getAllMcpGatewayEntities({
        query: params?.filters,
      });
      return response.data ?? [];
    },
    initialData: params?.initialData,
  });
}

// Paginated hook for the MCP Gateway page
export function useMcpGatewaysPaginated(params?: {
  initialData?: archestraApiTypes.GetMcpGatewayEntitiesResponses["200"];
  limit?: number;
  offset?: number;
  sortBy?: "name" | "createdAt" | "toolsCount" | "team";
  sortDirection?: "asc" | "desc";
  name?: string;
}) {
  const { initialData, limit, offset, sortBy, sortDirection, name } =
    params || {};

  const useInitialData =
    offset === 0 &&
    (sortBy === undefined || sortBy === DEFAULT_SORT_BY) &&
    (sortDirection === undefined || sortDirection === DEFAULT_SORT_DIRECTION) &&
    name === undefined &&
    (limit === undefined || limit === DEFAULT_AGENTS_PAGE_SIZE);

  return useSuspenseQuery({
    queryKey: ["mcpGateways", { limit, offset, sortBy, sortDirection, name }],
    queryFn: async () =>
      (
        await getMcpGatewayEntities({
          query: {
            limit,
            offset,
            sortBy,
            sortDirection,
            name,
          },
        })
      ).data ?? null,
    initialData: useInitialData ? initialData : undefined,
  });
}

export function useDefaultMcpGateway(params?: {
  initialData?: archestraApiTypes.GetDefaultMcpGatewayEntityResponses["200"];
}) {
  return useQuery({
    queryKey: ["mcpGateways", "default"],
    queryFn: async () => (await getDefaultMcpGatewayEntity()).data ?? null,
    initialData: params?.initialData,
  });
}

export function useMcpGateway(id: string | undefined) {
  return useQuery({
    queryKey: ["mcpGateways", id],
    queryFn: async () => {
      if (!id) return null;
      const response = await getMcpGatewayEntity({ path: { id } });
      return response.data ?? null;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useCreateMcpGateway() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      data: archestraApiTypes.CreateMcpGatewayEntityData["body"],
    ) => {
      const response = await createMcpGatewayEntity({ body: data });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcpGateways"] });
      toast.success("MCP Gateway created");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create MCP Gateway: ${error.message}`);
    },
  });
}

export function useUpdateMcpGateway() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: archestraApiTypes.UpdateMcpGatewayEntityData["body"];
    }) => {
      const response = await updateMcpGatewayEntity({
        path: { id },
        body: data,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcpGateways"] });
      toast.success("MCP Gateway updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update MCP Gateway: ${error.message}`);
    },
  });
}

export function useDeleteMcpGateway() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await deleteMcpGatewayEntity({ path: { id } });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcpGateways"] });
      toast.success("MCP Gateway deleted");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete MCP Gateway: ${error.message}`);
    },
  });
}

export function useMcpGatewayLabelKeys() {
  return useQuery({
    queryKey: ["mcpGateways", "labelKeys"],
    queryFn: async () => {
      const response = await getMcpGatewayEntityLabelKeys();
      return response.data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useMcpGatewayLabelValues(key?: string) {
  return useQuery({
    queryKey: ["mcpGateways", "labelValues", key],
    queryFn: async () => {
      const response = await getMcpGatewayEntityLabelValues({ query: { key } });
      return response.data ?? [];
    },
    enabled: !!key,
    staleTime: 5 * 60 * 1000,
  });
}
