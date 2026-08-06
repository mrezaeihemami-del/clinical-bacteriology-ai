[CmdletBinding()]
param(
    [Parameter()]
    [AllowEmptyString()]
    [string]$ProjectRoot = "",

    [Parameter()]
    [int]$PreferredPort = 8080,

    [Parameter()]
    [switch]$NoBrowser,

    [Parameter()]
    [switch]$ResetData
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$script:LogPath = $null
$script:ComposePrefix = @("compose", "--env-file", ".env")

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Utf8NoBom {
    param(
        [string]$Path,
        [string]$Content
    )

    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Invoke-Docker {
    param(
        [string[]]$Arguments,
        [switch]$AllowFailure
    )

    Write-Host "> docker $($Arguments -join ' ')" -ForegroundColor DarkGray

    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"

        & docker @Arguments 2>&1 | ForEach-Object {
            $line = $_.ToString()
            Write-Host $line
            if ($script:LogPath) {
                Add-Content -LiteralPath $script:LogPath -Value $line
            }
        }

        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }

    if (-not $AllowFailure -and $exitCode -ne 0) {
        throw "Docker command failed with exit code ${exitCode}: docker $($Arguments -join ' ')"
    }

    return $exitCode
}

function Get-DockerOutput {
    param(
        [string[]]$Arguments,
        [switch]$AllowFailure
    )

    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        $output = & docker @Arguments 2>&1
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }

    if (-not $AllowFailure -and $exitCode -ne 0) {
        throw "Docker command failed with exit code ${exitCode}: docker $($Arguments -join ' ')"
    }

    return @($output | ForEach-Object { $_.ToString() })
}

function Invoke-Compose {
    param(
        [string[]]$Arguments,
        [switch]$AllowFailure
    )

    return Invoke-Docker `
        -Arguments ($script:ComposePrefix + $Arguments) `
        -AllowFailure:$AllowFailure
}

function Get-ComposeOutput {
    param(
        [string[]]$Arguments,
        [switch]$AllowFailure
    )

    return Get-DockerOutput `
        -Arguments ($script:ComposePrefix + $Arguments) `
        -AllowFailure:$AllowFailure
}

function Assert-Docker {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw "Docker CLI was not found. Install or start Docker Desktop."
    }

    $null = Invoke-Docker -Arguments @("version")
    $null = Invoke-Docker -Arguments @("compose", "version")
}

function New-Base64Secret {
    param([int]$ByteCount)

    $bytes = New-Object byte[] $ByteCount
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $rng.GetBytes($bytes)
    }
    finally {
        $rng.Dispose()
    }

    return [Convert]::ToBase64String($bytes)
}

function Read-EnvValue {
    param(
        [string]$Path,
        [string]$Name
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return $null
    }

    foreach ($line in [System.IO.File]::ReadAllLines($Path)) {
        if ($line -match "^\s*$([Regex]::Escape($Name))=(.*)$") {
            return $Matches[1]
        }
    }

    return $null
}

function Set-EnvValue {
    param(
        [string]$Path,
        [string]$Name,
        [string]$Value
    )

    $lines = if (Test-Path -LiteralPath $Path) {
        [System.Collections.Generic.List[string]]::new(
            [System.IO.File]::ReadAllLines($Path)
        )
    }
    else {
        [System.Collections.Generic.List[string]]::new()
    }

    $found = $false

    for ($index = 0; $index -lt $lines.Count; $index++) {
        if ($lines[$index] -match "^\s*$([Regex]::Escape($Name))=") {
            $lines[$index] = "$Name=$Value"
            $found = $true
            break
        }
    }

    if (-not $found) {
        $lines.Add("$Name=$Value")
    }

    Write-Utf8NoBom -Path $Path -Content (($lines -join "`r`n") + "`r`n")
}

function Ensure-LocalEnv {
    param(
        [string]$Path,
        [int]$Port
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        $parent = Split-Path -Parent $ProjectRoot
        $legacyEnv = Join-Path $parent "clinical-bacteriology-ai-assistant-docker-only-fixed-v4\.env"

        if (Test-Path -LiteralPath $legacyEnv) {
            Copy-Item -LiteralPath $legacyEnv -Destination $Path -Force
            Write-Host "Imported the existing v4 .env file." -ForegroundColor Green
        }
    }

    $masterKey = Read-EnvValue -Path $Path -Name "AI_CONFIG_MASTER_KEY"
    if ([string]::IsNullOrWhiteSpace($masterKey)) {
        $masterKey = New-Base64Secret -ByteCount 32
    }

    $postgresPassword = Read-EnvValue -Path $Path -Name "POSTGRES_PASSWORD"
    if ([string]::IsNullOrWhiteSpace($postgresPassword)) {
        $postgresPassword = "cbai_" + (New-Base64Secret -ByteCount 18).Replace("/", "_").Replace("+", "-").TrimEnd("=")
    }

    $minioPassword = Read-EnvValue -Path $Path -Name "MINIO_ROOT_PASSWORD"
    if ([string]::IsNullOrWhiteSpace($minioPassword)) {
        $minioPassword = "cbai_" + (New-Base64Secret -ByteCount 18).Replace("/", "_").Replace("+", "-").TrimEnd("=")
    }

    $geminiKey = Read-EnvValue -Path $Path -Name "GOOGLE_GEMINI_API_KEY"
    if ($null -eq $geminiKey) {
        $geminiKey = ""
    }

    $geminiModel = Read-EnvValue -Path $Path -Name "GOOGLE_GEMINI_MODEL"
    if ([string]::IsNullOrWhiteSpace($geminiModel)) {
        $geminiModel = "gemini-3.6-flash"
    }

    $content = @"
APP_PORT=$Port

POSTGRES_PASSWORD=$postgresPassword
MINIO_ROOT_USER=cbai_minio
MINIO_ROOT_PASSWORD=$minioPassword
S3_BUCKET=cbai-private

AI_CONFIG_MASTER_KEY=$masterKey

GOOGLE_GEMINI_API_KEY=$geminiKey
GOOGLE_GEMINI_MODEL=$geminiModel

SEED_DEMO_DATA=true
"@

    Write-Utf8NoBom -Path $Path -Content $content
}

function Test-PortAvailable {
    param([int]$Port)

    $listener = $null
    try {
        $listener = [System.Net.Sockets.TcpListener]::new(
            [System.Net.IPAddress]::Loopback,
            $Port
        )
        $listener.Start()
        return $true
    }
    catch {
        return $false
    }
    finally {
        if ($listener) {
            try { $listener.Stop() } catch {}
        }
    }
}

function Get-FreePort {
    param([int]$StartPort)

    for ($port = $StartPort; $port -le [Math]::Min(65535, $StartPort + 200); $port++) {
        if (Test-PortAvailable -Port $port) {
            return $port
        }
    }

    throw "No free local port was found."
}

function Save-Diagnostics {
    Write-Step "Container diagnostics"
    $null = Invoke-Compose -Arguments @("ps", "-a") -AllowFailure
    $null = Invoke-Compose -Arguments @(
        "logs",
        "--no-color",
        "--timestamps",
        "--tail=350",
        "app",
        "postgres",
        "minio",
        "create-bucket"
    ) -AllowFailure
}

try {
    if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
        if (-not [string]::IsNullOrWhiteSpace($PSScriptRoot)) {
            $ProjectRoot = $PSScriptRoot
        }
        elseif ($MyInvocation.MyCommand.Path) {
            $ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
        }
        else {
            $ProjectRoot = (Get-Location).Path
        }
    }

    if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) {
        throw "Project folder not found: $ProjectRoot"
    }

    $ProjectRoot = (Get-Item -LiteralPath $ProjectRoot).FullName
    Set-Location -LiteralPath $ProjectRoot

    if (-not (Test-Path -LiteralPath "docker-compose.yml")) {
        throw "docker-compose.yml was not found."
    }

    New-Item -ItemType Directory -Path "logs" -Force | Out-Null
    $script:LogPath = Join-Path $ProjectRoot ("logs\startup-v5-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".log")
    "CBAI v5 startup - $(Get-Date -Format o)" | Set-Content -LiteralPath $script:LogPath -Encoding UTF8

    Write-Host ""
    Write-Host "Clinical Bacteriology AI Assistant - fixed v5" -ForegroundColor Green
    Write-Host "Project: $ProjectRoot"
    Write-Host "Log: $script:LogPath"

    Write-Step "Checking Docker Desktop"
    Assert-Docker

    $envPath = Join-Path $ProjectRoot ".env"
    Ensure-LocalEnv -Path $envPath -Port $PreferredPort

    Write-Step "Stopping the previous CBAI containers"
    if ($ResetData) {
        $null = Invoke-Compose -Arguments @("down", "--volumes", "--remove-orphans") -AllowFailure
    }
    else {
        $null = Invoke-Compose -Arguments @("down", "--remove-orphans") -AllowFailure
    }

    $savedPort = Read-EnvValue -Path $envPath -Name "APP_PORT"
    $selectedPort = $PreferredPort

    if ($savedPort -match "^\d+$") {
        $selectedPort = [int]$savedPort
    }

    if (-not (Test-PortAvailable -Port $selectedPort)) {
        $selectedPort = Get-FreePort -StartPort $PreferredPort
        Set-EnvValue -Path $envPath -Name "APP_PORT" -Value ([string]$selectedPort)
    }

    Write-Host "Application port: $selectedPort" -ForegroundColor White

    Write-Step "Validating Docker Compose configuration"
    $null = Invoke-Compose -Arguments @("config", "--quiet")

    Write-Step "Building the corrected application"
    $null = Invoke-Compose -Arguments @("--progress", "plain", "build", "app")

    Write-Step "Starting services"
    $null = Invoke-Compose -Arguments @("up", "-d", "--remove-orphans")

    $appUrl = "http://localhost:$selectedPort"
    $readyUrl = "$appUrl/api/health/ready"

    Write-Step "Waiting for application readiness"
    Write-Host $readyUrl -ForegroundColor DarkGray

    $ready = $false

    for ($attempt = 1; $attempt -le 90; $attempt++) {
        try {
            $response = Invoke-WebRequest `
                -Uri $readyUrl `
                -UseBasicParsing `
                -TimeoutSec 4

            if ($response.StatusCode -eq 200) {
                $ready = $true
                break
            }
        }
        catch {
        }

        $containerIds = Get-ComposeOutput -Arguments @("ps", "-q", "app") -AllowFailure
        $containerId = $containerIds | Select-Object -First 1

        if (-not [string]::IsNullOrWhiteSpace($containerId)) {
            $stateLines = Get-DockerOutput `
                -Arguments @(
                    "inspect",
                    "--format",
                    "{{.State.Status}}|{{.State.Restarting}}|{{.State.ExitCode}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}",
                    $containerId
                ) `
                -AllowFailure

            $state = $stateLines | Select-Object -Last 1

            if ($state -match "^(restarting|exited|dead)\|" -or $state -match "\|true\|") {
                Save-Diagnostics
                throw "The application container stopped or entered a restart loop."
            }

            if ($state -match "\|unhealthy$") {
                Save-Diagnostics
                throw "The application container became unhealthy."
            }
        }

        if (($attempt % 5) -eq 0) {
            Write-Host "Still waiting... $attempt/90" -ForegroundColor DarkGray
        }

        Start-Sleep -Seconds 2
    }

    if (-not $ready) {
        Save-Diagnostics
        throw "The readiness endpoint did not return HTTP 200."
    }

    Write-Host ""
    Write-Host "CBAI IS READY" -ForegroundColor Green
    Write-Host "Application: $appUrl" -ForegroundColor White
    Write-Host ""
    Write-Host "Administrator:" -ForegroundColor Cyan
    Write-Host "  Email:    admin@example.test"
    Write-Host "  Password: ChangeMe-123!"
    Write-Host ""
    Write-Host "Use AI provider -> Save securely to store the API key." -ForegroundColor Green

    if (-not $NoBrowser) {
        Start-Process $appUrl
    }

    exit 0
}
catch {
    Write-Host ""
    Write-Host "STARTUP FAILED" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red

    if ($script:LogPath) {
        Add-Content -LiteralPath $script:LogPath -Value ""
        Add-Content -LiteralPath $script:LogPath -Value $_.Exception.ToString()
        Write-Host "Log: $script:LogPath" -ForegroundColor Yellow
    }

    exit 1
}
