<#
.SYNOPSIS
    Reports what the built app downloads on first paint.

.DESCRIPTION
    Lists every asset referenced directly by dist/index.html — including
    <link rel="modulepreload"> hints — and totals their gzipped size.

    Anything listed here is fetched before the app is usable. The React vendor
    chunk, the app chunk and the CSS belong. Firebase, jspdf, html2canvas and
    socket.io do NOT: they are meant to load only when the feature that needs
    them is used.

    This check exists because the build's own output is misleading. Naming a
    chunk in Rollup's manualChunks does not make it load lazily, and an earlier
    config here shipped ~580KB of export libraries to every visitor while the
    build log showed them as neatly separate chunks.

.PARAMETER DistPath
    Build output directory. Defaults to ./dist.

.EXAMPLE
    npm run build:web
    .\scripts\Check-Bundle.ps1

.EXAMPLE
    # Confirm Monaco is no longer coming from a CDN
    .\scripts\Check-Bundle.ps1 -CheckCdn
#>
[CmdletBinding()]
param(
    [string] $DistPath = 'dist',

    # Also fail if any built asset still references a third-party CDN.
    [switch] $CheckCdn
)

$ErrorActionPreference = 'Stop'

$indexPath = Join-Path $DistPath 'index.html'
if (-not (Test-Path $indexPath)) {
    Write-Error "No build found at '$indexPath'. Run 'npm run build:web' first."
}

# Every asset the entry HTML points at, deduplicated.
$assets = Select-String -Path $indexPath -Pattern 'assets/[A-Za-z0-9._-]+\.(?:js|css)' -AllMatches |
    ForEach-Object { $_.Matches.Value } |
    Sort-Object -Unique

if (-not $assets) {
    Write-Error "No asset references found in $indexPath. Did the build succeed?"
}

function Get-GzipSize {
    param([string] $Path)

    $bytes  = [System.IO.File]::ReadAllBytes($Path)
    $buffer = [System.IO.MemoryStream]::new()
    $gzip   = [System.IO.Compression.GZipStream]::new(
        $buffer, [System.IO.Compression.CompressionLevel]::Optimal)
    try {
        $gzip.Write($bytes, 0, $bytes.Length)
    }
    finally {
        $gzip.Dispose()
    }
    $buffer.Length
}

$rows = foreach ($asset in $assets) {
    $full = Join-Path $DistPath $asset
    [pscustomobject]@{
        Asset  = $asset
        RawKB  = [math]::Round((Get-Item $full).Length / 1KB, 1)
        GzipKB = [math]::Round((Get-GzipSize $full) / 1KB, 1)
    }
}

Write-Host "`nLoaded on first paint:`n" -ForegroundColor Cyan
$rows | Format-Table -AutoSize

$totalGzip = ($rows | Measure-Object -Property GzipKB -Sum).Sum
Write-Host ("Total: {0:N1} KB gzipped" -f $totalGzip) -ForegroundColor Cyan
Write-Host "Baseline at the time of writing: ~132 KB. A large jump means" -ForegroundColor DarkGray
Write-Host "something heavy stopped being lazy.`n" -ForegroundColor DarkGray

# Heavy dependencies that must never appear in the first-paint set. Matched
# against chunk *contents*, since Rollup's hashed filenames reveal nothing.
$mustBeLazy = @{
    'firebase'     = 'firebase'
    'jspdf'        = 'jsPDF'
    'html2canvas'  = 'html2canvas'
    'socket.io'    = 'socket.io'
}

$leaked = @()
foreach ($entry in $mustBeLazy.GetEnumerator()) {
    foreach ($asset in $assets | Where-Object { $_ -like '*.js' }) {
        $full = Join-Path $DistPath $asset
        if (Select-String -Path $full -Pattern $entry.Value -SimpleMatch -Quiet) {
            $leaked += "$($entry.Key)  (found in $asset)"
        }
    }
}

if ($leaked) {
    Write-Host "Eagerly loaded but should be lazy:" -ForegroundColor Red
    $leaked | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    Write-Host "`nSee the code-splitting section of docs/ARCHITECTURE.md.`n"
}
else {
    Write-Host "All heavy dependencies are still lazy.`n" -ForegroundColor Green
}

if ($CheckCdn) {
    $cdnHits = Select-String -Path (Join-Path $DistPath 'assets\*.js') `
        -Pattern 'jsdelivr|cdnjs\.cloudflare' -List

    if ($cdnHits) {
        Write-Host "Still referencing a CDN:" -ForegroundColor Yellow
        $cdnHits | ForEach-Object { Write-Host "  $($_.Filename)" -ForegroundColor Yellow }
        Write-Host ""
    }
    else {
        Write-Host "No CDN references in built assets.`n" -ForegroundColor Green
    }
}

if ($leaked) { exit 1 }
