$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$env:DEBUG = "false"
$env:LABEL_STUDIO_BASE_DATA_DIR = Join-Path $projectRoot ".label-studio-data"
$env:SECRET_KEY = "style-studio-local-label-studio"
Remove-Item Env:HOST -ErrorAction SilentlyContinue

New-Item -ItemType Directory -Force -Path $env:LABEL_STUDIO_BASE_DATA_DIR | Out-Null

& "$env:APPDATA\Python\Python313\Scripts\label-studio.exe" start --port 8080 --host 127.0.0.1
