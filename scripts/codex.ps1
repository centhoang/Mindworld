# Run the user's signed-in Codex (bundled with the Codex desktop app) non-interactively in this project.
# Usage: powershell -File scripts/codex.ps1 -Prompt "<brief>" [-Sandbox read-only|workspace-write] [-Effort low|medium|high|xhigh|max] [-Out .scratch/codex-out.md]
# Model comes from ~/.codex/config.toml (user's choice). Final message is saved to -Out and printed.
param(
  [Parameter(Mandatory = $true)][string]$Prompt,
  [ValidateSet('read-only', 'workspace-write')][string]$Sandbox = 'read-only',
  [string]$Effort = 'max',
  [string]$Out = '.scratch/codex-out.md'
)
$pkg = Get-AppxPackage -Name 'OpenAI.Codex' | Select-Object -First 1
if (-not $pkg) { throw 'Codex desktop app not found' }
$exe = Join-Path $pkg.InstallLocation 'app\resources\codex.exe'
$root = Split-Path $PSScriptRoot -Parent
New-Item -ItemType Directory -Force (Join-Path $root '.scratch') | Out-Null
$outPath = Join-Path $root $Out
if (Test-Path $outPath) { Remove-Item $outPath -Force }
# Codex streams its whole transcript to the console; discard it and keep only the final message (saves our tokens).
& $exe exec -C $root -s $Sandbox -c "model_reasoning_effort=`"$Effort`"" -o $outPath $Prompt *> $null
if (Test-Path $outPath) { Get-Content $outPath -Raw -Encoding UTF8 } else { 'Codex produced no final message' }
