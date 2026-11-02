// Pip - AI desktop buddy for OfficeAuto.
// Main process: transparent always-on-top window, tray, hotkeys, Gemini calls
// (direct or via the Vercel relay), file reading and OfficeAuto task runner.
const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, globalShortcut,
  session, net, safeStorage, dialog, clipboard, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');            // OfficeAuto folder
const SCRIPT = path.join(ROOT, 'OfficeAuto.ps1');
const SETTINGS_FILE = () => path.join(app.getPath('userData'), 'settings.json');

const DEFAULTS = {
  mode: 'relay',                                       // 'relay' (no VPN needed) or 'direct'
  relayUrl: 'https://interview-relay.vercel.app/api/ask',
  proxy: '',                                           // e.g. http://127.0.0.1:8118 for direct mode
  model: 'gemini-2.5-flash',
  replyLang: 'auto',                                   // auto | en | my
  speak: true,
  voice: '',
  userName: '',
  autoStart: true,                                     // launch Pip when Windows starts
};
const KEY_FILE = path.join(__dirname, 'api-key.txt'); // optional plain-text keys, one per line

let win, tray, settings, apiKey = '';

// ---------------------------------------------------------------- settings (key encrypted with DPAPI)
function loadSettings() {
  let raw = {};
  try { raw = JSON.parse(fs.readFileSync(SETTINGS_FILE(), 'utf8')); } catch { }
  settings = { ...DEFAULTS, ...raw };
  delete settings.keyEnc;
  apiKey = '';
  if (raw.keyEnc) {
    try { apiKey = safeStorage.decryptString(Buffer.from(raw.keyEnc, 'base64')); } catch { }
  }
}

function saveSettings(patch) {
  if (typeof patch.apiKey === 'string') { apiKey = parseKeys(patch.apiKey).join(','); delete patch.apiKey; }
  settings = { ...settings, ...patch };
  const out = { ...settings };
  if (apiKey) out.keyEnc = safeStorage.encryptString(apiKey).toString('base64');
  fs.mkdirSync(path.dirname(SETTINGS_FILE()), { recursive: true });
  fs.writeFileSync(SETTINGS_FILE(), JSON.stringify(out, null, 2));
  applyProxy();
  applyAutoStart();
}

// Keys can come from Settings (encrypted), the GEMINI_API_KEY env var, or api-key.txt.
// Several keys = automatic rotation when one runs out of free quota.
function parseKeys(text) {
  return String(text || '').split(/\r?\n/).map(l => l.replace(/#.*$/, ''))
    .join(',').split(/[,\s]+/).map(k => k.trim()).filter(Boolean)
    .filter((k, i, a) => a.indexOf(k) === i);
}
function keySource() {
  if (parseKeys(apiKey).length) return { keys: parseKeys(apiKey), from: 'Settings' };
  if (parseKeys(process.env.GEMINI_API_KEY).length) return { keys: parseKeys(process.env.GEMINI_API_KEY), from: 'GEMINI_API_KEY env' };
  try { const k = parseKeys(fs.readFileSync(KEY_FILE, 'utf8')); if (k.length) return { keys: k, from: 'api-key.txt' }; } catch { }
  return { keys: [], from: '' };
}
const mask = k => k.length > 10 ? `${k.slice(0, 4)}...${k.slice(-4)}` : '****';

function applyAutoStart() {
  // unpackaged Electron: launch electron.exe with this app folder as the argument
  app.setLoginItemSettings({
    openAtLogin: !!settings.autoStart, name: 'Pip OfficeAuto Buddy',
    path: process.execPath, args: [app.getAppPath()],
  });
}

function publicSettings() {
  const { keys, from } = keySource();
  return { ...settings, hasKey: keys.length > 0, keyCount: keys.length, keyMasks: keys.map(mask), keyFrom: from };
}

function applyProxy() {
  const rules = settings.mode === 'direct' && settings.proxy ? settings.proxy : '';
  session.defaultSession.setProxy(rules ? { proxyRules: rules } : { mode: 'direct' });
}

// ---------------------------------------------------------------- window
function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  const W = 420, H = Math.min(700, workArea.height - 20);
  win = new BrowserWindow({
    width: W, height: H,
    x: workArea.x + workArea.width - W - 20, y: workArea.y + workArea.height - H,
    transparent: true, frame: false, resizable: false, hasShadow: false,
    skipTaskbar: true, alwaysOnTop: true, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: false },
  });
  win.setAlwaysOnTop(true, 'floating');
  win.setIgnoreMouseEvents(true, { forward: true });   // transparent area clicks pass through
  win.loadFile('index.html');
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.once('ready-to-show', () => win.showInactive());
}

function trayIcon() {
  // 16x16 BGRA bitmap: a teal circle, drawn in code so no icon file is needed
  const s = 16, buf = Buffer.alloc(s * s * 4);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const d = Math.hypot(x - 7.5, y - 7.5), i = (y * s + x) * 4;
    if (d < 7.5) { buf[i] = 0xb4; buf[i + 1] = 0xa8; buf[i + 2] = 0x14; buf[i + 3] = 255; }
    if (d < 2.2 && y < 9) { buf[i] = buf[i + 1] = buf[i + 2] = 255; }
  }
  return nativeImage.createFromBitmap(buf, { width: s, height: s });
}

function createTray() {
  tray = new Tray(trayIcon());
  tray.setToolTip('Pip - AI office buddy');
  tray.on('click', toggle);
  refreshTray();
}

function refreshTray() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show / hide Pip  (Ctrl+Alt+Space)', click: toggle },
    { label: 'Settings / API keys', click: () => { win.show(); win.webContents.send('ui:open', 'settings'); } },
    { label: 'Start with Windows', type: 'checkbox', checked: !!settings.autoStart,
      click: (item) => { saveSettings({ autoStart: item.checked }); win.webContents.send('ui:settings'); } },
    { label: 'Reset position', click: resetPosition },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]));
}

function toggle() {
  if (win.isVisible()) win.hide();
  else { win.show(); win.webContents.send('ui:open', 'chat'); }
}

function resetPosition() {
  const { workArea } = screen.getPrimaryDisplay();
  const [W, H] = win.getSize();
  win.setPosition(workArea.x + workArea.width - W - 20, workArea.y + workArea.height - H);
}

// ---------------------------------------------------------------- Gemini
// Streams the answer text to the renderer via 'ai:chunk'; resolves with the full text.
async function ask(req, onlyKeys) {
  const keys = onlyKeys || keySource().keys;
  if (!keys.length) throw new Error('NO_KEY: open Settings and paste your free Gemini API key (aistudio.google.com/apikey).');
  const send = t => win && win.webContents.send('ai:chunk', { id: req.id, text: t });
  const models = [settings.model, 'gemini-2.5-flash', 'gemini-2.5-flash-lite'].filter((m, i, a) => m && a.indexOf(m) === i);

  if (settings.mode === 'relay') {
    // relay is single-turn: fold recent history into the system prompt
    const hist = (req.history || []).map(h => `${h.role === 'user' ? 'User' : 'Pip'}: ${h.text}`).join('\n');
    const body = {
      system: req.system + (hist ? `\n\n--- Conversation so far ---\n${hist}` : ''),
      type: req.audio ? 'audio' : 'text',
      payload: req.audio || req.text || '(see attached file)',
      images: req.files || [],
      models, max_output_tokens: 4096, temperature: 0.6,
    };
    const res = await net.fetch(settings.relayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Gemini-Key': keys.join(',') },   // relay rotates on 429
      body: JSON.stringify(body),
    });
    if (res.status === 429) throw new Error('Gemini free quota is used up for this key (or the key was revoked). Wait a while, or paste a fresh key in Settings.');
    if (res.status === 401) throw new Error('Gemini rejected the API key. Paste a valid key from aistudio.google.com/apikey in Settings.');
    if (!res.ok) throw new Error(`Relay ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return readStream(res.body, chunk => send(chunk));
  }

  // direct mode: real multi-turn contents, SSE stream
  const contents = (req.history || []).map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.text }] }));
  const parts = [];
  if (req.audio) parts.push({ inlineData: { mimeType: 'audio/wav', data: req.audio } });
  for (const f of req.files || []) parts.push({ inlineData: f });
  if (req.text) parts.push({ text: req.text });
  contents.push({ role: 'user', parts });
  let lastErr = '';
  for (const model of models) for (const key of keys) {
    const res = await net.fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] }, contents,
        generationConfig: { temperature: 0.6, maxOutputTokens: 4096 },
      }),
    });
    if ([429, 404, 400, 403].includes(res.status)) { lastErr = `${model} ${mask(key)}: ${res.status}`; continue; }
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    let buf = '', full = '';
    await readStream(res.body, chunk => {
      buf += chunk;
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        try {
          const j = JSON.parse(line.slice(5));
          const t = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
          if (t) { full += t; send(t); }
        } catch { }
      }
    });
    return full;
  }
  throw new Error('QUOTA_EXHAUSTED (' + lastErr + ') - free quota used up, try again later or add another key.');
}

async function readStream(body, onChunk) {
  const reader = body.getReader(), dec = new TextDecoder();
  let full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const t = dec.decode(value, { stream: true });
    full += t; onChunk(t);
  }
  return full;
}

async function listModels() {
  const key = keySource().keys[0];
  if (!key || settings.mode !== 'direct') return [];
  const res = await net.fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key } });
  if (!res.ok) return [];
  const j = await res.json();
  return (j.models || [])
    .filter(m => (m.supportedGenerationMethods || []).includes('generateContent') && /gemini/.test(m.name))
    .map(m => m.name.replace('models/', ''));
}

// Tests every key separately with a tiny prompt; keys typed in the box can be tested before saving.
async function testKeys(text) {
  const keys = text && parseKeys(text).length ? parseKeys(text) : keySource().keys;
  const out = [];
  for (const k of keys) {
    const t0 = Date.now();
    try {
      const r = await ask({ id: -1, system: 'Reply with exactly: OK', text: 'ping' }, [k]);
      out.push({ key: mask(k), ok: true, msg: `works (${((Date.now() - t0) / 1000).toFixed(1)}s): ${r.trim().slice(0, 20)}` });
    } catch (e) { out.push({ key: mask(k), ok: false, msg: String(e.message).slice(0, 120) }); }
  }
  return out;
}

// ---------------------------------------------------------------- files -> Gemini parts
const TEXT_EXT = ['.txt', '.md', '.csv', '.json', '.log', '.xml', '.html', '.ps1', '.py', '.js', '.sql'];
const MIME = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

async function readFileForAI(p) {
  const ext = path.extname(p).toLowerCase(), name = path.basename(p);
  const limit = settings.mode === 'relay' ? 2.8 * 1024 * 1024 : 15 * 1024 * 1024;
  if (ext === '.docx') {
    const mammoth = require('mammoth');
    const { value } = await mammoth.extractRawText({ path: p });
    return { name, text: value.slice(0, 150000) };
  }
  if (['.xlsx', '.xlsm', '.xls', '.csv'].includes(ext)) {
    const tables = ext === '.csv' ? [csvTable(fs.readFileSync(p, 'utf8'), path.basename(p, ext))] : await excelTables(p);
    if (!tables.some(t => t.rows.length)) throw new Error(`${name} has no data rows.`);
    return { name, text: tablesToText(tables), tables };
  }
  if (TEXT_EXT.includes(ext)) return { name, text: fs.readFileSync(p, 'utf8').slice(0, 150000) };
  if (MIME[ext]) {
    const size = fs.statSync(p).size;
    if (size > limit) throw new Error(`${name} is ${(size / 1048576).toFixed(1)} MB - too big (max ${(limit / 1048576).toFixed(1)} MB in ${settings.mode} mode).`);
    return { name, inline: { mimeType: MIME[ext], data: fs.readFileSync(p).toString('base64') } };
  }
  throw new Error(`Can't read ${ext} files yet. Try Excel, CSV, PDF, DOCX, TXT or an image.`);
}

// ---------------------------------------------------------------- spreadsheets -> tables
// A table is { sheet, columns: [..], rows: [[..], ..] }. The renderer charts from these real
// values; the AI only gets a text preview and picks columns.
const MAX_ROWS = 20000;

function cellValue(v) {
  if (v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v) ? '' : v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if ('result' in v) return cellValue(v.result);                       // formula
    if (Array.isArray(v.richText)) return v.richText.map(r => r.text).join('');
    if ('text' in v) return String(v.text);                              // hyperlink
    if ('error' in v) return '';
    return '';
  }
  return v;
}

function toTable(sheet, grid) {
  grid = grid.filter(r => r.some(c => c !== ''));
  if (!grid.length) return { sheet, columns: [], rows: [] };
  const width = Math.max(...grid.map(r => r.length));
  const columns = Array.from({ length: width }, (_, i) => String(grid[0][i] ?? '').trim() || `Column ${i + 1}`);
  const rows = grid.slice(1, MAX_ROWS + 1).map(r => Array.from({ length: width }, (_, i) => r[i] ?? ''));
  return { sheet, columns, rows, truncated: grid.length - 1 > MAX_ROWS };
}

async function excelTables(p) {
  let file = p;
  if (path.extname(p).toLowerCase() === '.xls') file = await xlsToXlsx(p);   // old format: let Excel convert it
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(fs.readFileSync(file)); }
  catch (e) { throw new Error(`Couldn't read ${path.basename(p)}: ${e.code === 'EBUSY' ? 'file is locked' : e.message}`); }
  const tables = [];
  wb.eachSheet(ws => {
    if (tables.length >= 5) return;
    const grid = [];
    ws.eachRow({ includeEmpty: false }, row => {
      const vals = row.values.slice(1).map(cellValue);    // row.values is 1-based
      grid.push(vals);
    });
    const t = toTable(ws.name, grid);
    if (t.rows.length) tables.push(t);
  });
  return tables;
}

function xlsToXlsx(p) {
  const out = path.join(app.getPath('temp'), `pip-${Date.now()}.xlsx`);
  const ps = `$x=New-Object -ComObject Excel.Application;$x.DisplayAlerts=$false;$w=$x.Workbooks.Open([string]'${p.replace(/'/g, "''")}',0,$true);$w.SaveAs([string]'${out}',51);$w.Close($false);$x.Quit()`;
  return new Promise((resolve, reject) => {
    const c = spawn(path.join(process.env.WINDIR, 'System32\\WindowsPowerShell\\v1.0\\powershell.exe'), ['-NoProfile', '-Command', ps], { windowsHide: true });
    c.on('close', () => fs.existsSync(out) ? resolve(out) : reject(new Error('Old .xls format needs Microsoft Excel - or save it as .xlsx first.')));
  });
}

function csvTable(text, sheet) {
  const rows = [];
  let row = [], cell = '', q = false;
  const delim = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return toTable(sheet, rows.map(r => r.map(c => c.trim())));
}

const csvCell = v => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

function tablesToText(tables) {
  let budget = 60000;
  return tables.map(t => {
    const head = `### Sheet "${t.sheet}": ${t.rows.length}${t.truncated ? '+' : ''} rows. Columns: ${t.columns.join(' | ')}`;
    const lines = [t.columns.map(csvCell).join(',')];
    for (const r of t.rows) {
      const line = r.map(csvCell).join(',');
      if (budget - line.length < 0) { lines.push(`... (${t.rows.length - lines.length + 1} more rows not shown - Pip has them all for charts)`); break; }
      budget -= line.length; lines.push(line);
    }
    return head + '\n' + lines.join('\n');
  }).join('\n\n');
}

// Path of the workbook currently open in Excel (if any). Uses the running Excel via COM.
function activeExcelPath() {
  const ps = "try{$x=[Runtime.InteropServices.Marshal]::GetActiveObject('Excel.Application');$w=$x.ActiveWorkbook;if($w){[Console]::Out.Write($w.FullName+'|'+$w.Saved)}}catch{}";
  return new Promise(resolve => {
    const c = spawn(path.join(process.env.WINDIR, 'System32\\WindowsPowerShell\\v1.0\\powershell.exe'), ['-NoProfile', '-Command', ps], { windowsHide: true });
    let out = '';
    c.stdout.on('data', d => out += d);
    c.on('close', () => {
      const [full, saved] = out.trim().split('|');
      if (!full) return resolve({ open: false });
      if (!/[\\/]/.test(full)) return resolve({ open: true, unsaved: true, name: full });   // "Book1" - never saved
      resolve({ open: true, path: full, name: path.basename(full), saved: saved === 'True' });
    });
  });
}

// ---------------------------------------------------------------- OfficeAuto bridge
function officeConfig() {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8')); } catch { return {}; }
}
const expand = p => String(p || '').replace(/%([^%]+)%/g, (_, v) => process.env[v] || '');

function todayStamp() {
  const d = new Date(), z = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

// programs Pip may open on request (fixed list - the AI never runs arbitrary commands)
const APPS = {
  excel: 'excel', word: 'winword', powerpoint: 'powerpnt', outlook: 'outlook', notepad: 'notepad',
  calculator: 'calc', explorer: 'explorer', edge: 'msedge', chrome: 'chrome', teams: 'ms-teams:',
  paint: 'mspaint', snip: 'ms-screenclip:',
};

const ALLOWED_TASKS = ['Organize', 'Backup', 'CleanTemp', 'Morning', 'DailyNote', 'ToPdf', 'Duplicates'];

function runTask(task, folder) {
  return new Promise((resolve) => {
    if (!ALLOWED_TASKS.includes(task)) return resolve({ ok: false, out: 'Unknown task ' + task });
    const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT, '-Task', task];
    if (folder) args.push('-Folder', folder);
    const ps = spawn(path.join(process.env.WINDIR, 'System32\\WindowsPowerShell\\v1.0\\powershell.exe'), args, { windowsHide: true });
    let out = '';
    ps.stdout.on('data', d => out += d); ps.stderr.on('data', d => out += d);
    ps.on('close', code => resolve({ ok: code === 0, out: out.trim().split(/\r?\n/).slice(-6).join('\n') }));
  });
}

// ---------------------------------------------------------------- IPC
function registerIpc() {
  ipcMain.on('win:ignore', (_e, ignore) => win.setIgnoreMouseEvents(ignore, { forward: true }));
  ipcMain.on('win:move', (_e, { x, y }) => win.setPosition(Math.round(x), Math.round(y)));
  ipcMain.on('win:hide', () => win.hide());
  ipcMain.handle('win:pos', () => win.getPosition());
  ipcMain.handle('settings:get', () => publicSettings());
  ipcMain.handle('settings:set', (_e, patch) => { saveSettings(patch); refreshTray(); return publicSettings(); });
  ipcMain.handle('ai:test', (_e, text) => testKeys(text));
  ipcMain.handle('ai:ask', async (_e, req) => {
    try { return { ok: true, text: await ask(req) }; } catch (err) { return { ok: false, error: String(err.message || err) }; }
  });
  ipcMain.handle('ai:models', () => listModels().catch(() => []));
  ipcMain.handle('file:read', async (_e, p) => {
    try { return { ok: true, ...(await readFileForAI(p)) }; } catch (err) { return { ok: false, error: String(err.message || err) }; }
  });
  ipcMain.handle('file:pick', async () => {
    const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Documents', extensions: ['xlsx', 'xlsm', 'xls', 'csv', 'pdf', 'docx', 'txt', 'md', 'json', 'log', 'png', 'jpg', 'jpeg', 'webp'] }] });
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.handle('folder:pick', async () => {
    const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
    return r.canceled ? null : r.filePaths[0];
  });
  ipcMain.handle('task:run', (_e, { task, folder }) => runTask(task, folder));
  ipcMain.handle('note:today', () => {
    const p = path.join(expand(officeConfig().NotesFolder || '%USERPROFILE%\\Documents\\DailyNotes'), todayStamp() + '.md');
    return fs.existsSync(p) ? { ok: true, path: p, text: fs.readFileSync(p, 'utf8') } : { ok: false, path: p };
  });
  ipcMain.handle('open:url', async (_e, url) => {
    let u;
    try { u = new URL(url); } catch { return { ok: false, error: 'Bad link: ' + url }; }
    if (!['https:', 'http:'].includes(u.protocol)) return { ok: false, error: 'Only web links can be opened.' };
    await shell.openExternal(u.href);
    return { ok: true, label: u.hostname.replace(/^www\./, '') };
  });
  ipcMain.handle('open:app', (_e, name) => {
    const key = String(name).toLowerCase().trim();
    const target = APPS[key];
    if (!target) return { ok: false, error: `I can't open "${name}". I can open: ${Object.keys(APPS).join(', ')}.` };
    // "start" resolves App Paths (excel, winword...) and URI schemes (ms-teams:, ms-screenclip:)
    spawn('cmd.exe', ['/d', '/s', '/c', `start "" ${target}`],
      { windowsHide: true, detached: true, stdio: 'ignore', windowsVerbatimArguments: true }).unref();
    return { ok: true, label: key };
  });
  ipcMain.handle('excel:active', () => activeExcelPath());
  ipcMain.handle('clip:image', (_e, dataUrl) => { clipboard.writeImage(nativeImage.createFromDataURL(dataUrl)); return true; });
  ipcMain.handle('file:savePng', async (_e, { dataUrl, name }) => {
    const r = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('documents'), name), filters: [{ name: 'PNG image', extensions: ['png'] }] });
    if (r.canceled) return null;
    fs.writeFileSync(r.filePath, Buffer.from(dataUrl.split(',')[1], 'base64'));
    return r.filePath;
  });
  ipcMain.handle('clip:write', (_e, t) => { clipboard.writeText(t); return true; });
  ipcMain.handle('mail:draft', (_e, { subject, body }) =>
    shell.openExternal(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.slice(0, 1800))}`));
}

// ---------------------------------------------------------------- app lifecycle
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win) { win.show(); win.webContents.send('ui:open', 'chat'); } });

app.whenReady().then(() => {
  loadSettings();
  applyProxy();
  applyAutoStart();
  session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(perm === 'media'));
  registerIpc();
  createWindow();
  createTray();
  globalShortcut.register('Control+Alt+Space', toggle);
  globalShortcut.register('Control+Alt+V', () => { win.show(); win.webContents.send('ui:ptt'); });
});
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
