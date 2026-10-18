$ErrorActionPreference = 'Stop'
$ProjectRef = 'vznmljvoarfjugnaqdhv'
$DefaultOrigin = 'https://flora-fashion-hijab.vercel.app'

# This project installs Supabase CLI locally, so call it through npx (not a global `supabase` command).
$CliVersion = & npx supabase --version
if ($LASTEXITCODE -ne 0) { throw 'تعذر تشغيل Supabase CLI عبر npx. نفّذ npm install --save-dev supabase ثم أعد المحاولة.' }
Write-Host "Supabase CLI: $CliVersion" -ForegroundColor Cyan

$OriginInput = Read-Host "عنوان موقع Flora المنشور [$DefaultOrigin]"
$Origin = if ([string]::IsNullOrWhiteSpace($OriginInput)) { $DefaultOrigin } else { $OriginInput.Trim().TrimEnd('/') }
if ($Origin -notmatch '^https://[^/]+$') {
  throw 'اكتب عنوان HTTPS فقط بدون مسار أو شرطة مائلة أخيرة، مثل https://flora-fashion-hijab.vercel.app'
}

$FunctionRoot = Join-Path $PSScriptRoot 'functions'
foreach ($FunctionName in @('flora-admin', 'flora-customer-auth')) {
  if (-not (Test-Path (Join-Path (Join-Path $FunctionRoot $FunctionName) 'index.ts'))) {
    throw "ملف الدالة $FunctionName غير موجود؛ لم يتم نشر أي دالة."
  }
}

$bytes = New-Object byte[] 36
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
$EditSecret = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')

Write-Host ''
Write-Host "المشروع المستهدف: $ProjectRef (flora)" -ForegroundColor Cyan
Write-Host "الموقع المسموح: $Origin" -ForegroundColor Cyan
Write-Host 'سيتم ضبط أسرار الداشبورد ومصدر تسجيل العملاء، ثم نشر flora-admin و flora-customer-auth فقط.' -ForegroundColor Cyan

# The Supabase config.toml lives beside this script, not at the repository root.
# Run CLI commands from this directory so the intended config is applied.
Push-Location $PSScriptRoot
$SecretsUpdated = $false
try {
  & npx supabase secrets set "FLORA_DASHBOARD_EDIT_SECRET=$EditSecret" "FLORA_DASHBOARD_ORIGIN=$Origin" "FLORA_CUSTOMER_AUTH_ORIGINS=$Origin" --project-ref $ProjectRef
  if ($LASTEXITCODE -ne 0) { throw 'فشل ضبط الأسرار. لم يبدأ نشر الدوال.' }
  $SecretsUpdated = $true

  & npx supabase functions deploy flora-admin --project-ref $ProjectRef --use-api
  if ($LASTEXITCODE -ne 0) { throw 'فشل نشر Edge Function flora-admin.' }

  & npx supabase functions deploy flora-customer-auth --project-ref $ProjectRef --use-api
  if ($LASTEXITCODE -ne 0) { throw 'تم نشر flora-admin، لكن فشل نشر flora-customer-auth. راجع الخطأ ثم أعد تشغيل السكربت.' }

  Write-Host ''
  Write-Host 'تم طلب نشر الدالتين بنجاح. رمز إدارة الداشبورد (لن يُحفظ داخل الملفات):' -ForegroundColor Yellow
  Write-Host $EditSecret -ForegroundColor Green
  Write-Host ''
  Write-Host 'احتفظ بالرمز في مكان آمن، ولا ترسله في المحادثات أو تضعه في ملفات Frontend.'
  Write-Host 'الآن شغّل test_live_functions.ps1 من هذا المجلد لاختبار CORS ورفض الطلبات غير المصرح بها دون إنشاء أو تعديل بيانات.'
  Write-Host 'دالة flora-order-push لم تُنشر بهذا السكربت؛ تحتاج إعداد FIREBASE_SERVICE_ACCOUNT_JSON و FLORA_ORDER_WEBHOOK_SECRET أولًا.'
} catch {
  if ($SecretsUpdated) {
    Write-Host 'تنبيه: تم تحديث سر الإدارة بالفعل. احتفظ بالرمز الحالي التالي حتى لو فشل نشر إحدى الدوال:' -ForegroundColor Yellow
    Write-Host $EditSecret -ForegroundColor Green
  }
  throw
} finally {
  Pop-Location
}
