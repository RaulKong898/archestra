import {
  TOOL_ARTIFACT_WRITE_FULL_NAME,
  TOOL_TODO_WRITE_FULL_NAME,
} from "@shared";
import { and, desc, eq, getTableColumns, or, ne } from "drizzle-orm";
import { randomUUID } from "crypto";
import db, { schema } from "@/database";
import type { ShareMode } from "@/database/schemas/conversation";
import type {
  Conversation,
  InsertConversation,
  UpdateConversation,
} from "@/types";
import ConversationEnabledToolModel from "./conversation-enabled-tool";
import ToolModel from "./tool";

class ConversationModel {
  static async create(data: InsertConversation): Promise<Conversation> {
    const [conversation] = await db
      .insert(schema.conversationsTable)
      .values(data)
      .returning();

    // Disable Archestra tools by default for new conversations (except todo_write and artifact_write)
    // Get all tools assigned to the agent (profile tools)
    const agentTools = await ToolModel.getToolsByAgent(data.agentId);

    // Get prompt-specific agent delegation tools if a prompt is selected
    let promptTools: Awaited<
      ReturnType<typeof ToolModel.getAgentDelegationToolsByPrompt>
    > = [];
    if (data.promptId) {
      promptTools = await ToolModel.getAgentDelegationToolsByPrompt(
        data.promptId,
      );
    }

    // Combine profile tools and prompt-specific tools
    const allTools = [...agentTools, ...promptTools];

    // Filter out Archestra tools (those starting with "archestra__"), but keep todo_write and artifact_write enabled
    // Agent delegation tools (agent__*) should be enabled by default
    const nonArchestraToolIds = allTools
      .filter(
        (tool) =>
          !tool.name.startsWith("archestra__") ||
          tool.name === TOOL_TODO_WRITE_FULL_NAME ||
          tool.name === TOOL_ARTIFACT_WRITE_FULL_NAME,
      )
      .map((tool) => tool.id);

    // Set enabled tools to non-Archestra tools plus todo_write and artifact_write
    // This creates a custom tool selection with most Archestra tools disabled
    await ConversationEnabledToolModel.setEnabledTools(
      conversation.id,
      nonArchestraToolIds,
    );

    const conversationWithAgent = (await ConversationModel.findById({
      id: conversation.id,
      userId: data.userId,
      organizationId: data.organizationId,
    })) as Conversation;

    return conversationWithAgent;
  }

  static async findAll(
    userId: string,
    organizationId: string,
  ): Promise<Conversation[]> {
    const rows = await db
      .select({
        conversation: getTableColumns(schema.conversationsTable),
        message: getTableColumns(schema.messagesTable),
        agent: {
          id: schema.agentsTable.id,
          name: schema.agentsTable.name,
        },
      })
      .from(schema.conversationsTable)
      .innerJoin(
        schema.agentsTable,
        eq(schema.conversationsTable.agentId, schema.agentsTable.id),
      )
      .leftJoin(
        schema.messagesTable,
        eq(schema.conversationsTable.id, schema.messagesTable.conversationId),
      )
      .where(
        and(
          eq(schema.conversationsTable.userId, userId),
          eq(schema.conversationsTable.organizationId, organizationId),
        ),
      )
      .orderBy(
        desc(schema.conversationsTable.createdAt),
        schema.messagesTable.createdAt,
      );

    // Group messages by conversation
    const conversationMap = new Map<string, Conversation>();

    for (const row of rows) {
      const conversationId = row.conversation.id;

      if (!conversationMap.has(conversationId)) {
        conversationMap.set(conversationId, {
          ...row.conversation,
          agent: row.agent,
          messages: [],
        });
      }

      const conversation = conversationMap.get(conversationId);
      if (conversation && row?.message?.content) {
        // Merge database UUID into message content (overrides AI SDK's temporary ID)
        conversation.messages.push({
          ...row.message.content,
          id: row.message.id,
        });
      }
    }

    return Array.from(conversationMap.values());
  }

  static async findById({
    id,
    userId,
    organizationId,
  }: {
    id: string;
    userId: string;
    organizationId: string;
  }): Promise<Conversation | null> {
    const rows = await db
      .select({
        conversation: getTableColumns(schema.conversationsTable),
        message: getTableColumns(schema.messagesTable),
        agent: {
          id: schema.agentsTable.id,
          name: schema.agentsTable.name,
        },
      })
      .from(schema.conversationsTable)
      .innerJoin(
        schema.agentsTable,
        eq(schema.conversationsTable.agentId, schema.agentsTable.id),
      )
      .leftJoin(
        schema.messagesTable,
        eq(schema.conversationsTable.id, schema.messagesTable.conversationId),
      )
      .where(
        and(
          eq(schema.conversationsTable.id, id),
          eq(schema.conversationsTable.userId, userId),
          eq(schema.conversationsTable.organizationId, organizationId),
        ),
      )
      .orderBy(schema.messagesTable.createdAt);

    if (rows.length === 0) {
      return null;
    }

    const firstRow = rows[0];
    const messages = [];

    for (const row of rows) {
      if (row.message?.content) {
        // Merge database UUID into message content (overrides AI SDK's temporary ID)
        messages.push({
          ...row.message.content,
          id: row.message.id,
        });
      }
    }

    return {
      ...firstRow.conversation,
      agent: firstRow.agent,
      messages,
    };
  }

  static async update(
    id: string,
    userId: string,
    organizationId: string,
    data: UpdateConversation,
  ): Promise<Conversation | null> {
    const [updated] = await db
      .update(schema.conversationsTable)
      .set(data)
      .where(
        and(
          eq(schema.conversationsTable.id, id),
          eq(schema.conversationsTable.userId, userId),
          eq(schema.conversationsTable.organizationId, organizationId),
        ),
      )
      .returning();

    if (!updated) {
      return null;
    }

    const updatedWithAgent = (await ConversationModel.findById({
      id: updated.id,
      userId: userId,
      organizationId: organizationId,
    })) as Conversation;

    return updatedWithAgent;
  }

  static async delete(
    id: string,
    userId: string,
    organizationId: string,
  ): Promise<void> {
    await db
      .delete(schema.conversationsTable)
      .where(
        and(
          eq(schema.conversationsTable.id, id),
          eq(schema.conversationsTable.userId, userId),
          eq(schema.conversationsTable.organizationId, organizationId),
        ),
      );
  }

  /**
   * Find a conversation that is shared with the organization (shareMode = 'organization' or 'public')
   */
  static async findSharedById({
    id,
    organizationId,
  }: {
    id: string;
    organizationId: string;
  }): Promise<Conversation | null> {
    const rows = await db
      .select({
        conversation: getTableColumns(schema.conversationsTable),
        message: getTableColumns(schema.messagesTable),
        agent: {
          id: schema.agentsTable.id,
          name: schema.agentsTable.name,
        },
      })
      .from(schema.conversationsTable)
      .innerJoin(
        schema.agentsTable,
        eq(schema.conversationsTable.agentId, schema.agentsTable.id),
      )
      .leftJoin(
        schema.messagesTable,
        eq(schema.conversationsTable.id, schema.messagesTable.conversationId),
      )
      .where(
        and(
          eq(schema.conversationsTable.id, id),
          eq(schema.conversationsTable.organizationId, organizationId),
          // Allow access if shareMode is 'organization' or 'public'
          or(
            eq(schema.conversationsTable.shareMode, "organization"),
            eq(schema.conversationsTable.shareMode, "public"),
          ),
        ),
      )
      .orderBy(schema.messagesTable.createdAt);

    if (rows.length === 0) {
      return null;
    }

    const firstRow = rows[0];
    const messages = [];

    for (const row of rows) {
      if (row.message?.content) {
        messages.push({
          ...row.message.content,
          id: row.message.id,
        });
      }
    }

    return {
      ...firstRow.conversation,
      agent: firstRow.agent,
      messages,
    };
  }

  /**
   * Find a conversation by its public share token (no auth required)
   */
  static async findByPublicToken(
    token: string,
  ): Promise<Conversation | null> {
    const rows = await db
      .select({
        conversation: getTableColumns(schema.conversationsTable),
        message: getTableColumns(schema.messagesTable),
        agent: {
          id: schema.agentsTable.id,
          name: schema.agentsTable.name,
        },
      })
      .from(schema.conversationsTable)
      .innerJoin(
        schema.agentsTable,
        eq(schema.conversationsTable.agentId, schema.agentsTable.id),
      )
      .leftJoin(
        schema.messagesTable,
        eq(schema.conversationsTable.id, schema.messagesTable.conversationId),
      )
      .where(
        and(
          eq(schema.conversationsTable.publicShareToken, token),
          eq(schema.conversationsTable.shareMode, "public"),
        ),
      )
      .orderBy(schema.messagesTable.createdAt);

    if (rows.length === 0) {
      return null;
    }

    const firstRow = rows[0];
    const messages = [];

    for (const row of rows) {
      if (row.message?.content) {
        messages.push({
          ...row.message.content,
          id: row.message.id,
        });
      }
    }

    return {
      ...firstRow.conversation,
      agent: firstRow.agent,
      messages,
    };
  }

  /**
   * Set the share mode for a conversation (owner only)
   * When setting to 'public', generates a new publicShareToken if not already set
   * When setting to 'private' or 'organization', clears the publicShareToken
   */
  static async setShareMode(
    id: string,
    userId: string,
    organizationId: string,
    shareMode: ShareMode,
  ): Promise<Conversation | null> {
    // Prepare the update data
    const updateData: {
      shareMode: ShareMode;
      publicShareToken: string | null;
    } = {
      shareMode,
      publicShareToken: null,
    };

    // If setting to public, generate a new token
    if (shareMode === "public") {
      // Check if conversation already has a token
      const existing = await db
        .select({ publicShareToken: schema.conversationsTable.publicShareToken })
        .from(schema.conversationsTable)
        .where(
          and(
            eq(schema.conversationsTable.id, id),
            eq(schema.conversationsTable.userId, userId),
            eq(schema.conversationsTable.organizationId, organizationId),
          ),
        );

      if (existing.length > 0 && existing[0].publicShareToken) {
        // Keep existing token
        updateData.publicShareToken = existing[0].publicShareToken;
      } else {
        // Generate new token
        updateData.publicShareToken = randomUUID();
      }
    }

    const [updated] = await db
      .update(schema.conversationsTable)
      .set(updateData)
      .where(
        and(
          eq(schema.conversationsTable.id, id),
          eq(schema.conversationsTable.userId, userId),
          eq(schema.conversationsTable.organizationId, organizationId),
        ),
      )
      .returning();

    if (!updated) {
      return null;
    }

    return ConversationModel.findById({
      id: updated.id,
      userId,
      organizationId,
    });
  }
}

export default ConversationModel;
