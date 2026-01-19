"use client";

import type { archestraApiTypes } from "@shared";
import { archestraApiSdk } from "@shared";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { ChevronDown, ChevronUp, Plus, Search, Tag, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ErrorBoundary } from "@/app/_parts/error-boundary";
import {
  type ProfileLabel,
  ProfileLabels,
  type ProfileLabelsRef,
} from "@/components/agent-labels";
import { DebouncedInput } from "@/components/debounced-input";
import { LoadingSpinner } from "@/components/loading";
import { PageLayout } from "@/components/page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PermissionButton } from "@/components/ui/permission-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useHasPermissions } from "@/lib/auth.query";
import {
  useCreateMcpGateway,
  useDeleteMcpGateway,
  useMcpGatewayLabelKeys,
  useMcpGatewaysPaginated,
  useUpdateMcpGateway,
} from "@/lib/mcp-gateway-entity.query";
import {
  DEFAULT_AGENTS_PAGE_SIZE,
  DEFAULT_SORT_BY,
  DEFAULT_SORT_DIRECTION,
  formatDate,
} from "@/lib/utils";
import { McpGatewayActions } from "./mcp-gateway-actions";

type McpGatewaysInitialData = {
  mcpGateways: archestraApiTypes.GetMcpGatewayEntitiesResponses["200"] | null;
  teams: archestraApiTypes.GetTeamsResponses["200"];
};

export default function McpGatewaysPage({
  initialData,
}: {
  initialData?: McpGatewaysInitialData;
}) {
  return (
    <div className="w-full h-full">
      <ErrorBoundary>
        <Suspense fallback={<LoadingSpinner />}>
          <McpGateways initialData={initialData} />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}

function SortIcon({ isSorted }: { isSorted: false | "asc" | "desc" }) {
  const upArrow = <ChevronUp className="h-3 w-3" />;
  const downArrow = <ChevronDown className="h-3 w-3" />;
  if (isSorted === "asc") {
    return upArrow;
  }
  if (isSorted === "desc") {
    return downArrow;
  }
  return (
    <div className="text-muted-foreground/50 flex flex-col items-center">
      {upArrow}
      <span className="mt-[-4px]">{downArrow}</span>
    </div>
  );
}

function TeamsBadges({
  teams,
}: {
  teams: Array<{ id: string; name: string }> | undefined;
}) {
  const MAX_TEAMS_TO_SHOW = 3;
  if (!teams || teams.length === 0) {
    return <span className="text-sm text-muted-foreground">None</span>;
  }

  const visibleTeams = teams.slice(0, MAX_TEAMS_TO_SHOW);
  const remainingTeams = teams.slice(MAX_TEAMS_TO_SHOW);

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visibleTeams.map((team) => (
        <Badge key={team.id} variant="secondary" className="text-xs">
          {team.name}
        </Badge>
      ))}
      {remainingTeams.length > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground cursor-help">
                +{remainingTeams.length} more
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <div className="flex flex-col gap-1">
                {remainingTeams.map((team) => (
                  <div key={team.id} className="text-xs">
                    {team.name}
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

function McpGateways({
  initialData,
}: {
  initialData?: McpGatewaysInitialData;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Get pagination/filter params from URL
  const pageFromUrl = searchParams.get("page");
  const pageSizeFromUrl = searchParams.get("pageSize");
  const nameFilter = searchParams.get("name") || "";
  const sortByFromUrl = searchParams.get("sortBy") as
    | "name"
    | "createdAt"
    | "toolsCount"
    | "team"
    | null;
  const sortDirectionFromUrl = searchParams.get("sortDirection") as
    | "asc"
    | "desc"
    | null;

  const pageIndex = Number(pageFromUrl || "1") - 1;
  const pageSize = Number(pageSizeFromUrl || DEFAULT_AGENTS_PAGE_SIZE);
  const offset = pageIndex * pageSize;

  // Default sorting
  const sortBy = sortByFromUrl || DEFAULT_SORT_BY;
  const sortDirection = sortDirectionFromUrl || DEFAULT_SORT_DIRECTION;

  const { data: mcpGatewaysResponse } = useMcpGatewaysPaginated({
    initialData: initialData?.mcpGateways ?? undefined,
    limit: pageSize,
    offset,
    sortBy,
    sortDirection,
    name: nameFilter || undefined,
  });

  const mcpGateways = mcpGatewaysResponse?.data || [];
  const pagination = mcpGatewaysResponse?.pagination;

  const { data: _teams } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data } = await archestraApiSdk.getTeams();
      return data || [];
    },
    initialData: initialData?.teams,
  });

  const [searchQuery, setSearchQuery] = useState(nameFilter);
  const [sorting, setSorting] = useState<SortingState>([
    { id: sortBy, desc: sortDirection === "desc" },
  ]);

  // Sync sorting state with URL params
  useEffect(() => {
    setSorting([{ id: sortBy, desc: sortDirection === "desc" }]);
  }, [sortBy, sortDirection]);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingGateway, setEditingGateway] = useState<{
    id: string;
    name: string;
    teams: Array<{ id: string; name: string }>;
    labels: ProfileLabel[];
  } | null>(null);
  const [deletingGatewayId, setDeletingGatewayId] = useState<string | null>(
    null,
  );

  type McpGatewayData =
    archestraApiTypes.GetMcpGatewayEntitiesResponses["200"]["data"][number];

  // Update URL when search query changes
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set("name", value);
      } else {
        params.delete("name");
      }
      params.set("page", "1"); // Reset to first page on search
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  // Update URL when sorting changes
  const handleSortingChange = useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      const newSorting =
        typeof updater === "function" ? updater(sorting) : updater;
      setSorting(newSorting);

      const params = new URLSearchParams(searchParams.toString());
      if (newSorting.length > 0) {
        params.set("sortBy", newSorting[0].id);
        params.set("sortDirection", newSorting[0].desc ? "desc" : "asc");
      } else {
        params.delete("sortBy");
        params.delete("sortDirection");
      }
      params.set("page", "1"); // Reset to first page when sorting changes
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [sorting, searchParams, router, pathname],
  );

  // Update URL when pagination changes
  const handlePaginationChange = useCallback(
    (newPagination: { pageIndex: number; pageSize: number }) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", String(newPagination.pageIndex + 1));
      params.set("pageSize", String(newPagination.pageSize));
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  const columns: ColumnDef<McpGatewayData>[] = [
    {
      id: "name",
      accessorKey: "name",
      size: 300,
      header: ({ column }) => (
        <Button
          variant="ghost"
          className="h-auto !p-0 font-medium hover:bg-transparent"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Name
          <SortIcon isSorted={column.getIsSorted()} />
        </Button>
      ),
      cell: ({ row }) => {
        const gateway = row.original;
        return (
          <div className="font-medium">
            <div className="flex items-center gap-2">
              {gateway.name}
              {gateway.isDefault && (
                <Badge
                  variant="outline"
                  className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30 text-xs font-bold"
                >
                  DEFAULT
                </Badge>
              )}
              {gateway.labels && gateway.labels.length > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="inline-flex">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {gateway.labels.map((label) => (
                          <Badge
                            key={label.key}
                            variant="secondary"
                            className="text-xs"
                          >
                            <span className="font-semibold">{label.key}:</span>
                            <span className="ml-1">{label.value}</span>
                          </Badge>
                        ))}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: "createdAt",
      accessorKey: "createdAt",
      header: ({ column }) => (
        <Button
          variant="ghost"
          className="h-auto !p-0 font-medium hover:bg-transparent"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Created
          <SortIcon isSorted={column.getIsSorted()} />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="font-mono text-xs">
          {formatDate({ date: row.original.createdAt })}
        </div>
      ),
    },
    {
      id: "toolsCount",
      accessorKey: "toolsCount",
      header: ({ column }) => (
        <Button
          variant="ghost"
          className="h-auto !p-0 font-medium hover:bg-transparent"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Connected Tools
          <SortIcon isSorted={column.getIsSorted()} />
        </Button>
      ),
      cell: ({ row }) => row.original.tools?.length ?? 0,
    },
    {
      id: "team",
      header: ({ column }) => (
        <Button
          variant="ghost"
          className="h-auto !p-0 font-medium hover:bg-transparent"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Teams
          <SortIcon isSorted={column.getIsSorted()} />
        </Button>
      ),
      cell: ({ row }) => (
        <TeamsBadges
          teams={
            row.original.teams as unknown as Array<{
              id: string;
              name: string;
            }>
          }
        />
      ),
    },
    {
      id: "actions",
      header: "Actions",
      size: 176,
      enableHiding: false,
      cell: ({ row }) => {
        const gateway = row.original;
        return (
          <McpGatewayActions
            gateway={gateway}
            onEdit={(gatewayData) => {
              setEditingGateway({
                id: gatewayData.id,
                name: gatewayData.name,
                teams:
                  (gatewayData.teams as unknown as Array<{
                    id: string;
                    name: string;
                  }>) || [],
                labels: gatewayData.labels || [],
              });
            }}
            onDelete={setDeletingGatewayId}
          />
        );
      },
    },
  ];

  return (
    <PageLayout
      title="MCP Gateway"
      description={
        <p className="text-sm text-muted-foreground">
          MCP Gateway manages tool assignments and MCP tool execution for your
          agents and workflows.{" "}
          <a
            href="https://archestra.ai/docs/platform-mcp-gateways"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Read more in the docs
          </a>
        </p>
      }
      actionButton={
        <PermissionButton
          permissions={{ mcpGatewayEntity: ["create"] }}
          onClick={() => setIsCreateDialogOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Create MCP Gateway
        </PermissionButton>
      }
    >
      <div>
        <div>
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <DebouncedInput
                placeholder="Search MCP gateways by name..."
                initialValue={searchQuery}
                onChange={handleSearchChange}
                className="pl-9"
              />
            </div>
          </div>

          {!mcpGateways || mcpGateways.length === 0 ? (
            <div className="text-muted-foreground">
              {nameFilter
                ? "No MCP gateways found matching your search"
                : "No MCP gateways found"}
            </div>
          ) : (
            <div>
              <DataTable
                columns={columns}
                data={mcpGateways}
                sorting={sorting}
                onSortingChange={handleSortingChange}
                manualSorting={true}
                manualPagination={true}
                pagination={{
                  pageIndex,
                  pageSize,
                  total: pagination?.total || 0,
                }}
                onPaginationChange={handlePaginationChange}
              />
            </div>
          )}

          <CreateMcpGatewayDialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
          />

          {editingGateway && (
            <EditMcpGatewayDialog
              gateway={editingGateway}
              open={!!editingGateway}
              onOpenChange={(open) => !open && setEditingGateway(null)}
            />
          )}

          {deletingGatewayId && (
            <DeleteMcpGatewayDialog
              gatewayId={deletingGatewayId}
              open={!!deletingGatewayId}
              onOpenChange={(open) => !open && setDeletingGatewayId(null)}
            />
          )}
        </div>
      </div>
    </PageLayout>
  );
}

function CreateMcpGatewayDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [assignedTeamIds, setAssignedTeamIds] = useState<string[]>([]);
  const [labels, setLabels] = useState<ProfileLabel[]>([]);
  const { data: teams } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const response = await archestraApiSdk.getTeams();
      return response.data || [];
    },
  });
  const { data: availableKeys = [] } = useMcpGatewayLabelKeys();
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const createMcpGateway = useCreateMcpGateway();
  const gatewayLabelsRef = useRef<ProfileLabelsRef>(null);
  const { data: isMcpGatewayAdmin } = useHasPermissions({
    mcpGatewayEntity: ["admin"],
  });

  // Non-admin users must select at least one team
  const requiresTeamSelection =
    !isMcpGatewayAdmin && assignedTeamIds.length === 0;
  const hasNoAvailableTeams = !teams || teams.length === 0;

  const handleAddTeam = useCallback(
    (teamId: string) => {
      if (teamId && !assignedTeamIds.includes(teamId)) {
        setAssignedTeamIds([...assignedTeamIds, teamId]);
        setSelectedTeamId("");
      }
    },
    [assignedTeamIds],
  );

  const handleRemoveTeam = useCallback(
    (teamId: string) => {
      setAssignedTeamIds(assignedTeamIds.filter((id) => id !== teamId));
    },
    [assignedTeamIds],
  );

  const getUnassignedTeams = useCallback(() => {
    if (!teams) return [];
    return teams.filter((team) => !assignedTeamIds.includes(team.id));
  }, [teams, assignedTeamIds]);

  const getTeamById = useCallback(
    (teamId: string) => {
      return teams?.find((team) => team.id === teamId);
    },
    [teams],
  );

  const handleClose = useCallback(() => {
    setName("");
    setAssignedTeamIds([]);
    setLabels([]);
    setSelectedTeamId("");
    onOpenChange(false);
  }, [onOpenChange]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim()) {
        toast.error("Please enter a name");
        return;
      }

      // Non-admin users must select at least one team
      if (!isMcpGatewayAdmin && assignedTeamIds.length === 0) {
        toast.error("Please select at least one team");
        return;
      }

      // Save any unsaved label before submitting
      const updatedLabels =
        gatewayLabelsRef.current?.saveUnsavedLabel() || labels;

      try {
        await createMcpGateway.mutateAsync({
          name: name.trim(),
          teams: assignedTeamIds,
          labels: updatedLabels,
        });
        handleClose();
      } catch (_error) {
        // Error toast is handled in the mutation
      }
    },
    [
      name,
      assignedTeamIds,
      labels,
      createMcpGateway,
      isMcpGatewayAdmin,
      handleClose,
    ],
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] flex flex-col"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Create new MCP Gateway</DialogTitle>
          <DialogDescription>
            Create a new MCP Gateway to manage tool assignments and execution.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="grid gap-4 overflow-y-auto pr-2 pb-4 space-y-2">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My MCP Gateway"
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <Label>
                Team Access
                {!isMcpGatewayAdmin && (
                  <span className="text-destructive ml-1">(required)</span>
                )}
              </Label>
              <p className="text-sm text-muted-foreground">
                Assign teams to grant their members access to this MCP Gateway.
              </p>
              <Select value={selectedTeamId} onValueChange={handleAddTeam}>
                <SelectTrigger id="assign-team">
                  <SelectValue placeholder="Select a team to assign" />
                </SelectTrigger>
                <SelectContent>
                  {teams?.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No teams available
                    </div>
                  ) : getUnassignedTeams().length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      All teams are already assigned
                    </div>
                  ) : (
                    getUnassignedTeams().map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {assignedTeamIds.length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-2">
                  {assignedTeamIds.map((teamId) => {
                    const team = getTeamById(teamId);
                    return (
                      <Badge
                        key={teamId}
                        variant="secondary"
                        className="flex items-center gap-1 pr-1"
                      >
                        <span>{team?.name || teamId}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTeam(teamId)}
                          className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {isMcpGatewayAdmin
                    ? "No teams assigned yet. Admins have access to all MCP Gateway entries."
                    : hasNoAvailableTeams
                      ? "You are not a member of any team. Contact an admin to be added to a team."
                      : "No teams assigned yet."}
                </p>
              )}
            </div>

            <ProfileLabels
              ref={gatewayLabelsRef}
              labels={labels}
              onLabelsChange={setLabels}
              availableKeys={availableKeys}
            />
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                createMcpGateway.isPending ||
                requiresTeamSelection ||
                (!isMcpGatewayAdmin && hasNoAvailableTeams)
              }
            >
              {createMcpGateway.isPending
                ? "Creating..."
                : "Create MCP Gateway"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditMcpGatewayDialog({
  gateway,
  open,
  onOpenChange,
}: {
  gateway: {
    id: string;
    name: string;
    teams: Array<{ id: string; name: string }>;
    labels: ProfileLabel[];
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState(gateway.name);
  const [assignedTeamIds, setAssignedTeamIds] = useState<string[]>(
    gateway.teams?.map((t) => t.id) || [],
  );
  const [labels, setLabels] = useState<ProfileLabel[]>(gateway.labels || []);
  const { data: teams } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const response = await archestraApiSdk.getTeams();
      return response.data || [];
    },
  });
  const { data: availableKeys = [] } = useMcpGatewayLabelKeys();
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const updateMcpGateway = useUpdateMcpGateway();
  const gatewayLabelsRef = useRef<ProfileLabelsRef>(null);
  const { data: isMcpGatewayAdmin } = useHasPermissions({
    mcpGatewayEntity: ["admin"],
  });

  // Non-admin users must have at least one team assigned
  const requiresTeamSelection =
    !isMcpGatewayAdmin && assignedTeamIds.length === 0;

  const handleAddTeam = useCallback(
    (teamId: string) => {
      if (teamId && !assignedTeamIds.includes(teamId)) {
        setAssignedTeamIds([...assignedTeamIds, teamId]);
        setSelectedTeamId("");
      }
    },
    [assignedTeamIds],
  );

  const handleRemoveTeam = useCallback(
    (teamId: string) => {
      setAssignedTeamIds(assignedTeamIds.filter((id) => id !== teamId));
    },
    [assignedTeamIds],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim()) {
        toast.error("Please enter a name");
        return;
      }

      // Non-admin users must have at least one team assigned
      if (!isMcpGatewayAdmin && assignedTeamIds.length === 0) {
        toast.error("Please select at least one team");
        return;
      }

      // Save any unsaved label before submitting
      const updatedLabels =
        gatewayLabelsRef.current?.saveUnsavedLabel() || labels;

      try {
        await updateMcpGateway.mutateAsync({
          id: gateway.id,
          data: {
            name: name.trim(),
            teams: assignedTeamIds,
            labels: updatedLabels,
          },
        });
        onOpenChange(false);
      } catch (_error) {
        // Error toast is handled in the mutation
      }
    },
    [
      gateway.id,
      name,
      assignedTeamIds,
      labels,
      updateMcpGateway,
      onOpenChange,
      isMcpGatewayAdmin,
    ],
  );

  const getUnassignedTeams = useCallback(() => {
    if (!teams) return [];
    return teams.filter((team) => !assignedTeamIds.includes(team.id));
  }, [teams, assignedTeamIds]);

  const getTeamById = useCallback(
    (teamId: string) => {
      return teams?.find((team) => team.id === teamId);
    },
    [teams],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] flex flex-col"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Edit MCP Gateway</DialogTitle>
          <DialogDescription>
            Update the MCP Gateway's name and assign teams.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="grid gap-4 overflow-y-auto pr-2 pb-4 space-y-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My MCP Gateway"
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <Label>
                Team Access
                {!isMcpGatewayAdmin && (
                  <span className="text-destructive ml-1">(required)</span>
                )}
              </Label>
              <p className="text-sm text-muted-foreground">
                Assign teams to grant their members access to this MCP Gateway.
              </p>
              <Select value={selectedTeamId} onValueChange={handleAddTeam}>
                <SelectTrigger id="assign-team">
                  <SelectValue placeholder="Select a team to assign" />
                </SelectTrigger>
                <SelectContent>
                  {teams?.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No teams available
                    </div>
                  ) : getUnassignedTeams().length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      All teams are already assigned
                    </div>
                  ) : (
                    getUnassignedTeams().map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {assignedTeamIds.length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-2">
                  {assignedTeamIds.map((teamId) => {
                    const team = getTeamById(teamId);
                    return (
                      <Badge
                        key={teamId}
                        variant="secondary"
                        className="flex items-center gap-1 pr-1"
                      >
                        <span>{team?.name || teamId}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTeam(teamId)}
                          className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {isMcpGatewayAdmin
                    ? "No teams assigned yet. Admins have access to all MCP Gateway entries."
                    : "No teams assigned yet."}
                </p>
              )}
            </div>

            <ProfileLabels
              ref={gatewayLabelsRef}
              labels={labels}
              onLabelsChange={setLabels}
              availableKeys={availableKeys}
            />
          </div>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateMcpGateway.isPending || requiresTeamSelection}
            >
              {updateMcpGateway.isPending
                ? "Updating..."
                : "Update MCP Gateway"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteMcpGatewayDialog({
  gatewayId,
  open,
  onOpenChange,
}: {
  gatewayId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const deleteMcpGateway = useDeleteMcpGateway();

  const handleDelete = useCallback(async () => {
    try {
      await deleteMcpGateway.mutateAsync(gatewayId);
      onOpenChange(false);
    } catch (_error) {
      // Error toast is handled in the mutation
    }
  }, [gatewayId, deleteMcpGateway, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Delete MCP Gateway</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this MCP Gateway? This action cannot
            be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteMcpGateway.isPending}
          >
            {deleteMcpGateway.isPending ? "Deleting..." : "Delete MCP Gateway"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
