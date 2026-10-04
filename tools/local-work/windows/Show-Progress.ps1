param([switch]$SelfTest)
$ErrorActionPreference='Stop'
$gevRoot='D:/harness-work/atlias-local-1003'
function Read-GevJson([string]$name) {
  $gevFile=Join-Path $gevRoot $name
  if (-not (Test-Path -LiteralPath $gevFile)) { return $null }
  try { return (Get-Content -LiteralPath $gevFile -Raw | ConvertFrom-Json) } catch { return $null }
}
function Get-GevPercent($steps,$total) {
  if ($null -eq $steps -or $null -eq $total -or $total -le 0) { return 0 }
  return [int][Math]::Max(0,[Math]::Min(100,100*$steps/$total))
}
if ($SelfTest) {
  if ((Get-GevPercent $null 5) -ne 0) { throw 'Missing state' }
  if ((Get-GevPercent 3 5) -ne 60) { throw 'Phase step arithmetic' }
  if ((Get-GevPercent 12 5) -ne 100) { throw 'Upper bound' }
  if ((Get-GevPercent -1 5) -ne 0) { throw 'Lower bound' }
  if ((Get-GevPercent 1 0) -ne 0) { throw 'Zero total' }
  if ($null -ne (Read-GevJson 'NONEXISTENT-PROGRESS-TEST.json')) { throw 'Missing file' }
  Add-Type -AssemblyName System.Windows.Forms
  $gevTestBar=New-Object System.Windows.Forms.ProgressBar
  $gevTestBar.Value=Get-GevPercent 3 5
  if ($gevTestBar.Value -ne 60) { throw 'Native progress bar' }
  $gevTestBar.Dispose()
  Write-Output 'PASS: seven progress controls; native progress bar'
  exit 0
}
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$gevForm=New-Object System.Windows.Forms.Form
$gevForm.Text='Gev local Atlias progress'
$gevForm.Size=New-Object System.Drawing.Size(760,580)
$gevForm.MinimumSize=$gevForm.Size
$gevForm.StartPosition='CenterScreen'
$gevForm.AutoScroll=$true
$gevHeading=New-Object System.Windows.Forms.Label
$gevHeading.Text='Okay Gev. Local Atlias workflow progress'
$gevHeading.Location=New-Object System.Drawing.Point(20,18)
$gevHeading.Size=New-Object System.Drawing.Size(700,28)
$gevForm.Controls.Add($gevHeading)
$gevSummary=New-Object System.Windows.Forms.Label
$gevSummary.Location=New-Object System.Drawing.Point(20,55)
$gevSummary.Size=New-Object System.Drawing.Size(700,55)
$gevForm.Controls.Add($gevSummary)
$gevPhase=New-Object System.Windows.Forms.ProgressBar
$gevPhase.Location=New-Object System.Drawing.Point(20,115)
$gevPhase.Size=New-Object System.Drawing.Size(700,24)
$gevForm.Controls.Add($gevPhase)
$gevStageLabels=@{}
$gevStageBars=@{}
$gevIndex=0
foreach ($gevStage in @('research','plan','code','review','independent-check')) {
  $gevLabel=New-Object System.Windows.Forms.Label
  $gevLabel.Location=New-Object System.Drawing.Point(20,(155+44*$gevIndex))
  $gevLabel.Size=New-Object System.Drawing.Size(270,24)
  $gevLabel.Text=$gevStage
  $gevBar=New-Object System.Windows.Forms.ProgressBar
  $gevBar.Location=New-Object System.Drawing.Point(295,(155+44*$gevIndex))
  $gevBar.Size=New-Object System.Drawing.Size(425,22)
  $gevForm.Controls.Add($gevLabel)
  $gevForm.Controls.Add($gevBar)
  $gevStageLabels[$gevStage]=$gevLabel
  $gevStageBars[$gevStage]=$gevBar
  $gevIndex++
}
$gevDetails=New-Object System.Windows.Forms.Label
$gevDetails.Location=New-Object System.Drawing.Point(20,382)
$gevDetails.Size=New-Object System.Drawing.Size(700,102)
$gevForm.Controls.Add($gevDetails)
$gevRefresh=New-Object System.Windows.Forms.Button
$gevRefresh.Text='Refresh now'
$gevRefresh.Location=New-Object System.Drawing.Point(20,494)
$gevRefresh.Size=New-Object System.Drawing.Size(130,30)
$gevForm.Controls.Add($gevRefresh)
function Update-GevProgress {
  $gevFlow=Read-GevJson 'WORKFLOW-STATUS.json'
  $gevState=Read-GevJson 'STATUS.json'
  $gevConfig=Read-GevJson 'CONFIG.json'
  $gevAttention=Read-GevJson 'ATTENTION.json'
  $gevHeld=Test-Path -LiteralPath "$gevRoot/STOP"
  $gevLease=Read-GevJson 'WORKER.lock'
  $gevLive=$false
  if ($gevLease -and $gevLease.pid -gt 0) {
    $gevOwner=Get-CimInstance Win32_Process -Filter "ProcessId=$($gevLease.pid)" -ErrorAction SilentlyContinue
    $gevLive=$gevOwner -and $gevOwner.CommandLine -and $gevOwner.CommandLine.Contains('worker.mjs') -and $gevOwner.CommandLine.Replace('\','/').Contains($gevRoot)
  }
  $gevRound=if ($gevFlow) { $gevFlow.round } elseif ($gevState) { $gevState.round } else { 'unknown' }
  $gevStage=if ($gevFlow) { $gevFlow.stage } else { 'Waiting for first workflow receipt' }
  $gevRun=if ($gevHeld) { 'STOP requested' } elseif ($gevAttention) { 'Needs attention' } elseif ($gevLive) { 'Local worker running' } else { 'No verified live worker' }
  $gevSummary.Text="$gevRun | phase $gevRound | $gevStage`r`nModel: $($gevConfig.model) | all inference local"
  $gevPhase.Value=Get-GevPercent $gevFlow.completedSteps $gevFlow.totalSteps
  foreach ($gevName in $gevStageBars.Keys) {
    $gevStep=if ($gevFlow -and $gevFlow.steps) { $gevFlow.steps.$gevName } else { $null }
    $gevBar=$gevStageBars[$gevName]
    if ($gevStep -and $gevStep.completed) { $gevBar.Style='Continuous'; $gevBar.Value=100; $gevStageLabels[$gevName].Text="$gevName : step complete" }
    elseif ($gevLive -and $gevStage -eq $gevName) { $gevBar.Style='Marquee'; $gevStageLabels[$gevName].Text="$gevName : active" }
    else { $gevBar.Style='Continuous'; $gevBar.Value=0; $gevStageLabels[$gevName].Text="$gevName : pending / incomplete" }
  }
  $gevFailure=if ($gevAttention) { $gevAttention.error; $gevAttention.reason } else { $gevState.next }
  $gevFailureText=($gevFailure -join ' ')
  if ($gevFailureText.Length -gt 220) { $gevFailureText=$gevFailureText.Substring(0,220)+'...' }
  $gevRequests=0; $gevResponses=0
  if (Test-Path -LiteralPath "$gevRoot/MODEL-CALLS.jsonl") {
    foreach ($gevRow in (Get-Content -LiteralPath "$gevRoot/MODEL-CALLS.jsonl" -Tail 2000)) {
      try { $gevCall=$gevRow | ConvertFrom-Json; if ($gevCall.event -eq 'request') { $gevRequests++ }; if ($gevCall.event -eq 'response') { $gevResponses++ } } catch {}
    }
  }
  $gevDetails.Text="Phase steps: $($gevFlow.completedSteps) / 5; model reviews are advisory.`r`nLast 2000 receipts: $gevRequests requests / $gevResponses responses. Failures: $($gevState.failures).`r`n$gevFailureText`r`n20x token/context and normal capabilities remain unproved. Saved evidence: $gevRoot/rounds"
}
$gevTimer=New-Object System.Windows.Forms.Timer
$gevTimer.Interval=5000
$gevTimer.Add_Tick({try { Update-GevProgress } catch { $gevSummary.Text='Progress read failed: '+$_.Exception.Message }})
$gevRefresh.Add_Click({try { Update-GevProgress } catch { $gevSummary.Text='Progress read failed: '+$_.Exception.Message }})
$gevForm.Add_Shown({Update-GevProgress; $gevTimer.Start()})
$gevForm.Add_FormClosed({$gevTimer.Stop(); $gevTimer.Dispose()})
[void]$gevForm.ShowDialog()
$gevForm.Dispose()
