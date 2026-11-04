<#
  Builds the portable "Tom & Eaindra" app from this repo:  Desktop\Tom-Eaindra\  +  Desktop\Tom-Eaindra.zip
    Electron runtime (renamed Tom-Eaindra.exe)
    resources\app = shared Pip code (buddy\) + this edition's files + OfficeAuto.ps1/config.json
                    + node_modules + portable Python (natural voices)
  The copy then updates itself from GitHub (edition.json -> updateRepo), so build from a PUSHED commit:
  installed.json records that commit, and the app installs any newer one by itself.
  ASCII-only for Windows PowerShell 5.1.
#>
param(
    [string]$Out = (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Tom-Eaindra'),
    [string]$Python = 'C:\Users\lenovo\PanThuEaindra\python',   # python-3.13 embed + edge-tts (see README)
    [switch]$NoZip
)
$ErrorActionPreference = 'Stop'
$edition = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Resolve-Path (Join-Path $edition '..\..')
$buddy = Join-Path $repo 'buddy'
$electronDist = Join-Path $buddy 'node_modules\electron\dist'
if (-not (Test-Path (Join-Path $Python 'python.exe'))) { throw "Portable Python not found at $Python" }

if (Test-Path $Out) { Remove-Item $Out -Recurse -Force }
Write-Host "Electron runtime -> $Out"
robocopy $electronDist $Out /E /NFL /NDL /NJH /NJS /NP | Out-Null
Rename-Item (Join-Path $Out 'electron.exe') 'Tom-Eaindra.exe'
Remove-Item (Join-Path $Out 'resources\default_app.asar') -Force -ErrorAction SilentlyContinue

$app = Join-Path $Out 'resources\app'
New-Item -ItemType Directory -Force $app | Out-Null
Write-Host 'Shared code + edition files'
Get-ChildItem $buddy -File | Where-Object { $_.Extension -match '^\.(js|html|css|py|ps1)$' } | Copy-Item -Destination $app
Get-ChildItem $edition -File | Where-Object { $_.Name -ne 'make-portable.ps1' } | Copy-Item -Destination $app -Force
Copy-Item (Join-Path $repo 'OfficeAuto.ps1'), (Join-Path $repo 'config.json') $app
Write-Host 'node_modules (without the Electron dev package)'
robocopy (Join-Path $buddy 'node_modules') (Join-Path $app 'node_modules') /E /XD electron @electron .cache /NFL /NDL /NJH /NJS /NP | Out-Null
Write-Host 'Portable Python'
robocopy $Python (Join-Path $app 'python') /E /XD __pycache__ /NFL /NDL /NJH /NJS /NP | Out-Null

# which commit this build is (the updater compares it with GitHub)
Push-Location $repo
$sha = (git rev-parse HEAD).Trim(); $date = (git log -1 --format=%cI).Trim(); $msg = (git log -1 --format=%s).Trim()
$dirty = (git status --porcelain -- buddy editions OfficeAuto.ps1 | Where-Object { $_ -notmatch 'buddy/private' })
Pop-Location
if ($dirty) { Write-Warning 'Uncommitted changes in buddy/ or editions/ - commit and push first, or the copy may "update" back to the pushed version.' }
@{ sha = $sha; date = $date; message = $msg; installedAt = (Get-Date).ToString('o') } | ConvertTo-Json | Set-Content (Join-Path $app 'installed.json') -Encoding ascii

Copy-Item (Join-Path $edition 'README.txt') $Out
@'
@echo off
rem Creates a desktop shortcut to Tom & Eaindra
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\Tom and Eaindra.lnk'); $s.TargetPath='%~dp0Tom-Eaindra.exe'; $s.WorkingDirectory='%~dp0'; $s.Save()"
echo Desktop shortcut created.
pause
'@ | Set-Content (Join-Path $Out 'Create Desktop Shortcut.cmd') -Encoding ascii

$mb = (Get-ChildItem $Out -Recurse -File | Measure-Object Length -Sum).Sum / 1MB
Write-Host ("Folder size: {0:N0} MB  (build of {1})" -f $mb, $sha.Substring(0, 7))
if (-not $NoZip) {
    $zip = "$Out.zip"
    if (Test-Path $zip) { Remove-Item $zip -Force }
    Write-Host "Zipping -> $zip"
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Compression.ZipFile]::CreateFromDirectory($Out, $zip, [IO.Compression.CompressionLevel]::Optimal, $true)
    Write-Host ("Zip size: {0:N0} MB" -f ((Get-Item $zip).Length / 1MB))
}
