import { query } from '../db/connection.js';

// Ensure ai_audit table exists
export async function ensureAuditTable() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS ai_audit (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        endpoint TEXT,
        entity_id INTEGER,
        tokens_used INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } catch (err) {
    console.error('Failed to create ai_audit table:', err);
  }
}

// Fire-and-forget audit log
export function logAICall({ user_id, endpoint, entity_id, tokens_used }) {
  setImmediate(async () => {
    try {
      await query(
        'INSERT INTO ai_audit (user_id, endpoint, entity_id, tokens_used) VALUES ($1, $2, $3, $4)',
        [user_id || null, endpoint || null, entity_id || null, tokens_used || null]
      );
    } catch (err) {
      console.error('AI audit log error:', err);
    }
  });
}
