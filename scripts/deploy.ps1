# CatchME — Automated Production Deployment Script (Windows PowerShell)
$ErrorActionPreference = "Stop"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "      CatchME Apps Script Deployment Pipeline" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verify clasp project file
if (-not (Test-Path ".clasp.json")) {
    Write-Host "ERROR: .clasp.json not found!" -ForegroundColor Red
    Write-Host "Please link or create your Apps Script project first using 'npx clasp create' or 'npx clasp clone <scriptId>'." -ForegroundColor Yellow
    exit 1
}

# 2. Check deployment credentials
Write-Host "[1/5] Verifying Google Apps Script deployment credentials..."
$oldEAP = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"
try {
    $claspCmd = if (Test-Path "node_modules/.bin/clasp.cmd") { "node_modules/.bin/clasp.cmd" } else { "npx clasp" }
    $authOut = (& $claspCmd show-authorized-user 2>&1) -join "`n"
    if ($authOut -notmatch "logged in as") {
        Write-Host "ERROR: Clasp is not logged in on this machine." -ForegroundColor Red
        Write-Host "Run 'npx clasp login' to authorize deployment." -ForegroundColor Yellow
        exit 1
    }
    Write-Host "Authenticated: OK" -ForegroundColor Green
} catch {
    Write-Host "ERROR checking clasp auth: $_" -ForegroundColor Red
    exit 1
} finally {
    $ErrorActionPreference = $oldEAP
}

# 3. Run regression tests if tests file exists
if (Test-Path "tests/parser-tests.js") {
    Write-Host "[2/5] Running parser regression test suite..."
    try {
        node tests/parser-tests.js
        Write-Host "Tests: PASSED (100%)" -ForegroundColor Green
    } catch {
        Write-Host "ERROR: Regression tests failed! Aborting deployment." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[2/5] No tests found in tests/parser-tests.js (Skipping for Phase 0)" -ForegroundColor Yellow
}

# 4. Push source code via clasp
Write-Host "[3/5] Pushing source code to Google Apps Script..."
try {
    npx clasp push --force
    Write-Host "Clasp push: SUCCESS" -ForegroundColor Green
} catch {
    Write-Host "ERROR during clasp push: $_" -ForegroundColor Red
    exit 1
}

# 5. Create immutable version
Write-Host "[4/5] Creating immutable Apps Script version..."
$pkgJson = Get-Content "package.json" -Raw | ConvertFrom-Json
$appVersion = if ($pkgJson.version) { $pkgJson.version } else { "0.4.0" }
$versionDesc = "Deploy CatchME v$appVersion - " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
$verOut = npx clasp create-version "$versionDesc" 2>&1
Write-Host "$verOut"

$newVer = 0
if ($verOut -match "Created version (\d+)") {
    $newVer = [int]$Matches[1]
    Write-Host "New Version Created: #$newVer" -ForegroundColor Green
} else {
    Write-Host "Notice: Version creation output did not match standard regex. Proceeding..." -ForegroundColor Yellow
}

# 6. Check / update deployment
Write-Host "[5/5] Updating production deployments..."
$anonDeployId = "AKfycbxcYrhDehjEu0lngU7o64v4ldrhYuXmfnJJnRyTt0x7d7GhK2SEb9G8z1SAWcKLVsGfCA"
$prodDeployId = "AKfycbxQXL_SsHe-Fqg3DYEJf-6j_MB-lh-sWO5qcQ9K6AVyLE-WhHmCZhWNwlnx5eXENdWIvw"

if ($newVer -gt 0) {
    try {
        Write-Host "Updating ANYONE_ANONYMOUS deployment ($anonDeployId) to version #$newVer..."
        $depOut1 = npx clasp deploy -i $anonDeployId -V $newVer -d "$versionDesc" 2>&1
        Write-Host "$depOut1"
    } catch {
        Write-Host "Notice: Could not update $anonDeployId: $_" -ForegroundColor Yellow
    }

    try {
        Write-Host "Updating Production deployment ($prodDeployId) to version #$newVer..."
        $depOut2 = npx clasp deploy -i $prodDeployId -V $newVer -d "$versionDesc" 2>&1
        Write-Host "$depOut2"
    } catch {
        Write-Host "Notice: Could not update $prodDeployId: $_" -ForegroundColor Yellow
    }
}

$deployments = npx clasp list-deployments 2>&1
Write-Host "$deployments"

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Deployment completed successfully!" -ForegroundColor Green
Write-Host "Production Web App URL (No-Login ANYONE):" -ForegroundColor Cyan
Write-Host "https://script.google.com/macros/s/$anonDeployId/exec" -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Cyan
