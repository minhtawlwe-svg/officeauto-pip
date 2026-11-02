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

function Strip-Md([string]$s) { ($s -replace '\*\*', '' -replace '__', '' -replace '`', '').Trim() }

# Burmese (Myanmar script) needs a font that has the glyphs and taller lines,
# otherwise text shows as boxes or the stacked characters get clipped.
$MyFont = 'Myanmar Text'
$MyRange = '[' + [char]0x1000 + '-' + [char]0x109F + ']'
$Burmese = (ConvertTo-Json $d -Depth 10 -Compress) -match $MyRange
function Set-Font2($tr2, [double]$lineSpacing) {
    # TextFrame2 font: set Latin + complex-script + other so every script uses the Myanmar font
    $tr2.Font.Name = $MyFont; $tr2.Font.NameComplexScript = $MyFont; $tr2.Font.NameOther = $MyFont; $tr2.Font.NameFarEast = $MyFont
    $tr2.ParagraphFormat.LineRuleWithin = -1
    $tr2.ParagraphFormat.SpaceWithin = $lineSpacing
}

try {
    switch ($Kind) {
        'excel' {
            $xl = Get-App 'Excel.Application'
            $xl.Visible = $true
            $wb = $xl.Workbooks.Add()
            $ws = $wb.Worksheets.Item(1)
            if (@($d.Columns).Count -eq 0) { $ws.Activate(); [Console]::Out.Write('OK|New blank Excel workbook'); break }
            $title = Strip-Md $d.Title
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
            if ($Burmese) { $range.Font.Name = $MyFont; [void]$range.Rows.AutoFit() }
            [void]$range.Columns.AutoFit()
            $ws.Activate()
            [Console]::Out.Write("OK|Excel table with $($rows.Count) rows")
        }
        'word' {
            $wd = Get-App 'Word.Application'
            $wd.Visible = $true
            $doc = $wd.Documents.Add()
            if (@($d.Lines).Count -eq 0) { $doc.Activate(); [Console]::Out.Write('OK|New blank Word document'); break }
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
                $sel.TypeText((Strip-Md $text))
                $sel.TypeParagraph()
                if ($text.Trim()) { $first = $false }
            }
            if ($Burmese) {
                $f = $doc.Content.Font
                $f.Name = $MyFont; $f.NameBi = $MyFont; $f.NameOther = $MyFont
                $doc.Content.ParagraphFormat.LineSpacingRule = 5    # multiple
                $doc.Content.ParagraphFormat.LineSpacing = 15       # 1.25 lines
            }
            $doc.Activate()
            [Console]::Out.Write('OK|Word document')
        }
        'ppt' {
            $pp = Get-App 'PowerPoint.Application'
            $pres = $pp.Presentations.Add(-1)
            if (@($d.Slides).Count -eq 0 -and -not $d.Title) { [void]$pres.Slides.Add(1, 1); [Console]::Out.Write('OK|New blank PowerPoint presentation'); break }
            $w = $pres.PageSetup.SlideWidth; $h = $pres.PageSetup.SlideHeight
            # simple clean look: teal accent bar on every slide, dark titles
            $bar = $pres.SlideMaster.Shapes.AddShape(1, 0, 0, 14, $h)
            $bar.Fill.ForeColor.RGB = 0xB4A814; $bar.Line.Visible = 0
            $s = $pres.Slides.Add(1, 1)
            $s.Shapes.Item(1).TextFrame.TextRange.Text = (Strip-Md $d.Title)
            if ($s.Shapes.Count -ge 2) { $s.Shapes.Item(2).TextFrame.TextRange.Text = (Strip-Md $d.Subtitle) }
            if ($Burmese) {
                Set-Font2 $s.Shapes.Item(1).TextFrame2.TextRange 1.15
                $s.Shapes.Item(1).TextFrame2.TextRange.Font.Size = 40
                if ($s.Shapes.Count -ge 2) { Set-Font2 $s.Shapes.Item(2).TextFrame2.TextRange 1.2 }
            }
            for ($k = 1; $k -le [Math]::Min(2, $s.Shapes.Count); $k++) { $s.Shapes.Item($k).TextFrame2.AutoSize = 2; $s.Shapes.Item($k).TextFrame2.WordWrap = -1 }
            $i = 2
            foreach ($sl in @($d.Slides)) {
                $s = $pres.Slides.Add($i, 2)
                $title = $s.Shapes.Item(1); $body = $s.Shapes.Item(2)
                $title.TextFrame.TextRange.Text = (Strip-Md $sl.title)
                $title.TextFrame.TextRange.Font.Color.RGB = 0x4A3A1C
                $body.TextFrame.TextRange.Text = ((@($sl.bullets) | ForEach-Object { Strip-Md $_ }) -join "`r")
                if ($Burmese) {
                    Set-Font2 $title.TextFrame2.TextRange 1.1
                    $title.TextFrame2.TextRange.Font.Size = 30
                    Set-Font2 $body.TextFrame2.TextRange 1.35
                    $body.TextFrame2.TextRange.Font.Size = 20
                    $body.TextFrame2.TextRange.ParagraphFormat.SpaceAfter = 6
                }
                $title.TextFrame2.AutoSize = 2; $body.TextFrame2.AutoSize = 2    # shrink text to fit the box
                $title.TextFrame2.WordWrap = -1; $body.TextFrame2.WordWrap = -1
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
