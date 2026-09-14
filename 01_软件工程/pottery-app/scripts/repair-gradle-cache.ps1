param([Parameter(Mandatory=$true)][string]$CacheRoot)
$ErrorActionPreference = 'Stop'
$resolvedRoot = [IO.Path]::GetFullPath($CacheRoot).TrimEnd('\')
$cachePrefix = $resolvedRoot + '\'
$recovered = 0
# Gradle writes metadata.bin, including output hashes, only after successful work.
# Recover only completed transform directories after the build daemon has exited.
# A subsequent Gradle build still validates these hashes; no checks are disabled.
$transforms = Join-Path $resolvedRoot 'caches/8.14.3/transforms'
if (-not (Test-Path -LiteralPath $transforms)) { return 0 }
foreach ($entry in Get-ChildItem -LiteralPath $transforms -Directory) {
  if ($entry.Name -notmatch '^([a-f0-9]{32})-[a-f0-9-]{36}$') { continue }
  $target = [IO.Path]::GetFullPath((Join-Path $entry.Parent.FullName $Matches[1]))
  $source = [IO.Path]::GetFullPath($entry.FullName)
  if (-not $source.StartsWith($cachePrefix,[StringComparison]::OrdinalIgnoreCase) -or -not $target.StartsWith($cachePrefix,[StringComparison]::OrdinalIgnoreCase)) { throw 'Cache recovery path is outside the project cache' }
  if ((Test-Path -LiteralPath $target) -or -not (Test-Path -LiteralPath (Join-Path $source 'metadata.bin')) -or -not (Test-Path -LiteralPath (Join-Path $source 'results.bin'))) { continue }
  Copy-Item -LiteralPath $source -Destination $target -Recurse
  $recovered++
}
return $recovered
