param([switch]$Background,[switch]$SelfTest)
$ErrorActionPreference='Stop'
$gevRoot='D:/harness-work/atlias-local-1003'
$gevPin=Get-Content -LiteralPath "$gevRoot/CONTROLLER-PIN.json" -Raw | ConvertFrom-Json
$gevServer="$($gevPin.directory)/tools/local-work/dashboard.mjs"
foreach ($gevFile in $gevPin.files) {
  if ((Get-FileHash -LiteralPath "$($gevPin.directory)/$($gevFile.file)" -Algorithm SHA256).Hash.ToLowerInvariant() -ne $gevFile.sha256) { throw "Pinned controller changed: $($gevFile.file)" }
}
if ($SelfTest) { Write-Output 'PASS pinned dashboard source integrity'; exit 0 }
$gevLive=$false
if (Test-Path -LiteralPath "$gevRoot/DASHBOARD.lock") {
  $gevLease=Get-Content -LiteralPath "$gevRoot/DASHBOARD.lock" -Raw | ConvertFrom-Json
  if ($gevLease.pid -le 0) { throw 'Invalid dashboard lease' }
  $gevOwner=Get-CimInstance Win32_Process -Filter "ProcessId=$($gevLease.pid)"
  if ($gevOwner) {
    $gevLive=$gevOwner.CommandLine -and $gevOwner.CommandLine.Replace('\','/').Contains($gevServer)
    if (-not $gevLive) { throw 'Live dashboard lease belongs to an unverified process' }
  }
}
if (Test-Path -LiteralPath "$gevRoot/DASHBOARD-OFF") { throw 'Dashboard is paused; retained state is available on disk' }
if (-not $gevLive) {
  if (Get-NetTCPConnection -LocalPort 11436 -State Listen -ErrorAction SilentlyContinue) { throw 'Dashboard port is already occupied; nothing was replaced' }
  Start-Process -FilePath 'C:/Program Files/nodejs/node.exe' -ArgumentList @('"'+$gevServer+'"','"'+$gevRoot+'"') -WorkingDirectory $gevRoot -WindowStyle Hidden -RedirectStandardOutput "$gevRoot/DASHBOARD.stdout.log" -RedirectStandardError "$gevRoot/DASHBOARD.stderr.log"
}
$gevReady=$false
for ($gevTry=0;$gevTry -lt 30;$gevTry++) {
  try { $gevState=Invoke-RestMethod 'http://127.0.0.1:11436/api/progress' -TimeoutSec 2; if ($gevState.refreshedAt -and $gevState.totalGoals -eq 7) { $gevReady=$true; break } } catch {}
  Start-Sleep -Milliseconds 250
}
if (-not $gevReady) { throw 'Dashboard did not become ready; inspect DASHBOARD.stderr.log' }
if (-not $Background) { Start-Process 'http://127.0.0.1:11436' }
