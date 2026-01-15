"use client";

import type { archestraApiTypes } from "@shared";
import { Box, Github, Info, Loader2, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { DebouncedInput } from "@/components/debounced-input";
import { TruncatedText } from "@/components/truncated-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useHasPermissions } from "@/lib/auth.query";
import {
  useDockerRegistryCategories,
  useDockerRegistryServersInfinite,
} from "@/lib/docker-mcp-registry.query";
import type {
  DockerMcpServer,
  DockerRegistryCategory,
} from "@/lib/docker-mcp-registry.types";
import {
  useCreateInternalMcpCatalogItem,
  useInternalMcpCatalogSuspense,
} from "@/lib/internal-mcp-catalog.query";
import { DockerServerDetailsDialog } from "./docker-server-details-dialog";

export function DockerRegistryCatalogTab({
  catalogItems: initialCatalogItems,
  onClose,
  onSuccess,
}: {
  catalogItems?: archestraApiTypes.GetInternalMcpCatalogResponses["200"];
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [detailsServer, setDetailsServer] = useState<DockerMcpServer | null>(
    null,
  );
  const [category, setCategory] = useState<DockerRegistryCategory>("all");

  // Get catalog items for filtering (with live updates)
  const { data: catalogItems } = useInternalMcpCatalogSuspense({
    initialData: initialCatalogItems,
  });

  // Fetch available categories
  const { data: availableCategories = [] } = useDockerRegistryCategories();

  const { data: userIsMcpServerAdmin = false } = useHasPermissions({
    mcpServer: ["admin"],
  });

  // Use Docker registry query
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useDockerRegistryServersInfinite(searchQuery, category);

  // Mutation for adding servers to catalog
  const createMutation = useCreateInternalMcpCatalogItem();

  const handleAddToCatalog = async (server: DockerMcpServer) => {
    if (!server.metadata) {
      console.error("Cannot add server without metadata");
      return;
    }

    const metadata = server.metadata;

    // Build environment variables from config.secrets and config.env
    const environment: Array<{
      key: string;
      type: "plain_text" | "secret" | "boolean" | "number";
      value?: string;
      promptOnInstallation: boolean;
      required?: boolean;
      description?: string;
      default?: string | number | boolean;
    }> = [];

    // Add secrets as secret env vars
    if (metadata.config?.secrets) {
      for (const secret of metadata.config.secrets) {
        environment.push({
          key: secret.env,
          type: "secret",
          value: undefined,
          promptOnInstallation: true,
          required: true,
          description: `Secret: ${secret.name}${secret.example ? ` (e.g., ${secret.example})` : ""}`,
        });
      }
    }

    // Add regular env vars
    if (metadata.config?.env) {
      for (const envVar of metadata.config.env) {
        // Skip template placeholders for now
        const isTemplate = envVar.value?.includes("{{");
        environment.push({
          key: envVar.name,
          type: "plain_text",
          value: isTemplate ? undefined : envVar.value,
          promptOnInstallation: isTemplate || !envVar.value,
          required: false,
          description: envVar.example
            ? `Example: ${envVar.example}`
            : undefined,
        });
      }
    }

    // Add parameters as env vars if they exist
    if (metadata.config?.parameters?.properties) {
      for (const [key, prop] of Object.entries(
        metadata.config.parameters.properties,
      )) {
        // Check if this parameter is already covered by secrets or env
        const alreadyCovered =
          metadata.config?.secrets?.some((s) =>
            s.name.includes(key.toLowerCase()),
          ) ||
          metadata.config?.env?.some((e) =>
            e.name.toLowerCase().includes(key.toLowerCase()),
          );

        if (!alreadyCovered) {
          const envType =
            prop.type === "boolean"
              ? "boolean"
              : prop.type === "number"
                ? "number"
                : "plain_text";

          environment.push({
            key: key.toUpperCase(),
            type: envType,
            value:
              prop.default !== undefined ? String(prop.default) : undefined,
            promptOnInstallation: true,
            required: metadata.config?.parameters?.required?.includes(key),
            description: `Parameter: ${key}`,
            default:
              prop.default !== undefined
                ? typeof prop.default === "object"
                  ? undefined
                  : (prop.default as string | number | boolean)
                : undefined,
          });
        }
      }
    }

    // Create the local config for Docker-based server
    const localConfig: archestraApiTypes.CreateInternalMcpCatalogItemData["body"]["localConfig"] =
      {
        dockerImage: metadata.image,
        command: metadata.run?.command?.[0],
        arguments:
          metadata.run?.command && metadata.run.command.length > 1
            ? metadata.run.command.slice(1)
            : undefined,
        environment: environment.length > 0 ? environment : undefined,
      };

    await createMutation.mutateAsync({
      name: server.name,
      version: undefined,
      instructions: metadata.about?.description,
      serverType: "local", // Docker registry servers are always local (Docker-based)
      localConfig,
    });

    // Close the dialog after adding
    onClose();
    onSuccess?.();
  };

  // Flatten all pages into a single array of servers
  const servers = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap((page) => page.servers);
  }, [data]);

  // Create a Set of catalog item names for efficient lookup
  const catalogServerNames = useMemo(
    () => new Set(catalogItems?.map((item) => item.name) || []),
    [catalogItems],
  );

  return (
    <div className="w-full space-y-2 mt-4">
      <div className="flex items-end gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <DebouncedInput
              placeholder="Search Docker MCP servers by name..."
              initialValue={searchQuery}
              onChange={setSearchQuery}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-muted-foreground">
            Category
          </span>
          <Select
            value={category}
            onValueChange={(value) =>
              setCategory(value as DockerRegistryCategory)
            }
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {availableCategories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from(
            { length: 4 },
            (_, i) => `skeleton-${i}-${Date.now()}`,
          ).map((key) => (
            <Card key={key}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {error && (
        <div className="text-center py-12">
          <p className="text-destructive mb-2">
            Failed to load servers from Docker MCP Registry
          </p>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      )}

      {!isLoading && !error && servers && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {servers.length} {servers.length === 1 ? "server" : "servers"}{" "}
              found
            </p>
          </div>

          {servers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No servers match your search criteria.
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 overflow-y-auto pr-2">
                {servers.map((server, index) => (
                  <DockerServerCard
                    key={`${server.name}-${index}`}
                    server={server}
                    onAddToCatalog={handleAddToCatalog}
                    isAdding={createMutation.isPending}
                    onOpenDetails={setDetailsServer}
                    isInCatalog={catalogServerNames.has(server.name)}
                    userIsMcpServerAdmin={userIsMcpServerAdmin}
                  />
                ))}
              </div>

              {hasNextPage && (
                <div className="flex justify-center mt-6">
                  <Button
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    variant="outline"
                    size="lg"
                  >
                    {isFetchingNextPage ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading more...
                      </>
                    ) : (
                      "Load more"
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}

      <DockerServerDetailsDialog
        server={detailsServer}
        onClose={() => setDetailsServer(null)}
      />
    </div>
  );
}

// Server card component for a single Docker MCP server
function DockerServerCard({
  server,
  onAddToCatalog,
  isAdding,
  onOpenDetails,
  isInCatalog,
  userIsMcpServerAdmin,
}: {
  server: DockerMcpServer;
  onAddToCatalog: (server: DockerMcpServer) => void;
  isAdding: boolean;
  onOpenDetails: (server: DockerMcpServer) => void;
  isInCatalog: boolean;
  userIsMcpServerAdmin: boolean;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            {server.icon ? (
              <img
                src={server.icon}
                alt={`${server.name} icon`}
                className="w-8 h-8 rounded flex-shrink-0 mt-0.5"
              />
            ) : (
              <Box className="w-8 h-8 text-muted-foreground flex-shrink-0 mt-0.5" />
            )}
            <CardTitle className="text-base">
              <TruncatedText
                message={server.displayName || server.name}
                maxLength={40}
              />
            </CardTitle>
          </div>
          <div className="flex flex-wrap gap-1 items-center flex-shrink-0 mt-1">
            {server.category && (
              <Badge variant="outline" className="text-xs">
                {server.category}
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs">
              Docker
            </Badge>
          </div>
        </div>
        {server.displayName && server.displayName !== server.name && (
          <p className="text-xs text-muted-foreground font-mono">
            {server.name}
          </p>
        )}
        <div className="flex gap-1 mt-1">
          <Badge variant="outline" className="text-xs">
            Local
          </Badge>
          <Badge variant="outline" className="text-xs">
            {server.image}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col space-y-3">
        {server.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {server.description}
          </p>
        )}

        <div className="flex flex-col gap-2 mt-auto pt-3 justify-end">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenDetails(server)}
              className="flex-1"
            >
              <Info className="h-4 w-4 mr-1" />
              Details
            </Button>
            {server.sourceUrl && (
              <Button variant="outline" size="sm" asChild className="flex-1">
                <a
                  href={server.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="h-4 w-4 mr-1" />
                  Source
                </a>
              </Button>
            )}
          </div>
          {userIsMcpServerAdmin ? (
            <Button
              onClick={() => onAddToCatalog(server)}
              disabled={isAdding || isInCatalog || !server.metadataLoaded}
              size="sm"
              className="w-full"
            >
              {isInCatalog
                ? "Added"
                : !server.metadataLoaded
                  ? "Loading..."
                  : "Add to Your Registry"}
            </Button>
          ) : (
            <Button
              disabled={true}
              size="sm"
              variant="outline"
              className="w-full"
            >
              Requires admin access
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
