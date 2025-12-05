// server.js - single-file backend with simple generation stub and history storage
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch'); // npm i node-fetch@2
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 4000;
const HISTORY_FILE = path.join(__dirname, 'history.json');

app.use(bodyParser.json({ limit: '2mb' }));
app.use(express.static(__dirname)); // serve index.html, style.css, script.js

// ensure history file
if (!fs.existsSync(HISTORY_FILE)) fs.writeFileSync(HISTORY_FILE, '[]', 'utf8');

function readHistory() {
  try { return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8') || '[]'); } catch (e) { return []; }
}
function writeHistory(arr) {
  try { fs.writeFileSync(HISTORY_FILE, JSON.stringify(arr, null, 2), 'utf8'); return true; } catch (e) { console.error(e); return false; }
}

// health
app.get('/api/health', (req,res) => res.json({ ok:true }));

// get history
app.get('/api/history', (req,res) => {
  const history = readHistory();
  res.json({ ok: true, history });
});

// overwrite history (used by frontend for deletions)
app.post('/api/history/save', (req,res) => {
  const { history } = req.body || {};
  if (!Array.isArray(history)) return res.status(400).json({ error: 'invalid history' });
  writeHistory(history.slice(0,200));
  res.json({ ok:true });
});

// primary generate endpoint
app.post('/api/generate', async (req,res) => {
  const { provider, model, prompt } = req.body || {};
  if (!provider || !model || !prompt) return res.status(400).json({ error: 'provider, model, prompt required' });

  try {
    // If you have real provider keys configured in .env, you can uncomment/implement provider calls.
    // For convenience and to make this app run out of the box, we'll return a high-quality HTML template
    // that uses the prompt and includes premium 3D styles. If you set API keys, you can extend this section
    // to proxy calls to OpenAI/Gemini/Groq as shown earlier.

    const exampleHTML = generateSampleHtml(prompt);

    // save history
    const history = readHistory();
    history.unshift({ id: Date.now(), provider, model, prompt, html: exampleHTML, date: new Date().toISOString() });
    writeHistory(history.slice(0, 100));

    return res.json({ ok: true, html: exampleHTML });
  } catch (err) {
    console.error('generation error', err);
    res.status(500).json({ error: err.message || 'Generation failed' });
  }
});

// helper: generate a polished HTML template using the prompt
function generateSampleHtml(promptText) {
  const safe = String(promptText).replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const heroImage = 'https://source.unsplash.com/random/1600x900/?website,design';
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Generated Site - AgentForge</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body{font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;}
    .hero{background-image:url('${heroImage}'); background-size:cover; background-position:center;}
    .glass{backdrop-filter: blur(8px); background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02));}
    .card{transition: transform .35s cubic-bezier(.2,.9,.25,1); transform-origin:center;}
    .card:hover{transform: translateY(-12px) rotateX(3deg) rotateY(-3deg) scale(1.02);}
  </style>
</head>
<body class="bg-gray-900 text-white">
  <header class="hero py-24">
    <div class="max-w-6xl mx-auto px-6">
      <div class="glass rounded-3xl p-8 shadow-2xl max-w-3xl">
        <h1 class="text-4xl font-extrabold mb-3">Agency site — ${safe.substring(0, 60)}</h1>
        <p class="opacity-80 mb-4">${safe}</p>
        <a class="inline-block px-6 py-3 rounded-xl bg-emerald-400 text-black font-bold" href="#work">View Work</a>
      </div>
    </div>
  </header>

  <main class="max-w-6xl mx-auto p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
    <section class="md:col-span-2 space-y-6">
      <div class="card glass rounded-2xl p-6">
        <h2 class="text-2xl font-bold mb-2">Featured Projects</h2>
        <p class="opacity-80">A showcase of recent work tailored from your brief.</p>
        <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="rounded-xl overflow-hidden shadow-lg">
            <img src="https://source.unsplash.com/random/800x600/?product,interface" alt="" />
            <div class="p-4 bg-white/5">
              <h3 class="font-semibold">Project Alpha</h3>
              <p class="text-sm opacity-70">Design + Frontend</p>
            </div>
          </div>
          <div class="rounded-xl overflow-hidden shadow-lg">
            <img src="https://source.unsplash.com/random/800x600/?app,ux" alt="" />
            <div class="p-4 bg-white/5">
              <h3 class="font-semibold">Project Beta</h3>
              <p class="text-sm opacity-70">Brand + UI</p>
            </div>
          </div>
        </div>
      </div>

      <div class="card glass rounded-2xl p-6">
        <h2 class="text-2xl font-bold mb-2">About</h2>
        <p class="opacity-80">This demo site was generated from: <em>${safe}</em></p>
      </div>
    </section>

    <aside class="space-y-6">
      <div class="card glass rounded-2xl p-4">
        <h3 class="font-semibold">Services</h3>
        <ul class="mt-2 text-sm opacity-80">
          <li>Design Systems</li>
          <li>Frontend Engineering</li>
          <li>Performance & Accessibility</li>
        </ul>
      </div>

      <div class="card glass rounded-2xl p-4">
        <h3 class="font-semibold">Contact</h3>
        <p class="text-sm opacity-80">hello@agentforge.example</p>
        <a class="mt-3 inline-block px-4 py-2 bg-indigo-600 rounded-lg" href="mailto:hello@agentforge.example">Get in touch</a>
      </div>
    </aside>
  </main>

  <footer class="py-8 text-center opacity-70">Generated with AgentForge • ${new Date().toLocaleDateString()}</footer>
</body>
</html>`;
}

app.listen(PORT, () => {
  console.log(`AgentForge running at http://localhost:${PORT}`);
});
