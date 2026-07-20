$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'

if (-not (Test-Path (Join-Path $backend '.env'))) {
    throw 'backend/.env is missing. Copy backend/.env.example and configure it first.'
}

if (-not (Test-Path (Join-Path $frontend '.env'))) {
    throw 'frontend/.env is missing. Copy frontend/.env.example and configure it first.'
}

function Get-LocalListener([int] $Port) {
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
}

if (-not (Get-LocalListener 8000)) {
    Start-Process `
        -FilePath 'php' `
        -ArgumentList @(
            '-d', 'upload_max_filesize=64M',
            '-d', 'post_max_size=200M',
            '-d', 'max_file_uploads=101',
            '-d', 'max_input_time=300',
            '-d', 'max_execution_time=300',
            'artisan', 'serve', '--host=127.0.0.1', '--port=8000'
        ) `
        -WorkingDirectory $backend `
        -WindowStyle Hidden | Out-Null
}

if (-not (Get-LocalListener 5173)) {
    Start-Process `
        -FilePath 'npm.cmd' `
        -ArgumentList @('run', 'dev', '--', '--host=localhost', '--port=5173', '--strictPort') `
        -WorkingDirectory $frontend `
        -WindowStyle Hidden | Out-Null
}

$deadline = (Get-Date).AddSeconds(25)
do {
    $apiReady = try { (Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:8000/up' -TimeoutSec 2).StatusCode -eq 200 } catch { $false }
    $webReady = try { (Invoke-WebRequest -UseBasicParsing 'http://localhost:5173' -TimeoutSec 2).StatusCode -eq 200 } catch { $false }
    if ($apiReady -and $webReady) { break }
    Start-Sleep -Milliseconds 350
} while ((Get-Date) -lt $deadline)

if (-not $apiReady -or -not $webReady) {
    throw 'The local servers did not become ready within 25 seconds.'
}

Write-Host 'Plant Growth Academy is running locally:'
Write-Host '  Frontend: http://localhost:5173'
Write-Host '  Backend:  http://127.0.0.1:8000'
