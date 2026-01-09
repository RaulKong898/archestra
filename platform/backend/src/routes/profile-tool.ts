import { RouteId } from "@shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { hasPermission } from "@/auth";
import { ProfileToolModel } from "@/models";
import {
  constructResponseSchema,
  createPaginatedResponseSchema,
  PaginationQuerySchema,
  ProfileToolFilterSchema,
  ProfileToolSortBySchema,
  ProfileToolSortDirectionSchema,
  SelectProfileToolSchema,
} from "@/types";

const profileToolRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.get(
    "/api/profile-tools",
    {
      schema: {
        operationId: RouteId.GetAllProfileTools,
        description:
          "Get all tools with aggregated profile data (tool-centric view)",
        tags: ["Profile Tools"],
        querystring: ProfileToolFilterSchema.extend({
          sortBy: ProfileToolSortBySchema.optional(),
          sortDirection: ProfileToolSortDirectionSchema.optional(),
          skipPagination: z.coerce.boolean().optional(),
        }).merge(PaginationQuerySchema),
        response: constructResponseSchema(
          createPaginatedResponseSchema(SelectProfileToolSchema),
        ),
      },
    },
    async (
      {
        query: {
          limit,
          offset,
          sortBy,
          sortDirection,
          search,
          profileId,
          origin,
          credentialSourceMcpServerId,
          mcpServerOwnerId,
          excludeArchestraTools,
          skipPagination,
        },
        headers,
        user,
      },
      reply,
    ) => {
      const { success: isAgentAdmin } = await hasPermission(
        { profile: ["admin"] },
        headers,
      );

      const result = await ProfileToolModel.findAll({
        pagination: { limit, offset },
        sorting: { sortBy, sortDirection },
        filters: {
          search,
          profileId,
          origin,
          credentialSourceMcpServerId,
          mcpServerOwnerId,
          excludeArchestraTools,
        },
        userId: user.id,
        isAgentAdmin,
        skipPagination,
      });

      return reply.send(result);
    },
  );
};

export default profileToolRoutes;
