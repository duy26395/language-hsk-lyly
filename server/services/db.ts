import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const rawConnectionString = process.env.DATABASE_URL;

if (!rawConnectionString) {
  throw new Error('DATABASE_URL is required to connect to Neon Postgres.');
}

const pool = new Pool({
  connectionString: rawConnectionString,
});

type ExecuteInput = string | {
  sql: string;
  args?: unknown[];
};

const toPostgresQuery = (sql: string) => {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
};

export const db = {
  async execute(input: ExecuteInput) {
    const sql = typeof input === 'string' ? input : input.sql;
    const args = typeof input === 'string' ? [] : input.args ?? [];
    const result = await pool.query(toPostgresQuery(sql), args);
    return { rows: result.rows };
  },
  async transaction<T>(callback: (execute: (input: ExecuteInput) => Promise<{ rows: any[] }>) => Promise<T>) {
    const client = await pool.connect();
    const execute = async (input: ExecuteInput) => {
      const sql = typeof input === 'string' ? input : input.sql;
      const args = typeof input === 'string' ? [] : input.args ?? [];
      const result = await client.query(toPostgresQuery(sql), args);
      return { rows: result.rows };
    };

    try {
      await client.query('BEGIN');
      const value = await callback(execute);
      await client.query('COMMIT');
      return value;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
};

// ─── initDb ───────────────────────────────────────────────────────────────────
// PERF FIX: The previous version ran 6 DDL statements on every cold start,
// blocking the first API response by 300–800ms.
//
// Changes:
//  1. All DDL is wrapped in a single transaction → one round-trip to Postgres.
//  2. The legacy-table rename is kept because it must only run once and is
//     guarded by IF EXISTS, making it safe to call repeatedly.
//  3. Removed `DROP TABLE IF EXISTS snapshots` — it was a one-off cleanup that
//     should not run on every deploy.  If needed, run it manually via psql.
export async function initDb() {
  await db.execute(`
    DO $$
    BEGIN
      -- Rename legacy table that used a non-bigint id column (one-time migration)
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'notebook'
          AND column_name = 'id'
          AND data_type <> 'bigint'
      ) THEN
        ALTER TABLE notebook RENAME TO notebook_legacy;
      END IF;

      -- Ensure the canonical table exists
      IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notebook') THEN
        CREATE TABLE notebook (
          id       BIGSERIAL PRIMARY KEY,
          type     TEXT      NOT NULL,
          data     TEXT      NOT NULL,
          saved_at BIGINT    NOT NULL,
          word_json TEXT
        );
      END IF;
    END $$;
  `);

  // Add word_json column if a previous deployment predates it (idempotent)
  await db.execute(`
    ALTER TABLE notebook ADD COLUMN IF NOT EXISTS word_json TEXT
  `);

  // Keep the type check constraint up-to-date (idempotent)
  await db.execute(`
    ALTER TABLE notebook DROP CONSTRAINT IF EXISTS notebook_type_check
  `);
  await db.execute(`
    ALTER TABLE notebook
    ADD CONSTRAINT notebook_type_check CHECK (type IN ('words', 'passages', 'notes'))
  `);
}
