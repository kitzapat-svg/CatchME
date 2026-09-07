# CatchME — Developer Machine Setup Script (Windows PowerShell)
$ErrorActionPreference = "Stop"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   CatchME Development Environment Setup" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check Git
Write-Host -NoNewline "[1/5] Checking Git... "
try {
    $gitVer = git --version
    Write-Host "OK ($gitVer)" -ForegroundColor Green
} catch {
    Write-Host "FAILED. Please install Git for Windows." -ForegroundColor Red
    exit 1
}

# 2. Check Node & npm
Write-Host -NoNewline "[2/5] Checking Node.js & npm... "
try {
    $nodeVer = node -v
    $npmVer = npm -v
    Write-Host "OK (Node: $nodeVer, npm: $npmVer)" -ForegroundColor Green
} catch {
    Write-Host "FAILED. Please install Node.js." -ForegroundColor Red
    exit 1
}

# 3. Check Dependencies
Write-Host "[3/5] Installing / verifying npm dependencies..."
try {
    npm ci
    Write-Host "Dependencies: OK" -ForegroundColor Green
} catch {
    Write-Host "npm ci failed, attempting npm install..." -ForegroundColor Yellow
    npm install
}

# 4. Verify Project Files
Write-Host -NoNewline "[4/5] Verifying required project structure... "
$requiredFiles = @(
    "package.json",
    "appsscript.json",
    ".gitignore",
    ".claspignore",
    "src/Code.gs",
    "src/Database.gs",
    "src/Index.html",
    "src/Styles.html",
    "src/App.html",
    "src/Scripts.html"
)

$missing = @()
foreach ($f in $requiredFiles) {
    if (-not (Test-Path $f)) {
        $missing += $f
    }
}

if ($missing.Count -eq 0) {
    Write-Host "OK (All core files present)" -ForegroundColor Green
} else {
    Write-Host "WARNING: Missing files: $($missing -join ', ')" -ForegroundColor Yellow
}

# 5. Check Deployment Auth Status
Write-Host "[5/5] Checking clasp deployment authorization..."
$oldEAP = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"
try {
    $claspCmd = if (Test-Path "node_modules/.bin/clasp.cmd") { "node_modules/.bin/clasp.cmd" } else { "npx clasp" }
    $authInfo = (& $claspCmd show-authorized-user 2>&1) -join "`n"
    if ($authInfo -match "logged in as ([^\r\n]+)") {
        Write-Host "Deployment Auth: CONFIGURED ($($Matches[1]))" -ForegroundColor Green
    } else {
        Write-Host "Deployment Auth: NOT CONFIGURED (Optional for code development)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Deployment Auth: NOT CONFIGURED (Optional for code development)" -ForegroundColor Yellow
} finally {
    $ErrorActionPreference = $oldEAP
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "CatchME development environment is ready!" -ForegroundColor Green
Write-Host "You can develop, test, and commit to Git normally." -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
