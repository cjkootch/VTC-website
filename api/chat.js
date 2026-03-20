// Serverless proxy for Claude API
// Deploy to Vercel, Netlify Functions, or any Node.js serverless platform.
// Set ANTHROPIC_API_KEY as an environment variable — never hardcode it.
//
// If deploying to Vercel:
//   1. Put this file at /api/chat.js
//   2. Add ANTHROPIC_API_KEY to your Vercel environment variables
//   3. Deploy — the endpoint will be available at /api/chat
//
// If deploying standalone (e.g., on Neon or Railway):
//   Use the Express version at the bottom of this file.

// ── Vercel / Netlify Serverless Function ──
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

  const { system, messages } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Messages required' });
  }

  // Rate limiting: basic check (enhance with Redis/Neon for production)
  // For now, just limit message count per request
  if (messages.length > 30) {
    return res.status(400).json({ error: 'Too many messages' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
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

    return res.status(200).json({ content: reply });
  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ── Express Standalone Version ──
// Uncomment the block below if deploying as a standalone Node.js server
// (e.g., on Railway, Render, Fly.io, or a VPS)
//
// import express from 'express';
// import cors from 'cors';
//
// const app = express();
// app.use(cors({ origin: 'https://vectortradecapital.com' }));
// app.use(express.json());
// app.post('/api/chat', handler);
// app.listen(process.env.PORT || 3000, () => {
//   console.log('VTC Chat proxy running on port', process.env.PORT || 3000);
// });
