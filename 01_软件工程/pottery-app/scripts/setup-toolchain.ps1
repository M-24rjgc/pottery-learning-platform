$ErrorActionPreference = 'Stop'
$appRoot = Split-Path $PSScriptRoot -Parent
$toolRoot = Join-Path $appRoot '.toolchain'
New-Item -ItemType Directory -Force $toolRoot | Out-Null
$jdk = Get-ChildItem $toolRoot -Directory -Filter 'jdk-*' | Select-Object -First 1
if (-not $jdk) {
  $asset = @(Invoke-RestMethod 'https://api.adoptium.net/v3/assets/latest/21/hotspot?architecture=x64&image_type=jdk&os=windows')[0]
  $archive = Join-Path $toolRoot 'jdk.zip'
  & curl.exe -L --fail --retry 3 --silent --show-error -o $archive $asset.binary.package.link
  if ($LASTEXITCODE -ne 0) { throw 'JDK download failed' }
  $hashStream = [IO.File]::OpenRead($archive)
  $hasher = [Security.Cryptography.SHA256]::Create()
  try { $actualHash = [BitConverter]::ToString($hasher.ComputeHash($hashStream)).Replace('-','').ToLower() } finally { $hashStream.Dispose(); $hasher.Dispose() }
  if ($actualHash -ne $asset.binary.package.checksum) { throw 'JDK checksum mismatch' }
  Expand-Archive -LiteralPath $archive -DestinationPath $toolRoot -Force
  $asset | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $toolRoot 'jdk-source.json') -Encoding UTF8
  $jdk = Get-ChildItem $toolRoot -Directory -Filter 'jdk-*' | Select-Object -First 1
}
$env:JAVA_HOME = $jdk.FullName
$sdk = Join-Path $toolRoot 'sdk'
$manager = Join-Path $sdk 'cmdline-tools/latest/bin/sdkmanager.bat'
if (-not (Test-Path $manager)) {
  $archive = Join-Path $toolRoot 'commandline-tools.zip'
  & curl.exe -L --fail --retry 3 --silent --show-error -o $archive 'https://dl.google.com/android/repository/commandlinetools-win-15859902_latest.zip'
  if ($LASTEXITCODE -ne 0) { throw 'SDK tools download failed' }
  $unpack = Join-Path $toolRoot 'sdk-unpack'
  Expand-Archive -LiteralPath $archive -DestinationPath $unpack -Force
  New-Item -ItemType Directory -Force (Join-Path $sdk 'cmdline-tools/latest') | Out-Null
  Copy-Item -Path (Join-Path $unpack 'cmdline-tools/*') -Destination (Join-Path $sdk 'cmdline-tools/latest') -Recurse -Force
}
1..100 | ForEach-Object { 'y' } | & $manager "--sdk_root=$sdk" --licenses
if ($LASTEXITCODE -ne 0) { throw 'SDK license setup failed' }
& $manager "--sdk_root=$sdk" 'platforms;android-36' 'build-tools;36.0.0' 'platform-tools'
if ($LASTEXITCODE -ne 0) { throw 'SDK package setup failed' }
Write-Output 'Android toolchain ready.'
