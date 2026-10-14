import { date, index, pgSchema, text, uuid } from "drizzle-orm/pg-core";

import { people } from "@/apps/people/schema";
import { rawRowColumns, rawSchema } from "@/shared/raw/schema";

/** Mobile owns app accounts and, later, the events the app sends. */
export const mobileSchema = pgSchema("mobile");

/** One row per app account. The account's email lives in People. */
export const accounts = mobileSchema.table(
  "accounts",
  {
    userId: text("user_id").primaryKey(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    createdOn: date("created_on", { mode: "string" }).notNull(),
  },
  (table) => [index("accounts_person_id_idx").on(table.personId)],
);

/** app_users.csv exactly as it arrived. */
export const rawAppUsers = rawSchema.table("app_users", {
  ...rawRowColumns(),
  userId: text("user_id"),
  email: text("email"),
  createdAt: text("created_at"),
});
