/* Frontend logic: model population, generate, preview, history, tilt micro-interactions */

const MODELS = {
  gemini: [
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' }
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
  ],
  groq: [
    { id: 'llama3-70b-8192', name: 'Llama 3 70B' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' }
  ]
};

const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

const providerEl = $('#provider');
const modelEl = $('#model');
const promptEl = $('#prompt');
const generateBtn = $('#generateBtn');
const genTxt = $('#genTxt');
const statusEl = $('#status');
const placeholder = $('#placeholder');
const previewFrame = $('#previewFrame');
const codeArea = $('#codeArea');
const copyBtn = $('#copyBtn');
const downloadBtn = $('#downloadBtn');
const previewBtn = $('#previewBtn');
const codeBtn = $('#codeBtn');
const historyList = $('#historyList');
const refreshHistory = $('#refreshHistory');
const themeToggle = $('#themeToggle');
const downloadHeader = $('#downloadHeader');

function populateModels(provider) {
  modelEl.innerHTML = '';
  (MODELS[provider] || []).forEach(m => {
    const o = document.createElement('option');
    o.value = m.id;
    o.innerText = m.name;
    modelEl.appendChild(o);
  });
}

// initial
populateModels(providerEl.value);
providerEl.addEventListener('change', (e) => populateModels(e.target.value));

// view toggles
previewBtn.addEventListener('click', () => {
  previewFrame.classList.remove('hidden');
  codeArea.classList.add('hidden');
});
codeBtn.addEventListener('click', () => {
  codeArea.classList.remove('hidden');
  previewFrame.classList.add('hidden');
});

// tiny tilt effect for course cards
document.querySelectorAll('.courseCard').forEach(card => {
  card.addEventListener('mousemove', (e) => {
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    const rotateY = (px - 0.5) * 10;
    const rotateX = (0.5 - py) * 8;
    card.style.transform = `perspective(700px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(6px)`;
  });
  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
  });
});

// show status
function setStatus(text, isError=false) {
  statusEl.textContent = text || '';
  statusEl.style.color = isError ? '#ff8b8b' : '';
}

// fetch history and render
async function fetchHistory() {
  try {
    const r = await fetch('/api/history');
    const j = await r.json();
    if (j.ok) renderHistory(j.history || []);
  } catch (err) {
    console.error(err);
  }
}

function renderHistory(list) {
  historyList.innerHTML = '';
  list.forEach(item => {
    const el = document.createElement('div');
    el.className = 'p-3 bg-white/4 rounded-lg';
    el.innerHTML = `
      <div class="text-xs opacity-60">${item.provider.toUpperCase()} • ${new Date(item.date).toLocaleString()}</div>
      <div class="mt-2 text-sm line-clamp-2">${escapeHtml(item.prompt)}</div>
      <div class="mt-3 flex gap-2">
        <button data-id="${item.id}" class="loadBtn py-1 px-2 bg-white/5 rounded">Load</button>
        <button data-id="${item.id}" class="delBtn py-1 px-2 bg-red-600/80 rounded">Delete</button>
      </div>
    `;
    historyList.appendChild(el);
  });

  historyList.querySelectorAll('.loadBtn').forEach(b => {
    b.addEventListener('click', async (ev) => {
      const id = ev.target.dataset.id;
      const r = await fetch('/api/history');
      const j = await r.json();
      const item = (j.history || []).find(h => String(h.id) === String(id));
      if (item) {
        promptEl.value = item.prompt;
        showOutput(item.html || '');
        setStatus('Loaded from history');
      }
    });
  });

  historyList.querySelectorAll('.delBtn').forEach(b => {
    b.addEventListener('click', async (ev) => {
      const id = ev.target.dataset.id;
      const r = await fetch('/api/history');
      const j = await r.json();
      let arr = j.history || [];
      arr = arr.filter(h => String(h.id) !== String(id));
      await fetch('/api/history/save', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ history: arr })
      });
      fetchHistory();
    });
  });
}

// show output in preview & code
function showOutput(html) {
  if (!html) return;
  codeArea.value = html;
  codeArea.classList.add('hidden');
  previewFrame.classList.remove('hidden');
  previewFrame.srcdoc = html;
  copyBtn.classList.remove('hidden');
  downloadBtn.classList.remove('hidden');
  downloadHeader.classList.remove('hidden');
}

// escape to display prompt safely
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// generate handler
generateBtn.addEventListener('click', async () => {
  const provider = providerEl.value;
  const model = modelEl.value;
  const prompt = promptEl.value.trim();
  if (!prompt) { setStatus('Please enter a brief', true); return; }

  generateBtn.disabled = true;
  genTxt.innerText = 'Generating...';
  setStatus('Requesting server…');

  try {
    const r = await fetch('/api/generate', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ provider, model, prompt })
    });
    const j = await r.json();
    if (!j.ok) {
      setStatus('Error: ' + (j.error || 'Generation failed'), true);
    } else {
      setStatus('Generation complete');
      showOutput(j.html || '');
      fetchHistory();
    }
  } catch (err) {
    console.error(err);
    setStatus('Network/server error', true);
  } finally {
    generateBtn.disabled = false;
    genTxt.innerText = 'Generate Website';
  }
});

// copy & download
copyBtn.addEventListener('click', () => {
  const text = codeArea.value || previewFrame.srcdoc || '';
  navigator.clipboard.writeText(text);
  setStatus('Copied to clipboard');
});
downloadBtn.addEventListener('click', () => {
  const html = codeArea.value || previewFrame.srcdoc || '';
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'site_' + Date.now() + '.html'; a.click();
});

// refresh history
refreshHistory.addEventListener('click', fetchHistory);

// simple theme toggle (dark/light)
themeToggle.addEventListener('click', () => {
  document.documentElement.classList.toggle('light');
  setStatus('Toggled theme');
});

// small helper to prevent inline scripting issues in preview — but preview uses srcdoc
function sanitizeForPreview(html) {
  return html;
}

// passive startup
fetchHistory();
