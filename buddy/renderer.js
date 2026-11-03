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
const TAG_RE = /\[\[(RUN|OPEN|APP|READ|REMIND|CLOSE|NEW):[^\]]*\]\]/g;

// spreadsheet loaded for analysis - stays loaded for follow-up questions
let data = null;   // { name, tables, text }

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
  if (!busy && !isSpeaking() && Date.now() - lastActive > 5 * 60 * 1000 && !pipEl.classList.contains('sleep')) {
    mood('sleep'); charSound('sleep'); say(charStyle().sleepy, 6000);
  }
}, 15000);
function wake() { lastActive = Date.now(); if (pipEl.classList.contains('sleep')) mood('happy', 1200); }

function say(text, ms = 6000) {          // small speech bubble when the panel is closed
  if (!panel.classList.contains('hidden')) return;
  hint.textContent = text; hint.classList.remove('hidden');
  clearTimeout(say.t); say.t = setTimeout(() => hint.classList.add('hidden'), ms);
}
hint.onclick = () => { hint.classList.add('hidden'); openPanel(); };

// ---------------------------------------------------------------- click-through + drag
// Dragging is done by the main process from the REAL cursor position (screen.getCursorScreenPoint):
// inside the moving window the page's own mouse coordinates lag behind, which made a drag look
// like a click. On release, main reports how far the cursor travelled: under 5 px = a click.
let overHit = null, dragging = false;
document.addEventListener('mousemove', (e) => {
  if (dragging) return;
  const hit = !!e.target.closest('.hit');
  if (hit !== overHit) { overHit = hit; window.pip.ignoreMouse(!hit); }
  if (hit) wake();
});
pipEl.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  dragging = true;
  pipEl.setPointerCapture(e.pointerId);
  window.pip.ignoreMouse(false);
  window.pip.dragStart();
});
async function endDrag(e, cancelled) {
  if (!dragging) return;
  dragging = false;
  try { pipEl.releasePointerCapture(e.pointerId); } catch { }
  const { moved } = await window.pip.dragEnd();
  pipEl.classList.remove('drag');
  if (!moved && !cancelled) togglePanel();
}
pipEl.addEventListener('pointerup', (e) => endDrag(e, false));
pipEl.addEventListener('pointercancel', (e) => endDrag(e, true));
window.pip.onDragMoved(() => pipEl.classList.add('drag'));
// ---- chat window: minimize, expand/restore, free resize from the top-left grip
let expanded = false;
async function toggleExpand() {
  expanded = !expanded;
  await window.pip.expand(expanded);
  $('#btnExpand').innerHTML = expanded ? '&#10529;' : '&#10530;';
  $('#btnExpand').title = expanded ? 'Restore size' : 'Expand';
  log.scrollTop = log.scrollHeight;
}
$('#btnExpand').onclick = toggleExpand;
$('#head').addEventListener('dblclick', (e) => { if (!e.target.closest('button')) toggleExpand(); });
$('#btnMin').onclick = () => { panel.classList.add('hidden'); say('Minimized - click me to open the chat again 💬', 3000); };
const grip = $('#grip');
grip.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  e.preventDefault(); e.stopPropagation();
  grip.setPointerCapture(e.pointerId);
  dragging = true; window.pip.ignoreMouse(false);
  window.pip.resizeStart();
});
const endResize = async (e) => {
  if (!dragging) return;
  dragging = false;
  try { grip.releasePointerCapture(e.pointerId); } catch { }
  await window.pip.resizeEnd();
  expanded = false; $('#btnExpand').innerHTML = '&#10530;';
  log.scrollTop = log.scrollHeight;
};
grip.addEventListener('pointerup', endResize);
grip.addEventListener('pointercancel', endResize);

// right-click the character = Settings
pipEl.addEventListener('contextmenu', (e) => { e.preventDefault(); openPanel(); openSettings(); });

function openPanel() { panel.classList.remove('hidden'); hint.classList.add('hidden'); setTimeout(() => input.focus(), 50); }
function togglePanel() { if (panel.classList.contains('hidden')) { openPanel(); mood('happy', 1200); charSound('hello'); } else panel.classList.add('hidden'); }
$('#btnClose').onclick = () => panel.classList.add('hidden');
window.pip.onOpen((what) => { openPanel(); if (what === 'settings') openSettings(); });

// ---------------------------------------------------------------- tiny markdown renderer
function esc(s) { return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function md(src) {
  const blocks = String(src).split(/```/);
  return blocks.map((b, i) => {
    if (i % 2) return '<pre><code>' + esc(b.replace(/^\w*\n/, '')) + '</code></pre>';
    let html = '', inList = false, tbl = [];
    const flushTable = () => {
      if (!tbl.length) return;
      const rows = tbl.filter((r) => !/^\s*\|?[\s:|-]+\|?\s*$/.test(r)).map((r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
      html += '<div class="tableWrap"><table class="dataTable">' + rows.map((r, i) => '<tr>' + r.map((c) => (i ? '<td>' : '<th>') + c + (i ? '</td>' : '</th>')).join('') + '</tr>').join('') + '</table></div>';
      tbl = [];
    };
    for (const raw of esc(b).split('\n')) {
      let line = raw.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
      if (/^\s*\|.*\|\s*$/.test(line)) { if (inList) { html += '</ul>'; inList = false; } tbl.push(line); continue; }
      flushTable();
      const li = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)/);
      if (li) { if (!inList) { html += '<ul>'; inList = true; } html += '<li>' + li[1] + '</li>'; continue; }
      if (inList) { html += '</ul>'; inList = false; }
      const h = line.match(/^#{1,4}\s+(.*)/);
      html += h ? '<h4>' + h[1] + '</h4>' : (line.trim() ? line + '<br>' : '<br>');
    }
    flushTable();
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
const errMsg = (t) => { addMsg('err', esc(t)); mood('worried', 3000); charSound('error'); };

// character personalities (private/extra characters can add their own entry)
const CHAR_PERSONAS = {
      bears: 'You are Mocha & Milk, a sweet bear couple (Mocha the brown bear, Milk the white bear) who live above the Windows taskbar and help an office worker through the day. Speak warmly as "we", with the occasional cute touch, but stay useful.',
      cat: 'You are Mango, a clever, slightly sassy orange cat who lives above the Windows taskbar and helps an office worker through the day. You may add a cat touch ("meow", purr) in about one reply out of five - never at the start of every reply. Stay sharp and useful.',
      dog: 'You are Kopi, a loyal, cheerful puppy who lives above the Windows taskbar and helps an office worker through the day. Be enthusiastic and encouraging; a "woof!" in about one reply out of five at most. Stay practical and useful.',
      capy: 'You are Capy, a famously calm capybara (with a yuzu on your head) who lives above the Windows taskbar and helps an office worker through the day. Stay relaxed and reassuring - nothing stresses you - while being clear and useful.',
      penguin: 'You are Pebble, a neat, organised little penguin in a red scarf who lives above the Windows taskbar and helps an office worker through the day. Be tidy, precise and friendly.',
    };

// ---------------------------------------------------------------- system prompt
const localStamp = (d) => {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`;
};
function systemPrompt(extra = '') {
  const now = new Date();
  const lang = settings.replyLang === 'my' ? 'Always reply in Burmese (Myanmar script); keep technical terms in English.'
    : settings.replyLang === 'en' ? 'Always reply in English.'
    : 'Reply in the same language the user writes or speaks (English or Burmese).';
  return [
    CHAR_PERSONAS[settings.character] || 'You are Pip, a friendly, upbeat little desktop assistant who lives above the Windows taskbar and helps an office worker get through the day.',
    `Today is ${now.toDateString()}, local time ${now.toLocaleTimeString()}.` + (settings.userName ? ` The user's name is ${settings.userName}.` : ''),
    'You help with: writing and polishing emails, messages and reports; Excel/Word/PowerPoint how-tos and formulas; summarizing documents; translating; planning the day; explaining errors. Be practical and concise: short paragraphs and bullet lists, no long preambles. Use light markdown (bold, bullets, code blocks for formulas/scripts).',
    lang,
    'You can also trigger these automations on the user\'s PC. When the user clearly asks for one, add ONE tag on its own line: ' +
      Object.entries(TASK_LABELS).map(([k, v]) => `[[RUN:${k}]] (${v})`).join(', ') +
      '. The user must click to confirm, so never claim the task already ran.',
    'To open a website, add a tag on its own line: [[OPEN:https://full-url]] (e.g. YouTube = [[OPEN:https://www.youtube.com]]; for a search use the site\'s search URL, e.g. [[OPEN:https://www.youtube.com/results?search_query=lofi+music]]). ' +
      `To open a program, add [[APP:name]] where name is one of: ${Object.keys(APPS).join(', ')}. ` +
      `To close a program, add [[CLOSE:name]] (same names except explorer) - it asks the program to close politely, so it may ask the user to save first. ` +
      'To create a NEW blank file, add [[NEW:excel]], [[NEW:word]] or [[NEW:powerpoint]] (this also opens the program - do not add [[APP:...]] too, and never output an empty table for it). ' +
      'These run immediately, so just say "Opening ..." / "Closing ..." in one short sentence.',
    (settings.speak !== false
      ? 'YOUR VOICE: your replies are read aloud to the user with a natural voice (Burmese and English), so you DO speak - never say you can only reply in text. Keep spoken replies short and natural.'
      : 'Reading replies aloud is turned off right now; the user can turn it on in Settings ("Read replies aloud").'),
    'Be honest about your limits: you cannot click inside other apps, read the screen, send emails or messages yourself, or control programs beyond opening and closing them. If asked for something you cannot do, say so plainly and suggest the closest thing you can do. Never pretend you tried. Never start your reply with "Pip:".',
    'TABLES: when the user wants a table, list or anything for Excel, output a fenced block ```table\n{"title":"Customers","columns":["Name","Phone","Amount"],"rows":[["Ko Aung","09...",150000]]}\n``` (numbers as numbers, dates YYYY-MM-DD). Pip shows it with an "Open in Excel" button. Small comparison tables in normal answers can be markdown tables.',
    'SLIDES: when the user wants a presentation/PowerPoint, output ```slides\n{"title":"...","subtitle":"...","slides":[{"title":"...","bullets":["..."],"notes":"..."}]}\n``` (5-10 slides, max 5 short bullets each). Write the slides in the language the user asked in (Burmese request = Burmese slides; keep each Burmese bullet short, under ~10 words). Pip builds a real PowerPoint file from it (Burmese gets the Myanmar Text font automatically).',
    `REMINDERS: you CAN set reminders. Add [[REMIND:YYYY-MM-DD HH:MM|short text]] on its own line, in local time (now: ${localStamp(now)}, ${now.toLocaleDateString('en-US', { weekday: 'long' })}). "in 30 minutes" = now + 30 min; "tomorrow morning" = tomorrow 09:00. Confirm in one short sentence.`,
    'Letters, memos, reports and minutes get an "Open in Word" button and emails (with a "Subject:" line) get an "Email draft" button automatically - so write them complete and ready to use.',
    'SPREADSHEETS: you CAN read the user\'s Excel/CSV data and draw charts. ' + (data
      ? `Data is loaded from "${data.name}":\n${dataSummary()}\n`
      : 'No data is loaded yet. If the user asks you to read, analyze or chart their Excel/data/spreadsheet, reply with one short sentence like "Let me read your Excel file." and then the tag [[READ:excel]] on its own line (never inside bold/quotes, never ask the user to type it) - Pip will load the workbook open in Excel (or ask the user to pick a file) and send you the data. Do not ask which chart they want first.\n') +
      'To draw a chart, output a fenced block exactly like:\n```chart\n{"type":"bar","title":"Sales by Region","sheet":"Sheet1","x":"Region","y":"Sales","agg":"sum","top":10}\n```\n' +
      'type: bar | hbar | line | pie | doughnut. x = category or date column (exact column name). y = numeric column name, or a list of names, or omit to count rows. agg: sum | avg | count | max | min. ' +
      'Optional "bucket":"day"|"month"|"year" when x holds dates (use line charts for trends over time). Optional "sort":"desc"|"asc"|"none". ' +
      'Add "excel":true when the user wants the chart in Excel too - Pip then adds a sheet with the numbers and a real Excel chart to their workbook. ' +
      'You may also chart a table you write yourself (e.g. sample data): output the ```table block, then a SEPARATE ```chart block whose "sheet" is that table\'s title - with "excel":true Pip builds a new workbook with the table and the chart. Always one JSON object per fenced block. ' +
      'Pip computes the exact numbers from ALL rows and shows them under the chart, so NEVER state totals or numbers you did not see in the data - describe patterns instead. If the user asks for "a good chart", pick the most useful one yourself (max 3 charts).',
    'If the input is a voice recording: line 1 is "HEARD: <exactly what the user said>" and nothing else (no reply, no tags on that line). Then a NEW line with your reply and any tags. Example:\nHEARD: open Facebook\nOpening Facebook.\n[[OPEN:https://www.facebook.com]]\nAnswer ONLY this new recording - earlier messages were already answered, never repeat them. ' +
      ({ my: 'The user speaks BURMESE (Myanmar language). Transcribe it in Myanmar script (Unicode), e.g. "HEARD: notepad ဖွင့်ပေး", even if the audio is not perfect - give your best guess. English words mixed in stay in English.',
        en: 'The user speaks English.' }[settings.voiceLang] ||
        'The user may speak Burmese (Myanmar language) or English, often mixed. Write Burmese speech in Myanmar script (Unicode). If the audio is unclear, give your best-guess transcript.') +
      ' Never output timestamps. Reply "HEARD: (nothing)" ONLY for pure silence or noise with no voice at all.',
    extra,
  ].filter(Boolean).join('\n');
}

// ---------------------------------------------------------------- ask Gemini
window.pip.onChunk(({ id, text }) => {
  if (!streamTarget || id !== reqSeq) return;
  streamText += text;
  const shown = streamText.replace(/^HEARD:.*\n?/, '').replace(TAG_RE, '')
    .replace(/```(chart|json|table|slides)[\s\S]*?(```|$)/g, (_, k) => ({ table: '\n\u{1F4CB} building table...\n', slides: '\n\u{1F39E} writing slides...\n' }[k] || '\n\u{1F4CA} drawing chart...\n'));
  streamTarget.classList.remove('typing');
  streamTarget.innerHTML = md(shown);
  log.scrollTop = log.scrollHeight;
  if (!isSpeaking()) mood('talk');
});

async function askAI({ text = '', audio = null, display = null, extraSystem = '', tools = null, afterRead = false, copyResult = false, autoPpt = false }) {
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
  if (res.fellBack) sys(`↪ Answered by ${res.provider} (${(res.errors[0] || '').split(':')[0]} didn't work)`);
  const raw = res.text || streamText;
  // action tags count wherever the model put them - even on the HEARD line
  const tasks = [...raw.matchAll(/\[\[RUN:(\w+)\]\]/g)].map((m) => m[1]).filter((t) => TASK_LABELS[t]);
  const opens = [...raw.matchAll(/\[\[(OPEN|APP|CLOSE|NEW):([^\]]+)\]\]/g)].map((m) => ({ kind: m[1], target: m[2].trim().toLowerCase() }));
  // safety net: the model said "Opening Excel." / "Closing Notepad." but forgot the tag
  if (!opens.length) {
    const said = raw.match(/(?:^|\n)\s*(Opening|Closing)\s+(?:the\s+)?([A-Za-z]+)\b/i);
    if (said && APPS[said[2].toLowerCase()]) opens.push({ kind: /^open/i.test(said[1]) ? 'APP' : 'CLOSE', target: said[2].toLowerCase() });
  }
  let answer = raw, heard = '';
  // if the model re-answered older turns, several HEARD lines appear: the LAST one is this recording
  const hms = [...raw.matchAll(/^\s*HEARD:\s*(.*)$/gm)];
  if (hms.length) {
    const last = hms[hms.length - 1];
    heard = last[1].replace(TAG_RE, '').trim();
    answer = raw.slice(last.index + last[0].length);
    if (/^[\d\s:.,\-၀-၉]*$/.test(heard)) heard = '';   // only timestamps / digits = no real speech
  }
  answer = answer.replace(TAG_RE, '').replace(/(\*\*|__|`|")\s*\1/g, '').trim();   // drop empty **...** left where a tag was
  if (voiceEl) {
    const nothing = !heard || /^\(nothing\)$/i.test(heard);
    if (nothing && !opens.length && !tasks.length && answer.trim().length < 3) {
      voiceEl.remove(); target.remove(); say("I didn't catch that - try again?"); mood('worried', 2000);
      const lv = lastVoice ? `mic level ${lastVoice.rms.toFixed(3)}, ${lastVoice.secs.toFixed(1)}s` : '';
      sys(`Didn't catch any words (${lv}; AI heard: "${hms.length ? hms[hms.length - 1][1].trim() : raw.trim().slice(0, 60)}").\n` +
        (lastVoice && lastVoice.rms < 0.02 ? 'Your voice is quiet - speak closer or pick another mic in Settings → Microphone.' : 'Try speaking a bit slower. For Burmese, set Settings → Voice language → Burmese.'));
      return null;
    }
    voiceEl.innerHTML = '&#127908; ' + esc(heard || '(voice)');
  }
  answer = answer.replace(/^\s*Pip:\s*/i, '');
  const ex = extractBlocks(answer);
  answer = ex.text + (ex.broken ? '\n\n_(Part of my answer came out broken - ask me again.)_' : '');
  const charts = ex.charts, blocks = { table: ex.tables, slides: ex.slides };
  const remTags = [...raw.matchAll(/\[\[REMIND:([^|\]]+)\|([^\]]+)\]\]/g)].map((m) => ({ when: m[1].trim(), text: m[2].trim() }));
  const wantsRead = /\[\[READ:/.test(raw) && !afterRead;
  const anything = opens.length || tasks.length || charts.length || wantsRead || blocks.table.length || blocks.slides.length || remTags.length;
  if (!answer) answer = anything ? '\u{1F44D}' : heard;   // model squeezed everything onto the HEARD line
  for (const o of opens.slice(0, 3)) {
    let r;
    if (o.kind === 'NEW') {
      const kind = { excel: 'excel', word: 'word', powerpoint: 'ppt', ppt: 'ppt' }[o.target];
      r = kind ? await window.pip.officeMake(kind, { Columns: [], Lines: [], Slides: [], Title: '' }) : { ok: false, error: `I can make a new Excel, Word or PowerPoint file, not "${o.target}".` };
      if (r.ok) { sys('✨ ' + r.msg + ' opened (press Ctrl+S to save it)'); continue; }
    } else r = o.kind === 'OPEN' ? await window.pip.openUrl(o.target) : o.kind === 'CLOSE' ? await window.pip.closeApp(o.target) : await window.pip.openApp(o.target);
    if (r.ok) sys((o.kind === 'CLOSE' ? '✖ Closed ' : '↗ Opened ') + r.label); else errMsg(r.error);
  }
  target.classList.remove('typing');
  target.innerHTML = md(answer);
  for (const spec of charts.slice(0, 3)) renderChart(target, spec, blocks.table);
  for (const spec of blocks.table.slice(0, 3)) renderTable(target, spec);
  for (const spec of blocks.slides.slice(0, 1)) renderSlides(target, spec, autoPpt);
  for (const r of remTags.slice(0, 5)) setReminderFromTag(r);
  addTools(target, answer, tools);
  charSound('reply');
  if (copyResult && answer && answer !== '\u{1F44D}') {
    window.pip.copy(cleanForCopy(answer));
    sys('✔ Result copied - paste it with Ctrl+V');
  }
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
  if (wantsRead) {
    // the model asked for the data: load it, then repeat the user's request with the data attached
    const request = heard || text;
    if (await loadData()) return askAI({ text: request, display: false, afterRead: true });
    return answer;
  }
  speak(answer);
  return answer;
}

// ---------------------------------------------------------------- spreadsheet data + charts
function dataSummary() {
  return data.tables.map((t) => `- sheet "${t.sheet}": ${t.rows.length} rows; columns: ${t.columns.map((c, i) => `${c} (${colKind(t, i)})`).join(', ')}`).join('\n')
    + '\nFirst rows:\n' + data.text.split('\n').slice(0, 25).join('\n').slice(0, 5000);
}

function toNum(v) {
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(/[,\s$€£¥%]|MMK|Ks/gi, ''));
  return Number.isFinite(n) ? n : null;
}
function toDate(v) {
  if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 864e5));   // Excel serial date
  if (typeof v === 'string' && /^\d{4}-\d\d-\d\d/.test(v)) return new Date(v);
  if (typeof v === 'string' && /\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/.test(v)) { const d = new Date(v); return isNaN(d) ? null : d; }
  return null;
}
function colKind(t, i) {
  const sample = t.rows.slice(0, 200).map((r) => r[i]).filter((v) => v !== '');
  if (!sample.length) return 'empty';
  if (sample.filter((v) => toDate(v)).length > sample.length * 0.8) return 'date';
  if (sample.filter((v) => toNum(v) !== null).length > sample.length * 0.8) return 'number';
  return 'text';
}

// Finds the data to read: the workbook open in Excel, otherwise asks in the chat with the
// user's recent Excel files as buttons. Resolves true once data is loaded, false if cancelled.
async function loadData() {
  const a = await window.pip.activeExcel();
  if (a.path) {
    sys(`\u{1F4CA} Reading the workbook open in Excel: ${a.name}` + (a.saved ? '' : '\n(using the last saved version - press Ctrl+S in Excel to include new edits)'));
    if (await attachPath(a.path)) return true;
  }
  const recent = await window.pip.recentExcel();
  const intro = a.open && a.unsaved
    ? `"${a.name}" in Excel has never been saved. Save it first (Ctrl+S), then pick it here - or choose another file:`
    : 'Which file should I read? Here are your recent Excel files:';
  openPanel(); mood('listen');
  const el = addMsg('pip', md(recent.length ? intro : 'Which file should I read? Choose your Excel or CSV file:'));
  say('Which file should I read? Pick one in the chat \u{1F447}', 15000);
  speak(recent.length ? 'Which file should I read? Pick one.' : 'Which file should I read?');
  const box = document.createElement('div'); box.className = 'fileChoices'; el.appendChild(box);
  return new Promise((resolve) => {
    const finish = async (p) => {
      box.querySelectorAll('button').forEach((b) => (b.disabled = true));
      if (!p) {
        sys('Cancelled - no file loaded.');
        history.push({ role: 'model', text: '(No file was chosen, so no data is loaded and no chart was made yet. If the user asks again, use [[READ:excel]] again.)' });
        mood('idle'); return resolve(false);
      }
      const ok = await attachPath(p);
      if (!ok) box.querySelectorAll('button').forEach((b) => (b.disabled = false));
      else resolve(true);
    };
    const add = (label, title, fn) => { const b = document.createElement('button'); b.className = 'action'; b.textContent = label; b.title = title; b.onclick = fn; box.appendChild(b); };
    for (const f of recent) add('\u{1F4CA} ' + f.split('\\').pop(), f, () => finish(f));
    add('\u{1F4C2} Other file...', 'Browse for a file', async () => { const p = await window.pip.pickFile(); if (p) finish(p); });
    add('Cancel', '', () => finish(null));
    log.scrollTop = log.scrollHeight;
  });
}

function findCol(t, name) {
  const n = String(name || '').trim().toLowerCase();
  let i = t.columns.findIndex((c) => c.toLowerCase() === n);
  if (i < 0) i = t.columns.findIndex((c) => c.toLowerCase().includes(n) || n.includes(c.toLowerCase()));
  return i;
}

const PALETTE = ['#14a8b4', '#8b7cff', '#f2b33d', '#ef6f8b', '#39c27f', '#4d9bff', '#ff9f5a', '#b6e35a', '#c084fc', '#7dd3fc'];

// localTables = tables the AI wrote in the same answer (e.g. sample data); they can be charted too
function computeChart(spec, localTables = []) {
  const local = localTables.map((x) => ({ sheet: String(x.title || 'Table'), columns: (x.columns || []).map(String), rows: (x.rows || []).map((r) => (Array.isArray(r) ? r : [])), spec: x }));
  const wanted = String(spec.sheet || '').toLowerCase();
  const t = local.find((x) => x.sheet.toLowerCase() === wanted)
    || (data && data.tables.find((x) => x.sheet.toLowerCase() === wanted))
    || local[0] || (data && data.tables[0]);
  if (!t) throw new Error('No data loaded - click \u{1F4CA} Excel chart or attach an Excel file first.');
  const xi = findCol(t, spec.x);
  if (xi < 0) throw new Error(`Column "${spec.x}" not found. Columns: ${t.columns.join(', ')}`);
  const ys = [].concat(spec.y || []).filter(Boolean);
  const yi = ys.map((y) => { const i = findCol(t, y); if (i < 0) throw new Error(`Column "${y}" not found. Columns: ${t.columns.join(', ')}`); return i; });
  const agg = ys.length ? (spec.agg || 'sum').toLowerCase() : 'count';
  const bucket = spec.bucket;
  const groups = new Map();
  let used = 0;
  for (const r of t.rows) {
    let key = r[xi];
    if (bucket) {
      const d = toDate(key); if (!d) continue;
      const iso = d.toISOString();
      key = bucket === 'year' ? iso.slice(0, 4) : bucket === 'month' ? iso.slice(0, 7) : iso.slice(0, 10);
    }
    key = String(key).trim();
    if (!key) continue;   // empty category cell: skip the row
    if (!groups.has(key)) groups.set(key, { n: 0, v: yi.map(() => ({ sum: 0, n: 0, min: Infinity, max: -Infinity })) });
    const g = groups.get(key); g.n++; used++;
    yi.forEach((ci, k) => {
      const num = toNum(r[ci]); if (num === null) return;
      const s = g.v[k]; s.sum += num; s.n++; s.min = Math.min(s.min, num); s.max = Math.max(s.max, num);
    });
  }
  const val = (g, k) => {
    if (agg === 'count' || !yi.length) return g.n;
    const s = g.v[k]; if (!s.n) return 0;
    return agg === 'avg' ? s.sum / s.n : agg === 'min' ? s.min : agg === 'max' ? s.max : s.sum;
  };
  let rows = [...groups.entries()].map(([label, g]) => ({ label, vals: (yi.length ? yi : [0]).map((_, k) => val(g, k)) }));
  const type = String(spec.type).toLowerCase();
  const timeLike = bucket || type === 'line' || colKind(t, xi) === 'date';
  // month/day names and tables the AI wrote keep their own order (Jan, Feb, Mar... not sorted by value)
  const ordered = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|mon|tue|wed|thu|fri|sat|sun|q[1-4]|week)/i.test(String(rows[0]?.label || '')) || !!t.spec;
  const sort = spec.sort || (timeLike ? 'asc-label' : ordered ? 'none' : 'desc');
  if (sort === 'desc') rows.sort((a, b) => b.vals[0] - a.vals[0]);
  else if (sort === 'asc') rows.sort((a, b) => a.vals[0] - b.vals[0]);
  else if (sort === 'asc-label') rows.sort((a, b) => (a.label > b.label ? 1 : -1));
  const round = (n) => Math.round(n * 100) / 100;
  const pieLike = type === 'pie' || type === 'doughnut';
  const top = Number(spec.top) || (pieLike ? 8 : timeLike ? 400 : 15);
  if (rows.length > top) {
    if (pieLike) {
      const rest = rows.slice(top - 1);
      rows = rows.slice(0, top - 1).concat({ label: `Other (${rest.length})`, vals: [rest.reduce((s, r) => s + r.vals[0], 0)] });
    } else rows = rows.slice(0, top);
  }
  const what = yi.length ? `${agg} of ${ys.join(', ')}` : 'count of rows';
  return {
    type, title: spec.title || `${what} by ${t.columns[xi]}`, labels: rows.map((r) => r.label),
    datasets: (yi.length ? ys : ['Count']).map((name, k) => ({ label: yi.length ? t.columns[yi[k]] : 'Count', data: rows.map((r) => round(r.vals[k])) })),
    caption: `${what} by ${t.columns[xi]}${bucket ? ` (per ${bucket})` : ''} · from ${used} rows of "${t.sheet}"`,
    localTable: t.spec || null,   // set when the data came from a table in the AI's answer
  };
}

function chartConfig(c, light) {
  const fg = light ? '#333' : '#c9cbe6', grid = light ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.08)';
  const pieLike = c.type === 'pie' || c.type === 'doughnut';
  return {
    type: c.type === 'hbar' ? 'bar' : pieLike || c.type === 'line' ? c.type : 'bar',
    data: {
      labels: c.labels,
      datasets: c.datasets.map((d, i) => ({
        ...d,
        backgroundColor: pieLike ? c.labels.map((_, j) => PALETTE[j % PALETTE.length]) : PALETTE[i % PALETTE.length] + (c.type === 'line' ? '33' : ''),
        borderColor: pieLike ? (light ? '#fff' : '#232641') : PALETTE[i % PALETTE.length],
        borderWidth: pieLike ? 2 : c.type === 'line' ? 2 : 0, fill: c.type === 'line' && c.datasets.length === 1, tension: 0.3,
        pointRadius: c.labels.length > 40 ? 0 : 2, borderRadius: 4,
      })),
    },
    options: {
      indexAxis: c.type === 'hbar' ? 'y' : 'x', responsive: !light, maintainAspectRatio: false, animation: light ? false : { duration: 500 },
      plugins: {
        title: { display: true, text: c.title, color: fg, font: { size: light ? 18 : 12, weight: '600' } },
        legend: { display: pieLike || c.datasets.length > 1, position: pieLike ? 'right' : 'top', labels: { color: fg, boxWidth: 10, font: { size: light ? 13 : 10 } } },
      },
      scales: pieLike ? {} : {
        x: { ticks: { color: fg, font: { size: light ? 12 : 9 }, maxRotation: 50 }, grid: { color: grid } },
        y: { ticks: { color: fg, font: { size: light ? 12 : 9 } }, grid: { color: grid }, beginAtZero: true },
      },
    },
  };
}

// light, white-background copy for pasting into Word/email
function exportPng(c) {
  const cv = document.createElement('canvas'); cv.width = 900; cv.height = 520;
  const bg = { id: 'bg', beforeDraw: (ch) => { const x = ch.ctx; x.save(); x.fillStyle = '#fff'; x.fillRect(0, 0, ch.width, ch.height); x.restore(); } };
  const cfg = chartConfig(c, true); cfg.plugins = [bg];
  const ch = new Chart(cv, cfg);
  const url = cv.toDataURL('image/png'); ch.destroy();
  return url;
}

function renderChart(container, spec, localTables = []) {
  let c;
  try { c = computeChart(spec, localTables); } catch (e) { const er = document.createElement('div'); er.className = 'chartErr'; er.textContent = '⚠ ' + e.message; container.appendChild(er); return; }
  const box = document.createElement('div'); box.className = 'chart';
  const wrap = document.createElement('div'); wrap.className = 'chartCanvas';
  const cv = document.createElement('canvas'); wrap.appendChild(cv); box.appendChild(wrap);
  const cap = document.createElement('div'); cap.className = 'chartCap'; cap.textContent = c.caption; box.appendChild(cap);
  const tbl = document.createElement('table'); tbl.className = 'chartTable hidden';
  tbl.innerHTML = `<tr><th>${esc(spec.x)}</th>${c.datasets.map((d) => `<th>${esc(d.label)}</th>`).join('')}</tr>` +
    c.labels.map((l, i) => `<tr><td>${esc(l)}</td>${c.datasets.map((d) => `<td>${d.data[i].toLocaleString()}</td>`).join('')}</tr>`).join('');
  const bar = document.createElement('div'); bar.className = 'msgTools';
  const btn = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.onclick = () => fn(b); bar.appendChild(b); };
  btn('Copy image', async (b) => { await window.pip.copyImage(exportPng(c)); b.textContent = 'Copied ✔'; setTimeout(() => (b.textContent = 'Copy image'), 1500); });
  btn('Save PNG', async () => { const f = await window.pip.savePng(exportPng(c), (c.title.replace(/[^\w -]+/g, '').trim() || 'chart') + '.png'); if (f) sys('Saved ' + f); });
  const toExcel = async (b) => {
    if (b) { b.disabled = true; b.textContent = 'Adding...'; }
    const chart = { Title: c.title, Type: c.type, XLabel: spec.x, Labels: c.labels, Datasets: c.datasets.map((d) => ({ label: d.label, data: d.data })) };
    let r;
    if (c.localTable) {
      // data made by the AI: new workbook with the data table first, then the chart sheet in that same workbook
      const t = c.localTable;
      const made = await window.pip.officeMake('excel', { Title: t.title || 'Data', Columns: t.columns, Rows: t.rows });
      r = made.ok ? await window.pip.excelChart({ ...chart, UseActive: true }) : { ok: false, error: made.error };
    } else r = await window.pip.excelChart({ ...chart, File: (data && data.path) || '' });
    if (b) { b.disabled = false; b.textContent = 'Add to Excel'; }
    if (r.ok) { sys(`✔ Added sheet "${r.sheet}" with an Excel chart to ${r.book} (not saved yet - press Ctrl+S in Excel to keep it).`); mood('happy', 1500); }
    else errMsg('Excel: ' + r.error);
  };
  btn('Add to Excel', toExcel);
  btn('Numbers', () => tbl.classList.toggle('hidden'));
  btn('Copy numbers', () => window.pip.copy([[spec.x, ...c.datasets.map((d) => d.label)].join('\t'), ...c.labels.map((l, i) => [l, ...c.datasets.map((d) => d.data[i])].join('\t'))].join('\n')));
  box.appendChild(bar); box.appendChild(tbl);
  container.appendChild(box);
  if (c.type === 'hbar') wrap.style.height = Math.max(200, c.labels.length * 18 + 60) + 'px';
  new Chart(cv, chartConfig(c, false));
  if (spec.excel) toExcel(bar.querySelector('button:nth-child(3)'));
}

// Pulls every table / chart / slides object out of the answer's ``` blocks - even several merged
// into one block ("table {...} chart {...}"). Real code blocks (formulas, scripts) are left alone.
function extractBlocks(answer) {
  const out = { charts: [], tables: [], slides: [], broken: false };
  out.text = answer.replace(/```([a-z]*)[ \t]*\r?\n?([\s\S]*?)(```|$)/gi, (block, lang, body) => {
    lang = lang.toLowerCase();
    const isData = ['chart', 'json', 'table', 'slides'].includes(lang) || /^\s*(table|chart|slides)?\s*\{/i.test(body);
    if (!isData) return block;
    const objs = jsonObjects(body);
    if (!objs.length) { out.broken = true; return ''; }
    for (const o of objs) {
      const spec = parseLooseJSON(o.json);
      const label = (o.label || lang).toLowerCase();
      if (!spec || typeof spec !== 'object') { out.broken = true; continue; }
      if (/chart/.test(label) || (spec.type && spec.x)) out.charts.push(spec);
      else if (/slides/.test(label) || Array.isArray(spec.slides)) out.slides.push(spec);
      else if (/table/.test(label) || (spec.columns && spec.rows)) {
        const hasData = (spec.rows || []).some((r) => (r || []).some((c) => c !== '' && c != null));
        if (hasData) out.tables.push(spec);
      } else out.broken = true;
    }
    return '';
  }).trim();
  return out;
}
// top-level {...} objects in a text, with the words just before each one as its label
function jsonObjects(body) {
  const found = [];
  let depth = 0, start = -1, inStr = false, escNext = false, labelFrom = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inStr) { if (escNext) escNext = false; else if (ch === '\\') escNext = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"' && depth > 0) { inStr = true; continue; }
    if (ch === '{') { if (depth === 0) start = i; depth++; }
    else if (ch === '}' && depth > 0 && --depth === 0) {
      found.push({ label: body.slice(labelFrom, start).replace(/[^a-z]/gi, ' ').trim(), json: body.slice(start, i + 1) });
      labelFrom = i + 1;
    }
  }
  return found;
}

// JSON from the model, repaired for common slips: [,] holes, trailing commas, smart quotes
function parseLooseJSON(text) {
  try { return JSON.parse(text); } catch { }
  try {
    const fixed = text.replace(/[“”]/g, '"')
      .replace(/\[\s*,/g, '["",').replace(/,\s*,/g, ',"",').replace(/,\s*\]/g, ',""]')
      .replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(fixed);
  } catch { return null; }
}

// plain text for pasting into email/chat apps (no markdown symbols)
function cleanForCopy(t) {
  return t.replace(/^#{1,4}\s+/gm, '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').trim();
}

function addTools(el, text, extra) {
  const bar = document.createElement('div'); bar.className = 'msgTools';
  const copy = document.createElement('button'); copy.textContent = 'Copy';
  copy.onclick = () => { window.pip.copy(cleanForCopy(text)); copy.textContent = 'Copied'; setTimeout(() => (copy.textContent = 'Copy'), 1200); };
  bar.appendChild(copy);
  const subject = text.match(/^\s*\**Subject:\**\s*(.*)$/m);
  if (subject) {
    const b = document.createElement('button'); b.textContent = 'Email draft';
    b.onclick = () => window.pip.mailDraft(subject[1].replace(/\*/g, ''), cleanForCopy(text.replace(/^\s*\**Subject:.*$/m, '')));
    bar.appendChild(b);
  }
  if (text.length > 700 || /^#{1,3}\s/m.test(text)) {   // documents only, not chatty replies
    const b = document.createElement('button'); b.textContent = 'Open in Word';
    b.onclick = async () => {
      b.disabled = true; b.textContent = 'Opening Word...';
      const r = await window.pip.officeMake('word', { Title: '', Lines: text.replace(/^\s*\**Subject:.*$/m, '').trim().split('\n') });
      b.disabled = false; b.textContent = 'Open in Word';
      if (r.ok) sys('✔ Opened in Word (not saved yet - press Ctrl+S to keep it).'); else errMsg('Word: ' + r.error);
    };
    bar.appendChild(b);
  }
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

// ---- natural (neural) voices: Burmese + English, spoken sentence by sentence
let ttsReady = null, ttsGen = 0, ttsAudio = null;
window.pip.ttsAvailable().then((ok) => (ttsReady = ok));
const NEURAL_DEFAULT = { my: 'my-MM-ThihaNeural', en: 'en-US-GuyNeural', pitch: '+0Hz', rate: '+0%' };
const isSpeaking = () => speechSynthesis.speaking || !!(ttsAudio && !ttsAudio.paused);
function stopSpeaking() { ttsGen++; if (ttsAudio) { ttsAudio.pause(); ttsAudio = null; } speechSynthesis.cancel(); }
function sentences(t) {
  const parts = t.replace(/\s+/g, ' ').match(/[^\u104B.!?\n]+[\u104B.!?]*/g) || [t];
  const out = []; let cur = '';
  for (const p of parts) { if ((cur + p).length > 220 && cur) { out.push(cur); cur = ''; } cur += p; }
  if (cur.trim()) out.push(cur);
  return out.map((s) => s.trim()).filter((s) => /[\p{L}\p{N}]/u.test(s));
}
async function speakNeural(plain, burmese) {
  const n = { ...NEURAL_DEFAULT, ...(charStyle().neural || {}) };
  const voice = burmese ? n.my : n.en, gen = ++ttsGen;
  const parts = sentences(plain);
  let next = parts.length ? window.pip.ttsSpeak({ text: parts[0], voice, rate: n.rate, pitch: n.pitch }) : null;
  for (let i = 0; i < parts.length; i++) {
    const r = await next;
    if (gen !== ttsGen) return true;
    next = i + 1 < parts.length ? window.pip.ttsSpeak({ text: parts[i + 1], voice, rate: n.rate, pitch: n.pitch }) : null;   // prepare the next sentence while this one plays
    if (!r.ok) return i > 0;   // failed at the start: fall back to Windows voices
    const played = await new Promise((resolve) => {
      ttsAudio = new Audio(r.url);
      ttsAudio.onplay = () => mood('talk');
      ttsAudio.onended = () => resolve(true);
      ttsAudio.onerror = () => resolve(false);
      ttsAudio.play().catch(() => resolve(false));
    });
    if (!played && i === 0) { console.warn('natural voice could not play'); return false; }   // let the Windows voice try
    if (gen !== ttsGen) return true;
  }
  mood('idle');
  return true;
}

async function speak(text) {
  stopSpeaking();
  if (!settings.speak) { mood('happy', 1500); return; }
  const plain = text.replace(/```[\s\S]*?```/g, ' (code shown on screen) ').replace(/[#*`>_|]/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, '').slice(0, 900);
  const burmese = /[\u1000-\u109F]/.test(plain);
  if (settings.naturalVoice !== false && ttsReady && await speakNeural(plain, burmese)) return;
  let voice = voices.find((v) => v.name === settings.voice);
  // no voice chosen: let the character suggest one (e.g. a female voice for a girl character)
  if (!voice && charStyle().voiceHint) voice = voices.find((v) => charStyle().voiceHint.test(v.name));
  if (burmese) voice = voices.find((v) => /^my/i.test(v.lang));
  if (burmese && !voice) { mood('happy', 1500); return; }   // no Burmese voice installed on Windows: show text only
  const u = new SpeechSynthesisUtterance(plain);
  if (voice) u.voice = voice;
  if (!burmese) { u.pitch = charStyle().pitch; u.rate = charStyle().rate; }   // each character has its own voice
  else u.rate = 1.0;
  u.onstart = () => mood('talk');
  u.onend = u.onerror = () => mood('idle');
  speechSynthesis.speak(u);
}

// ---------------------------------------------------------------- chat input
$('#form').addEventListener('submit', (e) => {
  e.preventDefault();
  const t = input.value.trim();
  if (activeSkill) { if (t || attachment) { input.value = ''; input.style.height = ''; submitSkill(t); } return; }   // skills.js
  if (!t && !attachment) return;
  input.value = ''; input.style.height = '';
  askAI({ text: t || 'Summarize this file.' });
});
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#form').requestSubmit(); }
  if (e.key === 'Escape') stopSpeaking();
});
input.addEventListener('input', () => { input.style.height = ''; input.style.height = Math.min(input.scrollHeight, 90) + 'px'; });

// ---------------------------------------------------------------- attachments + summarize
async function attachPath(p) {
  const r = await window.pip.readFile(p);
  if (!r.ok) { errMsg(r.error); return false; }
  attachment = r;
  if (r.tables) {
    data = { name: r.name, path: r.path, tables: r.tables, text: r.text };
    sys(`\u{1F4CA} Loaded ${r.name}: ` + r.tables.map((t) => `"${t.sheet}" ${t.rows.length} rows × ${t.columns.length} columns`).join(', '));
  }
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
$('#btnExcel').onclick = async () => {
  openPanel();
  if (await loadData()) askAI({ text: 'Analyze this data: what it contains, 3-5 key insights (patterns, not invented numbers), and the 1-2 most useful charts.', display: 'Analyze ' + data.name });
};

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
  document.querySelectorAll('button[data-task]').forEach((b) => (b.disabled = true));
  const r = await window.pip.runTask(task, folder);
  document.querySelectorAll('button[data-task]').forEach((b) => (b.disabled = false));
  const lastLine = (r.out || '').split('\n').filter(Boolean).pop() || '';
  const clean = lastLine.replace(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\s+/, '');
  if (r.ok) { sys('\u2714 ' + (clean || 'Done')); mood('happy', 1800); say('Done! ' + clean.slice(0, 100)); }
  else errMsg('Task failed: ' + (r.out || 'unknown error'));
}
document.querySelectorAll('button[data-task]').forEach((b) => (b.onclick = () => runTask(b.dataset.task)));

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
  await askAI({ text: ask, display: "Write today's report from my daily note" });   // Email draft / Word buttons are added automatically
}
$('#btnReport').onclick = dailyReport;

// ---------------------------------------------------------------- voice input (push-to-talk)
let rec = null, lastVoice = null;   // lastVoice = { rms, peak, secs } of the latest recording, for diagnostics

// Noise suppression is off: it can cut parts of speech (and Burmese tones). Auto gain lifts quiet voices.
function micConstraints() {
  const c = { echoCancellation: true, noiseSuppression: false, autoGainControl: true, channelCount: 1 };
  if (settings.micId) c.deviceId = { exact: settings.micId };
  return { audio: c };
}
async function openMic() {
  try { return await navigator.mediaDevices.getUserMedia(micConstraints()); }
  catch (e) {   // chosen mic unplugged: fall back to the default one
    if (settings.micId) return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: true } });
    throw e;
  }
}
const levelBar = (rms) => '▁▂▃▄▅▆▇█'.slice(0, Math.max(1, Math.min(8, Math.round(rms * 120))));

async function startRec() {
  if (rec || busy) return;
  try {
    const stream = await openMic();
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    const chunks = [];
    let live = 0;
    proc.onaudioprocess = (e) => {
      const d = e.inputBuffer.getChannelData(0);
      chunks.push(new Float32Array(d));
      let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] * d[i];
      live = Math.sqrt(s / (d.length / 4));
    };
    src.connect(proc); proc.connect(ctx.destination);
    stopSpeaking();
    const meter = setInterval(() => say(`🎤 Listening ${levelBar(live)}  (click mic or Ctrl+Alt+V to stop)`, 30000), 150);
    rec = { stream, ctx, proc, chunks, meter, timer: setTimeout(stopRec, 30000) };
    $('#btnMic').classList.add('rec'); mood('listen');
  } catch (err) { errMsg('Microphone not available: ' + err.message); }
}
async function stopRec() {
  if (!rec) return;
  const { stream, ctx, proc, chunks, timer, meter } = rec; rec = null;
  clearTimeout(timer); clearInterval(meter); proc.disconnect(); stream.getTracks().forEach((t) => t.stop());
  $('#btnMic').classList.remove('rec'); hint.classList.add('hidden');
  const rate = ctx.sampleRate; ctx.close();
  const pcm = downsample(concat(chunks), rate, 16000);
  const rms = Math.sqrt(pcm.reduce((s, v) => s + v * v, 0) / (pcm.length || 1));
  const peak = pcm.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  lastVoice = { rms, peak, secs: pcm.length / 16000 };
  if (pcm.length < 16000 * 0.4 || rms < 0.004) {   // skip silence: avoids hallucinated transcripts
    mood('worried', 1500); openPanel();
    sys(`I didn't hear anything (mic level ${rms.toFixed(3)}, ${lastVoice.secs.toFixed(1)}s). Speak closer, or pick another microphone in Settings → Microphone.`);
    return;
  }
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
const CHAR_NAMES = { pip: 'Pip', bears: 'Mocha & Milk', cat: 'Mango', dog: 'Kopi', capy: 'Capy', penguin: 'Pebble' };
function applyCharacter() {
  const c = CHAR_NAMES[settings.character] ? settings.character : 'pip';
  pipEl.dataset.char = c;
  $('#head .who b').textContent = CHAR_NAMES[c];
  input.placeholder = `Ask ${CHAR_NAMES[c]} anything...  (Enter = send)`;
  $('#foot').textContent = `AI can make mistakes · drop a file on ${c === 'bears' ? 'us' : CHAR_NAMES[c]} to summarize`;
  pipEl.title = `${CHAR_NAMES[c]} - click to chat, drag to move, drop a file to summarize`;
}

function showModelTag() {
  $('#modelTag').textContent = settings.activeName
    ? `${settings.activeModel || settings.activeName}${settings.activeMode === 'relay' ? ' · relay' : ''}` : 'no AI set up';
  $('#modelTag').title = settings.activeName || '';
}

// ---- AI providers: list, add, edit, test, delete, choose active
let presets = {}, editing = null;   // editing = draft being edited ({ id?, preset, ... })

async function renderProviders(data) {
  const { list, presets: pr } = data || await window.pip.listProviders();
  if (pr) presets = pr;
  const box = $('#pList'); box.innerHTML = '';
  if (!list.length) box.innerHTML = '<div class="pNote">No AI provider yet - click <b>+ Add</b>.</div>';
  for (const p of list) {
    const row = document.createElement('div'); row.className = 'pRow' + (p.active ? ' active' : '');
    const keyInfo = p.noKey ? 'no key needed' : p.keyCount ? `${p.keyCount} key${p.keyCount > 1 ? 's' : ''}` : '⚠ no key';
    row.innerHTML = `<input type="radio" name="pActive" ${p.active ? 'checked' : ''} title="Use this one first">
      <div class="pInfo"><b>${esc(p.name)}</b><small>${esc(p.model || 'no model chosen')}${p.type === 'gemini' ? ' · ' + (p.mode === 'direct' ? 'direct' : 'relay') : ''} · ${keyInfo}</small></div>`;
    row.querySelector('input').onchange = async () => { const r = await window.pip.activateProvider(p.id); settings = r.settings; renderProviders(r); showModelTag(); };
    const btn = (label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = fn; row.appendChild(b); };
    btn('Edit', () => openEditor(p));
    btn('✕', async () => {
      if (!confirm(`Delete "${p.name}" and its saved keys?`)) return;
      const r = await window.pip.deleteProvider(p.id); settings = r.settings; renderProviders(r); showModelTag();
    });
    box.appendChild(row);
  }
}

$('#pAdd').onclick = async () => {
  if (!Object.keys(presets).length) await renderProviders();
  const m = $('#pAddMenu');
  if (!m.classList.contains('hidden')) { m.classList.add('hidden'); return; }
  m.innerHTML = '';
  for (const [id, pr] of Object.entries(presets)) {
    const b = document.createElement('button'); b.type = 'button';
    b.innerHTML = `${esc(pr.name)}<small>${esc(pr.note || '')}</small>`;
    b.onclick = () => { m.classList.add('hidden'); openEditor({ preset: id, name: pr.name, mode: pr.mode, relayUrl: pr.relayUrl, baseUrl: pr.baseUrl, model: pr.model, type: pr.type, noKey: pr.noKey, keyUrl: pr.keyUrl, note: pr.note, keyCount: 0 }); };
    m.appendChild(b);
  }
  m.classList.remove('hidden');
};

function openEditor(p) {
  editing = { ...p };
  const pr = presets[p.preset] || {};
  $('#pEditTitle').textContent = p.id ? `Edit: ${p.name}` : `Add: ${pr.name || p.name}`;
  $('#pNote').textContent = p.note || pr.note || '';
  $('#pKeyLink').classList.toggle('hidden', !(p.keyUrl || pr.keyUrl));
  $('#pName').value = p.name || ''; $('#pMode').value = p.mode || 'relay'; $('#pRelay').value = p.relayUrl || pr.relayUrl || '';
  $('#pBase').value = p.baseUrl || pr.baseUrl || ''; $('#pModel').value = p.model || '';
  $('#pKey').value = ''; $('#pKey').classList.remove('reveal'); $('#pShow').textContent = 'Show';
  $('#pKey').placeholder = p.keyCount ? `${p.keyCount} saved (${(p.keyMasks || []).join(', ')}) - leave empty to keep` : 'paste key - one per line to add several';
  $('#pStatus').textContent = p.keyFrom && p.keyFrom !== 'Settings' ? `Using key from ${p.keyFrom}.` : '';
  $('#pModelList').innerHTML = '';
  const type = p.type || pr.type, noKey = p.noKey || pr.noKey;
  document.querySelectorAll('.pGemini').forEach((e) => e.classList.toggle('hidden', type !== 'gemini'));
  document.querySelectorAll('.pOpenAI').forEach((e) => e.classList.toggle('hidden', type !== 'openai'));
  document.querySelectorAll('.pKeyRow').forEach((e) => e.classList.toggle('hidden', !!noKey));
  syncRelayRow();
  $('#pEdit').classList.remove('hidden');
  $('#pEdit').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function syncRelayRow() { $('.pRelay').classList.toggle('hidden', (editing?.type || presets[editing?.preset]?.type) !== 'gemini' || $('#pMode').value === 'direct'); }
$('#pMode').onchange = syncRelayRow;

function readEditor() {
  return { id: editing.id, preset: editing.preset, name: $('#pName').value.trim(), mode: $('#pMode').value,
    relayUrl: $('#pRelay').value.trim(), baseUrl: $('#pBase').value.trim(), model: $('#pModel').value.trim() };
}
$('#pKeyLink').onclick = (e) => { e.preventDefault(); const u = editing.keyUrl || presets[editing.preset]?.keyUrl; if (u) window.open(u); };
$('#pShow').onclick = () => { const r = $('#pKey').classList.toggle('reveal'); $('#pShow').textContent = r ? 'Hide' : 'Show'; };
$('#pCancel').onclick = () => { $('#pEdit').classList.add('hidden'); editing = null; };
$('#pLoadModels').onclick = async () => {
  const b = $('#pLoadModels'); b.disabled = true; b.textContent = 'Loading...';
  const list = await window.pip.providerModels(readEditor(), $('#pKey').value);
  b.disabled = false; b.textContent = 'Load models';
  $('#pModelList').innerHTML = list.map((m) => `<option value="${esc(m)}">`).join('');
  $('#pStatus').textContent = list.length ? `${list.length} models found - click the Model box to pick one.` : 'No model list (check the key / URL), type the model name yourself.';
  if (list.length && !$('#pModel').value) $('#pModel').value = list[0];
};
$('#pTest').onclick = async () => {
  const b = $('#pTest'); b.disabled = true; $('#pStatus').textContent = 'Testing...';
  if ($('#sProxy').value.trim() !== (settings.proxy || '')) settings = await window.pip.setSettings({ proxy: $('#sProxy').value.trim() });
  const res = await window.pip.testProvider(readEditor(), $('#pKey').value);
  b.disabled = false;
  $('#pStatus').innerHTML = res.map((r) => `<span class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✔' : '✖'} ${esc(r.key)}: ${esc(r.msg)}</span>`).join('<br>')
    + (res.some((r) => r.ok) ? '<br>Click <b>Save provider</b> to keep it.' : '');
};
$('#pClearKeys').onclick = async () => {
  if (!editing.id || !confirm('Remove the saved keys for this provider?')) return;
  const r = await window.pip.saveProvider({ ...readEditor(), clearKeys: true });
  settings = r.settings; renderProviders(r); $('#pKey').placeholder = 'paste key'; $('#pStatus').textContent = 'Keys removed.';
};
$('#pSave').onclick = async () => {
  const d = readEditor();
  if (presets[d.preset]?.type === 'openai' && !d.baseUrl) { $('#pStatus').textContent = 'Enter the API base URL.'; return; }
  const r = await window.pip.saveProvider({ ...d, apiKey: $('#pKey').value });
  settings = r.settings; renderProviders(r); showModelTag();
  $('#pEdit').classList.add('hidden'); editing = null;
  sys(`✔ Saved AI provider: ${d.name}`);
};

// ---- the rest of Settings
async function openSettings() {
  settings = await window.pip.getSettings();
  $('#sAuto').checked = !!settings.autoStart;
  $('#sChar').value = settings.character || 'pip';
  $('#sVoiceLang').value = settings.voiceLang || 'auto';
  loadMics();
  $('#sSound').checked = settings.sound !== false;
  $('#sVolume').value = settings.soundVolume ?? 0.6;
  $('#sFallback').checked = settings.fallback !== false;
  $('#sProxy').value = settings.proxy || '';
  $('#sLang').value = settings.replyLang; $('#sName').value = settings.userName;
  $('#sSpeak').checked = settings.speak; loadVoices();
  $('#sNatural').checked = settings.naturalVoice !== false;
  $('#naturalNote').textContent = ttsReady === false ? 'Not installed - to enable: open a terminal and run   pip install edge-tts   then restart.' : '';
  $('#pEdit').classList.add('hidden'); $('#pAddMenu').classList.add('hidden');
  $('#settings').classList.remove('hidden');
  renderProviders();
}
window.pip.onSettingsChanged(async () => { settings = await window.pip.getSettings(); });

// ---- microphone picker + level test
async function loadMics() {
  const sel = $('#sMic');
  let devs = [];
  try { devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput' && d.deviceId !== 'default' && d.deviceId !== 'communications'); } catch { }
  sel.innerHTML = '<option value="">Windows default microphone</option>' +
    devs.map((d, i) => `<option value="${esc(d.deviceId)}">${esc(d.label || 'Microphone ' + (i + 1))}</option>`).join('');
  sel.value = devs.some((d) => d.deviceId === settings.micId) ? settings.micId : '';
}
$('#sMicTest').onclick = async () => {
  const b = $('#sMicTest'), out = $('#micLevel');
  b.disabled = true;
  let stream;
  try {
    const chosen = $('#sMic').value, keep = settings.micId;
    settings.micId = chosen;
    stream = await openMic(); settings.micId = keep;
    await loadMics();                       // device names appear once mic permission exists
    $('#sMic').value = chosen;              // keep what the user picked (not saved until Save)
    const ctx = new AudioContext(), an = ctx.createAnalyser(); an.fftSize = 2048;
    ctx.createMediaStreamSource(stream).connect(an);
    const buf = new Float32Array(an.fftSize); let best = 0;
    const end = Date.now() + 4000;
    await new Promise((resolve) => {
      const tick = () => {
        an.getFloatTimeDomainData(buf);
        let s = 0; for (const v of buf) s += v * v;
        const rms = Math.sqrt(s / buf.length); best = Math.max(best, rms);
        out.textContent = `Say something... ${levelBar(rms)}  (${Math.ceil((end - Date.now()) / 1000)}s)`;
        if (Date.now() < end) requestAnimationFrame(tick); else resolve();
      };
      tick();
    });
    ctx.close();
    out.textContent = best < 0.01 ? `⚠ Very quiet (peak level ${best.toFixed(3)}). Pick another microphone or move closer.`
      : best < 0.03 ? `Quiet but usable (peak level ${best.toFixed(3)}). Speak a little louder or closer.` : `✔ Good level (peak ${best.toFixed(3)}).`;
  } catch (e) { out.textContent = 'Microphone error: ' + e.message; }
  finally { if (stream) stream.getTracks().forEach((t) => t.stop()); b.disabled = false; }
};
$('#btnSettings').onclick = openSettings;
$('#sCancel').onclick = () => $('#settings').classList.add('hidden');
$('#sSave').onclick = async () => {
  settings = await window.pip.setSettings({
    proxy: $('#sProxy').value.trim(), fallback: $('#sFallback').checked, replyLang: $('#sLang').value,
    userName: $('#sName').value.trim(), speak: $('#sSpeak').checked, voice: $('#sVoice').value,
    naturalVoice: $('#sNatural').checked,
    autoStart: $('#sAuto').checked, character: $('#sChar').value,
    sound: $('#sSound').checked, soundVolume: Number($('#sVolume').value),
    voiceLang: $('#sVoiceLang').value, micId: $('#sMic').value,
  });
  applyCharacter(); showModelTag();
  $('#settings').classList.add('hidden');
  sys('Settings saved.');
};

// ---------------------------------------------------------------- start-up + gentle nudges
(async () => {
  settings = await window.pip.getSettings();
  applyCharacter();
  showModelTag();
  loadVoices();
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  sys(`${greet}${settings.userName ? ', ' + settings.userName : ''}! Ask me anything, drop a file on me, or tap a button above.\nHotkeys: Ctrl+Alt+Space show/hide · Ctrl+Alt+V talk · Ctrl+Alt+C clipboard · Ctrl+Alt+S settings (or right-click me)`);
  setTimeout(() => {
    mood('happy', 1500);
    say(settings.hasKey ? `${charStyle().hi} ${greet}! Click me if you need anything.` : `${charStyle().hi} Click me, then \u2699 Settings \u2192 AI providers to add an API key (Gemini is free).`, 8000);
    charSound('hello');
  }, 800);
  if (!settings.hasKey) setTimeout(() => { openPanel(); openSettings(); }, 1500);

  const nudged = {};
  setInterval(() => {
    const d = new Date(), key = d.toDateString(), hm = d.getHours() * 60 + d.getMinutes();
    if (hm >= 17 * 60 + 15 && hm < 18 * 60 && !nudged[key + 'r']) { nudged[key + 'r'] = 1; mood('happy', 2000); charSound('alert'); say(`${charStyle().hi} Almost home time! Want me to write your daily report? Click me.`, 20000); }
    if (hm >= 12 * 60 && hm < 12 * 60 + 5 && !nudged[key + 'l']) { nudged[key + 'l'] = 1; charSound('hello'); say(`${charStyle().hi} Lunch time - stretch and drink some water! \u{1F35C}`, 10000); }
  }, 60000);
})();
