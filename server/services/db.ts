import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const rawConnectionString = process.env.NETLIFY_DATABASE_URL;

if (!rawConnectionString) {
  throw new Error('NETLIFY_DATABASE_URL is required to connect to Netlify Database.');
}

const databaseUrl = new URL(rawConnectionString);
const sslMode = databaseUrl.searchParams.get('sslmode');
databaseUrl.searchParams.delete('sslmode');
const connectionString = databaseUrl.toString();

const pool = new Pool({
  connectionString,
  ssl: sslMode
    ? { rejectUnauthorized: false }
    : undefined,
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

  await db.execute(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      created_at BIGINT NOT NULL
    )
  `);
}
