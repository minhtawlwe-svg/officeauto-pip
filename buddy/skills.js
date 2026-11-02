// Skills: one-click office jobs. Loaded after renderer.js and uses its helpers
// (askAI, addMsg, sys, errMsg, md, esc, mood, say, speak, openPanel, attachPath, loadData...).

const SKILLS = [
  // ---- writing
  { id: 'email', group: 'Write', icon: '✉️', name: 'Write email', hint: 'What is the email about? (to whom, purpose, key points, tone)',
    prompt: 'Write a ready-to-send professional email. First line "Subject: ...". Clear, polite, not too long. Use a short [placeholder] only for details I did not give.\n\nDetails: {input}' },
  { id: 'reply', group: 'Write', icon: '↩️', name: 'Reply to email', hint: 'Paste the email you received + what you want to say',
    prompt: 'Write my reply to the email below. First line "Subject: Re: ...". Same language as the email. Use my notes (if any) for what to say.\n\n{input}' },
  { id: 'polish', group: 'Write', icon: '✍️', name: 'Polish my text', hint: 'Paste text to fix grammar, clarity and tone', copy: true,
    prompt: 'Rewrite this so it is correct, clear and professional. Keep the meaning and the language. Output ONLY the improved text, then a line "---" and 1-3 short notes on what changed.\n\n{input}' },
  { id: 'translate', group: 'Write', icon: '🌐', name: 'Translate EN ⇄ MY', hint: 'Paste text: Burmese → English, English → Burmese', copy: true,
    prompt: 'Translate the text below. Burmese → natural business English; any other language → natural Burmese. Keep names, numbers and technical terms. Output ONLY the translation.\n\n{input}' },
  { id: 'customer', group: 'Write', icon: '💬', name: 'Reply to customer', hint: 'Paste the customer message (Viber / Facebook / email)',
    prompt: 'Write a polite, helpful reply to this customer message, in the same language. Short and warm; solve the issue or ask the one question needed. Give **A) Formal** and **B) Friendly** versions.\n\n{input}' },
  { id: 'letter', group: 'Write', icon: '📄', name: 'Letter / memo / notice', hint: 'e.g. leave request 4-6 Nov, holiday notice, letter to supplier',
    prompt: 'Write this office document complete and ready to use: title (# heading), date ({date}), proper greeting, body and closing. Use [placeholders] only for missing names.\n\nRequest: {input}' },
  { id: 'report', group: 'Write', icon: '📑', name: 'Report draft', hint: 'Paste your points / numbers (weekly, monthly, project)',
    prompt: 'Write a well-structured report from these points: # title, short summary, ## sections, key numbers, issues/risks, next steps. Never invent numbers.\n\n{input}' },
  { id: 'minutes', group: 'Write', icon: '📝', name: 'Meeting minutes', hint: 'Paste meeting notes or a transcript',
    prompt: 'Turn these notes into meeting minutes: # title, date, attendees (if known), ## Summary, ## Decisions, then the action items as a ```table block (columns Task, Owner, Due). Do not invent facts.\n\n{input}' },
  // ---- excel & data
  { id: 'formula', group: 'Excel & data', icon: '🧮', name: 'Excel formula', hint: 'What do you want to calculate? e.g. total of column D where column B = "Yangon"',
    prompt: 'Give the best Excel formula for this in a code block, explain it in 2-3 short bullets, and show a tiny example. If it needs Excel 365 (XLOOKUP, FILTER...) also give an older-Excel version.\n\nNeed: {input}' },
  { id: 'table', group: 'Excel & data', icon: '📋', name: 'Text → Excel table', hint: 'Paste messy text or a list, or describe the table you need',
    prompt: 'Turn this into a clean ```table block: sensible column names, one row per item, numbers as numbers, dates as YYYY-MM-DD, phone numbers as text. Then one line saying how many rows.\n\n{input}' },
  { id: 'data', group: 'Excel & data', icon: '📊', name: 'Analyze Excel + charts', run: 'data' },
  // ---- documents
  { id: 'summary', group: 'Documents', icon: '📚', name: 'Summarize file', run: 'summary' },
  { id: 'proofread', group: 'Documents', icon: '🔍', name: 'Proofread document', run: 'file',
    prompt: 'Proofread this document. List each problem as: original → correction (reason), grouped under **Spelling & grammar**, **Clarity**, **Consistency** (names, numbers, dates). End with a quality score out of 10. Do not rewrite the whole document.' },
  { id: 'ocr', group: 'Documents', icon: '🖼️', name: 'Read screenshot text', run: 'clipimage',
    prompt: 'Extract all text from this image exactly, keeping the layout. If it contains a table, output it as a ```table block. Finish with one line saying what the image is.' },
  { id: 'ppt', group: 'Documents', icon: '🎞️', name: 'Make PowerPoint', hint: 'Topic or your content, e.g. "Q3 sales review for managers, 6 slides"', autoPpt: true,
    prompt: 'Create a presentation as a ```slides block: strong title + subtitle, 5-10 slides, max 5 short bullets each, speaker notes. Write it in the same language as my request below (Burmese request = all slides in Burmese, short bullets). Use the content given and never invent numbers. After the block, one short sentence.\n\n{input}' },
  { id: 'explain', group: 'Documents', icon: '💡', name: 'Explain simply', hint: 'Paste anything confusing: a policy, contract clause, error message',
    prompt: 'Explain this simply for a busy office worker: what it means, what I need to do, any risk or deadline. Short bullets.\n\n{input}' },
  { id: 'sop', group: 'Documents', icon: '✅', name: 'Checklist / SOP', hint: 'Which process? e.g. month-end closing, new staff onboarding',
    prompt: 'Write a practical step-by-step checklist (SOP) for this: numbered steps with "- [ ]" boxes, who does each step, and common mistakes to avoid.\n\n{input}' },
  // ---- planning
  { id: 'plan', group: 'Plan my day', icon: '🗓️', name: 'Plan my day', run: 'plan' },
  { id: 'remind', group: 'Plan my day', icon: '⏰', name: 'Set reminder', hint: 'e.g. "at 3pm call the supplier", "tomorrow 9am send the report"',
    prompt: 'Set the reminder(s) I ask for with [[REMIND:...]] tags, then confirm in one short sentence.\n\n{input}' },
  { id: 'reminders', group: 'Plan my day', icon: '📌', name: 'My reminders', run: 'reminders' },
  { id: 'focus', group: 'Plan my day', icon: '🍅', name: 'Focus 25 min', run: 'focus' },
];

let activeSkill = null;

// ---------------------------------------------------------------- skills sheet
(function buildSheet() {
  const groups = {};
  for (const s of SKILLS) (groups[s.group] = groups[s.group] || []).push(s);
  const host = $('#skillGroups');
  for (const [g, list] of Object.entries(groups)) {
    const box = document.createElement('div'); box.className = 'skillGroup';
    box.innerHTML = `<h4>${esc(g)}</h4>`;
    const grid = document.createElement('div'); grid.className = 'skillGrid';
    for (const s of list) {
      const b = document.createElement('button');
      b.textContent = `${s.icon} ${s.name}`; b.title = s.hint || s.name;
      b.onclick = () => { $('#skills').classList.add('hidden'); useSkill(s.id); };
      grid.appendChild(b);
    }
    box.appendChild(grid); host.appendChild(box);
  }
})();
$('#btnSkills').onclick = () => { openPanel(); $('#skills').classList.toggle('hidden'); };
$('#skillsClose').onclick = () => $('#skills').classList.add('hidden');
document.querySelectorAll('#skills button[data-task]').forEach((b) => b.addEventListener('click', () => $('#skills').classList.add('hidden')));
document.querySelectorAll('#chips button[data-skill]').forEach((b) => (b.onclick = () => useSkill(b.dataset.skill)));
$('#btnClip').onclick = () => clipboardMenu();
window.pip.onClipboardKey(() => clipboardMenu());

// ---------------------------------------------------------------- running a skill
function useSkill(id) {
  const s = SKILLS.find((x) => x.id === id);
  if (!s) return;
  openPanel();
  switch (s.run) {
    case 'data': return $('#btnExcel').click();
    case 'summary': return $('#btnSummarize').click();
    case 'file': return skillWithFile(s);
    case 'clipimage': return skillWithScreenshot(s);
    case 'plan': return planMyDay();
    case 'reminders': return showReminders();
    case 'focus': return toggleFocus();
  }
  // text skills: show the chip and wait for the user's input
  activeSkill = s;
  $('#skillChipName').textContent = `${s.icon} ${s.name}`;
  $('#skillChip').classList.remove('hidden');
  input.placeholder = s.hint + '  (Enter = go)';
  input.focus();
}

function clearSkill() {
  activeSkill = null;
  $('#skillChip').classList.add('hidden');
  applyCharacter();   // restores the normal placeholder
}
$('#skillChipX').onclick = clearSkill;

function submitSkill(text) {
  const s = activeSkill;
  clearSkill();
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  askAI({
    text: s.prompt.replace('{input}', text || '(see the attached file)').replace('{date}', today),
    display: `${s.icon} ${s.name}: ${text.length > 160 ? text.slice(0, 160) + '...' : text}`,
    copyResult: !!s.copy, autoPpt: !!s.autoPpt,
  });
}

async function skillWithFile(s) {
  const p = await window.pip.pickFile();
  if (!p) return;
  if (await attachPath(p)) askAI({ text: s.prompt, display: `${s.icon} ${s.name}: ${attachment.name}` });
}

async function skillWithScreenshot(s) {
  const clip = await window.pip.readClipboard();
  if (!clip.image) {
    addMsg('pip', md('First copy a screenshot: press **Win + Shift + S**, select the area, then click **' + s.name + '** again.'));
    mood('worried', 1500);
    return;
  }
  attachment = { name: 'screenshot.png', inline: { mimeType: 'image/png', data: clip.image } };
  askAI({ text: s.prompt, display: `${s.icon} ${s.name}` });
}

// ---------------------------------------------------------------- clipboard actions (Ctrl+Alt+C)
const CLIP_ACTIONS = [
  { label: '✍️ Fix & polish', skill: 'polish' },
  { label: '👔 Make formal', copy: true, prompt: 'Rewrite this in a polite, formal business tone, same language. Output ONLY the rewritten text.\n\n{input}' },
  { label: '🌐 Translate', skill: 'translate' },
  { label: '📝 Summarize', prompt: 'Summarize this in 3-5 bullets, plus any action items or deadlines.\n\n{input}' },
  { label: '↩️ Reply', skill: 'reply' },
  { label: '💡 Explain', skill: 'explain' },
  { label: '📋 To Excel table', skill: 'table' },
];

async function clipboardMenu() {
  openPanel();
  const clip = await window.pip.readClipboard();
  const text = (clip.text || '').trim();
  if (!text && !clip.image) {
    addMsg('pip', md('Your clipboard is empty. Copy some text (**Ctrl+C**) or a screenshot (**Win+Shift+S**), then press **Ctrl+Alt+C** or click 📋 Clipboard.'));
    return;
  }
  const el = addMsg('pip', md(clip.image && !text ? 'You copied an **image**. What should I do with it?' : 'You copied this. What should I do with it?'));
  const prev = document.createElement('div'); prev.className = 'clipPreview';
  if (clip.image && !text) prev.innerHTML = `<img src="data:image/png;base64,${clip.image}">`;
  else prev.textContent = text.length > 220 ? text.slice(0, 220) + '...' : text;
  el.appendChild(prev);
  const box = document.createElement('div'); box.className = 'fileChoices'; el.appendChild(box);
  const add = (label, fn) => { const b = document.createElement('button'); b.className = 'action'; b.textContent = label; b.onclick = () => { box.querySelectorAll('button').forEach((x) => (x.disabled = true)); fn(); }; box.appendChild(b); };
  if (clip.image && !text) {
    add('🔤 Read the text', () => { attachment = { name: 'screenshot.png', inline: { mimeType: 'image/png', data: clip.image } }; askAI({ text: SKILLS.find((s) => s.id === 'ocr').prompt, display: '🔤 Read text from copied image' }); });
    add('🌐 Translate it', () => { attachment = { name: 'screenshot.png', inline: { mimeType: 'image/png', data: clip.image } }; askAI({ text: 'Read the text in this image and translate it (Burmese → English, otherwise → Burmese). Output only the translation.', display: '🌐 Translate copied image', copyResult: true }); });
    add('💡 Explain it', () => { attachment = { name: 'screenshot.png', inline: { mimeType: 'image/png', data: clip.image } }; askAI({ text: 'Explain what this screenshot shows and what I should do (if it is an error, how to fix it).', display: '💡 Explain copied image' }); });
    return;
  }
  for (const a of CLIP_ACTIONS) {
    add(a.label, () => {
      const s = a.skill && SKILLS.find((x) => x.id === a.skill);
      const prompt = s ? s.prompt : a.prompt;
      askAI({ text: prompt.replace('{input}', text).replace('{date}', new Date().toDateString()), display: `${a.label}: ${text.slice(0, 120)}${text.length > 120 ? '...' : ''}`, copyResult: s ? !!s.copy : !!a.copy });
    });
  }
}

// ---------------------------------------------------------------- tables -> Excel
function renderTable(container, spec) {
  const cols = (spec.columns || []).map(String), rows = Array.isArray(spec.rows) ? spec.rows : [];
  if (!cols.length) return;
  const wrap = document.createElement('div'); wrap.className = 'tableWrap';
  const shown = rows.slice(0, 60);
  wrap.innerHTML = '<table class="dataTable"><tr>' + cols.map((c) => `<th>${esc(c)}</th>`).join('') + '</tr>' +
    shown.map((r) => '<tr>' + cols.map((_, i) => `<td>${esc(String(r[i] ?? ''))}</td>`).join('') + '</tr>').join('') + '</table>';
  container.appendChild(wrap);
  if (rows.length > shown.length) { const n = document.createElement('div'); n.className = 'chartCap'; n.textContent = `+ ${rows.length - shown.length} more rows (all go to Excel)`; container.appendChild(n); }
  const bar = document.createElement('div'); bar.className = 'msgTools';
  const xl = document.createElement('button'); xl.textContent = 'Open in Excel';
  xl.onclick = async () => {
    xl.disabled = true; xl.textContent = 'Opening Excel...';
    const r = await window.pip.officeMake('excel', { Title: spec.title || 'Pip table', Columns: cols, Rows: rows });
    xl.disabled = false; xl.textContent = 'Open in Excel';
    if (r.ok) { sys(`✔ ${r.msg} opened in Excel (not saved yet - press Ctrl+S to keep it).`); mood('happy', 1500); } else errMsg('Excel: ' + r.error);
  };
  const tsv = document.createElement('button'); tsv.textContent = 'Copy for Excel';
  tsv.onclick = () => { window.pip.copy([cols, ...rows].map((r) => r.map((c) => String(c ?? '').replace(/\t|\n/g, ' ')).join('\t')).join('\n')); tsv.textContent = 'Copied ✔ (paste in Excel)'; };
  bar.appendChild(xl); bar.appendChild(tsv); container.appendChild(bar);
}

// ---------------------------------------------------------------- slides -> PowerPoint
function renderSlides(container, spec, auto) {
  const slides = Array.isArray(spec.slides) ? spec.slides : [];
  const box = document.createElement('div'); box.className = 'chart';
  box.innerHTML = `<b>🎞 ${esc(spec.title || 'Presentation')}</b> <span class="chartCap">${slides.length + 1} slides</span>` +
    '<ol class="slideList">' + slides.map((s) => `<li>${esc(s.title || '')}</li>`).join('') + '</ol>';
  const bar = document.createElement('div'); bar.className = 'msgTools';
  const b = document.createElement('button'); b.textContent = 'Create PowerPoint';
  const make = async () => {
    b.disabled = true; b.textContent = 'Building slides...';
    const r = await window.pip.officeMake('ppt', { Title: spec.title || 'Presentation', Subtitle: spec.subtitle || '', Slides: slides.map((s) => ({ title: s.title || '', bullets: s.bullets || [], notes: s.notes || '' })) });
    b.disabled = false; b.textContent = 'Create PowerPoint';
    if (r.ok) { sys(`✔ ${r.msg} opened (not saved yet - press Ctrl+S to keep it). Tip: Design → Designer for more styles.`); mood('happy', 1500); } else errMsg('PowerPoint: ' + r.error);
  };
  b.onclick = make;
  bar.appendChild(b); box.appendChild(bar); container.appendChild(box);
  if (auto) make();
}

// ---------------------------------------------------------------- reminders
const fmtWhen = (ms) => new Date(ms).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

async function setReminderFromTag({ when, text }) {
  const at = new Date(when.replace(' ', 'T'));
  if (isNaN(at)) { errMsg(`Couldn't understand the time "${when}"`); return; }
  if (at.getTime() < Date.now() - 60000) { errMsg(`That time (${fmtWhen(at.getTime())}) has already passed - reminder not set.`); return; }
  const r = await window.pip.addReminder(at.getTime(), text);
  const el = addMsg('sys', esc(`⏰ Reminder set: ${fmtWhen(r.at)} - ${r.text}  `));
  const undo = document.createElement('button'); undo.className = 'action'; undo.textContent = 'Cancel';
  undo.onclick = async () => { await window.pip.removeReminder(r.id); el.textContent = '⏰ Reminder cancelled.'; };
  el.appendChild(undo);
}

async function showReminders() {
  const list = await window.pip.listReminders();
  const el = addMsg('pip', md(list.length ? `**Your reminders (${list.length})**` : 'No reminders yet. Tell me e.g. *"remind me at 3pm to call the supplier"*.'));
  for (const r of list) {
    const row = document.createElement('div'); row.className = 'remRow';
    row.innerHTML = `<span>⏰ <b>${esc(fmtWhen(r.at))}</b> — ${esc(r.text)}</span>`;
    const x = document.createElement('button'); x.textContent = 'Delete';
    x.onclick = async () => { await window.pip.removeReminder(r.id); row.remove(); };
    row.appendChild(x); el.appendChild(row);
  }
}

window.pip.onReminder((r) => {
  openPanel();
  const msg = `⏰ ${r.late ? 'Missed reminder' : 'Reminder'}: ${r.text}`;
  addMsg('pip', md(`**${esc(msg)}**` + (r.late ? `\n(was due ${fmtWhen(r.at)})` : '')));
  mood('happy', 3000);
  charSound('alert');
  say(msg, 30000);
  speak(msg.replace('⏰', ''));
  history.push({ role: 'model', text: `(Reminder shown to the user: ${r.text})` });
});

// ---------------------------------------------------------------- focus timer (Pomodoro)
let focus = null;
function toggleFocus() {
  const btn = $('#btnFocus');
  if (focus) {
    clearTimeout(focus.timer); focus = null;
    btn.classList.remove('on'); btn.innerHTML = '🍅 Focus';
    sys('🍅 Focus timer stopped.');
    return;
  }
  const startRound = () => {
    const end = Date.now() + 25 * 60000;
    btn.classList.add('on');
    const tick = () => {
      if (!focus) return;
      const left = Math.max(0, Math.ceil((end - Date.now()) / 60000));
      btn.innerHTML = `🍅 ${left} min`;
      if (Date.now() >= end) return breakTime();
      focus.timer = setTimeout(tick, 15000);
    };
    focus = { timer: null }; tick();
  };
  const breakTime = () => {
    btn.classList.remove('on'); btn.innerHTML = '☕ Break';
    notify('🍅 25 minutes done! Take a 5-minute break: stand up, stretch, drink some water.');
    focus.timer = setTimeout(() => {
      notify('Break over — starting the next 25-minute focus round. Click 🍅 to stop.');
      startRound();
    }, 5 * 60000);
  };
  startRound();
  sys('🍅 Focus 25 min started. I\'ll tell you when to take a break. Click the 🍅 button again to stop.');
  mood('happy', 1200);
}

function notify(text) {
  window.pip.showWindow();
  charSound('alert');
  addMsg('pip', md('**' + esc(text) + '**'));
  say(text, 20000);
  speak(text);
  mood('happy', 3000);
}

// ---------------------------------------------------------------- plan my day
async function planMyDay() {
  const note = await window.pip.todayNote();
  const rems = await window.pip.listReminders();
  const today = new Date().toDateString();
  const todays = rems.filter((r) => new Date(r.at).toDateString() === today).map((r) => `- ${fmtWhen(r.at)}: ${r.text}`).join('\n');
  if (!note.ok && !todays) {
    addMsg('pip', md("Tell me what you need to do today (one per line), and I'll make a plan. Or open **Today's note** in Skills → PC tasks, write your to-dos, save, and click **Plan my day** again."));
    useSkillCustom('🗓️ Plan my day', 'List your tasks for today...', (t) => planAsk(t, todays));
    return;
  }
  planAsk(note.ok ? note.text : '', todays);
}
function planAsk(tasks, reminders) {
  askAI({
    display: '🗓️ Plan my day',
    text: `Make a realistic time-blocked plan for the rest of today (it is now ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}). ` +
      'Put the hardest/most important work first, group small tasks, add short breaks and a lunch break, leave buffer time. ' +
      'Use a markdown table (Time | Task | Why/Notes). Then list what can wait until tomorrow. Do not invent tasks.\n\n' +
      `MY TASKS:\n"""\n${tasks}\n"""` + (reminders ? `\n\nFIXED REMINDERS TODAY:\n${reminders}` : ''),
  });
}
// a one-off text skill with a custom handler
function useSkillCustom(label, hint, handler) {
  activeSkill = { id: 'custom', icon: '', name: label, hint, prompt: '{input}' };
  $('#skillChipName').textContent = label;
  $('#skillChip').classList.remove('hidden');
  input.placeholder = hint;
  input.focus();
  activeSkill.handler = handler;
}
const _submitSkill = submitSkill;
submitSkill = function (text) {
  if (activeSkill && activeSkill.handler) { const h = activeSkill.handler; clearSkill(); return h(text); }
  return _submitSkill(text);
};
