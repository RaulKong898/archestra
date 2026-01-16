"use client";

import type { archestraApiTypes } from "@shared";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChatToolsDisplay } from "@/components/chat/chat-tools-display";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useLlmProxies } from "@/lib/llm-proxy.query";
import { useMcpGateways } from "@/lib/mcp-gateway-entity.query";
import {
  usePromptAgents,
  useSyncPromptAgents,
} from "@/lib/prompt-agents.query";
import {
  useCreatePrompt,
  usePrompts,
  useUpdatePrompt,
} from "@/lib/prompts.query";

type Prompt = archestraApiTypes.GetPromptsResponses["200"][number];

interface PromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt?: Prompt | null;
  onViewVersionHistory?: (prompt: Prompt) => void;
}

export function PromptDialog({
  open,
  onOpenChange,
  prompt,
  onViewVersionHistory,
}: PromptDialogProps) {
  const { data: mcpGateways = [] } = useMcpGateways();
  const { data: llmProxies = [] } = useLlmProxies();
  const { data: allPrompts = [] } = usePrompts();
  const createPrompt = useCreatePrompt();
  const updatePrompt = useUpdatePrompt();
  const syncPromptAgents = useSyncPromptAgents();
  const { data: currentAgents = [] } = usePromptAgents(prompt?.id);

  const [name, setName] = useState("");
  const [mcpGatewayId, setMcpGatewayId] = useState<string | null>(null);
  const [llmProxyId, setLlmProxyId] = useState<string | null>(null);
  const [userPrompt, setUserPrompt] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [selectedAgentPromptIds, setSelectedAgentPromptIds] = useState<
    string[]
  >([]);

  // Available prompts that can be used as agents (excluding self)
  const availableAgentPrompts = useMemo(() => {
    return allPrompts
      .filter((p) => p.id !== prompt?.id)
      .map((p) => {
        const gateway = mcpGateways.find((g) => g.id === p.mcpGatewayId);
        return {
          value: p.id,
          label: gateway ? `${p.name} (${gateway.name})` : p.name,
        };
      });
  }, [allPrompts, mcpGateways, prompt?.id]);

  // Reset form when dialog opens/closes or prompt changes
  useEffect(() => {
    if (open) {
      // edit
      if (prompt) {
        setName(prompt.name);
        setMcpGatewayId(prompt.mcpGatewayId ?? null);
        setLlmProxyId(prompt.llmProxyId ?? null);
        setUserPrompt(prompt.userPrompt || "");
        setSystemPrompt(prompt.systemPrompt || "");
        // Note: agents are loaded separately via currentAgents query
      } else {
        // create
        setName("");
        setMcpGatewayId(null);
        setLlmProxyId(null);
        setUserPrompt("");
        setSystemPrompt("");
        setSelectedAgentPromptIds([]);
      }
    } else {
      // reset form
      setName("");
      setMcpGatewayId(null);
      setLlmProxyId(null);
      setUserPrompt("");
      setSystemPrompt("");
      setSelectedAgentPromptIds([]);
    }
  }, [open, prompt]);

  // Sync selectedAgentPromptIds with currentAgents when data loads
  // Use a stable string representation to avoid infinite loops
  const currentAgentIds = currentAgents.map((a) => a.agentPromptId).join(",");
  const promptId = prompt?.id;

  useEffect(() => {
    if (open && promptId && currentAgentIds) {
      setSelectedAgentPromptIds(currentAgentIds.split(",").filter(Boolean));
    }
  }, [open, promptId, currentAgentIds]);

  const handleSave = useCallback(async () => {
    // Trim values once at the start
    const trimmedName = name.trim();
    const trimmedUserPrompt = userPrompt.trim();
    const trimmedSystemPrompt = systemPrompt.trim();

    if (!trimmedName) {
      toast.error("Name is required");
      return;
    }

    // Use mcpGatewayId as agentId for backward compatibility
    // (they have the same IDs from the migration)
    const agentId = mcpGatewayId || mcpGateways[0]?.id;

    if (!agentId) {
      toast.error("MCP Gateway is required");
      return;
    }

    try {
      let promptId: string;

      if (prompt) {
        // Update increments version (ID stays the same with JSONB history)
        const updated = await updatePrompt.mutateAsync({
          id: prompt.id,
          data: {
            name: trimmedName,
            agentId,
            mcpGatewayId: mcpGatewayId || undefined,
            llmProxyId: llmProxyId || undefined,
            userPrompt: trimmedUserPrompt || undefined,
            systemPrompt: trimmedSystemPrompt || undefined,
          },
        });
        promptId = updated?.id ?? prompt.id;
        toast.success("Agent updated successfully");
      } else {
        const created = await createPrompt.mutateAsync({
          name: trimmedName,
          agentId,
          mcpGatewayId: mcpGatewayId || undefined,
          llmProxyId: llmProxyId || undefined,
          userPrompt: trimmedUserPrompt || undefined,
          systemPrompt: trimmedSystemPrompt || undefined,
        });
        promptId = created?.id ?? "";
        toast.success("Agent created successfully");
      }

      // Sync agents if any were selected and we have a valid promptId
      if (promptId && selectedAgentPromptIds.length > 0) {
        await syncPromptAgents.mutateAsync({
          promptId,
          agentPromptIds: selectedAgentPromptIds,
        });
      } else if (promptId && prompt && currentAgents.length > 0) {
        // Clear agents if none selected but there were some before
        await syncPromptAgents.mutateAsync({
          promptId,
          agentPromptIds: [],
        });
      }

      onOpenChange(false);
    } catch (_error) {
      toast.error("Failed to save Agent");
    }
  }, [
    name,
    mcpGatewayId,
    mcpGateways,
    llmProxyId,
    userPrompt,
    systemPrompt,
    prompt,
    selectedAgentPromptIds,
    currentAgents.length,
    updatePrompt,
    createPrompt,
    syncPromptAgents,
    onOpenChange,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>
            {prompt ? "Edit Agent" : "Create New Agent"}
            {prompt && onViewVersionHistory && (
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onViewVersionHistory(prompt);
                }}
                className="text-xs h-auto p-0 ml-2"
              >
                Version History
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="promptName">Name *</Label>
            <Input
              id="promptName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter prompt name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mcpGatewayId">MCP Gateway</Label>
            <p className="text-sm text-muted-foreground">
              Select the MCP Gateway with the tools that will be available
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={mcpGatewayId ?? ""}
                onValueChange={(v) => setMcpGatewayId(v || null)}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select MCP Gateway..." />
                </SelectTrigger>
                <SelectContent>
                  {mcpGateways.map((gateway) => (
                    <SelectItem key={gateway.id} value={gateway.id}>
                      {gateway.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {mcpGatewayId && (
                <ChatToolsDisplay agentId={mcpGatewayId} readOnly />
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="llmProxyId">LLM Proxy</Label>
            <p className="text-sm text-muted-foreground">
              Select the LLM Proxy for policy evaluation and observability
            </p>
            <Select
              value={llmProxyId ?? ""}
              onValueChange={(v) => setLlmProxyId(v || null)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select LLM Proxy..." />
              </SelectTrigger>
              <SelectContent>
                {llmProxies.map((proxy) => (
                  <SelectItem key={proxy.id} value={proxy.id}>
                    {proxy.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Agents</Label>
            <p className="text-sm text-muted-foreground">
              Select other agents to delegate tasks
            </p>
            <MultiSelect
              value={selectedAgentPromptIds}
              onValueChange={setSelectedAgentPromptIds}
              items={availableAgentPrompts}
              placeholder="Select agents..."
              disabled={availableAgentPrompts.length === 0}
            />
            {availableAgentPrompts.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No other agent available
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="systemPrompt">System Prompt</Label>
            <Textarea
              id="systemPrompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Enter system prompt (instructions for the LLM)"
              className="min-h-[150px] font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="userPrompt">User Prompt</Label>
            <Textarea
              id="userPrompt"
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              placeholder="Enter user prompt (shown to user, sent to LLM)"
              className="min-h-[150px] font-mono"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              !name.trim() || createPrompt.isPending || updatePrompt.isPending
            }
          >
            {(createPrompt.isPending || updatePrompt.isPending) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {prompt ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
