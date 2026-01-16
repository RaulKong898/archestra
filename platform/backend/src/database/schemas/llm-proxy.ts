import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

const llmProxiesTable = pgTable("llm_proxies", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").notNull(),
  name: text("name").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  considerContextUntrusted: boolean("consider_context_untrusted")
    .notNull()
    .default(false),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export default llmProxiesTable;
