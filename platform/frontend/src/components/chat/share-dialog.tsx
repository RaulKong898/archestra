"use client";

import { Check, Copy, Globe, Lock, Users } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { type ShareMode, useShareConversation } from "@/lib/chat.query";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  currentShareMode: ShareMode;
  publicShareToken: string | null;
}

export function ShareDialog({
  open,
  onOpenChange,
  conversationId,
  currentShareMode,
  publicShareToken,
}: ShareDialogProps) {
  const shareConversation = useShareConversation();
  const [copied, setCopied] = useState(false);

  const handleShareModeChange = useCallback(
    (value: ShareMode) => {
      shareConversation.mutate({
        id: conversationId,
        shareMode: value,
      });
    },
    [conversationId, shareConversation],
  );

  const publicUrl = publicShareToken
    ? `${window.location.origin}/shared/${publicShareToken}`
    : null;

  const handleCopyLink = useCallback(async () => {
    if (publicUrl) {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [publicUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share conversation</DialogTitle>
          <DialogDescription>
            Choose who can access this conversation. Only you can send messages.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup
            value={currentShareMode}
            onValueChange={(value) => handleShareModeChange(value as ShareMode)}
            className="space-y-3"
          >
            <div className="flex items-start space-x-3">
              <RadioGroupItem value="private" id="private" className="mt-1" />
              <Label htmlFor="private" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  <span className="font-medium">Private</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Only you can view this conversation.
                </p>
              </Label>
            </div>

            <div className="flex items-start space-x-3">
              <RadioGroupItem
                value="organization"
                id="organization"
                className="mt-1"
              />
              <Label htmlFor="organization" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="font-medium">Organization</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Anyone in your organization can view this conversation.
                </p>
              </Label>
            </div>

            <div className="flex items-start space-x-3">
              <RadioGroupItem value="public" id="public" className="mt-1" />
              <Label htmlFor="public" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  <span className="font-medium">Public</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Anyone with the link can view this conversation.
                </p>
              </Label>
            </div>
          </RadioGroup>

          {currentShareMode === "public" && publicUrl && (
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-sm font-medium">Share link</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-muted rounded text-xs truncate">
                  {publicUrl}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  className="shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
