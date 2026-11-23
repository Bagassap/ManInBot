# Memasang "otak" MiB (Ollama + satu model) untuk pengguna ini, tanpa hak administrator.
# Dipakai oleh pemasang MiB dan oleh tombol "Pasang" di aplikasi. Hanya karakter ASCII: PowerShell 5.1 membaca berkas tanpa BOM sebagai ANSI.
#   -Detect  : cetak "tier|keterangan PC" lalu selesai
#   -Tier    : auto | ringan | sedang | kuat
#   -Json    : kemajuan sebagai JSON per baris (dibaca aplikasi)
param(
  [ValidateSet('auto', 'ringan', 'sedang', 'kuat')][string]$Tier = 'auto',
  [switch]$Detect,
  [switch]$Json
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Version = 'v0.40.17'
$ZipSha = '3dd80f6e3a9699f2eadf4ac418f00529cee594df9557541806eda1f1f3f5588a'
$ZipBytes = 1618522644
$ZipUrl = "https://github.com/ollama/ollama/releases/download/$Version/ollama-windows-amd64.zip"
$Models = @{ ringan = 'qwen3:1.7b'; sedang = 'qwen3:4b'; kuat = 'qwen3:8b' }
$ModelGb = @{ ringan = 1.4; sedang = 2.5; kuat = 5.2 }
$Root = Join-Path $env:LOCALAPPDATA 'MiB'
$Bin = Join-Path $Root 'ollama'
$Exe = Join-Path $Bin 'ollama.exe'
$ModelDir = Join-Path $Root 'models'
$Base = 'http://127.0.0.1:11435'

function Get-Spec {
  $cpu = (Get-ItemProperty 'HKLM:\HARDWARE\DESCRIPTION\System\CentralProcessor\0').ProcessorNameString.Trim()
  $ram = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
  $threads = [Environment]::ProcessorCount
  if ($cpu -match '(?i)\bi[79]-|ryzen\s*(ai\s*)?[79]\b|core\s*(ultra\s*)?[79]\b|threadripper|xeon') { $rank = 2 }
  elseif ($cpu -match '(?i)\bi5-|ryzen\s*(ai\s*)?5\b|core\s*(ultra\s*)?5\b') { $rank = 1 }
  elseif ($cpu -match '(?i)\bi3-|ryzen\s*3\b|core\s*3\b|celeron|pentium|athlon') { $rank = 0 }
  elseif ($threads -ge 12) { $rank = 2 }
  elseif ($threads -ge 6) { $rank = 1 }
  else { $rank = 0 }
  # RAM membatasi: model tidak boleh membuat Excel/Word ikut macet.
  if ($ram -lt 7.5) { $rank = 0 } elseif ($ram -lt 15) { $rank = [math]::Min($rank, 1) }
  return @{ tier = @('ringan', 'sedang', 'kuat')[$rank]; cpu = $cpu; ram = $ram }
}

if ($Detect) {
  $s = Get-Spec
  [Console]::Write("$($s.tier)|$($s.cpu), RAM $([math]::Round($s.ram)) GB")
  exit 0
}

function Say($phase, $pct, $msg) {
  if ($Json) {
    [Console]::Out.WriteLine((@{ phase = $phase; pct = $pct; msg = $msg } | ConvertTo-Json -Compress))
    [Console]::Out.Flush()
  } elseif ($null -ne $pct) {
    Write-Host -NoNewline "`r$msg  $pct%      "
  } else {
    Write-Host "`n$msg"
  }
}

function Test-Server {
  try { $null = Invoke-RestMethod -Uri "$Base/api/version" -TimeoutSec 2; return $true } catch { return $false }
}

function Install-Runtime {
  $stamp = Join-Path $Bin '.mib-version'
  if ((Test-Path $Exe) -and (Test-Path $stamp) -and ((Get-Content $stamp -Raw).Trim() -eq $Version)) { return }
  New-Item -ItemType Directory -Force -Path $Root | Out-Null
  $zip = Join-Path $Root 'ollama.zip'
  $have = if (Test-Path $zip) { (Get-Item $zip).Length } else { 0 }
  if ($have -ne $ZipBytes) {
    Say 'runtime' $null 'Mengunduh mesin AI (sekitar 1,6 GB)...'
    # curl bawaan Windows: unduhan yang terputus dilanjutkan, bukan diulang.
    $p = Start-Process -FilePath 'curl.exe' -ArgumentList @('-L', '--fail', '-s', '-C', '-', '--retry', '5', '--retry-delay', '3', '-o', "`"$zip`"", $ZipUrl) -WindowStyle Hidden -PassThru
    $null = $p.Handle
    while (-not $p.HasExited) {
      Start-Sleep -Seconds 1
      if (Test-Path $zip) { Say 'runtime' ([math]::Floor((Get-Item $zip).Length * 100 / $ZipBytes)) 'Mengunduh mesin AI' }
    }
    if ($p.ExitCode -ne 0) { throw "Unduhan mesin AI gagal (kode $($p.ExitCode)). Periksa koneksi internet lalu coba lagi." }
  }
  Say 'verify' $null 'Memeriksa keaslian berkas...'
  if ((Get-FileHash $zip -Algorithm SHA256).Hash.ToLower() -ne $ZipSha) {
    Remove-Item $zip -Force
    throw 'Berkas mesin AI rusak (SHA-256 tidak cocok). Coba lagi.'
  }
  Say 'extract' $null 'Memasang mesin AI...'
  if (Test-Path $Bin) { Remove-Item $Bin -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $Bin | Out-Null
  & "$env:SystemRoot\System32\tar.exe" -xf $zip -C $Bin
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $Exe)) { throw 'Gagal membongkar mesin AI.' }
  [IO.File]::WriteAllText($stamp, $Version)
  Remove-Item $zip -Force
}

function Start-Server {
  if (Test-Server) { return $null }
  New-Item -ItemType Directory -Force -Path $ModelDir | Out-Null
  $env:OLLAMA_HOST = '127.0.0.1:11435'
  $env:OLLAMA_MODELS = $ModelDir
  $p = Start-Process -FilePath $Exe -ArgumentList 'serve' -WindowStyle Hidden -PassThru
  for ($i = 0; $i -lt 60; $i++) {
    if (Test-Server) { return $p }
    Start-Sleep -Milliseconds 500
  }
  throw 'Mesin AI tidak mau menyala.'
}

function Get-Model($name) {
  Say 'model' $null "Mengunduh model $name..."
  $req = [Net.HttpWebRequest]::Create("$Base/api/pull")
  $req.Method = 'POST'
  $req.ContentType = 'application/json'
  $req.Timeout = [Threading.Timeout]::Infinite
  $req.ReadWriteTimeout = 600000
  $body = [Text.Encoding]::UTF8.GetBytes((@{ model = $name; stream = $true } | ConvertTo-Json -Compress))
  $s = $req.GetRequestStream(); $s.Write($body, 0, $body.Length); $s.Close()
  $res = $req.GetResponse()
  $reader = New-Object IO.StreamReader($res.GetResponseStream())
  $done = $false
  $last = -1
  while ($null -ne ($line = $reader.ReadLine())) {
    $o = $line | ConvertFrom-Json
    if ($o.error) { throw "Unduhan model gagal: $($o.error)" }
    if ($o.status -eq 'success') { $done = $true }
    if ($o.total -and $o.completed) {
      $pct = [math]::Floor($o.completed * 100 / $o.total)
      if ($pct -ne $last) { Say 'model' $pct "Mengunduh model $name"; $last = $pct }
    }
  }
  $reader.Close()
  if (-not $done) { throw 'Unduhan model terputus. Coba lagi.' }
}

$server = $null
try {
  $spec = Get-Spec
  if ($Tier -eq 'auto') { $Tier = $spec.tier }
  $model = $Models[$Tier]
  $need = $ModelGb[$Tier] + 6
  $free = (Get-PSDrive -Name ($env:LOCALAPPDATA.Substring(0, 1))).Free / 1GB
  if ((-not (Test-Path $Exe)) -and $free -lt $need) { throw "Ruang disk kurang: butuh sekitar $need GB, tersedia $([math]::Round($free, 1)) GB." }
  Install-Runtime
  $server = Start-Server
  Get-Model $model
  [IO.File]::WriteAllText((Join-Path $Root 'brain.json'), (@{ tier = $Tier; model = $model; version = $Version } | ConvertTo-Json -Compress))
  Say 'done' 100 "Otak MiB siap ($model)."
  exit 0
} catch {
  Say 'error' $null "$($_.Exception.Message)"
  exit 1
} finally {
  if ($server -and -not $server.HasExited) { Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue }
}
