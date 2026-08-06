param(
  [string]$DeviceId = "",
  [string]$BackendUrl = "",
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

function Resolve-DeviceId {
  if ($DeviceId -and $DeviceId.Trim().Length -gt 0) {
    return $DeviceId.Trim()
  }

  $raw = adb devices | Select-String "`tdevice$"
  if (-not $raw) {
    throw "No connected Android device found. Connect phone and enable USB debugging."
  }

  return ($raw[0].ToString().Split("`t")[0]).Trim()
}

Set-Location $PSScriptRoot

$resolvedDevice = Resolve-DeviceId
Write-Host "Using device: $resolvedDevice" -ForegroundColor Cyan

if (-not $SkipBuild) {
  Write-Host "Building debug APK..." -ForegroundColor Yellow
  if ($BackendUrl -and $BackendUrl.Trim().Length -gt 0) {
    flutter build apk --debug --dart-define="BACKEND_URL=$($BackendUrl.Trim())"
  } else {
    flutter build apk --debug
  }
}

$apkPath = Join-Path $PSScriptRoot "build\app\outputs\flutter-apk\app-debug.apk"
if (-not (Test-Path $apkPath)) {
  throw "APK not found at $apkPath"
}

Write-Host "Installing APK with no-streaming..." -ForegroundColor Yellow
adb -s $resolvedDevice install --no-streaming -r -d -t "$apkPath"

Write-Host "Launching app..." -ForegroundColor Yellow
adb -s $resolvedDevice shell monkey -p com.example.trtripsathi_mobile -c android.intent.category.LAUNCHER 1 | Out-Null

Write-Host "Done. App should now be open on your phone." -ForegroundColor Green
