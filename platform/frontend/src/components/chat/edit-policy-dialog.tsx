"use client";

import { ToolCallPolicies } from "@/app/tools/_parts/tool-call-policies";
import { ToolResultPolicies } from "@/app/tools/_parts/tool-result-policies";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useProfileTools } from "@/lib/profile-tools.query";

interface EditPolicyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toolName: string;
  profileId: string;
}

export function EditPolicyDialog({
  open,
  onOpenChange,
  toolName,
  profileId,
}: EditPolicyDialogProps) {
  const { data } = useProfileTools({
    filters: {
      search: toolName,
      profileId,
    },
    pagination: {
      limit: 1,
    },
  });

  const tool = data?.data?.find((t) => t.name === toolName);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Policies</DialogTitle>
          <DialogDescription>
            Configure policies for {toolName}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 space-y-4">
          {tool ? (
            <>
              <ToolCallPolicies tool={tool} />
              <ToolResultPolicies toolId={tool.id} />
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              Tool not found or not assigned to this profile.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
