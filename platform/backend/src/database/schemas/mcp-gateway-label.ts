import { pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import labelKeyTable from "./label-key";
import labelValueTable from "./label-value";
import mcpGatewaysTable from "./mcp-gateway";

const mcpGatewayLabelTable = pgTable(
  "mcp_gateway_labels",
  {
    mcpGatewayId: uuid("mcp_gateway_id")
      .notNull()
      .references(() => mcpGatewaysTable.id, { onDelete: "cascade" }),
    keyId: uuid("key_id")
      .notNull()
      .references(() => labelKeyTable.id, { onDelete: "cascade" }),
    valueId: uuid("value_id")
      .notNull()
      .references(() => labelValueTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.mcpGatewayId, table.keyId] }),
  }),
);

export default mcpGatewayLabelTable;
