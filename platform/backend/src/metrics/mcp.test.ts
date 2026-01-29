import { vi } from "vitest";
import { beforeEach, describe, expect, test } from "@/test";

const counterInc = vi.fn();
const registerRemoveSingleMetric = vi.fn();

vi.mock("prom-client", () => {
  return {
    default: {
      Counter: class {
        inc(...args: unknown[]) {
          return counterInc(...args);
        }
      },
      register: {
        removeSingleMetric: (...args: unknown[]) =>
          registerRemoveSingleMetric(...args),
      },
    },
  };
});

import { initializeMcpMetrics, reportMcpToolCall } from "./mcp";

describe("initializeMcpMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("skips reinitialization when label keys haven't changed", () => {
    initializeMcpMetrics(["environment", "team"]);
    registerRemoveSingleMetric.mockClear();

    initializeMcpMetrics(["environment", "team"]);

    expect(registerRemoveSingleMetric).not.toHaveBeenCalled();
  });

  test("reinitializes metrics when label keys are added", () => {
    initializeMcpMetrics(["environment"]);
    registerRemoveSingleMetric.mockClear();

    initializeMcpMetrics(["environment", "team"]);

    expect(registerRemoveSingleMetric).toHaveBeenCalledWith(
      "mcp_tool_call_total",
    );
  });

  test("reinitializes metrics when label keys are removed", () => {
    initializeMcpMetrics(["environment", "team"]);
    registerRemoveSingleMetric.mockClear();

    initializeMcpMetrics(["environment"]);

    expect(registerRemoveSingleMetric).toHaveBeenCalledWith(
      "mcp_tool_call_total",
    );
  });

  test("doesn't reinit if keys are the same but in different order", () => {
    initializeMcpMetrics(["team", "environment"]);
    registerRemoveSingleMetric.mockClear();

    initializeMcpMetrics(["environment", "team"]);

    expect(registerRemoveSingleMetric).not.toHaveBeenCalled();
  });
});

describe("reportMcpToolCall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initializeMcpMetrics([]);
  });

  test("records successful tool call", () => {
    reportMcpToolCall({
      mcpGatewayName: "test-gateway",
      credentialName: "team-alpha",
      toolName: "github__create_issue",
      mcpServerName: "github",
      success: true,
    });

    expect(counterInc).toHaveBeenCalledWith({
      mcp_gateway_name: "test-gateway",
      credential_name: "team-alpha",
      tool_name: "github__create_issue",
      mcp_server_name: "github",
      success: "true",
    });
  });

  test("records failed tool call", () => {
    reportMcpToolCall({
      mcpGatewayName: "another-gateway",
      credentialName: "user-john",
      toolName: "slack__send_message",
      mcpServerName: "slack",
      success: false,
    });

    expect(counterInc).toHaveBeenCalledWith({
      mcp_gateway_name: "another-gateway",
      credential_name: "user-john",
      tool_name: "slack__send_message",
      mcp_server_name: "slack",
      success: "false",
    });
  });

  test("records tool call with custom agent labels", () => {
    initializeMcpMetrics(["environment", "team"]);

    reportMcpToolCall({
      mcpGatewayName: "prod-gateway",
      credentialName: "team-beta",
      toolName: "jira__create_ticket",
      mcpServerName: "jira",
      success: true,
      agentLabels: [
        { key: "environment", value: "production" },
        { key: "team", value: "platform" },
      ],
    });

    expect(counterInc).toHaveBeenCalledWith({
      mcp_gateway_name: "prod-gateway",
      credential_name: "team-beta",
      tool_name: "jira__create_ticket",
      mcp_server_name: "jira",
      success: "true",
      environment: "production",
      team: "platform",
    });
  });

  test("handles missing agent labels gracefully", () => {
    initializeMcpMetrics(["environment", "team"]);

    reportMcpToolCall({
      mcpGatewayName: "minimal-gateway",
      credentialName: "team-gamma",
      toolName: "linear__get_issues",
      mcpServerName: "linear",
      success: true,
      agentLabels: [{ key: "environment", value: "staging" }],
    });

    expect(counterInc).toHaveBeenCalledWith({
      mcp_gateway_name: "minimal-gateway",
      credential_name: "team-gamma",
      tool_name: "linear__get_issues",
      mcp_server_name: "linear",
      success: "true",
      environment: "staging",
      team: "",
    });
  });

  test("handles special characters in label keys", () => {
    initializeMcpMetrics(["env-name", "team.id"]);

    reportMcpToolCall({
      mcpGatewayName: "special-gateway",
      credentialName: "team-delta",
      toolName: "notion__search",
      mcpServerName: "notion",
      success: true,
      agentLabels: [
        { key: "env-name", value: "dev" },
        { key: "team.id", value: "t-123" },
      ],
    });

    expect(counterInc).toHaveBeenCalledWith({
      mcp_gateway_name: "special-gateway",
      credential_name: "team-delta",
      tool_name: "notion__search",
      mcp_server_name: "notion",
      success: "true",
      env_name: "dev",
      team_id: "t-123",
    });
  });
});
