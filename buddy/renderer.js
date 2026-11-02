// Pip renderer: character, chat, voice, file summary, daily report, OfficeAuto tasks.
const $ = (s) => document.querySelector(s);
const pipEl = $('#pip'), panel = $('#panel'), log = $('#log'), input = $('#input'), hint = $('#hint');

const TASK_LABELS = {
  Organize: 'Tidy Downloads', Backup: 'Backup Documents + Desktop', CleanTemp: 'Clean old temp files',
  Morning: 'Morning start', DailyNote: "Open today's note", ToPdf: 'Convert folder to PDF', Duplicates: 'Find duplicate files',
};
const FOLDER_TASKS = ['ToPdf', 'Duplicates'];
// programs Pip may open (names must match main.js APPS)
const APPS = { excel: 1, word: 1, powerpoint: 1, outlook: 1, notepad: 1, calculator: 1, explorer: 1, edge: 1, chrome: 1, teams: 1, paint: 1, snip: 1 };
const TAG_RE = /\[\[(RUN|OPEN|APP):[^\]]*\]\]/g;

let settings = {}, history = [], attachment = null, busy = false, reqSeq = 0;
let streamTarget = null, streamText = '';

// ---------------------------------------------------------------- moods
let moodTimer = null, lastActive = Date.now();
function mood(m, ms) {
  pipEl.className = 'hit ' + m;
  clearTimeout(moodTimer);
  if (ms) moodTimer = setTimeout(() => mood('idle'), ms);
}
setInterval(() => {
  if (!busy && !speechSynthesis.speaking && Date.now() - lastActive > 5 * 60 * 1000 && !pipEl.classList.contains('sleep')) mood('sleep');
}, 15000);
function wake() { lastActive = Date.now(); if (pipEl.classList.contains('sleep')) mood('happy', 1200); }

function say(text, ms = 6000) {          // small speech bubble when the panel is closed
  if (!panel.classList.contains('hidden')) return;
  hint.textContent = text; hint.classList.remove('hidden');
  clearTimeout(say.t); say.t = setTimeout(() => hint.classList.add('hidden'), ms);
}
hint.onclick = () => { hint.classList.add('hidden'); openPanel(); };

// ---------------------------------------------------------------- click-through + drag
let overHit = null, drag = null;
document.addEventListener('mousemove', (e) => {
  if (drag) {
    const dx = e.screenX - drag.sx, dy = e.screenY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) > 4) { drag.moved = true; pipEl.classList.add('drag'); }
    if (drag.moved) window.pip.moveWindow(drag.wx + dx, drag.wy + dy);
    return;
  }
  const hit = !!e.target.closest('.hit');
  if (hit !== overHit) { overHit = hit; window.pip.ignoreMouse(!hit); }
  if (hit) wake();
});
pipEl.addEventListener('mousedown', async (e) => {
  if (e.button !== 0) return;
  const [wx, wy] = await window.pip.windowPos();
  drag = { sx: e.screenX, sy: e.screenY, wx, wy, moved: false };
});
document.addEventListener('mouseup', () => {
  if (!drag) return;
  const wasClick = !drag.moved;
  drag = null; pipEl.classList.remove('drag');
  if (wasClick) togglePanel();
});

function openPanel() { panel.classList.remove('hidden'); hint.classList.add('hidden'); setTimeout(() => input.focus(), 50); }
function togglePanel() { if (panel.classList.contains('hidden')) { openPanel(); mood('happy', 1200); } else panel.classList.add('hidden'); }
$('#btnClose').onclick = () => panel.classList.add('hidden');
window.pip.onOpen((what) => { openPanel(); if (what === 'settings') openSettings(); });

// ---------------------------------------------------------------- tiny markdown renderer
function esc(s) { return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function md(src) {
  const blocks = String(src).split(/```/);
  return blocks.map((b, i) => {
    if (i % 2) return '<pre><code>' + esc(b.replace(/^\w*\n/, '')) + '</code></pre>';
    let html = '', inList = false;
    for (const raw of esc(b).split('\n')) {
      let line = raw.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
      const li = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)/);
      if (li) { if (!inList) { html += '<ul>'; inList = true; } html += '<li>' + li[1] + '</li>'; continue; }
      if (inList) { html += '</ul>'; inList = false; }
      const h = line.match(/^#{1,4}\s+(.*)/);
      html += h ? '<h4>' + h[1] + '</h4>' : (line.trim() ? line + '<br>' : '<br>');
    }
    return html + (inList ? '</ul>' : '');
  }).join('').replace(/(<br>){3,}/g, '<br><br>');
}

function addMsg(kind, html) {
  const el = document.createElement('div');
  el.className = 'msg ' + kind; el.innerHTML = html;
  log.appendChild(el); log.scrollTop = log.scrollHeight;
  return el;
}
const sys = (t) => addMsg('sys', esc(t));
const errMsg = (t) => { addMsg('err', esc(t)); mood('worried', 3000); };

// ---------------------------------------------------------------- system prompt
function systemPrompt(extra = '') {
  const now = new Date();
  const lang = settings.replyLang === 'my' ? 'Always reply in Burmese (Myanmar script); keep technical terms in English.'
    : settings.replyLang === 'en' ? 'Always reply in English.'
    : 'Reply in the same language the user writes or speaks (English or Burmese).';
  return [
    'You are Pip, a friendly, upbeat little desktop assistant who lives above the Windows taskbar and helps an office worker get through the day.',
    `Today is ${now.toDateString()}, local time ${now.toLocaleTimeString()}.` + (settings.userName ? ` The user's name is ${settings.userName}.` : ''),
    'You help with: writing and polishing emails, messages and reports; Excel/Word/PowerPoint how-tos and formulas; summarizing documents; translating; planning the day; explaining errors. Be practical and concise: short paragraphs and bullet lists, no long preambles. Use light markdown (bold, bullets, code blocks for formulas/scripts).',
    lang,
    'You can also trigger these automations on the user\'s PC. When the user clearly asks for one, add ONE tag on its own line: ' +
      Object.entries(TASK_LABELS).map(([k, v]) => `[[RUN:${k}]] (${v})`).join(', ') +
      '. The user must click to confirm, so never claim the task already ran.',
    'To open a website, add a tag on its own line: [[OPEN:https://full-url]] (e.g. YouTube = [[OPEN:https://www.youtube.com]]; for a search use the site\'s search URL, e.g. [[OPEN:https://www.youtube.com/results?search_query=lofi+music]]). ' +
      `To open a program, add [[APP:name]] where name is one of: ${Object.keys(APPS).join(', ')}. ` +
      'These open immediately, so say "Opening ..." in one short sentence.',
    'Be honest about your limits: you cannot click inside other apps, read the screen, send emails or messages yourself, or control programs beyond opening them. If asked for something you cannot do, say so plainly and suggest the closest thing you can do. Never pretend you tried.',
    'If the input is a voice recording: line 1 is "HEARD: <exactly what the user said>" and nothing else (no reply, no tags on that line). Then a NEW line with your reply and any tags. Example:\nHEARD: open Facebook\nOpening Facebook.\n[[OPEN:https://www.facebook.com]]\nIf the recording has no clear speech, reply only "HEARD: (nothing)".',
    extra,
  ].filter(Boolean).join('\n');
}

// ---------------------------------------------------------------- ask Gemini
window.pip.onChunk(({ id, text }) => {
  if (!streamTarget || id !== reqSeq) return;
  streamText += text;
  const shown = streamText.replace(/^HEARD:.*\n?/, '').replace(TAG_RE, '');
  streamTarget.classList.remove('typing');
  streamTarget.innerHTML = md(shown);
  log.scrollTop = log.scrollHeight;
  if (!speechSynthesis.speaking) mood('talk');
});

async function askAI({ text = '', audio = null, display = null, extraSystem = '', tools = null }) {
  if (busy) return;
  busy = true; wake();
  const files = [];
  let userText = text;
  if (attachment) {
    if (attachment.inline) files.push(attachment.inline);
    else userText = `[Attached file: ${attachment.name}]\n"""\n${attachment.text}\n"""\n\n${text}`;
  }
  if (display !== false && !audio) addMsg('user', esc(display || text) + (attachment ? `<br><small>&#128206; ${esc(attachment.name)}</small>` : ''));
  const voiceEl = audio ? addMsg('user', '&#127908; <i>listening...</i>') : null;
  const usedAttachment = attachment; clearAttachment();

  const id = ++reqSeq;
  streamText = '';
  streamTarget = addMsg('pip typing', '');
  mood('think');
  const res = await window.pip.ask({ id, system: systemPrompt(extraSystem), history: history.slice(-12), text: userText, audio, files });
  busy = false;
  const target = streamTarget; streamTarget = null;

  if (!res.ok) { target.remove(); if (voiceEl) voiceEl.remove(); errMsg(res.error); return null; }
  const raw = res.text || streamText;
  // action tags count wherever the model put them - even on the HEARD line
  const tasks = [...raw.matchAll(/\[\[RUN:(\w+)\]\]/g)].map((m) => m[1]).filter((t) => TASK_LABELS[t]);
  const opens = [...raw.matchAll(/\[\[(OPEN|APP):([^\]]+)\]\]/g)].map((m) => ({ kind: m[1], target: m[2].trim() }));
  let answer = raw, heard = '';
  const hm = raw.match(/^\s*HEARD:\s*(.*)\n?/);
  if (hm) { heard = hm[1].replace(TAG_RE, '').trim(); answer = raw.slice(hm[0].length); }
  answer = answer.replace(TAG_RE, '').trim();
  if (voiceEl) {
    if ((!heard || /^\(nothing\)$/i.test(heard)) && !opens.length && !tasks.length) { voiceEl.remove(); target.remove(); say("I didn't catch that - try again?"); sys("Didn't hear any speech."); mood('worried', 2000); return null; }
    voiceEl.innerHTML = '&#127908; ' + esc(heard || '(voice)');
  }
  if (!answer) answer = opens.length || tasks.length ? '\u{1F44D}' : heard;   // model squeezed everything onto the HEARD line
  for (const o of opens.slice(0, 3)) {
    const r = o.kind === 'OPEN' ? await window.pip.openUrl(o.target) : await window.pip.openApp(o.target);
    if (r.ok) sys('↗ Opened ' + r.label); else errMsg(r.error);
  }
  target.classList.remove('typing');
  target.innerHTML = md(answer);
  addTools(target, answer, tools);
  for (const t of [...new Set(tasks)]) {
    const b = document.createElement('button');
    b.className = 'action'; b.textContent = '\u25B6 Run: ' + TASK_LABELS[t];
    b.onclick = () => { b.disabled = true; runTask(t); };
    target.appendChild(document.createElement('br')); target.appendChild(b);
  }
  log.scrollTop = log.scrollHeight;

  const histUser = heard || (usedAttachment ? `[file ${usedAttachment.name}] ${text}` : text);
  history.push({ role: 'user', text: histUser.slice(0, 4000) }, { role: 'model', text: answer.slice(0, 4000) });
  if (panel.classList.contains('hidden')) say(answer.replace(/[#*`]/g, '').slice(0, 140) + (answer.length > 140 ? '...' : ''), 9000);
  speak(answer);
  return answer;
}

function addTools(el, text, extra) {
  const bar = document.createElement('div'); bar.className = 'msgTools';
  const copy = document.createElement('button'); copy.textContent = 'Copy';
  copy.onclick = () => { window.pip.copy(text); copy.textContent = 'Copied'; setTimeout(() => (copy.textContent = 'Copy'), 1200); };
  bar.appendChild(copy);
  for (const [label, fn] of Object.entries(extra || {})) {
    const b = document.createElement('button'); b.textContent = label; b.onclick = () => fn(text); bar.appendChild(b);
  }
  el.appendChild(bar);
}

// ---------------------------------------------------------------- text-to-speech
let voices = [];
function loadVoices() {
  voices = speechSynthesis.getVoices();
  const sel = $('#sVoice'); sel.innerHTML = '<option value="">Default</option>';
  for (const v of voices) { const o = document.createElement('option'); o.value = v.name; o.textContent = `${v.name} (${v.lang})`; sel.appendChild(o); }
  sel.value = settings.voice || '';
}
speechSynthesis.onvoiceschanged = loadVoices;

function speak(text) {
  speechSynthesis.cancel();
  if (!settings.speak) { mood('happy', 1500); return; }
  const plain = text.replace(/```[\s\S]*?```/g, ' (code shown on screen) ').replace(/[#*`>_|]/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, '').slice(0, 900);
  const burmese = /[\u1000-\u109F]/.test(plain);
  let voice = voices.find((v) => v.name === settings.voice);
  if (burmese) voice = voices.find((v) => /^my/i.test(v.lang));
  if (burmese && !voice) { mood('happy', 1500); return; }   // no Burmese voice installed on Windows: show text only
  const u = new SpeechSynthesisUtterance(plain);
  if (voice) u.voice = voice;
  u.rate = 1.05;
  u.onstart = () => mood('talk');
  u.onend = u.onerror = () => mood('idle');
  speechSynthesis.speak(u);
}

// ---------------------------------------------------------------- chat input
$('#form').addEventListener('submit', (e) => {
  e.preventDefault();
  const t = input.value.trim();
  if (!t && !attachment) return;
  input.value = ''; input.style.height = '';
  askAI({ text: t || 'Summarize this file.' });
});
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#form').requestSubmit(); }
  if (e.key === 'Escape') speechSynthesis.cancel();
});
input.addEventListener('input', () => { input.style.height = ''; input.style.height = Math.min(input.scrollHeight, 90) + 'px'; });

// ---------------------------------------------------------------- attachments + summarize
async function attachPath(p) {
  const r = await window.pip.readFile(p);
  if (!r.ok) { errMsg(r.error); return false; }
  attachment = r;
  $('#attachName').textContent = '\u{1F4CE} ' + r.name;
  $('#attach').classList.remove('hidden');
  return true;
}
function clearAttachment() { attachment = null; $('#attach').classList.add('hidden'); }
$('#attachX').onclick = clearAttachment;
$('#btnFile').onclick = async () => { const p = await window.pip.pickFile(); if (p) attachPath(p); };

const SUMMARY_ASK = 'Summarize this file for a busy office worker:\n1. **TL;DR** (2 sentences)\n2. **Key points** (bullets)\n3. **Action items / deadlines / numbers to remember**\n4. **Suggested reply or next step** (if relevant)';
async function summarizePath(p) {
  openPanel();
  if (await attachPath(p)) askAI({ text: SUMMARY_ASK, display: 'Summarize ' + attachment.name });
}
$('#btnSummarize').onclick = async () => { const p = await window.pip.pickFile(); if (p) summarizePath(p); };

// drag a file from Explorer onto Pip or the panel
const dropEl = $('#drop');
document.addEventListener('dragover', (e) => { e.preventDefault(); window.pip.ignoreMouse(false); dropEl.classList.remove('hidden'); mood('listen'); });
document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) { dropEl.classList.add('hidden'); mood('idle'); } });
document.addEventListener('drop', (e) => {
  e.preventDefault(); dropEl.classList.add('hidden');
  const f = e.dataTransfer.files[0];
  if (f) summarizePath(window.pip.pathOf(f)); else mood('idle');
});

// ---------------------------------------------------------------- OfficeAuto tasks
async function runTask(task) {
  let folder = null;
  if (FOLDER_TASKS.includes(task)) { folder = await window.pip.pickFolder(); if (!folder) return; }
  if (task === 'CleanTemp' && !confirm('Delete temp files older than 7 days? (Files in use are skipped.)')) return;
  openPanel();
  sys('Running: ' + TASK_LABELS[task] + '...');
  mood('think');
  document.querySelectorAll('#chips button[data-task]').forEach((b) => (b.disabled = true));
  const r = await window.pip.runTask(task, folder);
  document.querySelectorAll('#chips button[data-task]').forEach((b) => (b.disabled = false));
  const lastLine = (r.out || '').split('\n').filter(Boolean).pop() || '';
  const clean = lastLine.replace(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\s+/, '');
  if (r.ok) { sys('\u2714 ' + (clean || 'Done')); mood('happy', 1800); say('Done! ' + clean.slice(0, 100)); }
  else errMsg('Task failed: ' + (r.out || 'unknown error'));
}
document.querySelectorAll('#chips button[data-task]').forEach((b) => (b.onclick = () => runTask(b.dataset.task)));

// ---------------------------------------------------------------- AI daily report
async function dailyReport() {
  openPanel();
  const note = await window.pip.todayNote();
  if (!note.ok || !/\S/.test(note.text.replace(/^#.*$/gm, '').replace(/- \[ \]\s*$/gm, '').replace(/^- $/gm, ''))) {
    sys("Today's note is empty or missing. I'll open it - jot what you did, save, then click Daily report again.");
    runTask('DailyNote');
    return;
  }
  const ask = 'Turn my daily note below into a polished end-of-day report email for my manager.\n' +
    'Format: first line "Subject: Daily Report - <date>", then a greeting, then sections **Completed today**, **In progress**, **Blockers / help needed**, **Plan for tomorrow** (use unchecked to-dos), then a short sign-off' +
    (settings.userName ? ` from ${settings.userName}` : '') + '. Keep it factual, do not invent work that is not in the note. Ticked "- [x]" items are done.\n\n' +
    'DAILY NOTE:\n"""\n' + note.text + '\n"""';
  await askAI({
    text: ask, display: "Write today's report from my daily note",
    tools: {
      'Email draft': (t) => {
        const m = t.match(/^\s*\**Subject:\**\s*(.*)$/m);
        window.pip.mailDraft(m ? m[1].replace(/\*/g, '') : 'Daily Report', t.replace(/^\s*\**Subject:.*$/m, '').replace(/\*\*/g, '').trim());
      },
    },
  });
}
$('#btnReport').onclick = dailyReport;

// ---------------------------------------------------------------- voice input (push-to-talk)
let rec = null;
async function startRec() {
  if (rec || busy) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    const chunks = [];
    proc.onaudioprocess = (e) => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    src.connect(proc); proc.connect(ctx.destination);
    speechSynthesis.cancel();
    rec = { stream, ctx, proc, chunks, timer: setTimeout(stopRec, 30000) };
    $('#btnMic').classList.add('rec'); mood('listen');
    say('Listening... (click mic or Ctrl+Alt+V to stop)', 30000);
  } catch (err) { errMsg('Microphone not available: ' + err.message); }
}
async function stopRec() {
  if (!rec) return;
  const { stream, ctx, proc, chunks, timer } = rec; rec = null;
  clearTimeout(timer); proc.disconnect(); stream.getTracks().forEach((t) => t.stop());
  $('#btnMic').classList.remove('rec'); hint.classList.add('hidden');
  const rate = ctx.sampleRate; ctx.close();
  const pcm = downsample(concat(chunks), rate, 16000);
  const rms = Math.sqrt(pcm.reduce((s, v) => s + v * v, 0) / (pcm.length || 1));
  if (pcm.length < 16000 * 0.4 || rms < 0.004) { mood('worried', 1500); say("I didn't hear anything."); return; }   // skip silence: avoids hallucinated transcripts
  openPanel();
  askAI({ audio: wavBase64(pcm, 16000) });
}
$('#btnMic').onclick = () => (rec ? stopRec() : startRec());
window.pip.onPushToTalk(() => (rec ? stopRec() : startRec()));

function concat(chunks) { const n = chunks.reduce((s, c) => s + c.length, 0), out = new Float32Array(n); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; } return out; }
function downsample(buf, from, to) {
  if (from === to) return buf;
  const ratio = from / to, out = new Float32Array(Math.floor(buf.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const s = Math.floor(i * ratio), e = Math.min(Math.floor((i + 1) * ratio), buf.length);
    let sum = 0; for (let j = s; j < e; j++) sum += buf[j];
    out[i] = sum / Math.max(1, e - s);
  }
  return out;
}
function wavBase64(pcm, rate) {
  const buf = new ArrayBuffer(44 + pcm.length * 2), v = new DataView(buf);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true);
  let bin = ''; const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

// ---------------------------------------------------------------- settings
function syncModeRows() {
  const direct = $('#sMode').value === 'direct';
  document.querySelectorAll('.directOnly').forEach((e) => e.classList.toggle('hidden', !direct));
  document.querySelectorAll('.relayOnly').forEach((e) => e.classList.toggle('hidden', direct));
}
function showKeyStatus() {
  $('#keyStatus').textContent = settings.hasKey
    ? `\u2714 ${settings.keyCount} key(s) from ${settings.keyFrom}: ${settings.keyMasks.join(', ')}`
    : 'No key yet. Paste one above, or put keys in buddy\\api-key.txt (one per line).';
}
async function openSettings() {
  $('#sKey').value = ''; $('#sKey').classList.remove('reveal'); $('#sShow').textContent = 'Show';
  $('#sKey').placeholder = settings.hasKey ? 'saved - leave empty to keep, or paste new key(s) to replace' : 'paste key - one per line to add several';
  showKeyStatus();
  $('#sAuto').checked = !!settings.autoStart;
  $('#sMode').value = settings.mode; $('#sRelay').value = settings.relayUrl; $('#sProxy').value = settings.proxy;
  $('#sModel').value = settings.model; $('#sLang').value = settings.replyLang; $('#sName').value = settings.userName;
  $('#sSpeak').checked = settings.speak; loadVoices();
  syncModeRows();
  $('#settings').classList.remove('hidden');
  const list = await window.pip.models();
  $('#modelList').innerHTML = list.map((m) => `<option value="${esc(m)}">`).join('');
}
$('#sMode').onchange = syncModeRows;
$('#sShow').onclick = () => { const r = $('#sKey').classList.toggle('reveal'); $('#sShow').textContent = r ? 'Hide' : 'Show'; };
$('#sClearKeys').onclick = async () => {
  if (!confirm('Remove the API keys saved in Pip?')) return;
  settings = await window.pip.setSettings({ apiKey: '' });
  showKeyStatus();
};
$('#sTest').onclick = async () => {
  const typed = $('#sKey').value.trim();
  if (!typed && !settings.hasKey) { $('#keyStatus').textContent = 'Paste a key first.'; return; }
  // test with the connection chosen on screen, even before Save
  settings = await window.pip.setSettings({ mode: $('#sMode').value, relayUrl: $('#sRelay').value.trim(), proxy: $('#sProxy').value.trim() });
  $('#sTest').disabled = true; $('#keyStatus').textContent = 'Testing...';
  const res = await window.pip.testKeys(typed);
  $('#sTest').disabled = false;
  $('#keyStatus').innerHTML = res.map((r) => `<span class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✔' : '✖'} ${esc(r.key)}: ${esc(r.msg)}</span>`).join('<br>')
    + (typed && res.some((r) => r.ok) ? '<br>Click <b>Save</b> to keep these keys.' : '');
};
window.pip.onSettingsChanged(async () => { settings = await window.pip.getSettings(); });
$('#btnSettings').onclick = openSettings;
$('#sCancel').onclick = () => $('#settings').classList.add('hidden');
$('#keyLink').onclick = (e) => { e.preventDefault(); window.open('https://aistudio.google.com/apikey'); };
$('#sSave').onclick = async () => {
  const patch = {
    mode: $('#sMode').value, relayUrl: $('#sRelay').value.trim(), proxy: $('#sProxy').value.trim(),
    model: $('#sModel').value.trim() || 'gemini-2.5-flash', replyLang: $('#sLang').value,
    userName: $('#sName').value.trim(), speak: $('#sSpeak').checked, voice: $('#sVoice').value,
    autoStart: $('#sAuto').checked,
  };
  if ($('#sKey').value.trim()) patch.apiKey = $('#sKey').value.trim();
  settings = await window.pip.setSettings(patch);
  $('#modelTag').textContent = settings.model + (settings.mode === 'relay' ? ' \u00B7 relay' : '');
  $('#settings').classList.add('hidden');
  sys('Settings saved.');
};

// ---------------------------------------------------------------- start-up + gentle nudges
(async () => {
  settings = await window.pip.getSettings();
  $('#modelTag').textContent = settings.model + (settings.mode === 'relay' ? ' \u00B7 relay' : '');
  loadVoices();
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  sys(`${greet}${settings.userName ? ', ' + settings.userName : ''}! Ask me anything, drop a file on me, or tap a button above.\nHotkeys: Ctrl+Alt+Space show/hide - Ctrl+Alt+V talk`);
  setTimeout(() => {
    mood('happy', 1500);
    say(settings.hasKey ? `${greet}! Click me if you need anything.` : "Hi, I'm Pip! Click me, then \u2699 to add your free Gemini key.", 8000);
  }, 800);
  if (!settings.hasKey) setTimeout(() => { openPanel(); openSettings(); }, 1500);

  const nudged = {};
  setInterval(() => {
    const d = new Date(), key = d.toDateString(), hm = d.getHours() * 60 + d.getMinutes();
    if (hm >= 17 * 60 + 15 && hm < 18 * 60 && !nudged[key + 'r']) { nudged[key + 'r'] = 1; mood('happy', 2000); say('Almost home time! Want me to write your daily report? Click me.', 20000); }
    if (hm >= 12 * 60 && hm < 12 * 60 + 5 && !nudged[key + 'l']) { nudged[key + 'l'] = 1; say('Lunch time - stretch and drink some water! \u{1F35C}', 10000); }
  }, 60000);
})();
