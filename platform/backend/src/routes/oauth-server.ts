import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

/**
 * OAuth 2.1 well-known discovery endpoints.
 *
 * These use the request Host header for URL construction so they work
 * across Docker networking (host.docker.internal:9000) and local dev (localhost:9000).
 */
const oauthServerRoutes: FastifyPluginAsyncZod = async (fastify) => {
  /**
   * RFC 9728 - OAuth Protected Resource Metadata
   * GET /.well-known/oauth-protected-resource/*
   *
   * MCP clients hit this to discover which authorization server protects the resource.
   */
  fastify.get(
    "/.well-known/oauth-protected-resource/*",
    {
      schema: {
        tags: ["oauth"],
        response: {
          200: z.object({
            resource: z.string(),
            authorization_servers: z.array(z.string()),
            scopes_supported: z.array(z.string()),
            bearer_methods_supported: z.array(z.string()),
          }),
        },
      },
    },
    async (request, reply) => {
      const host = request.headers.host;
      const protocol = request.protocol;
      const baseUrl = `${protocol}://${host}`;

      // Extract the resource path (everything after /.well-known/oauth-protected-resource)
      const resourcePath = request.url.replace(
        "/.well-known/oauth-protected-resource",
        "",
      );

      reply.type("application/json");
      return {
        resource: `${baseUrl}${resourcePath}`,
        authorization_servers: [baseUrl],
        scopes_supported: ["mcp"],
        bearer_methods_supported: ["header"],
      };
    },
  );

  /**
   * RFC 8414 - OAuth Authorization Server Metadata
   * GET /.well-known/oauth-authorization-server
   *
   * MCP clients hit this to discover OAuth endpoints (authorize, token, register, jwks).
   */
  fastify.get(
    "/.well-known/oauth-authorization-server",
    {
      schema: {
        tags: ["oauth"],
        response: {
          200: z.object({
            issuer: z.string(),
            authorization_endpoint: z.string(),
            token_endpoint: z.string(),
            registration_endpoint: z.string(),
            jwks_uri: z.string(),
            response_types_supported: z.array(z.string()),
            grant_types_supported: z.array(z.string()),
            token_endpoint_auth_methods_supported: z.array(z.string()),
            code_challenge_methods_supported: z.array(z.string()),
            scopes_supported: z.array(z.string()),
          }),
        },
      },
    },
    async (request, reply) => {
      const host = request.headers.host;
      const protocol = request.protocol;
      const baseUrl = `${protocol}://${host}`;

      reply.type("application/json");
      return {
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/api/auth/oauth2/authorize`,
        token_endpoint: `${baseUrl}/api/auth/oauth2/token`,
        registration_endpoint: `${baseUrl}/api/auth/oauth2/register`,
        jwks_uri: `${baseUrl}/api/auth/jwks`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        token_endpoint_auth_methods_supported: [
          "client_secret_basic",
          "client_secret_post",
          "none",
        ],
        code_challenge_methods_supported: ["S256"],
        scopes_supported: [
          "mcp",
          "openid",
          "profile",
          "email",
          "offline_access",
        ],
      };
    },
  );
};

export default oauthServerRoutes;
