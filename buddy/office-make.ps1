<#
  Called by Pip to turn an AI result into a real Office file (never saved - the user decides).
    -Kind excel : { Title, Columns[], Rows[][] }             -> new workbook, formatted table
    -Kind word  : { Title, Lines[] } (markdown-ish lines)    -> new Word document with styles
    -Kind ppt   : { Title, Subtitle, Slides[{title,bullets[],notes}] } -> new PowerPoint deck
  Prints OK|<what> or ERR|<message>. ASCII-only for PowerShell 5.1.
#>
param(
    [Parameter(Mandatory)][ValidateSet('excel', 'word', 'ppt')][string]$Kind,
    [Parameter(Mandatory)][string]$Json
)
$ErrorActionPreference = 'Stop'
$d = Get-Content -Raw -LiteralPath $Json -Encoding UTF8 | ConvertFrom-Json

function Get-App([string]$progId) {
    try { return [Runtime.InteropServices.Marshal]::GetActiveObject($progId) }
    catch { return New-Object -ComObject $progId }
}

function Clean([string]$s) { ($s -replace '\*\*', '' -replace '__', '' -replace '`', '').Trim() }

try {
    switch ($Kind) {
        'excel' {
            $xl = Get-App 'Excel.Application'
            $xl.Visible = $true
            $wb = $xl.Workbooks.Add()
            $ws = $wb.Worksheets.Item(1)
            $title = Clean $d.Title
            if ($title) { $ws.Name = ($title -replace '[\\/\?\*\[\]:]', ' ').Substring(0, [Math]::Min(31, $title.Length)).Trim() }
            $cols = @($d.Columns); $rows = @($d.Rows)
            $arr = New-Object 'object[,]' ($rows.Count + 1), $cols.Count
            for ($j = 0; $j -lt $cols.Count; $j++) { $arr[0, $j] = [string]$cols[$j] }
            for ($i = 0; $i -lt $rows.Count; $i++) {
                $r = @($rows[$i])
                for ($j = 0; $j -lt $cols.Count; $j++) {
                    $v = if ($j -lt $r.Count) { $r[$j] } else { '' }
                    if ($v -is [string] -and $v -match '^(0\d+|\+?\d{12,})$') { $v = "'" + $v }   # phone numbers / IDs stay text
                    $arr[($i + 1), $j] = $v
                }
            }
            $range = $ws.Range($ws.Cells.Item(1, 1), $ws.Cells.Item($rows.Count + 1, $cols.Count))
            $range.Value2 = $arr
            [void]$ws.ListObjects.Add(1, $range, $null, 1)      # format as Excel table (filters, banded rows)
            [void]$range.Columns.AutoFit()
            $ws.Activate()
            [Console]::Out.Write("OK|Excel table with $($rows.Count) rows")
        }
        'word' {
            $wd = Get-App 'Word.Application'
            $wd.Visible = $true
            $doc = $wd.Documents.Add()
            $sel = $wd.Selection
            # built-in style ids (language-independent): Normal -1, Heading1 -2, Heading2 -3, Heading3 -4, Title -63, ListBullet -49, ListNumber -50
            $first = $true
            foreach ($raw in @($d.Lines)) {
                $line = [string]$raw
                if ($line -match '^\s*```') { continue }
                $style = -1; $text = $line
                if ($line -match '^\s*#\s+(.*)') { $style = $(if ($first) { -63 } else { -2 }); $text = $Matches[1] }
                elseif ($line -match '^\s*##\s+(.*)') { $style = -3; $text = $Matches[1] }
                elseif ($line -match '^\s*#{3,}\s+(.*)') { $style = -4; $text = $Matches[1] }
                elseif ($line -match '^\s*[-*]\s+(\[[ xX]\]\s*)?(.*)') { $style = -49; $text = $Matches[2] }
                elseif ($line -match '^\s*\d+[.)]\s+(.*)') { $style = -50; $text = $Matches[1] }
                if (-not $text.Trim() -and $style -eq -1) { $sel.Style = $doc.Styles.Item(-1); $sel.TypeParagraph(); continue }
                $sel.Style = $doc.Styles.Item($style)
                $sel.TypeText((Clean $text))
                $sel.TypeParagraph()
                if ($text.Trim()) { $first = $false }
            }
            $doc.Activate()
            [Console]::Out.Write('OK|Word document')
        }
        'ppt' {
            $pp = Get-App 'PowerPoint.Application'
            $pres = $pp.Presentations.Add(-1)
            $w = $pres.PageSetup.SlideWidth; $h = $pres.PageSetup.SlideHeight
            # simple clean look: teal accent bar on every slide, dark titles
            $bar = $pres.SlideMaster.Shapes.AddShape(1, 0, 0, 14, $h)
            $bar.Fill.ForeColor.RGB = 0xB4A814; $bar.Line.Visible = 0
            $s = $pres.Slides.Add(1, 1)
            $s.Shapes.Item(1).TextFrame.TextRange.Text = (Clean $d.Title)
            if ($s.Shapes.Count -ge 2) { $s.Shapes.Item(2).TextFrame.TextRange.Text = (Clean $d.Subtitle) }
            $i = 2
            foreach ($sl in @($d.Slides)) {
                $s = $pres.Slides.Add($i, 2)
                $s.Shapes.Item(1).TextFrame.TextRange.Text = (Clean $sl.title)
                $s.Shapes.Item(1).TextFrame.TextRange.Font.Color.RGB = 0x4A3A1C
                $s.Shapes.Item(2).TextFrame.TextRange.Text = ((@($sl.bullets) | ForEach-Object { Clean $_ }) -join "`r")
                if ($sl.notes) { $s.NotesPage.Shapes.Placeholders.Item(2).TextFrame.TextRange.Text = [string]$sl.notes }
                $i++
            }
            [Console]::Out.Write("OK|PowerPoint with $($i - 1) slides")
        }
    }
} catch {
    $m = $_.Exception.Message
    if ($m -match '0x8001010A|0x800AC472|rejected') { $m = 'The Office app is busy (a dialog is open or a cell is being edited). Press Esc there and try again.' }
    elseif ($m -match '80040154|class not registered') { $m = 'This needs Microsoft Office installed.' }
    [Console]::Out.Write("ERR|$m")
}
