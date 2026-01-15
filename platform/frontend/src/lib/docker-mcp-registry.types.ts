/**
 * Types for Docker MCP Registry (https://github.com/docker/mcp-registry)
 *
 * The Docker MCP Registry uses server.yaml files with the following structure.
 */

/**
 * Docker MCP Registry server metadata from server.yaml
 */
export interface DockerMcpServerMetadata {
  /** Server identifier (directory name in the registry) */
  name: string;
  /** Docker image name (e.g., mcp/airtable-mcp-server) */
  image: string;
  /** Type of MCP entry (always "server" for MCP servers) */
  type: "server";
  /** Metadata about the server */
  meta?: {
    /** Category for organization */
    category?: string;
    /** Tags for filtering */
    tags?: string[];
  };
  /** Display information */
  about?: {
    /** Display title */
    title?: string;
    /** Description of what the server does */
    description?: string;
    /** Icon URL */
    icon?: string;
  };
  /** Source code information */
  source?: {
    /** GitHub project URL */
    project?: string;
    /** Branch name */
    branch?: string;
    /** Commit hash */
    commit?: string;
    /** Dockerfile path within the source project */
    dockerfile?: string;
  };
  /** Runtime configuration */
  run?: {
    /** Command arguments (may contain template placeholders) */
    command?: string[];
    /** Volume mounts (may contain template placeholders) */
    volumes?: string[];
    /** Whether to disable network access */
    disableNetwork?: boolean;
  };
  /** Configuration schema for the server */
  config?: {
    /** Description of the configuration */
    description?: string;
    /** Secret environment variables (sensitive) */
    secrets?: Array<{
      /** Parameter name (e.g., "github.personal_access_token") */
      name: string;
      /** Environment variable name (e.g., "GITHUB_PERSONAL_ACCESS_TOKEN") */
      env: string;
      /** Example value */
      example?: string;
    }>;
    /** Regular environment variables */
    env?: Array<{
      /** Parameter name */
      name: string;
      /** Example value */
      example?: string;
      /** Default/static value (may contain template placeholders) */
      value?: string;
    }>;
    /** JSON Schema for user-configurable parameters */
    parameters?: {
      type: "object";
      properties?: Record<
        string,
        {
          type: "string" | "number" | "boolean" | "array";
          items?: { type: string };
          default?: unknown;
        }
      >;
      required?: string[];
    };
  };
}

/**
 * GitHub API response for directory contents
 */
export interface GitHubContentItem {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string | null;
  type: "file" | "dir" | "symlink" | "submodule";
}

/**
 * Processed Docker MCP server for display
 */
export interface DockerMcpServer {
  /** Server identifier */
  name: string;
  /** Display name (from about.title or name) */
  displayName: string;
  /** Docker image name */
  image: string;
  /** Description */
  description?: string;
  /** Icon URL */
  icon?: string;
  /** Category */
  category?: string;
  /** Tags */
  tags?: string[];
  /** Source project URL */
  sourceUrl?: string;
  /** Whether full metadata is loaded */
  metadataLoaded: boolean;
  /** Full metadata (loaded on demand) */
  metadata?: DockerMcpServerMetadata;
}

/**
 * Docker registry category derived from meta.category
 */
export type DockerRegistryCategory =
  | "all"
  | "devops"
  | "productivity"
  | "cloud"
  | "database"
  | "ai"
  | "communication"
  | "security"
  | string;
