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

export async function initDb() {
  await db.execute(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'notebook'
          AND column_name = 'id'
          AND data_type <> 'bigint'
      ) THEN
        ALTER TABLE notebook RENAME TO notebook_legacy;
      END IF;
    END $$;
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS notebook (
      id BIGSERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      data TEXT NOT NULL,
      saved_at BIGINT NOT NULL
    )
  `);

  await db.execute(`
    ALTER TABLE notebook
    DROP CONSTRAINT IF EXISTS notebook_type_check
  `);

  await db.execute(`
    ALTER TABLE notebook
    ADD CONSTRAINT notebook_type_check CHECK (type IN ('words', 'passages', 'notes'))
  `);

  await db.execute('DROP TABLE IF EXISTS snapshots');
}
