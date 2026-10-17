$ErrorActionPreference = 'Stop'

# Run from the AdminApp directory. This script intentionally contains ASCII only.
$root = (Get-Location).Path
$settingsPath = Join-Path $root 'android\settings.gradle.kts'
$wrapperPath  = Join-Path $root 'android\gradle\wrapper\gradle-wrapper.properties'
$gradleProps  = Join-Path $root 'android\gradle.properties'

foreach ($path in @($settingsPath, $wrapperPath, $gradleProps)) {
    if (-not (Test-Path $path)) { throw "Required file not found: $path. Run this from the AdminApp directory." }
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path $root ("android-build-backup-" + $stamp)
New-Item -ItemType Directory -Path $backupDir | Out-Null
Copy-Item $settingsPath (Join-Path $backupDir 'settings.gradle.kts')
Copy-Item $wrapperPath  (Join-Path $backupDir 'gradle-wrapper.properties')
Copy-Item $gradleProps  (Join-Path $backupDir 'gradle.properties')

$settings = Get-Content -Raw -Encoding UTF8 $settingsPath
if ($settings -notmatch 'com\.android\.application.*version "9\.1\.0"') {
    throw 'Unexpected Android Gradle Plugin version in settings.gradle.kts. No changes were made.'
}
if ($settings -notmatch 'org\.jetbrains\.kotlin\.android.*version "2\.4\.0"') {
    throw 'Unexpected Kotlin plugin version in settings.gradle.kts. No changes were made.'
}
$settings = $settings -replace '(id\("com\.android\.application"\)\s+version\s+")9\.1\.0("\s+apply false)', '${1}8.13.2${2}'
$settings = $settings -replace '(id\("org\.jetbrains\.kotlin\.android"\)\s+version\s+")2\.4\.0("\s+apply false)', '${1}2.3.0${2}'
Set-Content -Path $settingsPath -Value $settings -Encoding UTF8

$wrapper = Get-Content -Raw -Encoding UTF8 $wrapperPath
if ($wrapper -notmatch 'gradle-9\.3\.1-all\.zip') {
    throw 'Unexpected Gradle wrapper version. Restore from backup if needed, then inspect the wrapper file.'
}
$wrapper = $wrapper -replace 'gradle-9\.3\.1-all\.zip', 'gradle-8.13-all.zip'
Set-Content -Path $wrapperPath -Value $wrapper -Encoding UTF8

# The legacy Kotlin options block is supported by the AGP 8.x configuration above.
Write-Output 'Updated Android Gradle Plugin to 8.13.2, Kotlin Gradle Plugin to 2.3.0, and Gradle wrapper to 8.13.'
Write-Output "Backup saved at: $backupDir"

$sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$sdkmanagerCandidates = @(
    (Join-Path $sdk 'cmdline-tools\latest\bin\sdkmanager.bat'),
    (Join-Path $sdk 'cmdline-tools\bin\sdkmanager.bat')
)
$sdkmanager = $sdkmanagerCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($sdkmanager) {
    Write-Output 'Attempting to install the NDK version required by this project...'
    & $sdkmanager --install 'ndk;28.2.13676358'
    if ($LASTEXITCODE -ne 0) {
        Write-Warning 'NDK installation did not complete. Install NDK 28.2.13676358 from Android Studio > SDK Manager > SDK Tools > NDK (Side by side).'
    }
} else {
    Write-Warning 'sdkmanager.bat was not found. Install NDK 28.2.13676358 from Android Studio > SDK Manager > SDK Tools > NDK (Side by side).'
}

Write-Output ''
Write-Output 'Next run: flutter clean; flutter pub get; flutter analyze; flutter build apk --release'
