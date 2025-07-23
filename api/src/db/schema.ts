import { mysqlTable, int, varchar } from "drizzle-orm/mysql-core"

export const playersTable = mysqlTable('players', {
  pid: varchar({ length: 8 }).notNull().primaryKey(),
  plg: varchar({ length: 5 }).notNull().primaryKey(),
  sts: int(),
  sfc: varchar({ length: 2048 }),
  nfc: varchar({ length: 8192 }),
});