#!/usr/bin/env pwsh
# build_release.ps1 -- Android release build for Play Console upload.
# Default: generate AAB with `bundleRelease`
# Optional: add `-Apk` to also generate `app-release.apk`
# Default ABI: `arm64-v8a`
# Example:
#   powershell -File scripts/build_release.ps1
#   powershell -File scripts/build_release.ps1 -Architectures "armeabi-v7a,arm64-v8a"
#   powershell -File scripts/build_release.ps1 -Apk -Clean

param(
    [switch]$Apk,
    [switch]$Clean,
    [string]$Architectures = "arm64-v8a"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ROOT = "$PSScriptRoot\.."
Set-Location $ROOT

$env:JAVA_HOME    = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$GRADLEW          = Join-Path $ROOT "android\gradlew.bat"
$BUILD_GRADLE     = Join-Path $ROOT "android\app\build.gradle"
$KEYSTORE_PROPS   = Join-Path $ROOT "android\keystore.properties"
$AAB_PATH         = Join-Path $ROOT "android\app\build\outputs\bundle\release\app-release.aab"
$APK_PATH         = Join-Path $ROOT "android\app\build\outputs\apk\release\app-release.apk"

function Get-VersionCode {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $content = Get-Content $Path -Raw
    $match = [regex]::Match($content, 'versionCode\s+(\d+)')
    if (-not $match.Success) {
        throw "versionCode not found in $Path"
    }

    return [int]$match.Groups[1].Value
}

function Set-VersionCode {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [int]$VersionCode
    )

    $content = Get-Content $Path -Raw
    $updated = [regex]::Replace(
        $content,
        'versionCode\s+\d+',
        "versionCode $VersionCode",
        1
    )

    if ($updated -eq $content) {
        throw "Failed to update versionCode in $Path"
    }

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $updated, $utf8NoBom)
}

if (-not (Test-Path $GRADLEW)) {
    Write-Error "gradlew.bat not found: $GRADLEW"
    exit 1
}

$buildGradleText = Get-Content $BUILD_GRADLE -Raw
if (-not (Test-Path $KEYSTORE_PROPS)) {
    Write-Error "android\\keystore.properties not found. Copy android\\keystore.properties.example and fill in your release keystore settings before running a release build."
    exit 1
}

if ($buildGradleText -match 'release\s*\{[\s\S]*signingConfig\s+hasReleaseSigning\s*\?\s*signingConfigs\.release\s*:\s*signingConfigs\.debug') {
    Write-Host "Release signing config detected via android\\keystore.properties" -ForegroundColor Green
}

$currentVersionCode = Get-VersionCode -Path $BUILD_GRADLE
$nextVersionCode = $currentVersionCode + 1
Set-VersionCode -Path $BUILD_GRADLE -VersionCode $nextVersionCode
Write-Host "versionCode: $currentVersionCode -> $nextVersionCode" -ForegroundColor Yellow

$tasks = @()
if ($Clean) {
    $tasks += "clean"
}

$tasks += @(
    ":react-native-worklets:prefabReleasePackage",
    ":react-native-reanimated:prefabReleasePackage",
    "bundleRelease"
)
if ($Apk) {
    $tasks += "assembleRelease"
}

Write-Host "Architectures: $Architectures" -ForegroundColor Yellow
Write-Host "[1/2] Running Gradle tasks: $($tasks -join ', ')" -ForegroundColor Cyan
Set-Location (Join-Path $ROOT "android")
& .\gradlew.bat @tasks "-PreactNativeArchitectures=$Architectures"

if ($LASTEXITCODE -ne 0) {
    Write-Error "Release build failed"
    exit 1
}

Set-Location $ROOT

Write-Host "[2/2] Build output" -ForegroundColor Cyan
if (Test-Path $AAB_PATH) {
    Write-Host "AAB: $AAB_PATH" -ForegroundColor Green
} else {
    Write-Warning "AAB not found at expected path: $AAB_PATH"
}

if ($Apk) {
    if (Test-Path $APK_PATH) {
        Write-Host "APK: $APK_PATH" -ForegroundColor Green
    } else {
        Write-Warning "APK not found at expected path: $APK_PATH"
    }
}

Write-Host "Done!" -ForegroundColor Green
