// How risky is a PowerShell command the AI wants to run?
//   safe   = read-only (Get-..., ipconfig...): runs at once
//   change = changes something: the user must click Allow
//   danger = can delete / stop / change important things: red warning, user must click "Allow anyway"
// ---- commands the AI asks to run: read-only ones run at once, anything else needs the user's OK
const SAFE_CMDS = new Set(('get-childitem get-item get-itemproperty get-content get-date get-process get-service get-computerinfo get-ciminstance ' +
  'get-wmiobject get-volume get-psdrive get-disk get-physicaldisk get-partition get-netadapter get-netipaddress get-netipconfiguration ' +
  'get-nettcpconnection get-netconnectionprofile get-dnsclientserveraddress get-printer get-hotfix get-startapps get-location get-command ' +
  'get-help get-culture get-timezone get-uptime get-filehash get-acl get-localuser get-appxpackage get-package get-mpcomputerstatus get-winevent ' +
  'get-eventlog get-clipboard test-connection test-path test-netconnection resolve-dnsname measure-object select-object where-object sort-object ' +
  'group-object format-table format-list format-wide out-string convertto-json convertto-csv select-string foreach-object write-output ' +
  'ipconfig systeminfo whoami hostname ping nslookup tasklist dir ls gci gc cat type echo netstat tracert driverquery ver gps gsv gdr ' +
  'where sort select ft fl fw measure findstr % ? [math]').split(/\s+/));
// whole command names only: "format" is risky, "Format-Table" (just tidies the output) is not
const DANGER_RE = /(?<![\w-])(remove-item|rm|del|erase|rd|rmdir|ri|format|format-volume|clear-disk|diskpart|initialize-disk|stop-computer|restart-computer|shutdown|logoff|bcdedit|reg|remove-itemproperty|set-itemproperty|new-itemproperty|set-executionpolicy|invoke-expression|iex|invoke-command|invoke-webrequest|iwr|invoke-restmethod|irm|curl|wget|start-bitstransfer|bitsadmin|certutil|net|add-mppreference|set-mppreference|uninstall-\w+|remove-appxpackage|cipher|vssadmin|wbadmin|schtasks|sc|stop-process|taskkill|kill|spps|takeown|icacls|attrib|netsh|set-acl|clear-recyclebin|clear-content|set-content|out-file|move-item|rename-item|new-localuser|set-localuser|disable-\w+|enable-\w+|set-service|stop-service|new-service|mshta|rundll32|regsvr32|wscript|cscript|frombase64string|downloadstring|downloadfile)(?![\w-])|-enc\w*|>/i;
function commandRisk(cmd) {
  const c = String(cmd || '').trim();
  if (!c) return 'danger';
  if (DANGER_RE.test(c)) return 'danger';
  if (/[`]|\$\(|&\s|@\(|\bstart-process\b|\bstart\b/i.test(c)) return 'change';
  const parts = c.split(/\||;|&&|\|\||\r?\n/).map((p) => p.trim()).filter(Boolean);
  const safe = parts.every((p) => {
    const first = p.replace(/^[({\s]+/, '').split(/[\s(]/)[0].toLowerCase();
    return SAFE_CMDS.has(first) || first.startsWith('[math]::') || /^\$_\.?[\w.]*$/.test(first) || /^['"\d]/.test(first) || first === '}';
  });
  return safe ? 'safe' : 'change';
}

module.exports = { commandRisk };
