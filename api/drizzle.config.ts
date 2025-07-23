import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle',
  schema: './src/db',
  dialect: 'mysql',
  dbCredentials: {
    host: process.env.DB_MYSQL_HOST!,
    user: process.env.DB_MYSQL_USER!,
    database: process.env.BD_MYSQL_DATABASE!,
    password: process.env.DB_MYSQL_PASSWORD!
  },
});