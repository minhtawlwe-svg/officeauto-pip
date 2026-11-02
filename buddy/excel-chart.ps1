<#
  Called by Pip: puts a chart's numbers on a new sheet and adds a native Excel chart.
  Input: -Json <file> with { File, Title, Type, XLabel, Labels[], Datasets[{label,data[]}] }.
  Uses the workbook if it is already open in Excel, otherwise opens it (or a new workbook
  for CSV / no file). Never saves - the user decides. ASCII-only for PowerShell 5.1.
#>
param([Parameter(Mandatory)][string]$Json)
$ErrorActionPreference = 'Stop'
$d = Get-Content -Raw -LiteralPath $Json -Encoding UTF8 | ConvertFrom-Json

try {
    try { $xl = [Runtime.InteropServices.Marshal]::GetActiveObject('Excel.Application') }
    catch { $xl = New-Object -ComObject Excel.Application }
    $xl.Visible = $true

    $wb = $null
    $file = [string]$d.File
    if ($file -and $file -notmatch '\.csv$') {
        foreach ($w in $xl.Workbooks) { if ($w.FullName -eq $file) { $wb = $w } }
        if (-not $wb) { $wb = $xl.Workbooks.Open($file) }
    } else {
        $wb = $xl.Workbooks.Add()
    }

    # unique sheet name "Pip Chart", "Pip Chart 2", ...
    $names = @(); foreach ($s in $wb.Worksheets) { $names += $s.Name }
    $name = 'Pip Chart'; $n = 2
    while ($names -contains $name) { $name = "Pip Chart $n"; $n++ }
    $ws = $wb.Worksheets.Add([Type]::Missing, $wb.Worksheets.Item($wb.Worksheets.Count))
    $ws.Name = $name

    # data block: header row + one row per label
    $labels = @($d.Labels); $sets = @($d.Datasets)
    $rows = $labels.Count + 1; $cols = $sets.Count + 1
    $arr = New-Object 'object[,]' $rows, $cols
    $arr[0, 0] = [string]$d.XLabel
    for ($j = 0; $j -lt $sets.Count; $j++) { $arr[0, ($j + 1)] = [string]$sets[$j].label }
    for ($i = 0; $i -lt $labels.Count; $i++) {
        $arr[($i + 1), 0] = [string]$labels[$i]
        for ($j = 0; $j -lt $sets.Count; $j++) { $arr[($i + 1), ($j + 1)] = [double]$sets[$j].data[$i] }
    }
    $ws.Columns.Item(1).NumberFormat = '@'          # keep labels like 2026-01 as text, not dates
    $range = $ws.Range($ws.Cells.Item(1, 1), $ws.Cells.Item($rows, $cols))
    $range.Value2 = $arr
    $ws.Rows.Item(1).Font.Bold = $true
    $hasFraction = $false
    foreach ($s in $sets) { foreach ($v in $s.data) { if ([double]$v -ne [math]::Floor([double]$v)) { $hasFraction = $true } } }
    $ws.Range($ws.Cells.Item(2, 2), $ws.Cells.Item($rows, $cols)).NumberFormat = $(if ($hasFraction) { '#,##0.00' } else { '#,##0' })
    [void]$ws.Columns.Item(1).AutoFit()

    $types = @{ bar = 51; hbar = 57; line = 65; pie = 5; doughnut = -4120 }
    $type = [string]$d.Type
    $code = if ($types.ContainsKey($type)) { $types[$type] } else { 51 }
    $left = $ws.Cells.Item(1, $cols + 2).Left
    $co = $ws.ChartObjects().Add($left, 10, 560, 320)
    $ch = $co.Chart
    $ch.SetSourceData($range)
    $ch.ChartType = $code
    $ch.HasTitle = $true
    $ch.ChartTitle.Text = [string]$d.Title
    if ($sets.Count -eq 1 -and $code -ne 5 -and $code -ne -4120) { $ch.HasLegend = $false }

    $ws.Activate()
    [Console]::Out.Write("OK|$name|$($wb.Name)")
} catch {
    $m = $_.Exception.Message
    if ($m -match '0x8001010A|0x800AC472|rejected') { $m = 'Excel is busy (editing a cell or a dialog is open). Press Esc in Excel and try again.' }
    elseif ($m -match '80040154|class not registered') { $m = 'Microsoft Excel is not installed on this PC.' }
    [Console]::Out.Write("ERR|$m")
}
