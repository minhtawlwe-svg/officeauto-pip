// AI providers for Pip. Each provider is a saved profile { id, preset, type, name, model, ... , keys[] }.
//   gemini - Google Gemini, through the Vercel relay (works in Myanmar) or direct
//   claude - Anthropic Claude via the official @anthropic-ai/sdk
//   openai - any OpenAI-compatible chat API: OpenAI, OpenRouter, Groq, DeepSeek, Ollama, custom
// All calls stream text through onText(chunk) and resolve with the full answer.
const fs = require('fs');
const path = require('path');

const PRESETS = {
  gemini: { type: 'gemini', name: 'Google Gemini', mode: 'relay', relayUrl: 'https://interview-relay.vercel.app/api/ask', model: 'gemini-2.5-flash', keyUrl: 'https://aistudio.google.com/apikey', note: 'Free key. Relay mode works in Myanmar without VPN.' },
  claude: { type: 'claude', name: 'Claude (Anthropic)', model: 'claude-opus-5-5', keyUrl: 'https://platform.claude.com', note: 'Paid API key. Great for writing and long documents.' },
  openai: { type: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: '', keyUrl: 'https://platform.openai.com/api-keys', note: 'Paid API key. Click "Load models" after adding the key.' },
  openrouter: { type: 'openai', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: '', keyUrl: 'https://openrouter.ai/keys', note: 'One key for hundreds of models (some free).' },
  groq: { type: 'openai', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: '', keyUrl: 'https://console.groq.com/keys', note: 'Very fast, free tier.' },
  deepseek: { type: 'openai', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', keyUrl: 'https://platform.deepseek.com/api_keys', note: 'Low-cost API.' },
  ollama: { type: 'openai', name: 'Ollama (local, offline)', baseUrl: 'http://localhost:11434/v1', model: '', noKey: true, keyUrl: 'https://ollama.com/download', note: 'Free, runs on this PC. No key needed.' },
  custom: { type: 'openai', name: 'Custom (OpenAI-compatible)', baseUrl: '', model: '', note: 'Any service with an OpenAI-style /chat/completions API.' },
};

const KEY_FILE = path.join(__dirname, 'api-key.txt');   // optional plain-text Gemini keys

function parseKeys(text) {
  return String(text || '').split(/\r?\n/).map((l) => l.replace(/#.*$/, ''))
    .join(',').split(/[,\s]+/).map((k) => k.trim()).filter(Boolean)
    .filter((k, i, a) => a.indexOf(k) === i);
}
const mask = (k) => (k.length > 10 ? `${k.slice(0, 4)}...${k.slice(-4)}` : '****');

// Keys for a provider: saved keys, then (Gemini only) the GEMINI_API_KEY env var or api-key.txt.
function keysOf(p) {
  if (p.keys && p.keys.length) return { keys: p.keys, from: 'Settings' };
  if (p.type === 'gemini') {
    const env = parseKeys(process.env.GEMINI_API_KEY);
    if (env.length) return { keys: env, from: 'GEMINI_API_KEY env' };
    try { const k = parseKeys(fs.readFileSync(KEY_FILE, 'utf8')); if (k.length) return { keys: k, from: 'api-key.txt' }; } catch { }
  }
  return { keys: [], from: '' };
}
const usable = (p) => (PRESETS[p.preset] || {}).noKey || keysOf(p).keys.length > 0;

class KeyError extends Error { }          // this key failed (bad / out of quota): try the next key

// ---- key rotation: spread requests over all keys (round-robin) and push keys that just hit a limit to the back
const keyState = new Map();   // key -> { until: ms timestamp, fails }
const nextStart = new Map();  // provider id -> index of the key to start with next time
const lastKeys = new Map();   // provider id -> its key list (to advance the round-robin)
function orderKeys(p, keys) {
  if (keys.length < 2) return keys;
  lastKeys.set(p.id, keys);
  const start = (nextStart.get(p.id) || 0) % keys.length;
  const rot = [...keys.slice(start), ...keys.slice(0, start)];
  const now = Date.now(), ready = rot.filter((k) => !((keyState.get(k)?.until || 0) > now));
  return [...ready, ...rot.filter((k) => !ready.includes(k))];   // limited keys are still tried, just last
}
// rate limit: rest 1, 2, 4 ... min (max 1 h); rejected key: rest 6 h
function keyFailed(key, status) {
  const s = keyState.get(key) || { fails: 0 };
  s.fails++;
  s.until = Date.now() + (status === 429 ? Math.min(60e3 * 2 ** (s.fails - 1), 3600e3) : 6 * 3600e3);
  keyState.set(key, s);
}
function keyWorked(p, key) {
  if (key) keyState.delete(key);
  const keys = lastKeys.get(p.id);
  if (!keys || keys.length < 2) return;
  const i = key ? keys.indexOf(key) : (nextStart.get(p.id) || 0) % keys.length;
  nextStart.set(p.id, (i + 1) % keys.length);   // next request starts with the following key
}

module.exports = function createProviders({ net }) {
  const fetchFn = (url, init) => net.fetch(url, init);   // Chromium network stack: honours the app proxy

  // ------------------------------------------------------------ helpers
  async function readStream(body, onChunk) {
    const reader = body.getReader(), dec = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      onChunk(dec.decode(value, { stream: true }));
    }
  }
  // Server-sent events: calls onData(json) for every "data:" line
  async function readSSE(body, onData) {
    let buf = '';
    await readStream(body, (chunk) => {
      buf += chunk;
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        try { onData(JSON.parse(data)); } catch { }
      }
    });
  }
  // strict user/assistant alternation, starting with user (Claude requires it)
  function alternate(history) {
    const out = [];
    for (const h of history || []) {
      const role = h.role === 'user' ? 'user' : 'assistant';
      if (!out.length && role === 'assistant') continue;
      if (out.length && out[out.length - 1].role === role) out[out.length - 1].text += '\n\n' + h.text;
      else out.push({ role, text: h.text });
    }
    if (out.length && out[out.length - 1].role === 'user') out.pop();   // the new user turn comes next
    return out;
  }

  // ------------------------------------------------------------ Gemini
  async function askGemini(p, req, keys, onText) {
    const models = [p.model, 'gemini-2.5-flash', 'gemini-2.5-flash-lite'].filter((m, i, a) => m && a.indexOf(m) === i);
    if (p.mode !== 'direct') {
      // relay is single-turn and caps the system prompt at 20k chars: fold in the newest turns that fit
      let budget = 19000 - req.system.length, hist = '';
      for (const h of [...(req.history || [])].reverse()) {
        const line = `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text}\n`;
        if (line.length > budget) break;
        hist = line + hist; budget -= line.length;
      }
      const res = await fetchFn(p.relayUrl || PRESETS.gemini.relayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Gemini-Key': keys.join(',') },   // relay rotates keys on 429
        body: JSON.stringify({
          system: req.system + (hist ? `\n\n--- Conversation so far ---\n${hist.trim()}` : ''),
          type: req.audio ? 'audio' : 'text',
          payload: req.audio || req.text || '(see attached file)',
          images: req.files || [], models, max_output_tokens: 4096, temperature: 0.6,
        }),
      });
      if (res.status === 429) {   // the relay already tried every key we sent
        keys.forEach((k) => keyFailed(k, 429));
        throw new KeyError(keys.length > 1 ? `All ${keys.length} Gemini keys hit their free limit. Wait a while or add more keys.` : 'Gemini free quota is used up (or the key was revoked). Wait a while or add another key.');
      }
      if (res.status === 401) throw new KeyError('Gemini rejected the API key.');
      if (!res.ok) throw new Error(`Relay ${res.status}: ${(await res.text()).slice(0, 300)}`);
      let full = '';
      await readStream(res.body, (t) => { full += t; onText(t); });
      keyWorked(p, null);
      return full;
    }
    const contents = (req.history || []).map((h) => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.text }] }));
    const parts = [];
    if (req.audio) parts.push({ inlineData: { mimeType: 'audio/wav', data: req.audio } });
    for (const f of req.files || []) parts.push({ inlineData: f });
    if (req.text) parts.push({ text: req.text });
    contents.push({ role: 'user', parts });
    let lastErr = '';
    for (const model of models) for (const key of keys) {
      const res = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: req.system }] }, contents, generationConfig: { temperature: 0.6, maxOutputTokens: 4096 } }),
      });
      if ([429, 404, 400, 403].includes(res.status)) {
        if (res.status === 429 || res.status === 403) keyFailed(key, res.status);
        lastErr = `${model} ${mask(key)}: ${res.status}`; continue;
      }
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
      let full = '';
      await readSSE(res.body, (j) => {
        const t = (j.candidates?.[0]?.content?.parts || []).map((x) => x.text || '').join('');
        if (t) { full += t; onText(t); }
      });
      keyWorked(p, key);
      return full;
    }
    throw new KeyError('Gemini: all keys/models failed (' + lastErr + ').');
  }

  // ------------------------------------------------------------ OpenAI-compatible
  async function askOpenAI(p, req, keys, onText) {
    if (!p.baseUrl) throw new Error('Set the API base URL for this provider in Settings.');
    if (!p.model) throw new Error(`Choose a model for ${p.name} in Settings (click "Load models").`);
    const content = [];
    for (const f of req.files || []) {
      if (f.mimeType === 'application/pdf') content.push({ type: 'file', file: { filename: 'document.pdf', file_data: `data:application/pdf;base64,${f.data}` } });
      else content.push({ type: 'image_url', image_url: { url: `data:${f.mimeType};base64,${f.data}` } });
    }
    content.push({ type: 'text', text: req.text || '(see attached file)' });
    const messages = [{ role: 'system', content: req.system },
      ...(req.history || []).map((h) => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.text })),
      { role: 'user', content: content.length === 1 ? content[0].text : content }];
    const url = p.baseUrl.replace(/\/+$/, '') + '/chat/completions';
    for (const key of keys.length ? keys : ['']) {
      const headers = { 'Content-Type': 'application/json' };
      if (key) headers.Authorization = `Bearer ${key}`;
      if (/openrouter\.ai/.test(url)) { headers['HTTP-Referer'] = 'https://github.com/minhtawlwe-svg/officeauto-pip'; headers['X-Title'] = 'OfficeAuto Pip'; }
      let res;
      try { res = await fetchFn(url, { method: 'POST', headers, body: JSON.stringify({ model: p.model, messages, stream: true }) }); }
      catch (e) { throw new Error(`Can't reach ${p.name} (${e.message}).` + (p.preset === 'ollama' ? ' Is Ollama running?' : '')); }
      if ([401, 403, 429].includes(res.status)) {
        if (key) keyFailed(key, res.status);
        if (keys.length > 1) continue;
        throw new KeyError(`${p.name} ${res.status}: ${(await res.text()).slice(0, 200)}`);
      }
      if (!res.ok) throw new Error(`${p.name} ${res.status}: ${(await res.text()).slice(0, 300)}`);
      let full = '';
      await readSSE(res.body, (j) => { const t = j.choices?.[0]?.delta?.content; if (t) { full += t; onText(t); } });
      keyWorked(p, key);
      return full;
    }
    throw new KeyError(`${p.name}: every key was rejected or out of quota.`);
  }

  // ------------------------------------------------------------ Claude (official SDK)
  // Claude Opus 5.5 / 5, Fable 5.1 and Sonnet 5.5 support server-side refusal fallbacks ("default" routing).
  const FALLBACK_MODELS = /^claude-(opus-5-5|opus-5|fable-5-1|sonnet-5-5)$/;
  const EFFORT_MODELS = /^claude-(opus|sonnet|haiku|fable)-5/;
  async function askClaude(p, req, keys, onText) {
    const sdk = require('@anthropic-ai/sdk');
    const Anthropic = sdk.default || sdk;
    const blocks = [];
    for (const f of req.files || []) {
      if (f.mimeType === 'application/pdf') blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.data } });
      else blocks.push({ type: 'image', source: { type: 'base64', media_type: f.mimeType, data: f.data } });
    }
    blocks.push({ type: 'text', text: req.text || '(see attached file)' });
    const messages = [...alternate(req.history).map((h) => ({ role: h.role, content: h.text })), { role: 'user', content: blocks }];
    const model = p.model || PRESETS.claude.model;
    const params = { model, max_tokens: 16000, system: req.system, messages };
    if (EFFORT_MODELS.test(model)) params.output_config = { effort: 'medium' };   // chat assistant: balanced speed/quality
    for (const key of keys) {
      const client = new Anthropic({ apiKey: key, fetch: fetchFn, maxRetries: 1 });
      try {
        const stream = FALLBACK_MODELS.test(model)
          ? client.beta.messages.stream({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
          : client.messages.stream(params);
        let full = '';
        for await (const ev of stream) {
          if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') { full += ev.delta.text; onText(ev.delta.text); }
        }
        const msg = await stream.finalMessage();
        if (msg.stop_reason === 'refusal') throw new Error('Claude declined this request' + (msg.stop_details?.explanation ? `: ${msg.stop_details.explanation}` : '.'));
        keyWorked(p, key);
        return full;
      } catch (e) {
        if (e instanceof Anthropic.AuthenticationError) { keyFailed(key, 401); if (keys.length > 1) continue; throw new KeyError('Claude rejected the API key.'); }
        if (e instanceof Anthropic.PermissionDeniedError) throw new KeyError('Claude: this key has no access (' + e.message + ').');
        if (e instanceof Anthropic.RateLimitError) { keyFailed(key, 429); if (keys.length > 1) continue; throw new KeyError('Claude rate limit / credit exhausted. Try again later.'); }
        if (e instanceof Anthropic.NotFoundError) throw new Error(`Claude model "${model}" not found - pick another in Settings.`);
        if (e instanceof Anthropic.APIConnectionError) throw new Error("Can't reach Claude (network blocked? try the Proxy setting).");
        throw e;
      }
    }
    throw new KeyError('Claude: every key failed.');
  }

  // ------------------------------------------------------------ public API
  function askOne(p, req, onText, keysOverride) {
    const keys = keysOverride || orderKeys(p, keysOf(p).keys);
    const preset = PRESETS[p.preset] || {};
    if (!keys.length && !preset.noKey) throw new KeyError(`No API key for ${p.name}. Add one in Settings.`);
    if (req.audio && p.type !== 'gemini') throw new Error('Voice needs a Gemini provider.');
    if (p.type === 'gemini') return askGemini(p, req, keys, onText);
    if (p.type === 'claude') return askClaude(p, req, keys, onText);
    return askOpenAI(p, req, keys, onText);
  }

  // Tries the active provider first; with fallback on, the other providers in order.
  // Voice always goes to a Gemini provider (the others can't take audio).
  async function ask(providers, activeId, fallback, req, onText) {
    let list = [...providers].sort((a, b) => (a.id === activeId ? -1 : b.id === activeId ? 1 : 0));
    if (req.audio) list = list.filter((p) => p.type === 'gemini');
    if (!fallback && !req.audio) list = list.slice(0, 1);
    list = list.filter((p, i) => i === 0 || usable(p));
    if (!list.length) throw new Error(req.audio ? 'Voice needs a Google Gemini provider (free key) - add one in Settings → AI providers.' : 'No AI provider set up - open Settings → AI providers.');
    const errors = [];
    for (const p of list) {
      let streamed = false;
      try {
        const text = await askOne(p, req, (t) => { streamed = true; onText(t); });
        return { text, provider: p.name, fellBack: p !== list[0], errors };
      } catch (e) {
        errors.push(`${p.name}: ${e.message}`);
        if (streamed) break;   // half an answer already shown - don't mix providers
      }
    }
    throw new Error(errors.join('\n'));
  }

  async function test(p, keysText) {
    const typed = parseKeys(keysText);
    const keys = typed.length ? typed : keysOf(p).keys;
    const preset = PRESETS[p.preset] || {};
    const runs = keys.length ? keys.map((k) => [k]) : preset.noKey ? [[]] : [];
    if (!runs.length) return [{ key: '-', ok: false, msg: 'No key to test - paste one first.' }];
    const out = [];
    for (const ks of runs) {
      const t0 = Date.now();
      try {
        const r = await askOne(p, { system: 'Reply with exactly: OK', text: 'ping', history: [] }, () => { }, ks);
        out.push({ key: ks[0] ? mask(ks[0]) : 'local', ok: true, msg: `works (${((Date.now() - t0) / 1000).toFixed(1)}s): ${String(r).trim().slice(0, 20)}` });
      } catch (e) { out.push({ key: ks[0] ? mask(ks[0]) : 'local', ok: false, msg: String(e.message).slice(0, 160) }); }
    }
    return out;
  }

  async function listModels(p, keysText) {
    const typed = parseKeys(keysText);
    const key = typed[0] || keysOf(p).keys[0];
    try {
      if (p.type === 'gemini') {
        if (!key) return [];
        const res = await fetchFn('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key } });
        if (!res.ok) return ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'];   // relay users: Google itself may be blocked
        const j = await res.json();
        return (j.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent') && /gemini/.test(m.name)).map((m) => m.name.replace('models/', ''));
      }
      if (p.type === 'claude') {
        if (!key) return ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'];
        const sdk = require('@anthropic-ai/sdk'); const Anthropic = sdk.default || sdk;
        const client = new Anthropic({ apiKey: key, fetch: fetchFn, maxRetries: 1 });
        const ids = [];
        for await (const m of client.models.list()) ids.push(m.id);
        return ids;
      }
      const headers = key ? { Authorization: `Bearer ${key}` } : {};
      const res = await fetchFn(p.baseUrl.replace(/\/+$/, '') + '/models', { headers });
      if (!res.ok) return [];
      const j = await res.json();
      return (j.data || j.models || []).map((m) => m.id || m.name).filter(Boolean).sort();
    } catch { return []; }
  }

  return { PRESETS, parseKeys, mask, keysOf, usable, ask, test, listModels };
};
