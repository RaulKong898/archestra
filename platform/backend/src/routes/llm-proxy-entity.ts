import { RouteId } from "@shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { hasPermission } from "@/auth";
import { initializeMetrics } from "@/llm-metrics";
import { LlmProxyLabelModel, LlmProxyModel, TeamModel } from "@/models";
import {
  ApiError,
  constructResponseSchema,
  createPaginatedResponseSchema,
  createSortingQuerySchema,
  DeleteObjectResponseSchema,
  InsertLlmProxySchema,
  PaginationQuerySchema,
  SelectLlmProxySchema,
  SelectToolSchema,
  UpdateLlmProxySchema,
  UuidIdSchema,
} from "@/types";

const llmProxyEntityRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    "/api/llm-proxy-entities",
    {
      schema: {
        operationId: RouteId.GetLlmProxies,
        description:
          "Get all LLM Proxies with pagination, sorting, and filtering",
        tags: ["LLM Proxy"],
        querystring: z
          .object({
            name: z.string().optional().describe("Filter by proxy name"),
          })
          .merge(PaginationQuerySchema)
          .merge(
            createSortingQuerySchema([
              "name",
              "createdAt",
              "toolsCount",
              "team",
            ] as const),
          ),
        response: constructResponseSchema(
          createPaginatedResponseSchema(SelectLlmProxySchema),
        ),
      },
    },
    async (
      {
        query: { name, limit, offset, sortBy, sortDirection },
        user,
        headers,
        organizationId,
      },
      reply,
    ) => {
      const { success: isLlmProxyAdmin } = await hasPermission(
        { llmProxy: ["admin"] },
        headers,
      );
      return reply.send(
        await LlmProxyModel.findAllPaginated(
          organizationId,
          { limit, offset },
          { sortBy, sortDirection },
          { name },
          user.id,
          isLlmProxyAdmin,
        ),
      );
    },
  );

  fastify.get(
    "/api/llm-proxy-entities/all",
    {
      schema: {
        operationId: RouteId.GetAllLlmProxies,
        description: "Get all LLM Proxies without pagination",
        tags: ["LLM Proxy"],
        response: constructResponseSchema(z.array(SelectLlmProxySchema)),
      },
    },
    async ({ headers, user, organizationId }, reply) => {
      const { success: isLlmProxyAdmin } = await hasPermission(
        { llmProxy: ["admin"] },
        headers,
      );
      return reply.send(
        await LlmProxyModel.findAll(organizationId, user.id, isLlmProxyAdmin),
      );
    },
  );

  fastify.get(
    "/api/llm-proxy-entities/default",
    {
      schema: {
        operationId: RouteId.GetDefaultLlmProxy,
        description: "Get or create default LLM Proxy",
        tags: ["LLM Proxy"],
        response: constructResponseSchema(SelectLlmProxySchema),
      },
    },
    async ({ organizationId }, reply) => {
      return reply.send(await LlmProxyModel.getOrCreateDefault(organizationId));
    },
  );

  fastify.post(
    "/api/llm-proxy-entities",
    {
      schema: {
        operationId: RouteId.CreateLlmProxy,
        description: "Create a new LLM Proxy",
        tags: ["LLM Proxy"],
        body: InsertLlmProxySchema,
        response: constructResponseSchema(SelectLlmProxySchema),
      },
    },
    async ({ body, user, headers, organizationId }, reply) => {
      const { success: isLlmProxyAdmin } = await hasPermission(
        { llmProxy: ["admin"] },
        headers,
      );

      // Validate team assignment for non-admin users
      if (!isLlmProxyAdmin) {
        const userTeamIds = await TeamModel.getUserTeamIds(user.id);

        if (body.teams.length === 0) {
          // Non-admin users must select at least one team they're a member of
          if (userTeamIds.length === 0) {
            throw new ApiError(
              403,
              "You must be a member of at least one team to create an LLM Proxy",
            );
          }
          throw new ApiError(
            400,
            "You must assign at least one team to the LLM Proxy",
          );
        }

        // Verify user is a member of all specified teams
        const userTeamIdSet = new Set(userTeamIds);
        const invalidTeams = body.teams.filter((id) => !userTeamIdSet.has(id));
        if (invalidTeams.length > 0) {
          throw new ApiError(
            403,
            "You can only assign LLM Proxies to teams you are a member of",
          );
        }
      }

      const proxy = await LlmProxyModel.create({
        ...body,
        organizationId,
      });
      const labelKeys = await LlmProxyLabelModel.getAllKeys();

      // Re-init metrics with the new label keys in case label keys changed.
      initializeMetrics(labelKeys);

      return reply.send(proxy);
    },
  );

  fastify.get(
    "/api/llm-proxy-entities/:id",
    {
      schema: {
        operationId: RouteId.GetLlmProxy,
        description: "Get LLM Proxy by ID",
        tags: ["LLM Proxy"],
        params: z.object({
          id: UuidIdSchema,
        }),
        response: constructResponseSchema(SelectLlmProxySchema),
      },
    },
    async ({ params: { id }, headers, user }, reply) => {
      const { success: isLlmProxyAdmin } = await hasPermission(
        { llmProxy: ["admin"] },
        headers,
      );

      const proxy = await LlmProxyModel.findById(id, user.id, isLlmProxyAdmin);

      if (!proxy) {
        throw new ApiError(404, "LLM Proxy not found");
      }

      return reply.send(proxy);
    },
  );

  fastify.put(
    "/api/llm-proxy-entities/:id",
    {
      schema: {
        operationId: RouteId.UpdateLlmProxy,
        description: "Update an LLM Proxy",
        tags: ["LLM Proxy"],
        params: z.object({
          id: UuidIdSchema,
        }),
        body: UpdateLlmProxySchema.partial(),
        response: constructResponseSchema(SelectLlmProxySchema),
      },
    },
    async ({ params: { id }, body, user, headers }, reply) => {
      // Validate team assignment for non-admin users if teams are being updated
      if (body.teams !== undefined) {
        const { success: isLlmProxyAdmin } = await hasPermission(
          { llmProxy: ["admin"] },
          headers,
        );

        if (!isLlmProxyAdmin) {
          const userTeamIds = await TeamModel.getUserTeamIds(user.id);

          if (body.teams.length === 0) {
            // Non-admin users must assign at least one team
            throw new ApiError(
              400,
              "You must assign at least one team to the LLM Proxy",
            );
          }

          // Verify user is a member of all specified teams
          const userTeamIdSet = new Set(userTeamIds);
          const invalidTeams = body.teams.filter(
            (teamId) => !userTeamIdSet.has(teamId),
          );
          if (invalidTeams.length > 0) {
            throw new ApiError(
              403,
              "You can only assign LLM Proxies to teams you are a member of",
            );
          }
        }
      }

      const proxy = await LlmProxyModel.update(id, body);

      if (!proxy) {
        throw new ApiError(404, "LLM Proxy not found");
      }

      const labelKeys = await LlmProxyLabelModel.getAllKeys();
      // Re-init metrics with the new label keys in case label keys changed.
      initializeMetrics(labelKeys);

      return reply.send(proxy);
    },
  );

  fastify.delete(
    "/api/llm-proxy-entities/:id",
    {
      schema: {
        operationId: RouteId.DeleteLlmProxy,
        description: "Delete an LLM Proxy",
        tags: ["LLM Proxy"],
        params: z.object({
          id: UuidIdSchema,
        }),
        response: constructResponseSchema(DeleteObjectResponseSchema),
      },
    },
    async ({ params: { id } }, reply) => {
      const success = await LlmProxyModel.delete(id);

      if (!success) {
        throw new ApiError(404, "LLM Proxy not found");
      }

      return reply.send({ success: true });
    },
  );

  fastify.get(
    "/api/llm-proxy-entities/labels/keys",
    {
      schema: {
        operationId: RouteId.GetLlmProxyLabelKeys,
        description: "Get all available label keys for LLM Proxies",
        tags: ["LLM Proxy"],
        response: constructResponseSchema(z.array(z.string())),
      },
    },
    async (_request, reply) => {
      return reply.send(await LlmProxyLabelModel.getAllKeys());
    },
  );

  fastify.get(
    "/api/llm-proxy-entities/labels/values",
    {
      schema: {
        operationId: RouteId.GetLlmProxyLabelValues,
        description: "Get all available label values for LLM Proxies",
        tags: ["LLM Proxy"],
        querystring: z.object({
          key: z.string().optional().describe("Filter values by label key"),
        }),
        response: constructResponseSchema(z.array(z.string())),
      },
    },
    async ({ query: { key } }, reply) => {
      return reply.send(
        key
          ? await LlmProxyLabelModel.getValuesByKey(key)
          : await LlmProxyLabelModel.getAllKeys(),
      );
    },
  );

  fastify.get(
    "/api/llm-proxy-entities/:id/tools",
    {
      schema: {
        operationId: RouteId.GetLlmProxyTools,
        description: "Get auto-discovered tools for an LLM Proxy",
        tags: ["LLM Proxy"],
        params: z.object({
          id: UuidIdSchema,
        }),
        response: constructResponseSchema(z.array(SelectToolSchema)),
      },
    },
    async ({ params: { id }, headers, user }, reply) => {
      const { success: isLlmProxyAdmin } = await hasPermission(
        { llmProxy: ["admin"] },
        headers,
      );

      const proxy = await LlmProxyModel.findById(id, user.id, isLlmProxyAdmin);

      if (!proxy) {
        throw new ApiError(404, "LLM Proxy not found");
      }

      return reply.send(proxy.tools);
    },
  );
};

export default llmProxyEntityRoutes;
