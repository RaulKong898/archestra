import {
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import llmProxiesTable from "./llm-proxy";
import { team } from "./team";

const llmProxyTeamTable = pgTable(
  "llm_proxy_team",
  {
    llmProxyId: uuid("llm_proxy_id")
      .notNull()
      .references(() => llmProxiesTable.id, { onDelete: "cascade" }),
    teamId: text("team_id")
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.llmProxyId, table.teamId] }),
  }),
);

export default llmProxyTeamTable;
