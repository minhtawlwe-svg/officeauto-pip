// Self-update for packaged editions (e.g. Tom & Eaindra on a relative's PC).
// Checks the GitHub repo named in edition.json; when there is a newer commit it downloads the repo
// zip, installs the shared app files (buddy/*) plus the edition's own files, and restarts.
//  - never touches settings, keys, node_modules or the bundled Python
//  - refuses an update that needs npm libraries this copy does not have
//  - keeps a backup; if the new version fails to start twice, it rolls back
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const CODE_EXT = /\.(js|html|css|py|ps1|txt|md|json)$/i;
const NEVER = new Set(['package-lock.json', 'api-key.txt', 'api-key.example.txt', 'make-portable.ps1']);

module.exports = function createUpdater({ net, dir, edition }) {
  const repo = edition.updateRepo, branch = edition.updateBranch || 'main', editionDir = edition.editionDir;
  const enabled = !!repo && !process.defaultApp;   // the dev checkout (electron.exe .) never self-updates
  const STATE = path.join(dir, 'update-state.json'), INSTALLED = path.join(dir, 'installed.json'), BACKUP = path.join(dir, 'update-backup');
  const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
  const writeJson = (f, o) => fs.writeFileSync(f, JSON.stringify(o, null, 2));
  let busy = false;

  // ---- start-up guard: count starts of a freshly installed update; roll back after two failed starts
  function bootCheck() {
    const st = readJson(STATE);
    if (!st || !st.pending) return null;
    st.tries = (st.tries || 0) + 1;
    if (st.tries > 2 && fs.existsSync(BACKUP)) {
      copyTree(BACKUP, dir);
      if (st.previous) writeJson(INSTALLED, st.previous); else fs.rmSync(INSTALLED, { force: true });
      fs.rmSync(STATE, { force: true });
      return { rolledBack: true, message: st.message };
    }
    writeJson(STATE, st);
    return { justUpdated: st.tries === 1, message: st.message };
  }
  function markHealthy() {
    const st = readJson(STATE);
    if (st && st.pending) { st.pending = false; writeJson(STATE, st); }
  }

  async function latest() {
    const res = await net.fetch(`https://api.github.com/repos/${repo}/commits/${branch}`,
      { headers: { 'User-Agent': 'officeauto-updater', Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error(`GitHub ${res.status}`);
    const j = await res.json();
    return { sha: j.sha, date: j.commit.committer.date, message: (j.commit.message || '').split('\n')[0] };
  }

  async function check() {
    if (!enabled) return { enabled: false };
    const current = readJson(INSTALLED) || {};
    const l = await latest();
    return { enabled: true, current, latest: l, available: l.sha !== current.sha };
  }

  function expand(zip, to) {
    return new Promise((resolve, reject) => {
      const ps = spawn(path.join(process.env.WINDIR, 'System32\\WindowsPowerShell\\v1.0\\powershell.exe'),
        ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${zip.replace(/'/g, "''")}' -DestinationPath '${to.replace(/'/g, "''")}' -Force`], { windowsHide: true });
      ps.on('close', (code) => (code === 0 ? resolve() : reject(new Error('could not unpack the update'))));
    });
  }
  function copyTree(from, to) {
    for (const e of fs.readdirSync(from, { withFileTypes: true })) {
      const s = path.join(from, e.name), d = path.join(to, e.name);
      if (e.isDirectory()) { fs.mkdirSync(d, { recursive: true }); copyTree(s, d); } else fs.copyFileSync(s, d);
    }
  }
  // top-level code files of a folder -> [{ src, name }]
  const codeFiles = (folder) => (fs.existsSync(folder) ? fs.readdirSync(folder, { withFileTypes: true }) : [])
    .filter((e) => e.isFile() && CODE_EXT.test(e.name) && !NEVER.has(e.name)).map((e) => ({ src: path.join(folder, e.name), name: e.name }));

  async function apply() {
    if (!enabled) return { ok: false, error: 'updates are off for this copy' };
    if (busy) return { ok: false, error: 'already updating' };
    busy = true;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'officeauto-update-'));
    try {
      const info = await check();
      if (!info.available) return { ok: true, upToDate: true, current: info.current };
      const l = info.latest;
      const res = await net.fetch(`https://codeload.github.com/${repo}/zip/${l.sha}`);
      if (!res.ok) throw new Error(`download failed (${res.status})`);
      const zip = path.join(tmp, 'update.zip');
      fs.writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
      await expand(zip, path.join(tmp, 'x'));
      const root = path.join(tmp, 'x', fs.readdirSync(path.join(tmp, 'x'))[0]);

      // the new code must not need npm libraries this copy does not have
      const pkg = JSON.parse(fs.readFileSync(path.join(root, 'buddy', 'package.json'), 'utf8'));
      const missing = Object.keys(pkg.dependencies || {}).filter((d) => !fs.existsSync(path.join(dir, 'node_modules', d)));
      if (missing.length) return { ok: false, error: `this update needs new parts (${missing.join(', ')}) - ask for a fresh full copy` };

      // shared app files, then the edition's own files (edition wins), then the OfficeAuto script
      const files = new Map();
      for (const f of codeFiles(path.join(root, 'buddy'))) if (f.name !== 'package.json') files.set(f.name, f.src);
      if (editionDir) for (const f of codeFiles(path.join(root, editionDir))) files.set(f.name, f.src);
      if (fs.existsSync(path.join(root, 'OfficeAuto.ps1'))) files.set('OfficeAuto.ps1', path.join(root, 'OfficeAuto.ps1'));
      if (!files.has('main.js') || !files.has('renderer.js')) throw new Error('the update looks incomplete');

      fs.rmSync(BACKUP, { recursive: true, force: true });
      fs.mkdirSync(BACKUP, { recursive: true });
      for (const name of files.keys()) if (fs.existsSync(path.join(dir, name))) fs.copyFileSync(path.join(dir, name), path.join(BACKUP, name));
      for (const [name, src] of files) fs.copyFileSync(src, path.join(dir, name));

      writeJson(STATE, { pending: true, tries: 0, previous: info.current, message: l.message });
      writeJson(INSTALLED, { sha: l.sha, date: l.date, message: l.message, installedAt: new Date().toISOString() });
      return { ok: true, updated: true, message: l.message, files: files.size };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    } finally {
      busy = false;
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }

  const info = () => ({ enabled, repo, current: readJson(INSTALLED) || {} });
  return { enabled, bootCheck, markHealthy, check, apply, info };
};
