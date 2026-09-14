param([switch]$SkipWeb)
$ErrorActionPreference = 'Stop'
$appRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $appRoot
$toolRoot = Join-Path $appRoot '.toolchain'
$jdk = Get-ChildItem -LiteralPath $toolRoot -Directory -Filter 'jdk-*' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($jdk) { $env:JAVA_HOME = $jdk.FullName }
$sdk = Join-Path $toolRoot 'sdk'
if (-not (Test-Path $sdk)) { $sdk = $env:ANDROID_HOME }
if (-not $env:JAVA_HOME -or -not (Test-Path "$sdk/platforms/android-36")) { throw 'Run scripts/setup-toolchain.ps1 first, or configure JAVA_HOME and ANDROID_HOME (API 36).' }
if (-not $SkipWeb) {
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'Web build failed' }
  & ./node_modules/.bin/cap.cmd sync android
  if ($LASTEXITCODE -ne 0) { throw 'Capacitor sync failed' }
}
# A temporary drive alias avoids Windows long-path failures in Gradle caches.
# All files remain physically inside this project. The alias is released below.
$drive = @('P','Q','R','S','T','U','V','W','X','Y','Z') | Where-Object { -not (Get-PSDrive -Name $_ -ErrorAction SilentlyContinue) -and -not (Test-Path "${_}:\") } | Select-Object -First 1
if (-not $drive) { throw 'No unused drive letter available for short build paths' }
& subst.exe "${drive}:" $appRoot
if ($LASTEXITCODE -ne 0) { throw 'Could not create temporary build drive' }
try {
  $shortRoot = "${drive}:\"
  if ($jdk) { $env:JAVA_HOME = Join-Path $shortRoot ('.toolchain/' + $jdk.Name) }
  $buildSdk = if ($sdk.StartsWith($appRoot)) { Join-Path $shortRoot $sdk.Substring($appRoot.Length + 1) } else { $sdk }
  $env:ANDROID_HOME = $buildSdk
  $env:GRADLE_USER_HOME = Join-Path $shortRoot '.toolchain/gradle-cache'
  $sdkProperty = -join ($buildSdk.Replace('\','/').ToCharArray() | ForEach-Object { if ([int]$_ -gt 127) { '\u{0:x4}' -f [int]$_ } else { [string]$_ } })
  Set-Content -LiteralPath (Join-Path $appRoot 'android/local.properties') -Value "sdk.dir=$sdkProperty" -Encoding ASCII
  Set-Location -LiteralPath $shortRoot
  $built = $false
  for ($attempt=1; $attempt -le 5; $attempt++) {
    & ./android/gradlew.bat -p android --no-daemon --max-workers=1 "-Dorg.gradle.vfs.watch=false" :app:assembleDebug
    if ($LASTEXITCODE -eq 0) { $built=$true; break }
    $fixed = & (Join-Path $appRoot 'scripts/repair-gradle-cache.ps1') -CacheRoot $env:GRADLE_USER_HOME
    if ($fixed -eq 0) { break }
    Write-Output "Recovered $fixed completed Gradle cache directories after Windows rename failure; retrying normal build."
  }
  if (-not $built) { throw 'Android build failed' }
} finally {
  Set-Location -LiteralPath $appRoot
  if ($jdk) { $env:JAVA_HOME = $jdk.FullName }
  $env:ANDROID_HOME = $sdk
  $env:GRADLE_USER_HOME = Join-Path $toolRoot 'gradle-cache'
  & subst.exe "${drive}:" /D
  $sdkProperty = -join ($sdk.Replace('\','/').ToCharArray() | ForEach-Object { if ([int]$_ -gt 127) { '\u{0:x4}' -f [int]$_ } else { [string]$_ } })
  Set-Content -LiteralPath 'android/local.properties' -Value "sdk.dir=$sdkProperty" -Encoding ASCII
}
$version = (Get-Content -LiteralPath (Join-Path $appRoot 'package.json') -Raw | ConvertFrom-Json).version
$output = Join-Path $appRoot '../../05_交付归档/安卓APP'
New-Item -ItemType Directory -Force -Path $output | Out-Null
$apk = Join-Path $output ("非遗之手-{0}-debug.apk" -f $version)
Copy-Item -LiteralPath 'android/app/build/outputs/apk/debug/app-debug.apk' -Destination $apk -Force
& "$sdk/build-tools/36.0.0/apksigner.bat" verify --verbose $apk
if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed' }
$hashStream = [IO.File]::OpenRead($apk)
$hasher = [Security.Cryptography.SHA256]::Create()
try { $hash = [BitConverter]::ToString($hasher.ComputeHash($hashStream)).Replace('-','') } finally { $hashStream.Dispose(); $hasher.Dispose() }
Set-Content -LiteralPath "$apk.sha256" -Value ("{0}  {1}" -f $hash, [IO.Path]::GetFileName($apk)) -Encoding UTF8
Write-Output "APK ready: $apk"
