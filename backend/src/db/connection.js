import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../../.env') });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.DATABASE_URL ? undefined : process.env.POSTGRES_HOST,
  port: process.env.DATABASE_URL ? undefined : Number(process.env.POSTGRES_PORT || 5432),
  database: process.env.DATABASE_URL ? undefined : process.env.POSTGRES_DB,
  user: process.env.DATABASE_URL ? undefined : process.env.POSTGRES_USER,
  password: process.env.DATABASE_URL ? undefined : process.env.POSTGRES_PASSWORD,
  ssl: process.env.DB_SSL === 'require' ? { rejectUnauthorized: true } : undefined,
});

// Test connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
});

export const query = (text, params) => pool.query(text, params);

export default pool;
