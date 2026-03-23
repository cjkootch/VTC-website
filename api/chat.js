// Serverless proxy for Claude API with Neon conversation logging
// Environment variables needed:
//   ANTHROPIC_API_KEY — your Claude API key
//   DATABASE_URL — your Neon PostgreSQL connection string

import { neon } from '@neondatabase/serverless';

// ── Database Setup (runs once on cold start) ──
async function getDb() {
  const sql = neon(process.env.DATABASE_URL);
  // Create tables if they don't exist
  await sql`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      started_at TIMESTAMPTZ DEFAULT NOW(),
      page_url TEXT,
      user_agent TEXT,
      ip_country TEXT
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY,
      session_id TEXT REFERENCES chat_sessions(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  return sql;
}

export default async function handler(req, res) {
  // CORS headers
  const origin = req.headers.origin || '';
  const allowed = ['https://vectortradecapital.com', 'https://www.vectortradecapital.com', 'https://vtc-website-alpha.vercel.app'];
  const corsOrigin = allowed.includes(origin) ? origin : allowed[0];
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { system, messages, sessionId, pageUrl } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Messages required' });
  }

  if (messages.length > 30) {
    return res.status(400).json({ error: 'Too many messages' });
  }

  try {
    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2025-01-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20241022',
        max_tokens: 1024,
        system: system,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        }))
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Anthropic API error:', response.status, errorBody);
      return res.status(502).json({ error: 'AI service error' });
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text || 'I could not generate a response.';

    // Log to Neon (non-blocking — don't let DB errors break the chat)
    if (process.env.DATABASE_URL && sessionId) {
      try {
        const sql = await getDb();
        const lastUserMsg = messages[messages.length - 1];

        // Upsert session
        await sql`
          INSERT INTO chat_sessions (id, page_url, user_agent)
          VALUES (${sessionId}, ${pageUrl || null}, ${req.headers['user-agent'] || null})
          ON CONFLICT (id) DO NOTHING
        `;

        // Log user message + assistant reply
        await sql`
          INSERT INTO chat_messages (session_id, role, content)
          VALUES (${sessionId}, ${lastUserMsg.role}, ${lastUserMsg.content})
        `;
        await sql`
          INSERT INTO chat_messages (session_id, role, content)
          VALUES (${sessionId}, 'assistant', ${reply})
        `;
      } catch (dbErr) {
        console.error('DB logging error (non-fatal):', dbErr.message);
      }
    }

    return res.status(200).json({ content: reply });
  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
