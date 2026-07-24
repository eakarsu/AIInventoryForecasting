import bcrypt from 'bcryptjs';
import pool from './src/db/connection.js';

async function main() {
  if (process.env.ALLOW_SCHEMA_MIGRATION !== 'true') throw new Error('Admin provisioning requires ALLOW_SCHEMA_MIGRATION=true');
  const email = process.env.PROVISION_ADMIN_EMAIL;
  const password = process.env.PROVISION_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('PROVISION_ADMIN_EMAIL and PROVISION_ADMIN_PASSWORD are required');
  const passwordHash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO users (email, password_hash, name, role, email_verified)
     VALUES ($1, $2, 'Runtime Administrator', 'admin', true)
     ON CONFLICT (email) DO UPDATE SET password_hash=EXCLUDED.password_hash, name=EXCLUDED.name, role='admin', email_verified=true`,
    [email, passwordHash]
  );
  await pool.end();
}

main().catch(async (error) => {
  console.error(`Admin provisioning failed: ${error.message}`);
  try { await pool.end(); } catch {}
  process.exit(1);
});
