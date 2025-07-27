import { mysqlTable, primaryKey, int, varchar, datetime } from "drizzle-orm/mysql-core"

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

export const logs = mysqlTable(
  'logs',
  {
    id: int().primaryKey().autoincrement(),
    date: datetime(),
    ip: varchar({ length: 32 }),
    type: varchar({ length: 8 }),
    vid: varchar({ length: 11 }),
    name: varchar({ length: 128 }),
    subname: varchar({ length: 128 })
  }
);