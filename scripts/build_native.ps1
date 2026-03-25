#!/usr/bin/env pwsh
# build_native.ps1 -- native code change full build (with clean)
# Use when:
#   - Added new native packages via npm install
#   - Changed android/build.gradle or app/build.gradle
#   - Changed AndroidManifest.xml
#   - build_fast.ps1 returned "Build failed"

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

# -- 1. Gradle clean --
Write-Host "[1/4] Gradle clean..." -ForegroundColor Cyan
Set-Location "android"
.\gradlew.bat clean 2>&1
if ($LASTEXITCODE -ne 0) { Write-Error "Gradle clean failed"; exit 1 }
Set-Location $ROOT

# -- 2. JS bundle --
Write-Host "[2/4] Bundling JS..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force "android/app/src/main/assets" | Out-Null

npx react-native bundle `
    --platform android `
    --dev true `
    --entry-file index.js `
    --bundle-output android/app/src/main/assets/index.android.bundle `
    --assets-dest android/app/src/main/res

if ($LASTEXITCODE -ne 0) { Write-Error "Bundle failed"; exit 1 }

# -- 3. APK full build & install --
Write-Host "[3/4] Building APK (full build)..." -ForegroundColor Cyan
Set-Location "android"

.\gradlew.bat installDebug 2>&1

if ($LASTEXITCODE -ne 0) { Write-Error "Build failed"; exit 1 }
Set-Location $ROOT

# -- 4. Launch app --
Write-Host "[4/4] Launching app..." -ForegroundColor Cyan
& $ADB shell am force-stop $PACKAGE
Start-Sleep -Seconds 1
& $ADB shell am start -n "$PACKAGE/.MainActivity"

Write-Host "Done!" -ForegroundColor Green
