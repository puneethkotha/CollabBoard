import { Pool, PoolClient } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

export const pool = new Pool({
  connectionString: config.database.url,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected database error');
});

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug({ text, duration, rows: result.rowCount }, 'Executed query');
    return result;
  } catch (error) {
    logger.error({ text, error }, 'Query error');
    throw error;
  }
}

export async function getClient(): Promise<PoolClient> {
  return await pool.connect();
}

export async function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool() {
  await pool.end();
  logger.info('Database pool closed');
}
