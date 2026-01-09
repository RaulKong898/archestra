"use client";

import { Sparkles } from "lucide-react";
import { TruncatedText } from "@/components/truncated-text";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useInternalMcpCatalog } from "@/lib/internal-mcp-catalog.query";
import type { ProfileToolData } from "@/lib/profile-tools.query";
import { formatDate } from "@/lib/utils";
import { ToolCallPolicies } from "./tool-call-policies";
import { ToolReadonlyDetails } from "./tool-readonly-details";
import { ToolResultPolicies } from "./tool-result-policies";

interface ToolDetailsDialogProps {
  agentTool: ProfileToolData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ToolDetailsDialog({
  agentTool,
  open,
  onOpenChange,
}: ToolDetailsDialogProps) {
  const { data: internalMcpCatalogItems } = useInternalMcpCatalog();
  if (!agentTool) return null;

  const profileNames =
    agentTool.profiles.length > 0
      ? agentTool.profiles.map((p) => p.name).join(", ")
      : "-";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-[1600px] max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-xl font-semibold tracking-tight">
                {agentTool.name}
              </DialogTitle>
              {agentTool.description && (
                <TruncatedText
                  message={agentTool.description}
                  maxLength={200}
                  className="text-sm text-muted-foreground mt-1"
                />
              )}
            </div>
            <div className="flex gap-6 text-sm ml-6">
              <div>
                <div className="text-xs font-medium text-muted-foreground">
                  Profiles
                </div>
                <div className="text-sm text-foreground mt-0.5">
                  {profileNames}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground">
                  Origin
                </div>
                <div className="mt-0.5">
                  {agentTool.catalogId ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="default" className="bg-indigo-500">
                            MCP Server
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            {
                              internalMcpCatalogItems?.find(
                                (item) => item.id === agentTool.catalogId,
                              )?.name
                            }
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="secondary" className="bg-orange-800">
                            Intercepted
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Tool discovered via agent-LLM communication</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground">
                  Detected
                </div>
                <div className="text-sm text-foreground mt-0.5">
                  {formatDate({ date: agentTool.createdAt })}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground">
                  Updated
                </div>
                <div className="text-sm text-foreground mt-0.5">
                  {formatDate({ date: agentTool.updatedAt })}
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 -mr-2">
          <div className="space-y-6">
            {agentTool.policiesAutoConfiguredAt &&
              agentTool.policiesAutoConfiguredReasoning && (
                <div className="rounded-lg border border-purple-200 bg-purple-50 dark:border-purple-900 dark:bg-purple-950/30 p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-2">
                      <div className="font-semibold text-purple-900 dark:text-purple-100">
                        Configured by Policy Configuration Subagent
                      </div>
                      <p className="text-sm text-purple-800 dark:text-purple-200 leading-relaxed">
                        {agentTool.policiesAutoConfiguredReasoning}
                      </p>
                      <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                        Configured on{" "}
                        {formatDate({
                          date: agentTool.policiesAutoConfiguredAt,
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            <ToolReadonlyDetails tool={agentTool} />
            <div className="grid grid-cols-2 gap-6">
              <ToolCallPolicies tool={agentTool} />
              <ToolResultPolicies toolId={agentTool.id} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
