// server.js
// Single-file server which serves index.html and exposes /api endpoints
require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch'); // npm i node-fetch@2
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 4000;
const HISTORY_FILE = path.join(__dirname, 'history.json');
const INDEX_FILE = path.join(__dirname, 'index.html');

app.use(bodyParser.json({ limit: '2mb' }));
app.use(express.static(__dirname)); // serve index.html and any assets

// Read/write history helpers
function readHistory() {
  try {
    const raw = fs.readFileSync(HISTORY_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (e) {
    return [];
  }
}
function writeHistory(arr) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(arr, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Failed to write history:', e);
    return false;
  }
}

// Serve the index.html for root
app.get('/', (req, res) => {
  res.sendFile(INDEX_FILE);
});

// Health
app.get('/api/health', (req, res) => res.json({ ok: true }));

// History endpoints
app.get('/api/history', (req, res) => {
  const history = readHistory();
  res.json({ ok: true, history });
});

// Allow client to overwrite history (used for delete in the app)
app.post('/api/history/save', (req, res) => {
  const { history } = req.body || {};
  if (!Array.isArray(history)) return res.status(400).json({ error: 'invalid history' });
  writeHistory(history.slice(0, 200));
  res.json({ ok: true });
});

// Main generate endpoint: proxies to provider using server-side keys
app.post('/api/generate', async (req, res) => {
  const { provider, model, prompt } = req.body || {};
  if (!provider || !model || !prompt) {
    return res.status(400).json({ error: 'provider, model, prompt required' });
  }

  try {
    let html = '';
    const SYSTEM = `You are an expert AI web developer. Generate a COMPLETE single-file HTML5 website that uses Tailwind CDN and returns ONLY the HTML. Use modern responsive layout, images from source.unsplash.com, and make it production-ready.`;

    if (provider === 'openai') {
      const key = process.env.OPENAI_API_KEY;
      if (!key) throw new Error('OPENAI_API_KEY missing on server (.env)');
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 2500
        })
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
      html = j.choices?.[0]?.message?.content || '';
    } else if (provider === 'gemini') {
      const key = process.env.GEMINI_API_KEY;
      if (!key) throw new Error('GEMINI_API_KEY missing on server (.env)');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const body = {
        contents: [{ parts: [{ text: SYSTEM + "\\n\\nUser: " + prompt }] }]
      };
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
      html = j.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else if (provider === 'groq') {
      const key = process.env.GROQ_API_KEY;
      if (!key) throw new Error('GROQ_API_KEY missing on server (.env)');
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7
        })
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
      html = j.choices?.[0]?.message?.content || '';
    } else {
      throw new Error('Unknown provider');
    }

    // small cleaning
    html = String(html).replace(/```html/g, '').replace(/```/g, '').trim();

    // save history (keep last 100)
    const history = readHistory();
    history.unshift({ id: Date.now(), provider, model, prompt, html, date: new Date().toISOString() });
    writeHistory(history.slice(0, 100));

    res.json({ ok: true, html });
  } catch (err) {
    console.error('Generation error:', err);
    res.status(500).json({ error: err.message || 'Generation failed' });
  }
});

// Fallback static serve (for direct file access)
app.use(express.static(__dirname));

// Ensure history.json exists
if (!fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, '[]', 'utf8');

app.listen(PORT, () => {
  console.log(`AgentForge running on http://localhost:${PORT}`);
});
