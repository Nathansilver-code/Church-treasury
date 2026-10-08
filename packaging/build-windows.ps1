<#
  Builds the Windows installer for Church Treasury. Run on Windows (the GitHub workflow does this for you).

  What it does, in order:
    1. builds the frontend and puts it inside the backend (so one program serves the whole app)
    2. builds the backend (treasury.jar)
    3. makes a small Java runtime with jlink, so Java does not need to be installed
    4. unpacks PostgreSQL and keeps only what the app needs, so PostgreSQL does not need to be installed
    5. starts everything once as a check (smoke test)
    6. builds the installer with electron-builder

  The result is desktop\dist-installer\Church Treasury Setup <version>.exe
#>
#Requires -Version 7.0
$ErrorActionPreference = "Stop"

# ---- settings you may need to change -------------------------------------------------------
# PostgreSQL for Windows, "binaries" zip from EDB:  https://www.enterprisedb.com/download-postgresql-binaries
# If this address stops working, download the zip yourself and save it as packaging\downloads\postgres.zip
$PgZipUrl = "https://get.enterprisedb.com/postgresql/postgresql-16.4-1-windows-x64-binaries.zip"

# Java modules the backend needs. jlink only includes these, which keeps the runtime small.
$JavaModules = "java.base,java.compiler,java.desktop,java.instrument,java.logging,java.management,java.naming," +
               "java.net.http,java.prefs,java.rmi,java.scripting,java.security.jgss,java.security.sasl,java.sql," +
               "java.transaction.xa,java.xml,jdk.crypto.ec,jdk.management,jdk.unsupported,jdk.zipfs"
# ---------------------------------------------------------------------------------------------

$Root      = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Stage     = Join-Path $PSScriptRoot "stage"
$Downloads = Join-Path $PSScriptRoot "downloads"

function Run([string]$Title, [scriptblock]$Block) {
    Write-Host ""
    Write-Host "=== $Title" -ForegroundColor Cyan
    $global:LASTEXITCODE = 0
    & $Block
    if ($LASTEXITCODE -ne 0) { throw "Step failed: $Title (exit code $LASTEXITCODE)" }
}

if (-not $env:JAVA_HOME) { throw "JAVA_HOME is not set. Install JDK 21 and set JAVA_HOME." }
Remove-Item $Stage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $Stage, $Downloads | Out-Null

# 1 ---- frontend ---------------------------------------------------------------------------
Run "Frontend: install and build" {
    Push-Location (Join-Path $Root "frontend")
    try { npm ci; if ($LASTEXITCODE -eq 0) { npm run build } } finally { Pop-Location }
}
$Static = Join-Path $Root "backend\src\main\resources\static"
Remove-Item $Static -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $Root "frontend\dist") $Static -Recurse

# 2 ---- backend ----------------------------------------------------------------------------
Run "Backend: build treasury.jar" {
    Push-Location (Join-Path $Root "backend")
    try { mvn -B -DskipTests package } finally { Pop-Location }
}
$Jar = Get-ChildItem (Join-Path $Root "backend\target") -Filter "treasury-*.jar" |
       Where-Object { $_.Name -notlike "*original*" } | Select-Object -First 1
if (-not $Jar) { throw "treasury jar not found in backend\target" }
New-Item -ItemType Directory -Force -Path (Join-Path $Stage "backend") | Out-Null
Copy-Item $Jar.FullName (Join-Path $Stage "backend\treasury.jar")

# 3 ---- Java runtime (jlink) ------------------------------------------------------------------
Run "Java runtime with jlink" {
    & (Join-Path $env:JAVA_HOME "bin\jlink.exe") --add-modules $JavaModules --strip-debug --no-header-files `
        --no-man-pages --compress=zip-6 --output (Join-Path $Stage "runtime")
}
# the Visual C++ runtime files Java and PostgreSQL need, so they work on a computer that has nothing installed
$VcFiles = "vcruntime140.dll", "vcruntime140_1.dll", "msvcp140.dll"
foreach ($f in $VcFiles) {
    $src = Join-Path $env:SystemRoot "System32\$f"
    if (Test-Path $src) { Copy-Item $src (Join-Path $Stage "runtime\bin") -Force }
}
Run "Check the Java runtime starts" { & (Join-Path $Stage "runtime\bin\java.exe") -version }

# 4 ---- PostgreSQL -------------------------------------------------------------------------
$PgZip = Join-Path $Downloads "postgres.zip"
if (-not (Test-Path $PgZip)) {
    Write-Host "Downloading PostgreSQL from $PgZipUrl"
    Invoke-WebRequest -Uri $PgZipUrl -OutFile $PgZip
}
$PgTemp = Join-Path $Downloads "pg"
Remove-Item $PgTemp -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive -Path $PgZip -DestinationPath $PgTemp -Force
$PgRoot = Join-Path $PgTemp "pgsql"
if (-not (Test-Path (Join-Path $PgRoot "bin\postgres.exe"))) { throw "postgres.exe not found: is the zip the Windows 'binaries' zip from EDB?" }
New-Item -ItemType Directory -Force -Path (Join-Path $Stage "postgres") | Out-Null
foreach ($d in "bin", "lib", "share") { Copy-Item (Join-Path $PgRoot $d) (Join-Path $Stage "postgres\$d") -Recurse }   # leaves out pgAdmin, docs, headers
foreach ($f in $VcFiles) {
    $src = Join-Path $env:SystemRoot "System32\$f"
    if (Test-Path $src) { Copy-Item $src (Join-Path $Stage "postgres\bin") -Force }
}
Run "Check PostgreSQL starts" { & (Join-Path $Stage "postgres\bin\postgres.exe") --version }

# 5 ---- smoke test: start everything once, like a first launch on a new computer ------------------
Run "Smoke test (database + application)" {
    Push-Location (Join-Path $Root "desktop")
    try { $env:TREASURY_STAGE_DIR = $Stage; node (Join-Path $PSScriptRoot "smoke-test.js") } finally { Pop-Location }
}

# 6 ---- installer -------------------------------------------------------------------------
Run "Installer with electron-builder" {
    Push-Location (Join-Path $Root "desktop")
    try { npm ci; if ($LASTEXITCODE -eq 0) { npx electron-builder --win --x64 --publish never } } finally { Pop-Location }
}

Write-Host ""
Write-Host "Done. The installer is in desktop\dist-installer" -ForegroundColor Green
Get-ChildItem (Join-Path $Root "desktop\dist-installer") -Filter *.exe | ForEach-Object { "{0}  ({1:N0} MB)" -f $_.Name, ($_.Length / 1MB) }
