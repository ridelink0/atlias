param([switch]$SelfTest)
$ErrorActionPreference='Stop'
$gevRoot='D:/harness-work/atlias-local-1003'
function Get-GevNotice($data) {
  if (-not $data) { return $null }
  if ($data.error) { return "Local Atlias needs attention: $($data.error)" }
  if ($data.status -like 'needs-repair*' -and $data.failures -ge 3) { return "Local Atlias retained $($data.failures) failed phases and is changing focus after a cooldown." }
  if ($data.status -match 'FAILED|HELD|attention|complete|qualified|goal-achieved') { return "Local Atlias: $($data.status)" }
  return $null
}
function Test-GevNoticeFresh([hashtable]$seen,[string]$file,[string]$hash,[string]$text) {
  return ($seen[$file] -ne $hash -and -not $seen.ContainsKey('notice:'+$text))
}
Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
public static class GevLocalPower {
  [DllImport("kernel32.dll", SetLastError=true)] public static extern uint SetThreadExecutionState(uint state);
}
'@
if ($SelfTest) {
  if ($null -ne (Get-GevNotice $null)) { throw 'Empty notification input' }
  if ($null -ne (Get-GevNotice @{status='worker-active'})) { throw 'Routine state must stay quiet' }
  if (-not (Get-GevNotice @{error='coding gate failed'})) { throw 'Failure notification missing' }
  if (-not (Get-GevNotice @{status='completed'})) { throw 'Completion notification missing' }
  if (-not (Get-GevNotice @{status='HELD'})) { throw 'Held notification missing' }
  if (-not (Get-GevNotice @{status='needs-repair';failures=3})) { throw 'Persistent recovery notification missing' }
  if ($null -ne (Get-GevNotice @{status='needs-repair';failures=1})) { throw 'First repair phase should not generate repeated alerts' }
  if (Test-GevNoticeFresh @{'notice:same recovery'=$true} 'RECOVERY.json' 'different-file-hash' 'same recovery') { throw 'Duplicate cross-file recovery notice' }
  if (-not (Test-GevNoticeFresh @{} 'RECOVERY.json' 'fresh-hash' 'new recovery')) { throw 'New notice suppressed' }
  if ([GevLocalPower]::SetThreadExecutionState([uint32]2147483648) -eq 0) { throw 'Native keep-awake API failed' }
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing
  $gevProbe=New-Object System.Windows.Forms.NotifyIcon
  $gevProbe.Dispose()
  Write-Output 'PASS: nine state/dedup controls, native notification object and keep-awake API'
  exit 0
}
$gevCreated=$false
$gevMutex=New-Object System.Threading.Mutex($true,'Local\GevAtliasLocalNotifications',[ref]$gevCreated)
if (-not $gevCreated) { $gevMutex.Dispose(); exit 0 }
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$gevIcon=New-Object System.Windows.Forms.NotifyIcon
$gevIcon.Icon=[System.Drawing.SystemIcons]::Information
$gevIcon.Text='Gev local Atlias'
$gevIcon.Visible=$true
$gevIcon.Add_MouseClick({
  if ($_.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
    Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File','"D:/harness-work/atlias-local-1003/Show-Progress.ps1"') -WindowStyle Hidden
  }
})
$gevSeenFile="$gevRoot/NOTIFICATION-SEEN.json"
$gevSeen=@{}
if (Test-Path -LiteralPath $gevSeenFile) {
  try { $gevSaved=Get-Content -LiteralPath $gevSeenFile -Raw | ConvertFrom-Json; foreach ($gevItem in $gevSaved.PSObject.Properties) { $gevSeen[$gevItem.Name]=$gevItem.Value } } catch { Add-Content -LiteralPath "$gevRoot/NOTIFICATIONS-errors.log" -Value $_.Exception.Message }
}
try {
  while (-not (Test-Path -LiteralPath "$gevRoot/NOTIFICATIONS-OFF")) {
    foreach ($gevFile in @('SETUP-STATUS.json','CANDIDATE-STATUS.json','ATTENTION.json','STATUS.json','RECOVERY.json')) {
      $gevPath="$gevRoot/$gevFile"
      if (-not (Test-Path -LiteralPath $gevPath)) { continue }
      try {
        $gevRaw=Get-Content -LiteralPath $gevPath -Raw
        $gevData=$gevRaw | ConvertFrom-Json
        $gevText=Get-GevNotice $gevData
        if (-not $gevText) { continue }
        $gevBytes=[System.Text.Encoding]::UTF8.GetBytes($gevRaw)
        $gevHasher=[System.Security.Cryptography.SHA256]::Create()
        try { $gevHash=[BitConverter]::ToString($gevHasher.ComputeHash($gevBytes)).Replace('-','') } finally { $gevHasher.Dispose() }
        $gevNoticeKey='notice:'+$gevText
        if (-not (Test-GevNoticeFresh $gevSeen $gevFile $gevHash $gevText)) { continue }
        $gevIcon.ShowBalloonTip(10000,'Gev local Atlias',"Okay Gev. $gevText",[System.Windows.Forms.ToolTipIcon]::Info)
        $gevReceipt=@{at=[DateTime]::UtcNow.ToString('o');file=$gevFile;sha256=$gevHash;message=$gevText;nativeApiAccepted=$true;visualDeliveryVerified=$false}
        Add-Content -LiteralPath "$gevRoot/NOTIFICATIONS.jsonl" -Value ($gevReceipt | ConvertTo-Json -Compress)
        $gevSeen[$gevFile]=$gevHash
        $gevSeen[$gevNoticeKey]=$true
        $gevSeen | ConvertTo-Json | Set-Content -LiteralPath $gevSeenFile -Encoding UTF8
      } catch { Add-Content -LiteralPath "$gevRoot/NOTIFICATIONS-errors.log" -Value $_.Exception.Message }
    }
    $gevKeepAwake=$false
    if (Test-Path -LiteralPath "$gevRoot/WORKER.lock") {
      try {
        $gevLease=Get-Content -LiteralPath "$gevRoot/WORKER.lock" -Raw | ConvertFrom-Json
        if ($gevLease.pid -gt 0) {
          $gevOwner=Get-CimInstance Win32_Process -Filter "ProcessId=$($gevLease.pid)"
          $gevKeepAwake=$gevOwner -and $gevOwner.CommandLine -and $gevOwner.CommandLine.Contains('worker.mjs') -and $gevOwner.CommandLine.Replace('\','/').Contains($gevRoot)
        }
      } catch { Add-Content -LiteralPath "$gevRoot/NOTIFICATIONS-errors.log" -Value $_.Exception.Message }
    }
    if ($gevKeepAwake) { [void][GevLocalPower]::SetThreadExecutionState([uint32]2147483649) }
    else { [void][GevLocalPower]::SetThreadExecutionState([uint32]2147483648) }
    [System.Windows.Forms.Application]::DoEvents()
    Start-Sleep -Seconds 15
  }
} finally { [void][GevLocalPower]::SetThreadExecutionState([uint32]2147483648); $gevIcon.Visible=$false; $gevIcon.Dispose(); $gevMutex.ReleaseMutex(); $gevMutex.Dispose() }
