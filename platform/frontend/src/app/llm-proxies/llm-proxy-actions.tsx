"use client";

import type { archestraApiTypes } from "@shared";
import { Link2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { ProxyConnectionInstructions } from "@/components/proxy-connection-instructions";
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

type LlmProxyData =
  archestraApiTypes.GetLlmProxiesResponses["200"]["data"][number];

interface LlmProxyActionsProps {
  proxy: LlmProxyData;
  onEdit: (proxy: LlmProxyData) => void;
  onDelete: (proxyId: string) => void;
}

export function LlmProxyActions({
  proxy,
  onEdit,
  onDelete,
}: LlmProxyActionsProps) {
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
            permissions={{ llmProxy: ["update"] }}
            noPermissionHandle="hide"
          >
            <DropdownMenuItem onClick={() => onEdit(proxy)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
          </WithPermissions>
          <WithPermissions
            permissions={{ llmProxy: ["delete"] }}
            noPermissionHandle="hide"
          >
            <DropdownMenuItem
              onClick={() => onDelete(proxy.id)}
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
            <DialogTitle>Connect to {proxy.name}</DialogTitle>
            <DialogDescription>
              Configure your LLM client to use this proxy for policy evaluation,
              cost limits, and observability.
            </DialogDescription>
          </DialogHeader>
          <ProxyConnectionInstructions agentId={proxy.id} />
        </DialogContent>
      </Dialog>
    </>
  );
}
