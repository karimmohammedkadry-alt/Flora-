$ErrorActionPreference = 'Stop'
if (-not (Get-Command flutter -ErrorAction SilentlyContinue)) { throw 'Flutter SDK غير موجود في PATH. ثبّت Flutter ثم افتح PowerShell جديدًا.' }
if (-not (Test-Path '.\android\app\google-services.json')) { throw 'ملف Firebase غير موجود: AdminApp/android/app/google-services.json. سجّل تطبيق Android في Firebase أولًا.' }
flutter pub get
flutter analyze
if ($LASTEXITCODE -ne 0) { throw 'فشل flutter analyze؛ أصلح الأخطاء قبل البناء.' }
flutter build apk --release
if ($LASTEXITCODE -ne 0) { throw 'فشل بناء APK؛ راجع سجل Flutter/Gradle.' }
Write-Host 'APK: build\app\outputs\flutter-apk\app-release.apk'
