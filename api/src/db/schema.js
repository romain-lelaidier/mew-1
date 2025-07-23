import { mysqlTable, primaryKey, int, varchar } from "drizzle-orm/mysql-core"

export const players = mysqlTable(
  'players',
  {
    pid: varchar({ length: 8 }).notNull(),
    plg: varchar({ length: 5 }).notNull(),
    sts: int(),
    sfc: varchar({ length: 2048 }),
    nfc: varchar({ length: 8192 }),
  },
  table => [
    primaryKey({ columns: [ table.pid, table.plg ] })
  ]
);

export const palettes = mysqlTable(
  'palettes',
  {
    id: varchar({ length: 17 }).notNull().primaryKey(),
    p: varchar({ length: 256 }).notNull()
  }
);