<#
  OfficeAuto - daily-life automation toolkit for office workers.

  Interactive menu:   powershell -ExecutionPolicy Bypass -File OfficeAuto.ps1
  Single task:        powershell -ExecutionPolicy Bypass -File OfficeAuto.ps1 -Task Organize
  Tasks: Organize, Backup, CleanTemp, Rename, ToPdf, Morning, DailyNote, Duplicates, Schedule, Unschedule
  Folder tasks:       ... -Task ToPdf -Folder "C:\path"   (also Duplicates, Rename)
  AI desktop buddy:   Start-Buddy.cmd  (menu option A)

  Settings live in config.json next to this script. Logs go to .\logs\.
  Keep this file ASCII-only so Windows PowerShell 5.1 parses it correctly.
#>
param(
    [ValidateSet('Menu','Organize','Backup','CleanTemp','Rename','ToPdf','Morning','DailyNote','Duplicates','Schedule','Unschedule')]
    [string]$Task = 'Menu',
    [string]$Folder,
    [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'
$ScriptPath = $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $ScriptPath
$LogDir = Join-Path $Root 'logs'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Write-Log([string]$Msg, [string]$Color = 'Gray') {
    $line = '{0}  {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Msg
    Write-Host $line -ForegroundColor $Color
    Add-Content -Path (Join-Path $LogDir ((Get-Date -Format 'yyyy-MM-dd') + '.log')) -Value $line
}

function Expand-PathVar([string]$p) { [Environment]::ExpandEnvironmentVariables($p) }

function Get-Config {
    $raw = Get-Content -Raw -Path (Join-Path $Root 'config.json')
    return $raw | ConvertFrom-Json
}

function Get-UniquePath([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return $Path }
    $dir = Split-Path -Parent $Path
    $base = [IO.Path]::GetFileNameWithoutExtension($Path)
    $ext = [IO.Path]::GetExtension($Path)
    $i = 1
    do { $candidate = Join-Path $dir ('{0} ({1}){2}' -f $base, $i, $ext); $i++ } while (Test-Path -LiteralPath $candidate)
    return $candidate
}

function Read-Folder([string]$Prompt) {
    $p = if ($Folder) { $Folder } else { (Read-Host $Prompt).Trim('"', ' ') }
    if (-not $p -or -not (Test-Path -LiteralPath $p -PathType Container)) { Write-Log "Folder not found: $p" 'Red'; return $null }
    return (Resolve-Path -LiteralPath $p).Path
}

# ---------------------------------------------------------------- 1. Organize Downloads
function Invoke-Organize {
    $cfg = Get-Config
    $src = Expand-PathVar $cfg.DownloadsFolder
    $map = @{}
    foreach ($cat in $cfg.Categories.PSObject.Properties) {
        foreach ($ext in $cat.Value) { $map[$ext.ToLower()] = $cat.Name }
    }
    $partial = @('.crdownload', '.part', '.tmp', '.download', '.partial')
    $cutoff = (Get-Date).AddMinutes(-2)   # skip files that may still be downloading
    $moved = 0
    Get-ChildItem -LiteralPath $src -File | Where-Object { $_.LastWriteTime -lt $cutoff } | ForEach-Object {
        $ext = $_.Extension.ToLower()
        if ($partial -contains $ext) { return }
        $cat = if ($map.ContainsKey($ext)) { $map[$ext] } else { 'Others' }
        $destDir = Join-Path $src $cat
        $dest = Get-UniquePath (Join-Path $destDir $_.Name)
        if ($WhatIf) { Write-Log "[preview] $($_.Name) -> $cat"; return }
        try {
            New-Item -ItemType Directory -Force -Path $destDir | Out-Null
            Move-Item -LiteralPath $_.FullName -Destination $dest
            $moved++
        } catch { Write-Log "Skip (in use?) $($_.Name): $($_.Exception.Message)" 'Yellow' }
    }
    Write-Log "Organize: moved $moved file(s) in $src" 'Green'
}

# ---------------------------------------------------------------- 2. Backup to dated zip
function Invoke-Backup {
    $cfg = Get-Config
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $destRoot = Expand-PathVar $cfg.BackupDestination
    New-Item -ItemType Directory -Force -Path $destRoot | Out-Null
    $zipPath = Join-Path $destRoot ('Backup_{0}.zip' -f (Get-Date -Format 'yyyy-MM-dd_HHmm'))
    $skipExt = @($cfg.BackupExcludeExtensions | ForEach-Object { $_.ToLower() })
    $skipDirs = @('node_modules', '.git', '.venv', '__pycache__')
    $maxBytes = 100MB

    if ($WhatIf) { Write-Log "[preview] would create $zipPath"; return }
    $zip = [IO.Compression.ZipFile]::Open($zipPath, 'Create')
    $added = 0; $skipped = 0
    try {
        foreach ($s in $cfg.BackupSources) {
            $src = Expand-PathVar $s
            if (-not (Test-Path -LiteralPath $src)) { Write-Log "Backup source missing: $src" 'Yellow'; continue }
            $srcName = Split-Path -Leaf $src
            Get-ChildItem -LiteralPath $src -File -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
                $rel = $_.FullName.Substring($src.Length).TrimStart('\')
                $parts = $rel -split '\\'
                if (($parts | Where-Object { $skipDirs -contains $_ }) -or ($skipExt -contains $_.Extension.ToLower()) -or $_.Length -gt $maxBytes) { $skipped++; return }
                try {
                    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, "$srcName\$rel", 'Optimal') | Out-Null
                    $added++
                } catch { $skipped++ }   # locked / no access
            }
        }
    } finally { $zip.Dispose() }

    # keep only the newest N backups
    Get-ChildItem -LiteralPath $destRoot -Filter 'Backup_*.zip' | Sort-Object LastWriteTime -Descending |
        Select-Object -Skip ([int]$cfg.BackupKeep) | Remove-Item -Force
    $mb = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
    Write-Log "Backup: $added file(s), $skipped skipped, $mb MB -> $zipPath" 'Green'
}

# ---------------------------------------------------------------- 3. Clean old temp files
function Invoke-CleanTemp {
    $cfg = Get-Config
    $cutoff = (Get-Date).AddDays(-[int]$cfg.TempMaxAgeDays)
    $files = Get-ChildItem -LiteralPath $env:TEMP -File -Recurse -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -lt $cutoff }
    $total = ($files | Measure-Object Length -Sum).Sum
    $mb = [math]::Round($total / 1MB, 1)
    if ($WhatIf) { Write-Log "[preview] $($files.Count) temp file(s), $mb MB older than $($cfg.TempMaxAgeDays) days"; return }
    $freed = 0
    foreach ($f in $files) {
        try { $len = $f.Length; Remove-Item -LiteralPath $f.FullName -Force; $freed += $len } catch { }   # in use -> skip
    }
    Write-Log ("CleanTemp: freed {0} MB of {1} MB candidates" -f [math]::Round($freed / 1MB, 1), $mb) 'Green'
}

# ---------------------------------------------------------------- 4. Bulk rename
function Invoke-Rename {
    $dir = Read-Folder 'Folder with files to rename'
    if (-not $dir) { return }
    $filter = Read-Host 'File filter (e.g. *.jpg, Enter = all)'
    if (-not $filter) { $filter = '*' }
    $prefix = Read-Host 'New name prefix (e.g. Invoice)'
    $useDate = (Read-Host 'Add file date? (y/n)') -eq 'y'
    $files = @(Get-ChildItem -LiteralPath $dir -File -Filter $filter | Sort-Object LastWriteTime)
    if (-not $files) { Write-Log 'No files matched.' 'Yellow'; return }
    $width = ([string]$files.Count).Length
    $plan = for ($i = 0; $i -lt $files.Count; $i++) {
        $f = $files[$i]
        $name = $prefix
        if ($useDate) { $name += '_' + $f.LastWriteTime.ToString('yyyy-MM-dd') }
        $name += '_' + ([string]($i + 1)).PadLeft([math]::Max($width, 3), '0') + $f.Extension.ToLower()
        [pscustomobject]@{ Old = $f.Name; New = $name; Path = $f.FullName }
    }
    $plan | Select-Object -First 10 Old, New | Format-Table -AutoSize | Out-Host
    if ($files.Count -gt 10) { Write-Host "... and $($files.Count - 10) more" }
    if ((Read-Host "Rename $($files.Count) file(s)? (y/n)") -ne 'y') { return }
    # two-pass via temp names so A->B / B->A swaps never collide
    $tmp = foreach ($p in $plan) { $t = $p.Path + '.oa_tmp'; Rename-Item -LiteralPath $p.Path -NewName (Split-Path -Leaf $t); $t }
    for ($i = 0; $i -lt $plan.Count; $i++) {
        $final = Get-UniquePath (Join-Path $dir $plan[$i].New)
        Rename-Item -LiteralPath $tmp[$i] -NewName (Split-Path -Leaf $final)
    }
    $plan | ForEach-Object { "$($_.Old) -> $($_.New)" } | Add-Content (Join-Path $LogDir 'rename-history.log')
    Write-Log "Rename: $($plan.Count) file(s) in $dir (undo list in logs\rename-history.log)" 'Green'
}

# ---------------------------------------------------------------- 5. Word/Excel/PowerPoint -> PDF
function Invoke-ToPdf {
    $dir = Read-Folder 'Folder with Word/Excel/PowerPoint files'
    if (-not $dir) { return }
    $outDir = Join-Path $dir 'PDF'
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
    $files = Get-ChildItem -LiteralPath $dir -File | Where-Object { $_.Extension -match '^\.(docx?|xlsx?|pptx?)$' -and $_.Name -notlike '~$*' }
    if (-not $files) { Write-Log 'No Office files found.' 'Yellow'; return }
    $word = $excel = $ppt = $null
    $done = 0
    try {
        foreach ($f in $files) {
            [string]$pdf = Join-Path $outDir ($f.BaseName + '.pdf')
            try {
                switch -Regex ($f.Extension) {
                    '^\.docx?$' {
                        if (-not $word) { $word = New-Object -ComObject Word.Application; $word.Visible = $false; $word.DisplayAlerts = 0 }
                        $d = $word.Documents.Open([string]$f.FullName, $false, $true, $false); $d.ExportAsFixedFormat($pdf, 17); $d.Close($false)
                    }
                    '^\.xlsx?$' {
                        if (-not $excel) { $excel = New-Object -ComObject Excel.Application; $excel.Visible = $false; $excel.DisplayAlerts = $false }
                        $w = $excel.Workbooks.Open($f.FullName, 0, $true); $w.ExportAsFixedFormat(0, $pdf); $w.Close($false)
                    }
                    '^\.pptx?$' {
                        if (-not $ppt) { $ppt = New-Object -ComObject PowerPoint.Application }
                        $p = $ppt.Presentations.Open($f.FullName, $true, $false, $false); $p.SaveAs($pdf, 32); $p.Close()
                    }
                }
                $done++; Write-Log "  PDF: $($f.Name)"
            } catch { Write-Log "  Failed $($f.Name): $($_.Exception.Message)" 'Yellow' }
        }
    } finally {
        foreach ($app in @($word, $excel, $ppt)) {
            if ($app) { try { $app.Quit() } catch { }; [void][Runtime.InteropServices.Marshal]::ReleaseComObject($app) }
        }
    }
    Write-Log "ToPdf: $done of $($files.Count) converted -> $outDir" 'Green'
}

# ---------------------------------------------------------------- 6. Morning launcher
function Invoke-Morning {
    $cfg = Get-Config
    foreach ($a in $cfg.MorningApps) {
        try { Start-Process (Expand-PathVar $a); Write-Log "Opened $a" } catch { Write-Log "Could not open $a" 'Yellow' }
    }
    foreach ($u in $cfg.MorningUrls) { Start-Process $u; Start-Sleep -Milliseconds 400 }
    Invoke-DailyNote
}

# ---------------------------------------------------------------- 7. Daily note (to-do + end-of-day report)
function Invoke-DailyNote {
    $cfg = Get-Config
    $dir = Expand-PathVar $cfg.NotesFolder
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $today = Join-Path $dir ((Get-Date -Format 'yyyy-MM-dd') + '.md')
    if (-not (Test-Path -LiteralPath $today)) {
        # carry over unfinished "- [ ]" items from the most recent previous note
        $prev = Get-ChildItem -LiteralPath $dir -Filter '*.md' | Where-Object { $_.FullName -ne $today } |
            Sort-Object Name -Descending | Select-Object -First 1
        $carry = @()
        if ($prev) { $carry = @(Get-Content -LiteralPath $prev.FullName | Where-Object { $_ -match '^\s*- \[ \]' }) }
        $body = @(
            "# $(Get-Date -Format 'dddd, dd MMMM yyyy')", '',
            '## Top 3 priorities', '- [ ] ', '- [ ] ', '- [ ] ', '',
            '## To-do'
        ) + $(if ($carry) { $carry } else { @('- [ ] ') }) + @(
            '', '## Meetings', '- ', '',
            '## Done today (end-of-day report)', '- ', '',
            '## Blockers / follow-ups', '- '
        )
        Set-Content -LiteralPath $today -Value $body -Encoding UTF8
        Write-Log "DailyNote: created $today ($($carry.Count) item(s) carried over)" 'Green'
    }
    Start-Process notepad.exe $today
}

# ---------------------------------------------------------------- 8. Duplicate finder (report only)
function Invoke-Duplicates {
    $dir = Read-Folder 'Folder to scan for duplicate files'
    if (-not $dir) { return }
    Write-Host 'Scanning (size first, then hash)...'
    $groups = Get-ChildItem -LiteralPath $dir -File -Recurse -ErrorAction SilentlyContinue |
        Where-Object Length -gt 0 | Group-Object Length | Where-Object Count -gt 1
    $dupes = foreach ($g in $groups) {
        $g.Group | ForEach-Object {
            try { [pscustomobject]@{ Hash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash; File = $_ } } catch { }
        } | Group-Object Hash | Where-Object Count -gt 1
    }
    $report = Join-Path $LogDir ('duplicates_{0}.csv' -f (Get-Date -Format 'yyyyMMdd_HHmm'))
    $rows = foreach ($d in $dupes) {
        foreach ($x in $d.Group) { [pscustomobject]@{ Group = $d.Name.Substring(0, 12); SizeKB = [math]::Round($x.File.Length / 1KB, 1); Path = $x.File.FullName; Modified = $x.File.LastWriteTime } }
    }
    if (-not $rows) { Write-Log "Duplicates: none found in $dir" 'Green'; return }
    $rows | Export-Csv -Path $report -NoTypeInformation -Encoding UTF8
    $waste = ($dupes | ForEach-Object { $_.Group[0].File.Length * ($_.Count - 1) } | Measure-Object -Sum).Sum
    Write-Log ("Duplicates: {0} group(s), {1} MB reclaimable. Report: {2}" -f @($dupes).Count, [math]::Round($waste / 1MB, 1), $report) 'Green'
    Invoke-Item $report
}

# ---------------------------------------------------------------- 9. Windows Task Scheduler
function Invoke-Schedule {
    $cfg = Get-Config
    $ps = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $jobs = @(
        @{ Name = 'OfficeAuto-Organize'; Task = 'Organize'; Trigger = New-ScheduledTaskTrigger -Daily -At $cfg.Schedule.OrganizeTime },
        @{ Name = 'OfficeAuto-Backup';   Task = 'Backup';   Trigger = New-ScheduledTaskTrigger -Daily -At $cfg.Schedule.BackupTime },
        @{ Name = 'OfficeAuto-Morning';  Task = 'Morning';  Trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME }
    )
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    foreach ($j in $jobs) {
        $style = if ($j.Task -eq 'Morning') { '' } else { '-WindowStyle Hidden ' }
        $action = New-ScheduledTaskAction -Execute $ps -Argument ("-NoProfile {0}-ExecutionPolicy Bypass -File `"{1}`" -Task {2}" -f $style, $ScriptPath, $j.Task)
        Register-ScheduledTask -TaskName $j.Name -Action $action -Trigger $j.Trigger -Settings $settings -Description 'OfficeAuto' -Force | Out-Null
        Write-Log "Scheduled $($j.Name)" 'Green'
    }
}

function Invoke-Unschedule {
    Get-ScheduledTask -TaskName 'OfficeAuto-*' -ErrorAction SilentlyContinue | ForEach-Object {
        Unregister-ScheduledTask -TaskName $_.TaskName -Confirm:$false; Write-Log "Removed $($_.TaskName)" 'Green'
    }
}

# ---------------------------------------------------------------- menu
function Show-Menu {
    while ($true) {
        Write-Host ''
        Write-Host '=========== OfficeAuto ===========' -ForegroundColor Cyan
        Write-Host ' 1. Organize Downloads by file type'
        Write-Host ' 2. Backup Documents + Desktop (zip)'
        Write-Host ' 3. Clean old temp files'
        Write-Host ' 4. Bulk rename files'
        Write-Host ' 5. Convert Word/Excel/PPT to PDF'
        Write-Host ' 6. Morning start (apps + sites + note)'
        Write-Host ' 7. Open today''s to-do / daily report'
        Write-Host ' 8. Find duplicate files'
        Write-Host ' 9. Turn ON daily automation (scheduler)'
        Write-Host '10. Turn OFF daily automation'
        Write-Host ' A. Launch AI buddy (desktop assistant)'
        Write-Host ' C. Edit settings (config.json)'
        Write-Host ' Q. Quit'
        $c = Read-Host 'Choose'
        try {
            switch ($c.ToUpper()) {
                '1' { Invoke-Organize }   '2' { Invoke-Backup }     '3' { Invoke-CleanTemp }
                '4' { Invoke-Rename }     '5' { Invoke-ToPdf }      '6' { Invoke-Morning }
                '7' { Invoke-DailyNote }  '8' { Invoke-Duplicates } '9' { Invoke-Schedule }
                '10' { Invoke-Unschedule }
                'A' { Start-Process (Join-Path $Root 'Start-Buddy.cmd') }
                'C' { Start-Process notepad.exe (Join-Path $Root 'config.json') }
                'Q' { return }
                default { Write-Host 'Unknown choice' -ForegroundColor Yellow }
            }
        } catch { Write-Log "Error: $($_.Exception.Message)" 'Red' }
    }
}

if ($Task -eq 'Menu') { Show-Menu } else {
    try { & "Invoke-$Task" } catch { Write-Log "Error in ${Task}: $($_.Exception.Message)" 'Red'; exit 1 }
}
