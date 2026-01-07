import Fastify, { type FastifyInstance } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { TeamTokenModel } from "@/models";
import { afterEach, beforeEach, describe, expect, test } from "@/test";
import { legacyMcpGatewayRoutes } from "./mcp-gateway";
import { activeSessions } from "./mcp-gateway.utils";

/**
 * Helper to create MCP gateway request headers
 * The MCP SDK requires Accept header with both application/json and text/event-stream
 */
function makeMcpHeaders(
  agentId: string,
  sessionId?: string,
): Record<string, string> {
  return {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    authorization: `Bearer ${agentId}`,
    ...(sessionId && { "mcp-session-id": sessionId }),
  };
}

describe("MCP Gateway session auto-recreation", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    // Clear any existing sessions
    activeSessions.clear();

    // Create a test Fastify app
    app = Fastify().withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);

    await app.register(legacyMcpGatewayRoutes);
  });

  afterEach(async () => {
    await app.close();
    activeSessions.clear();
  });

  test("creates session on initialize, then auto-recreates after session is cleared (simulating expiration)", async ({
    makeAgent,
    makeOrganization,
  }) => {
    const agent = await makeAgent();
    const org = await makeOrganization();

    // Create an org token for legacy auth
    await TeamTokenModel.create({
      organizationId: org.id,
      name: "Org Token",
      teamId: null,
      isOrganizationToken: true,
    });

    // Step 1: Send initialize request to create session
    const initResponse = await app.inject({
      method: "POST",
      url: "/v1/mcp",
      headers: makeMcpHeaders(agent.id),
      payload: {
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
        id: 1,
      },
    });

    expect(initResponse.statusCode).toBe(200);
    const sessionId = initResponse.headers["mcp-session-id"] as string;
    expect(sessionId).toBeDefined();
    expect(activeSessions.size).toBe(1);
    expect(activeSessions.has(sessionId)).toBe(true);

    // Step 2: Clear the session to simulate expiration (like the 5-minute cleanup interval)
    activeSessions.clear();
    expect(activeSessions.size).toBe(0);

    // Step 3: Send another initialize request with the old session ID
    // This should auto-create a new session instead of returning 400
    const reinitResponse = await app.inject({
      method: "POST",
      url: "/v1/mcp",
      headers: makeMcpHeaders(agent.id, sessionId),
      payload: {
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
        id: 2,
      },
    });

    // Should succeed with 200, not fail with 400
    expect(reinitResponse.statusCode).toBe(200);

    // Should have created a new session
    expect(activeSessions.size).toBe(1);

    // The new session should use the same session ID (effectiveSessionId = sessionId)
    expect(activeSessions.has(sessionId)).toBe(true);
  });

  test("reuses existing valid session without re-creating", async ({
    makeAgent,
    makeOrganization,
  }) => {
    const agent = await makeAgent();
    const org = await makeOrganization();

    await TeamTokenModel.create({
      organizationId: org.id,
      name: "Org Token",
      teamId: null,
      isOrganizationToken: true,
    });

    // Step 1: Initialize session
    const initResponse = await app.inject({
      method: "POST",
      url: "/v1/mcp",
      headers: makeMcpHeaders(agent.id),
      payload: {
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
        id: 1,
      },
    });

    expect(initResponse.statusCode).toBe(200);
    const sessionId = initResponse.headers["mcp-session-id"] as string;
    expect(activeSessions.size).toBe(1);

    // Get reference to the original session data
    const originalSession = activeSessions.get(sessionId);
    expect(originalSession).toBeDefined();

    // Step 2: Send tools/list with valid session - should reuse
    const toolsResponse = await app.inject({
      method: "POST",
      url: "/v1/mcp",
      headers: makeMcpHeaders(agent.id, sessionId),
      payload: {
        jsonrpc: "2.0",
        method: "tools/list",
        params: {},
        id: 2,
      },
    });

    expect(toolsResponse.statusCode).toBe(200);

    // Should still have only 1 session (reused, not created new)
    expect(activeSessions.size).toBe(1);

    // Should be the same session object (reused)
    expect(activeSessions.get(sessionId)).toBe(originalSession);
  });

  test("creates new session when no session ID provided", async ({
    makeAgent,
    makeOrganization,
  }) => {
    const agent = await makeAgent();
    const org = await makeOrganization();

    await TeamTokenModel.create({
      organizationId: org.id,
      name: "Org Token",
      teamId: null,
      isOrganizationToken: true,
    });

    // Send initialize without session ID
    const initResponse = await app.inject({
      method: "POST",
      url: "/v1/mcp",
      headers: makeMcpHeaders(agent.id), // No session ID
      payload: {
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
        id: 1,
      },
    });

    expect(initResponse.statusCode).toBe(200);

    // Should have created a session with a generated ID
    expect(activeSessions.size).toBe(1);

    // The session ID should be in the response header
    const sessionId = initResponse.headers["mcp-session-id"] as string;
    expect(sessionId).toBeDefined();
    expect(sessionId).toMatch(/^session-\d+-[a-f0-9-]+$/);
  });

  test("non-initialize request with expired session returns error (prompts re-initialization)", async ({
    makeAgent,
    makeOrganization,
  }) => {
    const agent = await makeAgent();
    const org = await makeOrganization();

    await TeamTokenModel.create({
      organizationId: org.id,
      name: "Org Token",
      teamId: null,
      isOrganizationToken: true,
    });

    // Step 1: Initialize to create a session
    const initResponse = await app.inject({
      method: "POST",
      url: "/v1/mcp",
      headers: makeMcpHeaders(agent.id),
      payload: {
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
        id: 1,
      },
    });

    expect(initResponse.statusCode).toBe(200);
    const sessionId = initResponse.headers["mcp-session-id"] as string;

    // Step 2: Clear session to simulate expiration
    activeSessions.clear();

    // Step 3: Send tools/list with the expired session ID
    // Should return 400 with clear error message prompting re-initialization
    // This allows clients like Cursor to detect and restart the connection
    const toolsResponse = await app.inject({
      method: "POST",
      url: "/v1/mcp",
      headers: makeMcpHeaders(agent.id, sessionId),
      payload: {
        jsonrpc: "2.0",
        method: "tools/list",
        params: {},
        id: 2,
      },
    });

    // Should return 400 with session expired error
    expect(toolsResponse.statusCode).toBe(400);
    const body = toolsResponse.json();
    expect(body.error?.message).toBe(
      "Bad Request: Session expired or invalid. Please reconnect.",
    );

    // No orphan session should be created
    expect(activeSessions.size).toBe(0);
  });

  test("initialize request with expired session creates new session successfully", async ({
    makeAgent,
    makeOrganization,
  }) => {
    const agent = await makeAgent();
    const org = await makeOrganization();

    await TeamTokenModel.create({
      organizationId: org.id,
      name: "Org Token",
      teamId: null,
      isOrganizationToken: true,
    });

    // Step 1: Initialize to create a session
    const initResponse = await app.inject({
      method: "POST",
      url: "/v1/mcp",
      headers: makeMcpHeaders(agent.id),
      payload: {
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
        id: 1,
      },
    });

    expect(initResponse.statusCode).toBe(200);
    const sessionId = initResponse.headers["mcp-session-id"] as string;

    // Step 2: Clear session to simulate expiration
    activeSessions.clear();

    // Step 3: Send initialize with the expired session ID - should work and create new session
    const reinitResponse = await app.inject({
      method: "POST",
      url: "/v1/mcp",
      headers: makeMcpHeaders(agent.id, sessionId),
      payload: {
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
        id: 2,
      },
    });

    expect(reinitResponse.statusCode).toBe(200);

    // New session should be created with the same ID
    expect(activeSessions.size).toBe(1);
    expect(activeSessions.has(sessionId)).toBe(true);
  });
});
