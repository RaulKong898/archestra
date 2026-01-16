import {
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import mcpGatewaysTable from "./mcp-gateway";
import { team } from "./team";

const mcpGatewayTeamTable = pgTable(
  "mcp_gateway_team",
  {
    mcpGatewayId: uuid("mcp_gateway_id")
      .notNull()
      .references(() => mcpGatewaysTable.id, { onDelete: "cascade" }),
    teamId: text("team_id")
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.mcpGatewayId, table.teamId] }),
  }),
);

export default mcpGatewayTeamTable;
