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
  createLlmProxy,
  deleteLlmProxy,
  getLlmProxies,
  getAllLlmProxies,
  getDefaultLlmProxy,
  getLlmProxy,
  updateLlmProxy,
  getLlmProxyLabelKeys,
  getLlmProxyLabelValues,
  getLlmProxyTools,
} = archestraApiSdk;

// Returns all LLM Proxy entries as an array (no pagination)
export function useLlmProxies(
  params: {
    initialData?: archestraApiTypes.GetAllLlmProxiesResponses["200"];
    filters?: archestraApiTypes.GetAllLlmProxiesData["query"];
  } = {},
) {
  return useSuspenseQuery({
    queryKey: ["llmProxies", "all", params?.filters],
    queryFn: async () => {
      const response = await getAllLlmProxies({ query: params?.filters });
      return response.data ?? [];
    },
    initialData: params?.initialData,
  });
}

// Paginated hook for the LLM Proxy page
export function useLlmProxiesPaginated(params?: {
  initialData?: archestraApiTypes.GetLlmProxiesResponses["200"];
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
    queryKey: ["llmProxies", { limit, offset, sortBy, sortDirection, name }],
    queryFn: async () =>
      (
        await getLlmProxies({
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

export function useDefaultLlmProxy(params?: {
  initialData?: archestraApiTypes.GetDefaultLlmProxyResponses["200"];
}) {
  return useQuery({
    queryKey: ["llmProxies", "default"],
    queryFn: async () => (await getDefaultLlmProxy()).data ?? null,
    initialData: params?.initialData,
  });
}

export function useLlmProxy(id: string | undefined) {
  return useQuery({
    queryKey: ["llmProxies", id],
    queryFn: async () => {
      if (!id) return null;
      const response = await getLlmProxy({ path: { id } });
      return response.data ?? null;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useCreateLlmProxy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: archestraApiTypes.CreateLlmProxyData["body"]) => {
      const response = await createLlmProxy({ body: data });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["llmProxies"] });
      toast.success("LLM Proxy created");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create LLM Proxy: ${error.message}`);
    },
  });
}

export function useUpdateLlmProxy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: archestraApiTypes.UpdateLlmProxyData["body"];
    }) => {
      const response = await updateLlmProxy({ path: { id }, body: data });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["llmProxies"] });
      toast.success("LLM Proxy updated");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update LLM Proxy: ${error.message}`);
    },
  });
}

export function useDeleteLlmProxy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await deleteLlmProxy({ path: { id } });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["llmProxies"] });
      toast.success("LLM Proxy deleted");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete LLM Proxy: ${error.message}`);
    },
  });
}

export function useLlmProxyLabelKeys() {
  return useQuery({
    queryKey: ["llmProxies", "labelKeys"],
    queryFn: async () => {
      const response = await getLlmProxyLabelKeys();
      return response.data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useLlmProxyLabelValues(key?: string) {
  return useQuery({
    queryKey: ["llmProxies", "labelValues", key],
    queryFn: async () => {
      const response = await getLlmProxyLabelValues({ query: { key } });
      return response.data ?? [];
    },
    enabled: !!key,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLlmProxyTools(id: string | undefined) {
  return useQuery({
    queryKey: ["llmProxies", id, "tools"],
    queryFn: async () => {
      if (!id) return [];
      const response = await getLlmProxyTools({ path: { id } });
      return response.data ?? [];
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}
