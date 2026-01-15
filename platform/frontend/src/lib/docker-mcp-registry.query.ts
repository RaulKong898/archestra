import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import jsYaml from "js-yaml";
import type {
  DockerMcpServer,
  DockerMcpServerMetadata,
  DockerRegistryCategory,
  GitHubContentItem,
} from "./docker-mcp-registry.types";

const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_RAW_BASE = "https://raw.githubusercontent.com";
const DOCKER_REGISTRY_REPO = "docker/mcp-registry";
const DOCKER_REGISTRY_BRANCH = "main";

/**
 * Fetch the list of server directories from the Docker MCP Registry
 */
async function fetchServerList(): Promise<GitHubContentItem[]> {
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${DOCKER_REGISTRY_REPO}/contents/servers?ref=${DOCKER_REGISTRY_BRANCH}`,
    {
      headers: {
        Accept: "application/vnd.github.v3+json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch Docker MCP Registry: ${response.statusText}`,
    );
  }

  const data: GitHubContentItem[] = await response.json();
  return data.filter((item) => item.type === "dir");
}

/**
 * Fetch server.yaml metadata for a specific server
 */
async function fetchServerMetadata(
  serverName: string,
): Promise<DockerMcpServerMetadata | null> {
  const response = await fetch(
    `${GITHUB_RAW_BASE}/${DOCKER_REGISTRY_REPO}/${DOCKER_REGISTRY_BRANCH}/servers/${serverName}/server.yaml`,
  );

  if (!response.ok) {
    return null;
  }

  const yamlText = await response.text();
  try {
    return jsYaml.load(yamlText) as DockerMcpServerMetadata;
  } catch {
    return null;
  }
}

/**
 * Transform GitHub directory listing + metadata into DockerMcpServer
 */
function transformToDockerMcpServer(
  item: GitHubContentItem,
  metadata: DockerMcpServerMetadata | null,
): DockerMcpServer {
  return {
    name: item.name,
    displayName: metadata?.about?.title || item.name,
    image: metadata?.image || `mcp/${item.name}`,
    description: metadata?.about?.description,
    icon: metadata?.about?.icon,
    category: metadata?.meta?.category,
    tags: metadata?.meta?.tags,
    sourceUrl: metadata?.source?.project,
    metadataLoaded: !!metadata,
    metadata: metadata || undefined,
  };
}

/**
 * Hook to fetch all Docker MCP Registry servers with pagination
 * Fetches server list first, then metadata in batches
 */
export function useDockerRegistryServersInfinite(
  search?: string,
  category?: DockerRegistryCategory,
  pageSize = 20,
) {
  return useInfiniteQuery({
    queryKey: ["docker-registry", "servers-infinite", search, category],
    queryFn: async ({ pageParam = 0 }) => {
      // First, get the full list of servers (cached)
      const serverDirs = await fetchServerList();

      // Filter by search and category (client-side)
      let filteredDirs = serverDirs;

      if (search?.trim()) {
        const searchLower = search.trim().toLowerCase();
        filteredDirs = filteredDirs.filter((dir) =>
          dir.name.toLowerCase().includes(searchLower),
        );
      }

      // Apply pagination
      const startIndex = pageParam;
      const endIndex = startIndex + pageSize;
      const pageDirs = filteredDirs.slice(startIndex, endIndex);

      // Fetch metadata for each server in this page
      const serversWithMetadata = await Promise.all(
        pageDirs.map(async (dir) => {
          const metadata = await fetchServerMetadata(dir.name);
          return transformToDockerMcpServer(dir, metadata);
        }),
      );

      // Filter by category after we have metadata
      let filteredServers = serversWithMetadata;
      if (category && category !== "all") {
        filteredServers = serversWithMetadata.filter(
          (server) => server.category?.toLowerCase() === category.toLowerCase(),
        );
      }

      return {
        servers: filteredServers,
        totalCount: filteredDirs.length,
        offset: startIndex,
        limit: pageSize,
        hasMore: endIndex < filteredDirs.length,
      };
    },
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.offset + lastPage.limit : undefined;
    },
    initialPageParam: 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch a single server's full metadata
 */
export function useDockerRegistryServer(serverName: string | null) {
  return useQuery({
    queryKey: ["docker-registry", "server", serverName],
    queryFn: async (): Promise<DockerMcpServer | null> => {
      if (!serverName) return null;

      const metadata = await fetchServerMetadata(serverName);
      if (!metadata) return null;

      return {
        name: serverName,
        displayName: metadata.about?.title || serverName,
        image: metadata.image,
        description: metadata.about?.description,
        icon: metadata.about?.icon,
        category: metadata.meta?.category,
        tags: metadata.meta?.tags,
        sourceUrl: metadata.source?.project,
        metadataLoaded: true,
        metadata,
      };
    },
    enabled: !!serverName,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to fetch available categories from the Docker registry
 * This requires fetching all servers and extracting unique categories
 */
export function useDockerRegistryCategories() {
  return useQuery({
    queryKey: ["docker-registry", "categories"],
    queryFn: async (): Promise<string[]> => {
      const serverDirs = await fetchServerList();

      // Fetch metadata for a sample of servers to get categories
      // We'll fetch the first 50 servers to get a good sample of categories
      const sampleDirs = serverDirs.slice(0, 50);
      const metadataList = await Promise.all(
        sampleDirs.map((dir) => fetchServerMetadata(dir.name)),
      );

      const categories = new Set<string>();
      for (const metadata of metadataList) {
        if (metadata?.meta?.category) {
          categories.add(metadata.meta.category);
        }
      }

      return Array.from(categories).sort();
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}

/**
 * Hook to get just the list of server names (fast, no metadata fetch)
 */
export function useDockerRegistryServerList() {
  return useQuery({
    queryKey: ["docker-registry", "server-list"],
    queryFn: fetchServerList,
    staleTime: 10 * 60 * 1000, // 10 minutes
    select: (data) => data.map((item) => item.name),
  });
}
