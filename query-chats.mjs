// Quick script to query chat conversations from Neon
// Usage: node query-chats.mjs [days]
// Example: node query-chats.mjs 7  (last 7 days, default)

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Set DATABASE_URL environment variable');
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const days = parseInt(process.argv[2]) || 7;
const command = process.argv[3] || 'all';

if (command === 'stats') {
  // Summary stats
  const sessions = await sql`SELECT COUNT(*) as total FROM chat_sessions WHERE started_at > NOW() - ${days + ' days'}::interval`;
  const msgs = await sql`SELECT COUNT(*) as total FROM chat_messages WHERE created_at > NOW() - ${days + ' days'}::interval`;
  const pages = await sql`SELECT page_url, COUNT(*) as visits FROM chat_sessions WHERE started_at > NOW() - ${days + ' days'}::interval GROUP BY page_url ORDER BY visits DESC LIMIT 10`;

  console.log(`\n=== Chat Stats (last ${days} days) ===`);
  console.log(`Sessions: ${sessions[0].total}`);
  console.log(`Messages: ${msgs[0].total}`);
  console.log(`\nTop pages:`);
  pages.forEach(p => console.log(`  ${p.visits}x  ${p.page_url}`));
} else {
  // Full conversation log
  const rows = await sql`
    SELECT s.id as session_id, s.page_url, s.started_at, m.role, m.content, m.created_at
    FROM chat_sessions s
    JOIN chat_messages m ON m.session_id = s.id
    WHERE s.started_at > NOW() - ${days + ' days'}::interval
    ORDER BY s.started_at DESC, m.created_at ASC
  `;

  if (rows.length === 0) {
    console.log('No conversations in the last ' + days + ' days.');
    process.exit(0);
  }

  let currentSession = null;
  rows.forEach(row => {
    if (row.session_id !== currentSession) {
      currentSession = row.session_id;
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Session: ${row.session_id}`);
      console.log(`Page: ${row.page_url}`);
      console.log(`Started: ${row.started_at}`);
      console.log('='.repeat(60));
    }
    const label = row.role === 'user' ? 'VISITOR' : 'AI';
    console.log(`\n[${label}] ${row.content}`);
  });
}
