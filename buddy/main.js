// Pip - AI desktop buddy for OfficeAuto.
// Main process: transparent always-on-top window, tray, hotkeys, Gemini calls
// (direct or via the Vercel relay), file reading and OfficeAuto task runner.
const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, globalShortcut,
  session, net, safeStorage, dialog, clipboard, shell, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');            // OfficeAuto folder
const SCRIPT = path.join(ROOT, 'OfficeAuto.ps1');
const SETTINGS_FILE = () => path.join(app.getPath('userData'), 'settings.json');

const DEFAULTS = {
  activeProvider: '',                                  // id of the provider used first
  fallback: true,                                      // if it fails, try the other providers
  proxy: '',                                           // e.g. http://127.0.0.1:8118 for blocked services
  replyLang: 'auto',                                   // auto | en | my
  speak: true,
  voice: '',
  userName: '',
  character: 'pip',                                   // pip | bears
  autoStart: true,                                     // launch Pip when Windows starts
};
let win, tray, settings;
let providers = [];            // [{ id, preset, type, name, mode, relayUrl, baseUrl, model, keys[] }] - keys decrypted in memory only
const AI = require('./providers')({ net });

// ---------------------------------------------------------------- settings (API keys encrypted with Windows DPAPI)
const enc = (keys) => (keys.length ? safeStorage.encryptString(keys.join(',')).toString('base64') : '');
const dec = (b64) => { try { return b64 ? AI.parseKeys(safeStorage.decryptString(Buffer.from(b64, 'base64'))) : []; } catch { return []; } };

function loadSettings() {
  let raw = {};
  try { raw = JSON.parse(fs.readFileSync(SETTINGS_FILE(), 'utf8')); } catch { }
  settings = { ...DEFAULTS, ...raw };
  if (Array.isArray(raw.providers)) {
    providers = raw.providers.map(({ keyEnc, ...p }) => ({ ...p, keys: dec(keyEnc) }));
  } else {
    // first run of the multi-provider version: turn the old single Gemini setup into a provider
    providers = [{ ...AI.PRESETS.gemini, id: 'gemini1', preset: 'gemini',
      mode: raw.mode || 'relay', relayUrl: raw.relayUrl || AI.PRESETS.gemini.relayUrl, model: raw.model || AI.PRESETS.gemini.model, keys: dec(raw.keyEnc) }];
    settings.activeProvider = 'gemini1';
  }
  for (const k of ['keyEnc', 'mode', 'relayUrl', 'model', 'providers']) delete settings[k];
  if (!providers.some((p) => p.id === settings.activeProvider)) settings.activeProvider = providers[0]?.id || '';
}

function saveSettings(patch = {}) {
  settings = { ...settings, ...patch };
  const out = { ...settings, providers: providers.map(({ keys, ...p }) => ({ ...p, keyEnc: enc(keys || []) })) };
  fs.mkdirSync(path.dirname(SETTINGS_FILE()), { recursive: true });
  fs.writeFileSync(SETTINGS_FILE(), JSON.stringify(out, null, 2));
  applyProxy();
  applyAutoStart();
}

const activeProvider = () => providers.find((p) => p.id === settings.activeProvider) || providers[0];

// what the renderer may see about providers (never the keys themselves)
function publicProviders() {
  return providers.map((p) => {
    const { keys, from } = AI.keysOf(p), preset = AI.PRESETS[p.preset] || {};
    return { id: p.id, preset: p.preset, type: p.type, name: p.name, mode: p.mode, relayUrl: p.relayUrl, baseUrl: p.baseUrl, model: p.model,
      keyCount: keys.length, keyMasks: keys.map(AI.mask), keyFrom: from, noKey: !!preset.noKey, keyUrl: preset.keyUrl || '', note: preset.note || '',
      active: p.id === settings.activeProvider };
  });
}

function saveProvider(draft) {
  const preset = AI.PRESETS[draft.preset] || AI.PRESETS.custom;
  let p = providers.find((x) => x.id === draft.id);
  if (!p) {
    p = { id: `${draft.preset}${Date.now().toString(36)}`, preset: draft.preset, type: preset.type, keys: [] };
    providers.push(p);
    if (providers.length === 1 || !AI.usable(activeProvider())) settings.activeProvider = p.id;
  }
  p.name = (draft.name || preset.name).trim();
  p.model = (draft.model || '').trim();
  if (p.type === 'gemini') { p.mode = draft.mode === 'direct' ? 'direct' : 'relay'; p.relayUrl = (draft.relayUrl || preset.relayUrl).trim(); }
  else if (p.type === 'openai') p.baseUrl = (draft.baseUrl || preset.baseUrl || '').trim();
  if (typeof draft.apiKey === 'string' && draft.apiKey.trim()) p.keys = AI.parseKeys(draft.apiKey);
  if (draft.clearKeys) p.keys = [];
  saveSettings();
  return p;
}

// a provider object for Test / Load models, built from the editor before it is saved
function draftProvider(draft) {
  const saved = providers.find((x) => x.id === draft.id);
  const preset = AI.PRESETS[draft.preset] || AI.PRESETS.custom;
  return { ...(saved || {}), preset: draft.preset, type: preset.type, name: draft.name || preset.name, model: draft.model,
    mode: draft.mode, relayUrl: draft.relayUrl || preset.relayUrl, baseUrl: draft.baseUrl || preset.baseUrl, keys: saved ? saved.keys : [] };
}

function applyAutoStart() {
  // unpackaged Electron: launch electron.exe with this app folder as the argument
  app.setLoginItemSettings({
    openAtLogin: !!settings.autoStart, name: 'Pip OfficeAuto Buddy',
    path: process.execPath, args: [app.getAppPath()],
  });
}

function publicSettings() {
  const a = activeProvider();
  return { ...settings, hasKey: !!a && AI.usable(a), activeName: a ? a.name : '', activeModel: a ? a.model : '',
    activeMode: a && a.type === 'gemini' ? a.mode : '', hasGemini: providers.some((p) => p.type === 'gemini' && AI.usable(p)) };
}

function applyProxy() {
  const rules = (settings.proxy || '').trim();
  session.defaultSession.setProxy(rules ? { proxyRules: rules, proxyBypassRules: '<local>' } : { mode: 'direct' });
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

// ---------------------------------------------------------------- AI (see providers.js)
// Streams the answer text to the renderer via 'ai:chunk'.
function ask(req) {
  const send = (t) => win && win.webContents.send('ai:chunk', { id: req.id, text: t });
  return AI.ask(providers, settings.activeProvider, settings.fallback, req, send);
}

// ---------------------------------------------------------------- files -> Gemini parts
const TEXT_EXT = ['.txt', '.md', '.csv', '.json', '.log', '.xml', '.html', '.ps1', '.py', '.js', '.sql'];
const MIME = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

async function readFileForAI(p) {
  const ext = path.extname(p).toLowerCase(), name = path.basename(p);
  const a = activeProvider();
  const viaRelay = a && a.type === 'gemini' && a.mode !== 'direct';
  const limit = viaRelay ? 2.8 * 1024 * 1024 : 15 * 1024 * 1024;   // the relay has a small request limit
  if (ext === '.docx') {
    const mammoth = require('mammoth');
    const { value } = await mammoth.extractRawText({ path: p });
    return { name, text: value.slice(0, 150000) };
  }
  if (['.xlsx', '.xlsm', '.xls', '.csv'].includes(ext)) {
    const tables = ext === '.csv' ? [csvTable(fs.readFileSync(p, 'utf8'), path.basename(p, ext))] : await excelTables(p);
    if (!tables.some(t => t.rows.length)) throw new Error(`${name} has no data rows.`);
    return { name, path: p, text: tablesToText(tables), tables };
  }
  if (TEXT_EXT.includes(ext)) return { name, text: fs.readFileSync(p, 'utf8').slice(0, 150000) };
  if (MIME[ext]) {
    const size = fs.statSync(p).size;
    if (size > limit) throw new Error(`${name} is ${(size / 1048576).toFixed(1)} MB - too big (max ${(limit / 1048576).toFixed(1)} MB${viaRelay ? ' through the Gemini relay' : ''}).`);
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

// Excel's own "Recent" list (registry MRU), newest first, only files that still exist.
function recentExcelFiles() {
  const ps = "Get-ChildItem 'HKCU:\\Software\\Microsoft\\Office' -EA SilentlyContinue | % { @((Join-Path $_.PSPath 'Excel\\File MRU')) + @(Get-ChildItem (Join-Path $_.PSPath 'Excel\\User MRU') -EA SilentlyContinue | % { Join-Path $_.PSPath 'File MRU' }) } | ? { Test-Path $_ } | % { (Get-ItemProperty $_).PSObject.Properties | ? Name -like 'Item*' | Sort-Object { [int]($_.Name -replace '\\D','') } | % { ($_.Value -split '\\*')[-1] } }";
  return new Promise(resolve => {
    const c = spawn(path.join(process.env.WINDIR, 'System32\\WindowsPowerShell\\v1.0\\powershell.exe'), ['-NoProfile', '-Command', ps], { windowsHide: true });
    let out = '';
    c.stdout.on('data', d => out += d);
    c.on('close', () => resolve(out.split(/\r?\n/).map(s => s.trim())
      .filter((p, i, a) => p && a.indexOf(p) === i && /\.(xlsx|xlsm|xls|csv)$/i.test(p) && fs.existsSync(p)).slice(0, 6)));
  });
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

// ---------------------------------------------------------------- Office files (Excel table / Word / PowerPoint)
function runOfficeScript(script, args, payload) {
  return new Promise((resolve) => {
    const json = path.join(app.getPath('temp'), `pip-office-${Date.now()}.json`);
    fs.writeFileSync(json, JSON.stringify(payload), 'utf8');
    const ps = spawn(path.join(process.env.WINDIR, 'System32\\WindowsPowerShell\\v1.0\\powershell.exe'),
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, script), ...args, '-Json', json], { windowsHide: true });
    let out = '';
    ps.stdout.on('data', (d) => out += d); ps.stderr.on('data', (d) => out += d);
    ps.on('close', () => {
      fs.rmSync(json, { force: true });
      const [status, msg] = out.trim().split('|');
      resolve(status === 'OK' ? { ok: true, msg } : { ok: false, error: msg || out.trim().slice(0, 200) || 'failed' });
    });
  });
}

// ---------------------------------------------------------------- reminders (survive restarts)
const REM_FILE = () => path.join(app.getPath('userData'), 'reminders.json');
let reminders = [];
function loadReminders() { try { reminders = JSON.parse(fs.readFileSync(REM_FILE(), 'utf8')); } catch { reminders = []; } }
function saveReminders() { fs.writeFileSync(REM_FILE(), JSON.stringify(reminders.filter(r => !r.done || Date.now() - r.at < 864e5), null, 2)); }
function addReminder(at, text) {
  const r = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: Number(at), text: String(text).slice(0, 300), done: false };
  reminders.push(r); saveReminders();
  return r;
}
function checkReminders() {
  const now = Date.now();
  let changed = false;
  for (const r of reminders) {
    if (r.done || r.at > now) continue;
    r.done = true; changed = true;
    const late = now - r.at > 10 * 60 * 1000;
    if (win) { if (!win.isVisible()) win.showInactive(); win.webContents.send('reminder:due', { ...r, late }); }
    if (Notification.isSupported()) new Notification({ title: '⏰ Reminder' + (late ? ' (missed)' : ''), body: r.text }).show();
  }
  if (changed) saveReminders();
}

// ---------------------------------------------------------------- IPC
function registerIpc() {
  ipcMain.on('win:ignore', (_e, ignore) => win.setIgnoreMouseEvents(ignore, { forward: true }));
  ipcMain.on('win:move', (_e, { x, y }) => win.setPosition(Math.round(x), Math.round(y)));
  ipcMain.on('win:hide', () => win.hide());
  ipcMain.on('win:show', () => { if (!win.isVisible()) win.showInactive(); });
  ipcMain.handle('office:make', (_e, { kind, payload }) => runOfficeScript('office-make.ps1', ['-Kind', kind], payload));
  ipcMain.handle('clip:read', () => {
    let img = clipboard.readImage(), image = null;
    if (!img.isEmpty()) {
      if (img.getSize().width > 1600) img = img.resize({ width: 1600 });
      image = img.toPNG().toString('base64');
    }
    return { text: clipboard.readText(), image };
  });
  ipcMain.handle('remind:add', (_e, { at, text }) => addReminder(at, text));
  ipcMain.handle('remind:list', () => reminders.filter(r => !r.done).sort((a, b) => a.at - b.at));
  ipcMain.handle('remind:remove', (_e, id) => { reminders = reminders.filter(r => r.id !== id); saveReminders(); return true; });
  ipcMain.handle('win:pos', () => win.getPosition());
  ipcMain.handle('settings:get', () => publicSettings());
  ipcMain.handle('settings:set', (_e, patch) => { saveSettings(patch); refreshTray(); return publicSettings(); });
  ipcMain.handle('ai:ask', async (_e, req) => {
    try { const r = await ask(req); return { ok: true, ...r }; } catch (err) { return { ok: false, error: String(err.message || err) }; }
  });
  ipcMain.handle('providers:list', () => ({ list: publicProviders(), presets: AI.PRESETS }));
  ipcMain.handle('providers:save', (_e, draft) => { const p = saveProvider(draft); return { id: p.id, list: publicProviders(), settings: publicSettings() }; });
  ipcMain.handle('providers:delete', (_e, id) => {
    providers = providers.filter((p) => p.id !== id);
    if (settings.activeProvider === id) settings.activeProvider = providers[0]?.id || '';
    saveSettings(); return { list: publicProviders(), settings: publicSettings() };
  });
  ipcMain.handle('providers:activate', (_e, id) => { saveSettings({ activeProvider: id }); return { list: publicProviders(), settings: publicSettings() }; });
  ipcMain.handle('providers:test', (_e, { draft, keysText }) => AI.test(draftProvider(draft), keysText));
  ipcMain.handle('providers:models', (_e, { draft, keysText }) => AI.listModels(draftProvider(draft), keysText));
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
  ipcMain.handle('excel:recent', () => recentExcelFiles());
  ipcMain.handle('excel:chart', (_e, chart) => new Promise((resolve) => {
    const json = path.join(app.getPath('temp'), `pip-chart-${Date.now()}.json`);
    fs.writeFileSync(json, JSON.stringify(chart), 'utf8');
    const ps = spawn(path.join(process.env.WINDIR, 'System32\\WindowsPowerShell\\v1.0\\powershell.exe'),
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'excel-chart.ps1'), '-Json', json], { windowsHide: true });
    let out = '';
    ps.stdout.on('data', (d) => out += d); ps.stderr.on('data', (d) => out += d);
    ps.on('close', () => {
      fs.rmSync(json, { force: true });
      const [status, a, b] = out.trim().split('|');
      resolve(status === 'OK' ? { ok: true, sheet: a, book: b } : { ok: false, error: a || out.trim().slice(0, 200) || 'Excel chart failed' });
    });
  }));
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
  app.setAppUserModelId('OfficeAuto.Pip');   // so Windows notifications show our name
  loadSettings();
  applyProxy();
  applyAutoStart();
  session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(perm === 'media'));
  registerIpc();
  createWindow();
  createTray();
  globalShortcut.register('Control+Alt+Space', toggle);
  globalShortcut.register('Control+Alt+V', () => { win.show(); win.webContents.send('ui:ptt'); });
  globalShortcut.register('Control+Alt+C', () => { win.show(); win.webContents.send('ui:clipboard'); });
  globalShortcut.register('Control+Alt+S', () => { win.show(); win.webContents.send('ui:open', 'settings'); });
  loadReminders();
  setInterval(checkReminders, 15000);
  setTimeout(checkReminders, 5000);
});
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
