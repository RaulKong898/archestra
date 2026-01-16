"use client";

import type { archestraApiTypes } from "@shared";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { WithPermissions } from "@/components/roles/with-permissions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
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
  );
}
