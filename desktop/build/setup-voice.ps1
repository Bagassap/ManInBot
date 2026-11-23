# Memasang pendengar suara MiB (Whisper + satu model) untuk pengguna ini, tanpa hak administrator.
# Hanya karakter ASCII: PowerShell 5.1 membaca berkas tanpa BOM sebagai ANSI.
#   -Model : base (PC ringan) | small (lebih akurat)
#   -Json  : kemajuan sebagai JSON per baris (dibaca aplikasi)
param(
  [ValidateSet('base', 'small')][string]$Model = 'base',
  [switch]$Json
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Build = 'b5454'
$ZipUrl = "https://github.com/ggml-org/whisper.cpp/releases/download/$Build/whisper-bin-x64.zip"
$ZipSha = '6ba69e3482d7826214f90a6a9c84ca07782aec1e1d0c6a7c30c994fd5d816ccb'
$ZipBytes = 8928640
$Files = @{
  base = @{ name = 'ggml-base-q5_1.bin'; bytes = 59707625; sha = '422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898' }
  small = @{ name = 'ggml-small-q5_1.bin'; bytes = 190085487; sha = 'ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb' }
}
$Root = Join-Path $env:LOCALAPPDATA 'MiB\voice'
$Bin = Join-Path $Root 'whisper'

function Say($phase, $pct, $msg) {
  if ($Json) {
    [Console]::Out.WriteLine((@{ phase = $phase; pct = $pct; msg = $msg } | ConvertTo-Json -Compress))
    [Console]::Out.Flush()
  } else { Write-Host "$msg $pct" }
}

function Get-Verified($url, $dest, $bytes, $sha, $label) {
  if ((Test-Path $dest) -and (Get-Item $dest).Length -eq $bytes -and (Get-FileHash $dest -Algorithm SHA256).Hash.ToLower() -eq $sha) { return }
  if ((Test-Path $dest) -and (Get-Item $dest).Length -ge $bytes) { Remove-Item $dest -Force }
  $p = Start-Process -FilePath 'curl.exe' -ArgumentList @('-L', '--fail', '-s', '-C', '-', '--retry', '5', '--retry-delay', '3', '-o', "`"$dest`"", $url) -WindowStyle Hidden -PassThru
  $null = $p.Handle
  while (-not $p.HasExited) {
    Start-Sleep -Milliseconds 700
    if (Test-Path $dest) { Say 'download' ([math]::Floor((Get-Item $dest).Length * 100 / $bytes)) "Mengunduh $label" }
  }
  if ($p.ExitCode -ne 0) { throw "Unduhan $label gagal (kode $($p.ExitCode)). Periksa koneksi internet lalu coba lagi." }
  if ((Get-FileHash $dest -Algorithm SHA256).Hash.ToLower() -ne $sha) {
    Remove-Item $dest -Force
    throw "Berkas $label rusak (SHA-256 tidak cocok). Coba lagi."
  }
}

try {
  New-Item -ItemType Directory -Force -Path $Root | Out-Null
  $stamp = Join-Path $Bin '.mib-version'
  if (-not ((Test-Path (Join-Path $Bin 'whisper-cli.exe')) -and (Test-Path $stamp) -and ((Get-Content $stamp -Raw).Trim() -eq $Build))) {
    $zip = Join-Path $Root 'whisper.zip'
    Get-Verified $ZipUrl $zip $ZipBytes $ZipSha 'mesin suara'
    Say 'extract' $null 'Memasang mesin suara...'
    $tmp = Join-Path $Root 'whisper-tmp'
    if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $tmp | Out-Null
    & "$env:SystemRoot\System32\tar.exe" -xf $zip -C $tmp
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path (Join-Path $tmp 'Release\whisper-cli.exe'))) { throw 'Gagal membongkar mesin suara.' }
    # Hanya program pendengar dan pustakanya yang disimpan.
    Get-ChildItem (Join-Path $tmp 'Release') -Filter *.exe | Where-Object { $_.Name -ne 'whisper-cli.exe' } | Remove-Item -Force
    if (Test-Path $Bin) { Remove-Item $Bin -Recurse -Force }
    Move-Item (Join-Path $tmp 'Release') $Bin
    Remove-Item $tmp -Recurse -Force
    [IO.File]::WriteAllText($stamp, $Build)
    Remove-Item $zip -Force
  }
  $f = $Files[$Model]
  $dest = Join-Path $Root $f.name
  Get-Verified "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/$($f.name)" $dest $f.bytes $f.sha 'model suara'
  [IO.File]::WriteAllText((Join-Path $Root 'voice.json'), (@{ model = $f.name; build = $Build } | ConvertTo-Json -Compress))
  Say 'done' 100 'Suara MiB siap.'
  exit 0
} catch {
  Say 'error' $null "$($_.Exception.Message)"
  exit 1
}
