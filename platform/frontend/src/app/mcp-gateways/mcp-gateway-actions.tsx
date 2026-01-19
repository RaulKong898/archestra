"use client";

import type { archestraApiTypes } from "@shared";
import { Link2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { McpGatewayConnectionInstructions } from "@/components/mcp-gateway-connection-instructions";
import { WithPermissions } from "@/components/roles/with-permissions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type McpGatewayData =
  archestraApiTypes.GetMcpGatewayEntitiesResponses["200"]["data"][number];

interface McpGatewayActionsProps {
  gateway: McpGatewayData;
  onEdit: (gateway: McpGatewayData) => void;
  onDelete: (gatewayId: string) => void;
}

export function McpGatewayActions({
  gateway,
  onEdit,
  onDelete,
}: McpGatewayActionsProps) {
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setConnectDialogOpen(true)}>
            <Link2 className="mr-2 h-4 w-4" />
            Connect
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <WithPermissions
            permissions={{ mcpGatewayEntity: ["update"] }}
            noPermissionHandle="hide"
          >
            <DropdownMenuItem onClick={() => onEdit(gateway)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
          </WithPermissions>
          <WithPermissions
            permissions={{ mcpGatewayEntity: ["delete"] }}
            noPermissionHandle="hide"
          >
            <DropdownMenuItem
              onClick={() => onDelete(gateway.id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </WithPermissions>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Connect to {gateway.name}</DialogTitle>
            <DialogDescription>
              Configure your MCP client to connect to this gateway and access
              its tools.
            </DialogDescription>
          </DialogHeader>
          <McpGatewayConnectionInstructions
            gatewayId={gateway.id}
            gatewayName={gateway.name}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
