[CmdletBinding()]
param(
    [Parameter()]
    [string]$ProjectRoot = $PSScriptRoot,

    [Parameter()]
    [switch]$RemoveData
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
Set-Location (Resolve-Path -LiteralPath $ProjectRoot).Path

$args = @("--env-file", ".env", "down", "--remove-orphans")
if ($RemoveData) {
    $args += "--volumes"
}

& docker compose @args
if ($LASTEXITCODE -ne 0) {
    throw "Docker Compose stop failed."
}
