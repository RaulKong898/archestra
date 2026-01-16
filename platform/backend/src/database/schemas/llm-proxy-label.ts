import { pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import labelKeyTable from "./label-key";
import labelValueTable from "./label-value";
import llmProxiesTable from "./llm-proxy";

const llmProxyLabelTable = pgTable(
  "llm_proxy_labels",
  {
    llmProxyId: uuid("llm_proxy_id")
      .notNull()
      .references(() => llmProxiesTable.id, { onDelete: "cascade" }),
    keyId: uuid("key_id")
      .notNull()
      .references(() => labelKeyTable.id, { onDelete: "cascade" }),
    valueId: uuid("value_id")
      .notNull()
      .references(() => labelValueTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.llmProxyId, table.keyId] }),
  }),
);

export default llmProxyLabelTable;
