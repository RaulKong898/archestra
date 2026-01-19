"use client";

import { archestraApiSdk } from "@shared";
import { Check, Copy, Eye, EyeOff, Loader2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { CodeText } from "@/components/code-text";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useHasPermissions } from "@/lib/auth.query";
import config from "@/lib/config";
import { useTokens } from "@/lib/team-token.query";
import { useUserToken } from "@/lib/user-token.query";

const { displayProxyUrl: apiBaseUrl } = config.api;

interface McpGatewayConnectionInstructionsProps {
  gatewayId: string;
  gatewayName: string;
}

// Special ID for personal token in the dropdown
const PERSONAL_TOKEN_ID = "__personal_token__";

export function McpGatewayConnectionInstructions({
  gatewayId,
  gatewayName,
}: McpGatewayConnectionInstructionsProps) {
  const { data: userToken } = useUserToken();
  const { data: hasMcpGatewayAdminPermission } = useHasPermissions({
    mcpGatewayEntity: ["admin"],
  });

  const [copiedConfig, setCopiedConfig] = useState(false);
  const [isCopyingConfig, setIsCopyingConfig] = useState(false);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);

  // Fetch tokens (org-level since MCP Gateway is org-level)
  const { data: tokensData } = useTokens({});
  const tokens = tokensData?.tokens;
  const [showExposedToken, setShowExposedToken] = useState(false);
  const [exposedTokenValue, setExposedTokenValue] = useState<string | null>(
    null,
  );
  const [isLoadingToken, setIsLoadingToken] = useState(false);

  // MCP Gateway URL
  const mcpUrl = `${apiBaseUrl}/mcp/${gatewayId}`;

  // Default to personal token if available, otherwise org token, then first token
  const orgToken = tokens?.find((t) => t.isOrganizationToken);
  const defaultTokenId = userToken
    ? PERSONAL_TOKEN_ID
    : (orgToken?.id ?? tokens?.[0]?.id ?? "");

  // Check if personal token is selected (either explicitly or by default)
  const effectiveTokenId = selectedTokenId ?? defaultTokenId;
  const isPersonalTokenSelected = effectiveTokenId === PERSONAL_TOKEN_ID;

  // Get the selected team token (for non-personal tokens)
  const selectedTeamToken = isPersonalTokenSelected
    ? null
    : tokens?.find((t) => t.id === effectiveTokenId);

  // Get display name for selected token
  const getTokenDisplayName = () => {
    if (isPersonalTokenSelected) {
      return "Personal Token";
    }
    if (selectedTeamToken) {
      if (selectedTeamToken.isOrganizationToken) {
        return "Organization Token";
      }
      if (selectedTeamToken.team?.name) {
        return `Team Token (${selectedTeamToken.team.name})`;
      }
      return selectedTeamToken.name;
    }
    return "Select token";
  };

  // Determine display token based on selection
  const tokenForDisplay =
    showExposedToken && exposedTokenValue
      ? exposedTokenValue
      : isPersonalTokenSelected
        ? userToken
          ? `${userToken.tokenStart}***`
          : "ask-admin-for-access-token"
        : hasMcpGatewayAdminPermission && selectedTeamToken
          ? `${selectedTeamToken.tokenStart}***`
          : "ask-admin-for-access-token";

  // Sanitize gateway name for use as key in config
  const configKey = gatewayName.toLowerCase().replace(/\s+/g, "-");

  const mcpConfig = useMemo(
    () =>
      JSON.stringify(
        {
          mcpServers: {
            [configKey]: {
              url: mcpUrl,
              headers: {
                Authorization: `Bearer ${tokenForDisplay}`,
              },
            },
          },
        },
        null,
        2,
      ),
    [mcpUrl, tokenForDisplay, configKey],
  );

  const handleExposeToken = useCallback(async () => {
    if (showExposedToken) {
      // Hide token
      setShowExposedToken(false);
      setExposedTokenValue(null);
      return;
    }

    setIsLoadingToken(true);
    try {
      let tokenValue: string;

      if (isPersonalTokenSelected) {
        // Fetch personal token value
        const response = await archestraApiSdk.getUserTokenValue();
        if (response.error || !response.data) {
          throw new Error("Failed to fetch personal token value");
        }
        tokenValue = (response.data as { value: string }).value;
      } else {
        // Fetch team token value
        if (!selectedTeamToken) {
          setIsLoadingToken(false);
          return;
        }
        const response = await archestraApiSdk.getTokenValue({
          path: { tokenId: selectedTeamToken.id },
        });
        if (response.error || !response.data) {
          throw new Error("Failed to fetch token value");
        }
        tokenValue = (response.data as { value: string }).value;
      }

      setExposedTokenValue(tokenValue);
      setShowExposedToken(true);
    } catch (error) {
      toast.error("Failed to fetch token");
      console.error(error);
    } finally {
      setIsLoadingToken(false);
    }
  }, [isPersonalTokenSelected, selectedTeamToken, showExposedToken]);

  const handleCopyConfigWithoutRealToken = async () => {
    const fullConfig = JSON.stringify(
      {
        mcpServers: {
          [configKey]: {
            url: mcpUrl,
            headers: {
              Authorization: `Bearer ${tokenForDisplay}`,
            },
          },
        },
      },
      null,
      2,
    );

    await navigator.clipboard.writeText(fullConfig);
    setCopiedConfig(true);
    toast.success("Configuration copied (preview only)");
    setTimeout(() => setCopiedConfig(false), 2000);
  };

  const handleCopyConfig = useCallback(async () => {
    setIsCopyingConfig(true);
    try {
      let tokenValue: string;

      if (isPersonalTokenSelected) {
        // Fetch personal token value
        const response = await archestraApiSdk.getUserTokenValue();
        if (response.error || !response.data) {
          throw new Error("Failed to fetch personal token value");
        }
        tokenValue = (response.data as { value: string }).value;
      } else {
        // Fetch team token value
        if (!selectedTeamToken) {
          setIsCopyingConfig(false);
          return;
        }
        const response = await archestraApiSdk.getTokenValue({
          path: { tokenId: selectedTeamToken.id },
        });
        if (response.error || !response.data) {
          throw new Error("Failed to fetch token value");
        }
        tokenValue = (response.data as { value: string }).value;
      }

      const fullConfig = JSON.stringify(
        {
          mcpServers: {
            [configKey]: {
              url: mcpUrl,
              headers: {
                Authorization: `Bearer ${tokenValue}`,
              },
            },
          },
        },
        null,
        2,
      );

      await navigator.clipboard.writeText(fullConfig);
      setCopiedConfig(true);
      toast.success("Configuration copied");
      setTimeout(() => setCopiedConfig(false), 2000);
    } catch {
      toast.error("Failed to copy configuration");
    } finally {
      setIsCopyingConfig(false);
    }
  }, [mcpUrl, isPersonalTokenSelected, selectedTeamToken, configKey]);

  return (
    <div className="space-y-6">
      {/* Token Selector */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Select token</Label>
        <Select
          value={effectiveTokenId}
          onValueChange={(value) => {
            setSelectedTokenId(value);
            // Reset exposed token state when changing token selection
            setShowExposedToken(false);
            setExposedTokenValue(null);
          }}
        >
          <SelectTrigger className="w-full min-h-[60px] py-2.5">
            <SelectValue placeholder="Select token">
              {effectiveTokenId && (
                <div className="flex flex-col gap-0.5 items-start text-left">
                  <div>{getTokenDisplayName()}</div>
                  <div className="text-xs text-muted-foreground">
                    {isPersonalTokenSelected
                      ? "The most secure option."
                      : selectedTeamToken?.isOrganizationToken
                        ? "To share org-wide"
                        : "To share with your teammates"}
                  </div>
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {userToken && (
              <SelectItem value={PERSONAL_TOKEN_ID}>
                <div className="flex flex-col gap-0.5 items-start">
                  <div>Personal Token</div>
                  <div className="text-xs text-muted-foreground">
                    The most secure option.
                  </div>
                </div>
              </SelectItem>
            )}
            {/* Team tokens (non-organization) */}
            {tokens
              ?.filter((token) => !token.isOrganizationToken)
              .map((token) => (
                <SelectItem key={token.id} value={token.id}>
                  <div className="flex flex-col gap-0.5 items-start">
                    <div>
                      {token.team?.name
                        ? `Team Token (${token.team.name})`
                        : token.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      To share with your teammates
                    </div>
                  </div>
                </SelectItem>
              ))}
            {/* Organization token */}
            {tokens
              ?.filter((token) => token.isOrganizationToken)
              .map((token) => (
                <SelectItem key={token.id} value={token.id}>
                  <div className="flex flex-col gap-0.5 items-start">
                    <div>Organization Token</div>
                    <div className="text-xs text-muted-foreground">
                      To share org-wide
                    </div>
                  </div>
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Configuration for MCP clients:
          </p>

          <div className="bg-muted rounded-md p-3 relative">
            <pre className="text-xs whitespace-pre-wrap break-all">
              <CodeText className="text-sm whitespace pre-wrap break-all">
                {mcpConfig}
              </CodeText>
            </pre>
            <div className="absolute top-2 right-2 flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2"
                onClick={handleExposeToken}
                disabled={
                  isLoadingToken ||
                  (!isPersonalTokenSelected && !hasMcpGatewayAdminPermission)
                }
              >
                {isLoadingToken ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading...</span>
                  </>
                ) : showExposedToken ? (
                  <>
                    <EyeOff className="h-4 w-4" />
                    <span>Hide token</span>
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" />
                    <span>Expose token</span>
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2"
                onClick={
                  isPersonalTokenSelected || hasMcpGatewayAdminPermission
                    ? handleCopyConfig
                    : handleCopyConfigWithoutRealToken
                }
                disabled={isCopyingConfig}
              >
                {isCopyingConfig ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Copying...</span>
                  </>
                ) : copiedConfig ? (
                  <>
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Copy with exposed token</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          The host/port is configurable via the{" "}
          <CodeText className="text-xs">ARCHESTRA_API_BASE_URL</CodeText>{" "}
          environment variable. See{" "}
          <a
            href="https://archestra.ai/docs/platform-deployment#environment-variables"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500"
          >
            here
          </a>{" "}
          for more details.
        </p>
      </div>
    </div>
  );
}
