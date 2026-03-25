#!/usr/bin/env pwsh
# build_fast.ps1 -- fast install for JS-only changes (no clean)
# For native code changes (new packages / build.gradle), use build_native.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ROOT = "$PSScriptRoot\.."
Set-Location $ROOT

$env:JAVA_HOME    = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$ADB              = "$env:ANDROID_HOME\platform-tools\adb.exe"
$PACKAGE          = "com.ktakahashi.yoake"

# -- 0. Check device connection --
$devices = & $ADB devices | Select-String "device$"
if (-not $devices) {
    Write-Error "Android device not found. Check USB connection and USB debugging."
    exit 1
}

# -- 1. JS bundle --
Write-Host "[1/3] Bundling JS..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force "android/app/src/main/assets" | Out-Null

npx react-native bundle `
    --platform android `
    --dev true `
    --entry-file index.js `
    --bundle-output android/app/src/main/assets/index.android.bundle `
    --assets-dest android/app/src/main/res

if ($LASTEXITCODE -ne 0) { Write-Error "Bundle failed"; exit 1 }

# -- 2. APK incremental build & install --
Write-Host "[2/3] Building APK (incremental, no clean)..." -ForegroundColor Cyan
Set-Location "android"

.\gradlew.bat installDebug 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed. If you added native packages, run build_native.ps1 instead."
    exit 1
}
Set-Location $ROOT

# -- 3. Launch app --
Write-Host "[3/3] Launching app..." -ForegroundColor Cyan
& $ADB shell am force-stop $PACKAGE
Start-Sleep -Seconds 1
& $ADB shell am start -n "$PACKAGE/.MainActivity"

Write-Host "Done!" -ForegroundColor Green
