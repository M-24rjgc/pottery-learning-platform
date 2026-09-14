$ErrorActionPreference='Stop'
$studioRoot=Split-Path $PSScriptRoot
$previousApi=$env:VITE_API_ORIGIN
Push-Location (Join-Path $studioRoot 'desktop')
try {
 $env:VITE_API_ORIGIN='http://localhost:4192'
 node node_modules/vite/bin/vite.js build --outDir ../.demo/desktop
 if($LASTEXITCODE -ne 0){throw '演示界面构建失败'}
} finally {
 $env:VITE_API_ORIGIN=$previousApi
 Pop-Location
}
node (Join-Path $PSScriptRoot 'server.mjs')
