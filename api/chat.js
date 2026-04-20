// Serverless proxy for Claude API with Neon conversation logging
// + outbound webhook to Vex CRM on conversation.started / conversation.ended
//
// Environment variables needed:
//   ANTHROPIC_API_KEY                — Claude API key
//   DATABASE_URL                     — Neon PostgreSQL connection string
//   WEBSITE_CHAT_WEBHOOK_SECRET      — HMAC-SHA256 shared secret with Vex
//   VEX_WEBHOOK_URL (optional)       — defaults to https://api.vexhq.ai/webhooks/website-chat

import { neon } from '@neondatabase/serverless';
import { createHmac } from 'node:crypto';

const VEX_WEBHOOK_URL = process.env.VEX_WEBHOOK_URL || 'https://api.vexhq.ai/webhooks/website-chat';
const WEBSITE_VERSION = process.env.VERCEL_GIT_COMMIT_SHA || process.env.WEBSITE_VERSION || 'dev';

// ── Database ──────────────────────────────────────────────────────────
async function getDb() {
  const sql = neon(process.env.DATABASE_URL);
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

// ── Vex webhook ───────────────────────────────────────────────────────
async function sendToVex(payload) {
  const secret = process.env.WEBSITE_CHAT_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('Vex webhook skipped — WEBSITE_CHAT_WEBHOOK_SECRET not set');
    return { skipped: true };
  }

  const body = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');

  // Form events go to /webhooks/form, conversation events go to /webhooks/website-chat
  const isForm = payload.event && payload.event.startsWith('form.');
  const url = isForm
    ? (process.env.VEX_FORM_WEBHOOK_URL || 'https://api.vexhq.ai/webhooks/form')
    : VEX_WEBHOOK_URL;

  console.log(`[vex] POST ${url} event=${payload.event} bodyLen=${body.length}`);

  const delays = [0, 1000, 2000, 4000];
  let lastErr;
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt]) await new Promise(r => setTimeout(r, delays[attempt]));
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-VTC-Timestamp': timestamp,
          'X-VTC-Signature': signature,
          'X-Idempotency-Key': `${payload.conversation_id || payload.lead?.email || 'unknown'}:${payload.event}`
        },
        body
      });
      if (res.ok) {
        console.log(`[vex] OK event=${payload.event} attempt=${attempt + 1} status=${res.status}`);
        return { ok: true, attempt: attempt + 1 };
      }
      const errBody = await res.text().catch(() => '');
      console.warn(`[vex] non-2xx event=${payload.event} attempt=${attempt + 1} status=${res.status} body=${errBody.slice(0, 300)}`);
      lastErr = new Error(`Vex webhook ${res.status}: ${errBody.slice(0, 300)}`);
    } catch (err) {
      console.warn(`[vex] fetch error event=${payload.event} attempt=${attempt + 1} err=${err.message}`);
      lastErr = err;
    }
  }
  console.error(`[vex] FAILED after retries event=${payload.event} err=${lastErr?.message}`);
  return { ok: false, error: lastErr?.message };
}

// ── CORS ──────────────────────────────────────────────────────────────
function setCors(req, res) {
  const origin = req.headers.origin || '';
  const allowed = [
    'https://vectortradecapital.com',
    'https://www.vectortradecapital.com',
    'https://vtc-website-alpha.vercel.app'
  ];
  const corsOrigin = allowed.includes(origin) ? origin : allowed[0];
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ── Event handlers ────────────────────────────────────────────────────
async function handleConversationStarted(req, res) {
  const { sessionId, lead, page } = req.body;
  if (!sessionId || !lead?.name || !lead?.email) {
    return res.status(400).json({ error: 'sessionId, lead.name, lead.email required' });
  }
  const result = await sendToVex({
    event: 'conversation.started',
    conversation_id: sessionId,
    website_version: WEBSITE_VERSION,
    timestamp: new Date().toISOString(),
    lead: { name: lead.name, email: lead.email },
    page: page || {}
  });
  return res.status(200).json({ ok: true, vex: result });
}

async function handleFormSubmitted(req, res) {
  const { form_id, form_name, lead, fields, page } = req.body;
  if (!lead?.email) {
    return res.status(400).json({ error: 'lead.email required' });
  }
  const result = await sendToVex({
    event: 'form.submitted',
    form_id: form_id || 'lead-form',
    form_name: form_name || 'Request a Quote',
    website_version: WEBSITE_VERSION,
    timestamp: new Date().toISOString(),
    lead: {
      name: lead.name ?? null,
      email: lead.email,
      phone: lead.phone ?? null,
      sms_consent: lead.sms_consent ?? false
    },
    fields: {
      country: fields?.country ?? null,
      product_interest: fields?.product_interest ?? null,
      message: fields?.message ?? null,
      _gotcha: fields?._gotcha ?? null
    },
    page: page ?? {}
  });
  return res.status(200).json({ ok: true, vex: result });
}

async function handleConversationEnded(req, res) {
  const { sessionId, lead, page, messages: clientMessages } = req.body;
  if (!sessionId || !lead?.name || !lead?.email) {
    return res.status(400).json({ error: 'sessionId, lead.name, lead.email required' });
  }

  // Pull full transcript from Neon if available; fall back to client-supplied messages.
  let messages = [];
  if (process.env.DATABASE_URL) {
    try {
      const sql = await getDb();
      const rows = await sql`
        SELECT role, content, created_at
        FROM chat_messages
        WHERE session_id = ${sessionId}
        ORDER BY id ASC
      `;
      messages = rows.map(r => ({
        role: r.role,
        text: r.content,
        ts: new Date(r.created_at).toISOString()
      }));
    } catch (dbErr) {
      console.error('Neon transcript read error:', dbErr.message);
    }
  }
  if (!messages.length && Array.isArray(clientMessages)) {
    messages = clientMessages
      .filter(m => m && m.role && (m.text || m.content))
      .map(m => ({ role: m.role, text: m.text || m.content, ts: m.ts || null }));
  }
  if (!messages.length) {
    return res.status(400).json({ error: 'no transcript available' });
  }

  const result = await sendToVex({
    event: 'conversation.ended',
    conversation_id: sessionId,
    website_version: WEBSITE_VERSION,
    timestamp: new Date().toISOString(),
    lead: { name: lead.name, email: lead.email },
    page: page || {},
    messages
  });
  return res.status(200).json({ ok: true, vex: result, message_count: messages.length });
}

async function handleChatMessage(req, res) {
  const { system, messages, sessionId, pageUrl } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Messages required' });
  }
  if (messages.length > 30) {
    return res.status(400).json({ error: 'Too many messages' });
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system,
      messages: messages.map(m => ({ role: m.role, content: m.content }))
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Anthropic API error:', response.status, errorBody);
    return res.status(502).json({ error: 'AI service error' });
  }

  const data = await response.json();
  const reply = data.content?.[0]?.text || 'I could not generate a response.';

  if (process.env.DATABASE_URL && sessionId) {
    try {
      const sql = await getDb();
      const lastUserMsg = messages[messages.length - 1];
      await sql`
        INSERT INTO chat_sessions (id, page_url, user_agent)
        VALUES (${sessionId}, ${pageUrl || null}, ${req.headers['user-agent'] || null})
        ON CONFLICT (id) DO NOTHING
      `;
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
}

// ── Main handler ──────────────────────────────────────────────────────
export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const event = req.body?.event;
    console.log(`[chat] incoming event=${event || 'chat-message'} origin=${req.headers.origin || 'none'}`);
    if (event === 'conversation.started') return await handleConversationStarted(req, res);
    if (event === 'conversation.ended') return await handleConversationEnded(req, res);
    if (event === 'form.submitted') return await handleFormSubmitted(req, res);
    return await handleChatMessage(req, res);
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
