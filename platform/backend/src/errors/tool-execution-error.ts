/**
 * Custom error class for MCP tool execution failures.
 * Preserves tool execution details that would otherwise be lost
 * when wrapped in a generic Error.
 *
 * This class is kept in a separate file to avoid transitive imports
 * from the chat-mcp-client module which has database dependencies.
 */
export class ToolExecutionError extends Error {
  /** Name of the tool that failed */
  readonly toolName: string;
  /** Original error message from the tool */
  readonly toolError: string;
  /** Raw result from the tool execution (for debugging) */
  readonly rawResult: unknown;

  constructor(toolName: string, error: string, rawResult?: unknown) {
    super(error || "Tool execution failed");
    this.name = "ToolExecutionError";
    this.toolName = toolName;
    this.toolError = error;
    this.rawResult = rawResult;
  }
}
