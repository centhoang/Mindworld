<#
.SYNOPSIS
  Pet Mind "power mode": runs Meta Llama 3.2 locally with llama.cpp so the browser game can use it.

.DESCRIPTION
  Downloads a pinned llama.cpp Windows build and a pinned Llama 3.2 GGUF (default: the tuned Pet Mind coach 3B) (first run only,
  verified by size and SHA-256), then starts llama-server on 127.0.0.1:<Port>. The game page probes
  http://127.0.0.1:8080 and switches to the local model when it answers. Everything runs on this PC;
  nothing is sent anywhere. Stop the server with Ctrl+C. Safe to re-run.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\power-mode.ps1
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\power-mode.ps1 -Backend vulkan -Model coach1b
#>
[CmdletBinding()]
param(
  [ValidateSet('cuda', 'vulkan', 'cpu')] [string]$Backend = 'cuda',
  [ValidateSet('coach3b', 'coach1b', '3b', '1b')] [string]$Model = 'coach3b',
  [string]$InstallDir = (Join-Path $env:LOCALAPPDATA 'PetMind'),
  [switch]$SkipDownload,
  [int]$Port = 8080,
  [int]$CtxSize = 4096,
  # Optional overrides (e.g. to reuse an existing llama.cpp folder or GGUF file).
  [string]$BinDir,
  [string]$ModelPath,
  # CORS origins llama-server accepts. "*" lets the hosted game page reach it; pass the game origin to lock it down.
  [string]$AllowOrigin = '*',
  # Start the server in the background and return its process (used for testing).
  [switch]$Detach
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'  # Invoke-WebRequest is ~10x slower with the progress bar
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# ---- Pinned artifacts (llama.cpp b11934, bartowski Llama 3.2 Instruct Q4_K_M) ----
$LlamaTag = 'b11934'
$LlamaBase = "https://github.com/ggml-org/llama.cpp/releases/download/$LlamaTag"
$Builds = @{
  cuda   = @(
    @{ Name = "llama-$LlamaTag-bin-win-cuda-12.4-x64.zip"; Size = 279441688; Sha = 'aceb6b82e8982885f4b0fc57cc95e1146ce5670b93694285c1ff47895d6af96d' },
    @{ Name = 'cudart-llama-bin-win-cuda-12.4-x64.zip'; Size = 391443627; Sha = '8c79a9b226de4b3cacfd1f83d24f962d0773be79f1e7b75c6af4ded7e32ae1d6' }
  )
  vulkan = @(@{ Name = "llama-$LlamaTag-bin-win-vulkan-x64.zip"; Size = 37178570; Sha = 'd5a4af38583ddeebbe7b7f21e91765ea2a1463990a3039423f683178731a9114' })
  cpu    = @(@{ Name = "llama-$LlamaTag-bin-win-cpu-x64.zip"; Size = 24256271; Sha = 'a66878ddf32a2d9349bb66d3fb8a1d6d2a8187c249900276693ee105b66b2dc1' })
}
$Models = @{
  '3b' = @{ File = 'Llama-3.2-3B-Instruct-Q4_K_M.gguf'; Size = 2019377696; Sha = '6c1a2b41161032677be168d354123594c0e6e67d2b9227c84f296ad037c728ff'
            Url = 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf' }
  '1b' = @{ File = 'Llama-3.2-1B-Instruct-Q4_K_M.gguf'; Size = 807694464; Sha = '6f85a640a97cf2bf5b8e764087b1e83da0fdb51d7c9fab7d0fece9385611df83'
            Url = 'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf' }
  # Llama 3.2 tuned on Muse Spark Open's Teach memos and the pet's voice (docs/FINETUNE.md): the free coach.
  'coach3b' = @{ File = 'Llama-3.2-3B-PetMind-Coach-Q4_K_M.gguf'; Size = 2019373760; Sha = '53f1bb062e73fa3c844dcb044dcb9deca10c88bff05dd485d97cd2d94378c467'
            Url = 'https://huggingface.co/kysupo/Llama-3.2-3B-PetMind-Coach-GGUF/resolve/main/Llama-3.2-3B-PetMind-Coach-Q4_K_M.gguf' }
  'coach1b' = @{ File = 'Llama-3.2-1B-PetMind-Coach-Q4_K_M.gguf'; Size = 807690496; Sha = 'fa6298a9343219aa85d0defb4a8778d1f9ee98306bfbe03a2c2514b80875f3e6'
            Url = 'https://huggingface.co/kysupo/Llama-3.2-1B-PetMind-Coach-GGUF/resolve/main/Llama-3.2-1B-PetMind-Coach-Q4_K_M.gguf' }
}

function Say($msg) { Write-Host "[power-mode] $msg" }

function Test-File($path, $size, $sha) {
  if (-not (Test-Path -LiteralPath $path)) { return $false }
  if ((Get-Item -LiteralPath $path).Length -ne $size) { return $false }
  return ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLower() -eq $sha)
}

function Get-Verified($url, $dest, $size, $sha) {
  if (Test-File $dest $size $sha) { Say "ok (cached): $(Split-Path $dest -Leaf)"; return }
  $mb = [math]::Round($size / 1MB)
  Say "downloading $(Split-Path $dest -Leaf) ($mb MB) ..."
  $tmp = "$dest.part"
  Invoke-WebRequest -Uri $url -OutFile $tmp -UseBasicParsing
  if (-not (Test-File $tmp $size $sha)) {
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    throw "Checksum mismatch for $(Split-Path $dest -Leaf). Download aborted; re-run to retry."
  }
  Move-Item -LiteralPath $tmp -Destination $dest -Force
  Say "verified: $(Split-Path $dest -Leaf)"
}

# ---- Resolve paths ----
$InstallDir = [IO.Path]::GetFullPath($InstallDir)
if (-not $BinDir) { $BinDir = Join-Path $InstallDir "llama.cpp-$LlamaTag-$Backend" }
$BinDir = [IO.Path]::GetFullPath($BinDir)
$m = $Models[$Model]
if (-not $ModelPath) { $ModelPath = Join-Path $InstallDir "models\$($m.File)" }
$ModelPath = [IO.Path]::GetFullPath($ModelPath)
$ServerExe = Join-Path $BinDir 'llama-server.exe'

# ---- Download + install (idempotent) ----
if (-not $SkipDownload) {
  $dl = Join-Path $InstallDir 'downloads'
  New-Item -ItemType Directory -Force -Path $dl, $BinDir, (Split-Path $ModelPath) | Out-Null
  $marker = Join-Path $BinDir '.installed'
  if (-not ((Test-Path $ServerExe) -and (Test-Path $marker))) {
    foreach ($z in $Builds[$Backend]) {
      $zip = Join-Path $dl $z.Name
      Get-Verified "$LlamaBase/$($z.Name)" $zip $z.Size $z.Sha
      Say "extracting $($z.Name) ..."
      Expand-Archive -LiteralPath $zip -DestinationPath $BinDir -Force
    }
    Set-Content -LiteralPath $marker -Value $LlamaTag -Encoding ascii
  } else { Say "ok (installed): llama.cpp $LlamaTag ($Backend)" }
  Get-Verified $m.Url $ModelPath $m.Size $m.Sha
}

if (-not (Test-Path $ServerExe)) { throw "llama-server.exe not found in $BinDir. Run without -SkipDownload, or pass -BinDir." }
if (-not (Test-Path $ModelPath)) { throw "Model not found: $ModelPath. Run without -SkipDownload, or pass -ModelPath." }

# ---- Already running? ----
$healthUrl = "http://127.0.0.1:$Port/health"
try {
  $r = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 2
  if ($r.StatusCode -eq 200) { Say "a server already answers on port $Port. Nothing to do; open the game."; return }
} catch { }
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
  throw "Port $Port is in use by another program. Close it or pass -Port (the game expects 8080)."
}

# ---- Start llama-server ----
$ngl = if ($Backend -eq 'cpu') { 0 } else { 99 }
$srvArgs = @('-m', "`"$ModelPath`"", '--host', '127.0.0.1', '--port', $Port, '-c', $CtxSize, '-ngl', $ngl,
          '-np', 1, '-a', "llama-3.2-$Model", '--cors-origins', $AllowOrigin, '--no-cors-credentials')
if ($Backend -eq 'cuda') { Say 'needs an NVIDIA GPU with ~3 GB free VRAM (3b) or ~1 GB (1b). Use -Backend vulkan or cpu otherwise.' }
Say "starting llama-server on http://127.0.0.1:$Port (model: $(Split-Path $ModelPath -Leaf), backend: $Backend)"

if ($Detach) {
  $p = Start-Process -FilePath $ServerExe -ArgumentList $srvArgs -WorkingDirectory $BinDir -PassThru -WindowStyle Hidden
  for ($i = 0; $i -lt 120; $i++) {
    Start-Sleep -Milliseconds 500
    if ($p.HasExited) { throw "llama-server exited (code $($p.ExitCode)). Try -Backend vulkan or -Backend cpu." }
    try { if ((Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200) { Say "ready (pid $($p.Id))."; return $p } } catch { }
  }
  Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
  throw 'llama-server did not become healthy within 60 s.'
}

Say 'ready when you see "listening on". Keep this window open, then open the game. Ctrl+C stops it.'
Push-Location $BinDir
try { & $ServerExe @($srvArgs | ForEach-Object { $_ -replace '^"|"$', '' }) } finally { Pop-Location }
