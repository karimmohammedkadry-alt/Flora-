$ErrorActionPreference = 'Stop'
$ProjectRef = 'vznmljvoarfjugnaqdhv'
$DefaultOrigin = 'https://flora-fashion-hijab.vercel.app'
$OriginInput = Read-Host "عنوان موقع Flora المنشور [$DefaultOrigin]"
$Origin = if ([string]::IsNullOrWhiteSpace($OriginInput)) { $DefaultOrigin } else { $OriginInput.Trim().TrimEnd('/') }
if ($Origin -notmatch '^https://[^/]+$') { throw 'عنوان الموقع يجب أن يكون HTTPS بدون مسار.' }

$ConfigPath = Join-Path $PSScriptRoot '..\..\Shared\frontend\js\supabase-config.js'
if (-not (Test-Path $ConfigPath)) { throw "ملف الإعداد العام غير موجود: $ConfigPath" }
$ConfigText = Get-Content $ConfigPath -Raw
if ($ConfigText -notmatch 'window\.FLORA_SUPABASE_KEY\s*=\s*["'']([^"'']+)["'']') { throw 'تعذر قراءة publishable key من supabase-config.js.' }
$PublicKey = $Matches[1]
$BaseUrl = "https://$ProjectRef.supabase.co/functions/v1"

function Get-HttpProbe([string]$Method, [string]$Uri, [hashtable]$Headers, [string]$Body = '') {
  try {
    $args = @{ Uri = $Uri; Method = $Method; Headers = $Headers; UseBasicParsing = $true; ErrorAction = 'Stop' }
    if ($Body) { $args.Body = $Body; $args.ContentType = 'application/json' }
    $r = Invoke-WebRequest @args
    return [pscustomobject]@{ Status = [int]$r.StatusCode; AllowOrigin = [string]$r.Headers['Access-Control-Allow-Origin']; Body = [string]$r.Content }
  } catch {
    $resp = $_.Exception.Response
    if (-not $resp) { throw }
    $status = 0
    try { $status = [int]$resp.StatusCode.value__ } catch { $status = [int]$resp.StatusCode }
    $allow = ''
    try { $allow = [string]$resp.Headers['Access-Control-Allow-Origin'] } catch {}
    $content = ''
    try {
      $stream = $resp.GetResponseStream()
      if ($stream) { $reader = New-Object System.IO.StreamReader($stream); try { $content = $reader.ReadToEnd() } finally { $reader.Dispose() } }
    } catch {}
    return [pscustomobject]@{ Status = $status; AllowOrigin = $allow; Body = $content }
  }
}

$failed = 0
foreach ($name in @('flora-admin', 'flora-customer-auth')) {
  $requestedHeaders = if ($name -eq 'flora-admin') { 'content-type, apikey, x-flora-dashboard-key' } else { 'content-type, apikey' }
  $headers = @{
    Origin = $Origin
    'Access-Control-Request-Method' = 'POST'
    'Access-Control-Request-Headers' = $requestedHeaders
  }
  $preflight = Get-HttpProbe 'OPTIONS' "$BaseUrl/$name" $headers
  if ($preflight.Status -eq 204 -and $preflight.AllowOrigin -eq $Origin) {
    Write-Host "PASS $name CORS preflight (204; origin allowed)" -ForegroundColor Green
  } else {
    Write-Host "FAIL $name CORS preflight: status=$($preflight.Status), allow-origin='$($preflight.AllowOrigin)'" -ForegroundColor Red
    $failed++
  }
}

$adminHeaders = @{ Origin = $Origin; apikey = $PublicKey; 'x-flora-dashboard-key' = 'flora-invalid-key-smoke-test' }
$adminBody = '{"action":"products_list","payload":{}}'
$adminProbe = Get-HttpProbe 'POST' "$BaseUrl/flora-admin" $adminHeaders $adminBody
if ($adminProbe.Status -eq 401) {
  Write-Host 'PASS flora-admin rejects an invalid dashboard key (401; no data changed)' -ForegroundColor Green
} else {
  Write-Host "FAIL flora-admin invalid-key test: expected 401, got $($adminProbe.Status)" -ForegroundColor Red
  $failed++
}

$customerHeaders = @{ Origin = $Origin; apikey = $PublicKey }
$customerBody = '{"action":"login","phone":"000","password":"invalid-smoke-test"}'
$customerProbe = Get-HttpProbe 'POST' "$BaseUrl/flora-customer-auth" $customerHeaders $customerBody
if ($customerProbe.Status -eq 400) {
  Write-Host 'PASS flora-customer-auth rejects invalid phone input before database changes (400)' -ForegroundColor Green
} else {
  Write-Host "FAIL flora-customer-auth input validation: expected 400, got $($customerProbe.Status)" -ForegroundColor Red
  $failed++
}

Write-Host ''
if ($failed -eq 0) {
  Write-Host 'All non-mutating smoke tests passed. This does not verify a real customer registration, product write, order creation, or Firebase push.' -ForegroundColor Green
} else {
  throw "$failed smoke test(s) failed. Review the output and Supabase Function logs."
}
