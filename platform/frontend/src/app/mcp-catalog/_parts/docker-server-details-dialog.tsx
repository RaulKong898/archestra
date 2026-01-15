"use client";

import {
  Box,
  Code2,
  ExternalLink,
  Github,
  Info,
  Key,
  Settings,
  Terminal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { DockerMcpServer } from "@/lib/docker-mcp-registry.types";

interface DockerServerDetailsDialogProps {
  server: DockerMcpServer | null;
  onClose: () => void;
}

export function DockerServerDetailsDialog({
  server,
  onClose,
}: DockerServerDetailsDialogProps) {
  const isOpen = !!server;
  const metadata = server?.metadata;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {server?.icon ? (
              <img
                src={server.icon}
                alt={`${server?.name} icon`}
                className="w-6 h-6 rounded"
              />
            ) : (
              <Box className="w-6 h-6 text-muted-foreground" />
            )}
            {server?.displayName || server?.name || "Server"}
          </DialogTitle>
          <DialogDescription>
            {server?.description && (
              <span className="block mb-1">{server.description}</span>
            )}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] w-full py-4">
          <div className="space-y-6 pr-4">
            {/* Overview Section */}
            <section>
              <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <Info className="h-5 w-5" />
                Overview
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex flex-wrap gap-2">
                  {server?.category && (
                    <Badge variant="outline">{server.category}</Badge>
                  )}
                  <Badge variant="secondary">Docker</Badge>
                  {server?.tags?.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
                {metadata?.config?.description && (
                  <p className="text-muted-foreground">
                    {metadata.config.description}
                  </p>
                )}
              </div>
            </section>

            {/* Docker Image Section */}
            <Separator />
            <section>
              <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <Box className="h-5 w-5" />
                Docker Image
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground font-medium">
                    Image:{" "}
                  </span>
                  <code className="bg-muted px-2 py-1 rounded text-xs">
                    {server?.image}
                  </code>
                </div>
                {metadata?.run?.command && metadata.run.command.length > 0 && (
                  <div>
                    <span className="text-muted-foreground font-medium">
                      Command:{" "}
                    </span>
                    <code className="bg-muted px-2 py-1 rounded text-xs">
                      {metadata.run.command.join(" ")}
                    </code>
                  </div>
                )}
                {metadata?.run?.disableNetwork && (
                  <div>
                    <Badge variant="secondary" className="text-xs">
                      Network Disabled
                    </Badge>
                  </div>
                )}
              </div>
            </section>

            {/* Source Section */}
            {metadata?.source && (
              <>
                <Separator />
                <section>
                  <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                    <Github className="h-5 w-5" />
                    Source
                  </h3>
                  <div className="space-y-2 text-sm">
                    {metadata.source.project && (
                      <div>
                        <span className="text-muted-foreground font-medium">
                          Project:{" "}
                        </span>
                        <a
                          href={metadata.source.project}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          {metadata.source.project}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                    {metadata.source.branch && (
                      <div>
                        <span className="text-muted-foreground font-medium">
                          Branch:{" "}
                        </span>
                        <code className="bg-muted px-2 py-1 rounded text-xs">
                          {metadata.source.branch}
                        </code>
                      </div>
                    )}
                    {metadata.source.commit && (
                      <div>
                        <span className="text-muted-foreground font-medium">
                          Commit:{" "}
                        </span>
                        <code className="bg-muted px-2 py-1 rounded text-xs">
                          {metadata.source.commit.substring(0, 8)}
                        </code>
                      </div>
                    )}
                    {metadata.source.dockerfile && (
                      <div>
                        <span className="text-muted-foreground font-medium">
                          Dockerfile:{" "}
                        </span>
                        <code className="bg-muted px-2 py-1 rounded text-xs">
                          {metadata.source.dockerfile}
                        </code>
                      </div>
                    )}
                  </div>
                </section>
              </>
            )}

            {/* Secrets Section */}
            {metadata?.config?.secrets &&
              metadata.config.secrets.length > 0 && (
                <>
                  <Separator />
                  <section>
                    <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                      <Key className="h-5 w-5" />
                      Required Secrets ({metadata.config.secrets.length})
                    </h3>
                    <div className="space-y-2">
                      {metadata.config.secrets.map((secret, index) => (
                        <div
                          key={`${secret.name}-${index}`}
                          className="border rounded-lg p-3 text-sm"
                        >
                          <div className="flex items-start justify-between">
                            <div className="font-semibold font-mono">
                              {secret.env}
                            </div>
                            <Badge variant="destructive" className="text-xs">
                              Required
                            </Badge>
                          </div>
                          <div className="text-muted-foreground mt-1 text-xs">
                            {secret.name}
                          </div>
                          {secret.example && (
                            <div className="text-muted-foreground mt-1 text-xs">
                              Example:{" "}
                              <code className="bg-muted px-1 rounded">
                                {secret.example}
                              </code>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              )}

            {/* Environment Variables Section */}
            {metadata?.config?.env && metadata.config.env.length > 0 && (
              <>
                <Separator />
                <section>
                  <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                    <Terminal className="h-5 w-5" />
                    Environment Variables ({metadata.config.env.length})
                  </h3>
                  <div className="space-y-2">
                    {metadata.config.env.map((envVar, index) => (
                      <div
                        key={`${envVar.name}-${index}`}
                        className="border rounded-lg p-3 text-sm"
                      >
                        <div className="font-semibold font-mono">
                          {envVar.name}
                        </div>
                        {envVar.value && (
                          <div className="text-muted-foreground mt-1 text-xs">
                            Value:{" "}
                            <code className="bg-muted px-1 rounded">
                              {envVar.value}
                            </code>
                          </div>
                        )}
                        {envVar.example && (
                          <div className="text-muted-foreground mt-1 text-xs">
                            Example:{" "}
                            <code className="bg-muted px-1 rounded">
                              {envVar.example}
                            </code>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            {/* Configuration Parameters Section */}
            {metadata?.config?.parameters?.properties &&
              Object.keys(metadata.config.parameters.properties).length > 0 && (
                <>
                  <Separator />
                  <section>
                    <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Configuration Parameters
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(
                        metadata.config.parameters.properties,
                      ).map(([key, prop]) => (
                        <div
                          key={key}
                          className="border rounded-lg p-3 text-sm"
                        >
                          <div className="flex items-start justify-between">
                            <div className="font-semibold font-mono">{key}</div>
                            <div className="flex gap-1">
                              <Badge variant="outline" className="text-xs">
                                {prop.type}
                              </Badge>
                              {metadata.config?.parameters?.required?.includes(
                                key,
                              ) && (
                                <Badge
                                  variant="destructive"
                                  className="text-xs"
                                >
                                  Required
                                </Badge>
                              )}
                            </div>
                          </div>
                          {prop.default !== undefined && (
                            <div className="text-muted-foreground mt-1 text-xs">
                              Default:{" "}
                              {typeof prop.default === "object"
                                ? JSON.stringify(prop.default)
                                : String(prop.default)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              )}

            {/* Run Configuration Section */}
            {metadata?.run && (
              <>
                <Separator />
                <section>
                  <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                    <Code2 className="h-5 w-5" />
                    Runtime Configuration
                  </h3>
                  <div className="space-y-2 text-sm">
                    {metadata.run.volumes &&
                      metadata.run.volumes.length > 0 && (
                        <div>
                          <span className="text-muted-foreground font-medium block mb-1">
                            Volumes:
                          </span>
                          <div className="bg-muted rounded p-2 space-y-1">
                            {metadata.run.volumes.map((vol) => (
                              <div key={vol} className="font-mono text-xs">
                                {vol}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                </section>
              </>
            )}

            {/* Not Loaded Warning */}
            {!server?.metadataLoaded && (
              <>
                <Separator />
                <section className="text-center py-4">
                  <p className="text-muted-foreground">
                    Full metadata not yet loaded. Click "Add to Registry" to
                    load complete configuration.
                  </p>
                </section>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
