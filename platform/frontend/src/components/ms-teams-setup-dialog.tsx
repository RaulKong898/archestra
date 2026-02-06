import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateChatOpsConfigInQuickstart } from "@/lib/chatops-config.query";
import { useFeatures } from "@/lib/features.query";

interface MsTeamsSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MsTeamsSetupDialog({
  open,
  onOpenChange,
}: MsTeamsSetupDialogProps) {
  const { data: features } = useFeatures();
  const mutation = useUpdateChatOpsConfigInQuickstart();
  const chatops = features?.chatops;

  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [tenantId, setTenantId] = useState("");

  const handleSave = async () => {
    const body: Record<string, unknown> = { enabled: true };
    if (appId) body.appId = appId;
    if (appSecret) body.appSecret = appSecret;
    if (tenantId) body.tenantId = tenantId;

    await mutation.mutateAsync(
      body as {
        enabled?: boolean;
        appId?: string;
        appSecret?: string;
        tenantId?: string;
      },
    );

    setAppId("");
    setAppSecret("");
    setTenantId("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Setup Microsoft Teams</DialogTitle>
          <DialogDescription>
            Configure your MS Teams Bot credentials to enable ChatOps
            integration.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="setup-app-id">App ID</Label>
            <Input
              id="setup-app-id"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              placeholder={
                chatops?.msTeamsAppId ? "Value already set" : "Azure Bot App ID"
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="setup-app-secret">App Secret</Label>
            <Input
              id="setup-app-secret"
              type="password"
              value={appSecret}
              onChange={(e) => setAppSecret(e.target.value)}
              placeholder={
                chatops?.msTeamsAppSecret
                  ? "Value already set"
                  : "Azure Bot App Secret"
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="setup-tenant-id">Tenant ID</Label>
            <Input
              id="setup-tenant-id"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder={
                chatops?.msTeamsTenantId
                  ? "Value already set"
                  : "Azure AD Tenant ID (optional for multi-tenant)"
              }
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={mutation.isPending}
            className="w-full"
          >
            {mutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Save & Activate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
