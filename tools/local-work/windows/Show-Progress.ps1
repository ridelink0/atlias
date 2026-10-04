param([switch]$SelfTest)
$ErrorActionPreference='Stop'
$gevLauncher='D:/harness-work/atlias-local-1003/Start-Dashboard.ps1'
if ($SelfTest) { & $gevLauncher -SelfTest } else { & $gevLauncher }
