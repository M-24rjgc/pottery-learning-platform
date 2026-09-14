$ErrorActionPreference = 'Stop'
$workspaceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..')).TrimEnd('\')
$recordDir = Join-Path $workspaceRoot '06_整理工具与核验\整理记录\2026-09-13'
New-Item -ItemType Directory -Force -Path $recordDir | Out-Null
function Checked-Path([string]$relative) {
    $resolved = [IO.Path]::GetFullPath((Join-Path $workspaceRoot $relative))
    if (-not $resolved.StartsWith($workspaceRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "Path outside workspace: $resolved" }
    return $resolved
}
$review = 'output\hardware-review-2026-09-13'
$moves = [Collections.Generic.List[object]]::new()
function Add-Move([string]$source, [string]$destination) {
    $moves.Add([pscustomobject]@{source=$source;destination=$destination})
}
Add-Move 'pottery-studio' '01_软件工程\pottery-studio'
Add-Move "$review\pottery-learning-glove" '02_硬件工程\pottery-learning-glove'
Add-Move "$review\evidence\pc_tool" '02_硬件工程\上位机交付版\pc_tool'
Add-Move '项目计划书.docx' '03_项目文档\01_项目计划\项目计划书.docx'
Add-Move "$review\硬件资料梳理与软件衔接.md" '03_项目文档\03_梳理报告\硬件资料梳理与软件衔接.md'
foreach ($name in @('技术实现报告(1).docx','使用说明(1).docx','更新内容.docx')) {
    Add-Move "$review\evidence\attachments\$name" "03_项目文档\02_硬件原始文档\$name"
}
foreach ($name in @('1cfe3732e239d76d01ae3035b7acbe0b.mp4','cf50fccc447bee09ab5f47b11fb699d9.mp4','de7cee6d1fe7cd7f5ba2302b98367dbc.mp4','fd08dfb4b5a08629ba392b169f345af2.mp4')) {
    Add-Move $name "04_素材资源\01_原始教学与参考视频\$name"
}
foreach ($name in @('580ef6347bb554d4b8dd9eeadf7c36e5.mp4','7e1b180eb46f813f974978d5badc7550.mp4','22925470a70bc725dcb6982650e1a1e9.mp4')) {
    Add-Move "$review\evidence\attachments\$name" "04_素材资源\02_硬件演示视频\$name"
}
foreach ($name in @('e340d89ada134ca1218b0f34807f0f19.jpg','codex-clipboard-5e6eeca7-f96f-4c81-944c-45fb2cf42e5f.png','codex-clipboard-5df3a35a-1a70-4257-970b-a8be5811ab31.png','codex-clipboard-557a7e06-01bb-440c-b746-40312e7b56c4.png')) {
    Add-Move "$review\evidence\attachments\$name" "04_素材资源\03_硬件说明与沟通截图\$name"
}
Add-Move 'output\design' '04_素材资源\04_界面原型'
Add-Move 'pottery-assets' '04_素材资源\05_插画素材'
Add-Move "$review\evidence\attachments\pc_tool(1).rar" '05_交付归档\原始压缩包\pc_tool(1).rar'
Add-Move "$review\inspect_media.py" '06_整理工具与核验\整理工具\视频审阅\inspect_media.py'
Add-Move "$review\tooldeps" '06_整理工具与核验\整理工具\视频审阅\tooldeps'
# Move remaining evidence after individual attachments and PC source have moved.
Add-Move "$review\evidence" '06_整理工具与核验\审阅证据\2026-09-13'

foreach ($move in $moves) {
    $src = Checked-Path $move.source; $dst = Checked-Path $move.destination
    if (-not (Test-Path -LiteralPath $src)) { throw "Missing source: $src" }
    if (Test-Path -LiteralPath $dst) { throw "Destination exists: $dst" }
}
$moves | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $recordDir '迁移计划.json') -Encoding utf8
$inventory = @(Get-ChildItem -LiteralPath $workspaceRoot -Recurse -File -Force | Where-Object {
    $_.FullName -notmatch '\\(node_modules|tooldeps|\.git|dist)\\' -and
    -not $_.FullName.StartsWith((Join-Path $workspaceRoot '06_整理工具与核验'))
} | ForEach-Object {
    [pscustomobject]@{path=$_.FullName.Substring($workspaceRoot.Length+1);bytes=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash}
})
$inventory | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $recordDir '迁移前文件校验.json') -Encoding utf8
$journal = [Collections.Generic.List[object]]::new()
foreach ($move in $moves) {
    $src = Checked-Path $move.source; $dst = Checked-Path $move.destination
    New-Item -ItemType Directory -Force -Path ([IO.Path]::GetDirectoryName($dst)) | Out-Null
    Move-Item -LiteralPath $src -Destination $dst
    $journal.Add([pscustomobject]@{source=$move.source;destination=$move.destination;completedAt=(Get-Date).ToString('o')})
    $journal | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $recordDir '迁移日志.json') -Encoding utf8
}
$checks = foreach ($item in $inventory) {
    $move = $moves | Where-Object { $item.path -eq $_.source -or $item.path.StartsWith($_.source+'\') } | Sort-Object {$_.source.Length} -Descending | Select-Object -First 1
    $relative = if ($move) { $move.destination + $item.path.Substring($move.source.Length) } else { $item.path }
    $target = Checked-Path $relative
    $hash = if (Test-Path -LiteralPath $target -PathType Leaf) { (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash } else { '' }
    [pscustomobject]@{oldPath=$item.path;newPath=$relative;bytes=$item.bytes;sha256=$item.sha256;matched=($hash -eq $item.sha256)}
}
$checks | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $recordDir '迁移后文件校验.json') -Encoding utf8
$failed = @($checks | Where-Object {-not $_.matched})
if ($failed.Count) { throw "Verification failed: $($failed.Count) files" }
foreach ($relative in @('06_整理工具与核验\审阅证据\2026-09-13\attachments',$review,'output')) {
    $folder = Checked-Path $relative
    if ((Test-Path -LiteralPath $folder -PathType Container) -and @(Get-ChildItem -LiteralPath $folder -Force).Count -eq 0) { Remove-Item -LiteralPath $folder }
}
Write-Output "Moved $($moves.Count) items; verified $($checks.Count) source/material files; no hash mismatches."
