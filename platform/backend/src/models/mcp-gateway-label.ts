import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import db, { schema } from "@/database";
import type { AgentLabelWithDetails } from "@/types";

class McpGatewayLabelModel {
  /**
   * Get all labels for a specific MCP Gateway with key and value details
   */
  static async getLabelsForMcpGateway(
    mcpGatewayId: string,
  ): Promise<AgentLabelWithDetails[]> {
    const rows = await db
      .select({
        keyId: schema.mcpGatewayLabelsTable.keyId,
        valueId: schema.mcpGatewayLabelsTable.valueId,
        key: schema.labelKeysTable.key,
        value: schema.labelValuesTable.value,
      })
      .from(schema.mcpGatewayLabelsTable)
      .leftJoin(
        schema.labelKeysTable,
        eq(schema.mcpGatewayLabelsTable.keyId, schema.labelKeysTable.id),
      )
      .leftJoin(
        schema.labelValuesTable,
        eq(schema.mcpGatewayLabelsTable.valueId, schema.labelValuesTable.id),
      )
      .where(eq(schema.mcpGatewayLabelsTable.mcpGatewayId, mcpGatewayId))
      .orderBy(asc(schema.labelKeysTable.key));

    return rows.map((row) => ({
      keyId: row.keyId,
      valueId: row.valueId,
      key: row.key || "",
      value: row.value || "",
    }));
  }

  /**
   * Get or create a label key
   */
  static async getOrCreateKey(key: string): Promise<string> {
    // Try to find existing key
    const [existing] = await db
      .select()
      .from(schema.labelKeysTable)
      .where(eq(schema.labelKeysTable.key, key))
      .limit(1);

    if (existing) {
      return existing.id;
    }

    // Create new key
    const [created] = await db
      .insert(schema.labelKeysTable)
      .values({ key })
      .returning();

    return created.id;
  }

  /**
   * Get or create a label value
   */
  static async getOrCreateValue(value: string): Promise<string> {
    // Try to find existing value
    const [existing] = await db
      .select()
      .from(schema.labelValuesTable)
      .where(eq(schema.labelValuesTable.value, value))
      .limit(1);

    if (existing) {
      return existing.id;
    }

    // Create new value
    const [created] = await db
      .insert(schema.labelValuesTable)
      .values({ value })
      .returning();

    return created.id;
  }

  /**
   * Sync labels for an MCP Gateway (replaces all existing labels)
   */
  static async syncMcpGatewayLabels(
    mcpGatewayId: string,
    labels: AgentLabelWithDetails[],
  ): Promise<void> {
    // Process labels outside of transaction to avoid deadlocks
    const labelInserts: {
      mcpGatewayId: string;
      keyId: string;
      valueId: string;
    }[] = [];

    if (labels.length > 0) {
      // Process each label to get or create keys/values
      for (const label of labels) {
        const keyId = await McpGatewayLabelModel.getOrCreateKey(label.key);
        const valueId = await McpGatewayLabelModel.getOrCreateValue(
          label.value,
        );
        labelInserts.push({ mcpGatewayId, keyId, valueId });
      }
    }

    await db.transaction(async (tx) => {
      // Delete all existing labels for this MCP Gateway
      await tx
        .delete(schema.mcpGatewayLabelsTable)
        .where(eq(schema.mcpGatewayLabelsTable.mcpGatewayId, mcpGatewayId));

      // Insert new labels (if any provided)
      if (labelInserts.length > 0) {
        await tx.insert(schema.mcpGatewayLabelsTable).values(labelInserts);
      }
    });

    await McpGatewayLabelModel.pruneKeysAndValues();
  }

  /**
   * Prune orphaned label keys and values that are no longer referenced
   * by any label tables (agent_labels, mcp_gateway_labels, llm_proxy_labels)
   */
  static async pruneKeysAndValues(): Promise<{
    deletedKeys: number;
    deletedValues: number;
  }> {
    return await db.transaction(async (tx) => {
      // Find orphaned keys (not referenced in any label table)
      const orphanedKeys = await tx
        .select({ id: schema.labelKeysTable.id })
        .from(schema.labelKeysTable)
        .leftJoin(
          schema.agentLabelsTable,
          eq(schema.labelKeysTable.id, schema.agentLabelsTable.keyId),
        )
        .leftJoin(
          schema.mcpGatewayLabelsTable,
          eq(schema.labelKeysTable.id, schema.mcpGatewayLabelsTable.keyId),
        )
        .leftJoin(
          schema.llmProxyLabelsTable,
          eq(schema.labelKeysTable.id, schema.llmProxyLabelsTable.keyId),
        )
        .where(
          and(
            isNull(schema.agentLabelsTable.keyId),
            isNull(schema.mcpGatewayLabelsTable.keyId),
            isNull(schema.llmProxyLabelsTable.keyId),
          ),
        );

      // Find orphaned values (not referenced in any label table)
      const orphanedValues = await tx
        .select({ id: schema.labelValuesTable.id })
        .from(schema.labelValuesTable)
        .leftJoin(
          schema.agentLabelsTable,
          eq(schema.labelValuesTable.id, schema.agentLabelsTable.valueId),
        )
        .leftJoin(
          schema.mcpGatewayLabelsTable,
          eq(schema.labelValuesTable.id, schema.mcpGatewayLabelsTable.valueId),
        )
        .leftJoin(
          schema.llmProxyLabelsTable,
          eq(schema.labelValuesTable.id, schema.llmProxyLabelsTable.valueId),
        )
        .where(
          and(
            isNull(schema.agentLabelsTable.valueId),
            isNull(schema.mcpGatewayLabelsTable.valueId),
            isNull(schema.llmProxyLabelsTable.valueId),
          ),
        );

      let deletedKeys = 0;
      let deletedValues = 0;

      // Delete orphaned keys
      if (orphanedKeys.length > 0) {
        const keyIds = orphanedKeys.map((k) => k.id);
        const result = await tx
          .delete(schema.labelKeysTable)
          .where(inArray(schema.labelKeysTable.id, keyIds));
        deletedKeys = result.rowCount || 0;
      }

      // Delete orphaned values
      if (orphanedValues.length > 0) {
        const valueIds = orphanedValues.map((v) => v.id);
        const result = await tx
          .delete(schema.labelValuesTable)
          .where(inArray(schema.labelValuesTable.id, valueIds));
        deletedValues = result.rowCount || 0;
      }

      return { deletedKeys, deletedValues };
    });
  }

  /**
   * Get labels for multiple MCP Gateways in one query to avoid N+1
   */
  static async getLabelsForMcpGateways(
    mcpGatewayIds: string[],
  ): Promise<Map<string, AgentLabelWithDetails[]>> {
    if (mcpGatewayIds.length === 0) {
      return new Map();
    }

    const rows = await db
      .select({
        mcpGatewayId: schema.mcpGatewayLabelsTable.mcpGatewayId,
        keyId: schema.mcpGatewayLabelsTable.keyId,
        valueId: schema.mcpGatewayLabelsTable.valueId,
        key: schema.labelKeysTable.key,
        value: schema.labelValuesTable.value,
      })
      .from(schema.mcpGatewayLabelsTable)
      .leftJoin(
        schema.labelKeysTable,
        eq(schema.mcpGatewayLabelsTable.keyId, schema.labelKeysTable.id),
      )
      .leftJoin(
        schema.labelValuesTable,
        eq(schema.mcpGatewayLabelsTable.valueId, schema.labelValuesTable.id),
      )
      .where(inArray(schema.mcpGatewayLabelsTable.mcpGatewayId, mcpGatewayIds))
      .orderBy(asc(schema.labelKeysTable.key));

    const labelsMap = new Map<string, AgentLabelWithDetails[]>();

    // Initialize all gateway IDs with empty arrays
    for (const mcpGatewayId of mcpGatewayIds) {
      labelsMap.set(mcpGatewayId, []);
    }

    // Populate the map with labels
    for (const row of rows) {
      const labels = labelsMap.get(row.mcpGatewayId) || [];
      labels.push({
        keyId: row.keyId,
        valueId: row.valueId,
        key: row.key || "",
        value: row.value || "",
      });
      labelsMap.set(row.mcpGatewayId, labels);
    }

    return labelsMap;
  }

  /**
   * Get all available label keys
   */
  static async getAllKeys(): Promise<string[]> {
    const keys = await db.select().from(schema.labelKeysTable);
    return keys.map((k) => k.key);
  }

  /**
   * Get all available label values for a specific key
   */
  static async getValuesByKey(key: string): Promise<string[]> {
    // Find the key ID
    const [keyRecord] = await db
      .select()
      .from(schema.labelKeysTable)
      .where(eq(schema.labelKeysTable.key, key))
      .limit(1);

    if (!keyRecord) {
      return [];
    }

    // Get all values associated with this key across all label types
    const values = await db
      .select({
        value: schema.labelValuesTable.value,
      })
      .from(schema.mcpGatewayLabelsTable)
      .innerJoin(
        schema.labelValuesTable,
        eq(schema.mcpGatewayLabelsTable.valueId, schema.labelValuesTable.id),
      )
      .where(eq(schema.mcpGatewayLabelsTable.keyId, keyRecord.id))
      .groupBy(schema.labelValuesTable.value)
      .orderBy(asc(schema.labelValuesTable.value));

    return values.map((v) => v.value);
  }
}

export default McpGatewayLabelModel;
