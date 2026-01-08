<#
Setup script for Windows dev machine for this project.
Run this PowerShell script as Administrator.
It will:
 - Install Temurin (OpenJDK 17) silently
 - Set JAVA_HOME and update Machine PATH
 - Download Android command-line tools and install platform-tools, build-tools and platforms
 - Accept Android SDK licenses
 - Run a Gradle build (clean assembleDebug)
#>

Set-StrictMode -Version Latest

function Write-Log { param($m) Write-Host "[setup] $m" }

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "This script must be run as Administrator. Open PowerShell as Administrator and re-run."
    exit 1
}

$ErrorActionPreference = 'Stop'

# 1) Install Temurin 17
$msi = Join-Path $env:TEMP 'temurin17.msi'
$urlJdk = 'https://github.com/adoptium/temurin17-binaries/releases/latest/download/OpenJDK17U-jdk_x64_windows_hotspot.msi'
Write-Log "Downloading Temurin 17 from $urlJdk to $msi"
Invoke-WebRequest -Uri $urlJdk -OutFile $msi -UseBasicParsing
Write-Log "Installing Temurin 17 (silent install)"
$proc = Start-Process -FilePath msiexec.exe -ArgumentList '/i', $msi, '/quiet', '/norestart' -Wait -PassThru
if ($proc.ExitCode -ne 0) { Write-Error "msiexec exited with code $($proc.ExitCode)"; exit 1 }

# 2) Find java and set JAVA_HOME
Start-Sleep -Seconds 2
$javaCmd = Get-Command java.exe -ErrorAction SilentlyContinue
if (-not $javaCmd) { Write-Error "java not found after install. Check installer output."; exit 1 }
$javaPath = $javaCmd.Path
$javaBin = Split-Path -Parent $javaPath
$javaHome = Split-Path -Parent $javaBin
Write-Log "Detected java at $javaPath; setting JAVA_HOME=$javaHome"
[Environment]::SetEnvironmentVariable('JAVA_HOME',$javaHome,'Machine')
$machinePath = [Environment]::GetEnvironmentVariable('Path','Machine')
if ($machinePath -notlike "*$($javaHome)\bin*") {
    [Environment]::SetEnvironmentVariable('Path',$machinePath + ';' + ($javaHome + '\bin'),'Machine')
}

# 3) Download Android command-line tools
$androidRoot = Join-Path $env:LOCALAPPDATA 'Android'
$sdkRoot = Join-Path $androidRoot 'sdk'
$cmdlineDir = Join-Path $sdkRoot 'cmdline-tools\latest'
if (-not (Test-Path $sdkRoot)) { New-Item -ItemType Directory -Path $sdkRoot -Force | Out-Null }
$zip = Join-Path $env:TEMP 'commandlinetools.zip'
# Using a known release URL; may change in the future
$urlCmdTools = 'https://dl.google.com/android/repository/commandlinetools-win-9477386_latest.zip'
Write-Log "Downloading Android command-line tools from $urlCmdTools"
Invoke-WebRequest -Uri $urlCmdTools -OutFile $zip -UseBasicParsing
Write-Log "Extracting to $cmdlineDir"
if (Test-Path $cmdlineDir) { Remove-Item $cmdlineDir -Recurse -Force }
New-Item -ItemType Directory -Path $cmdlineDir -Force | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory($zip,$cmdlineDir)
# Note: the zip often contains a 'cmdline-tools' top folder; ensure 'latest' has a 'bin' folder with sdkmanager
if (-not (Test-Path (Join-Path $cmdlineDir 'bin'))) {
    # Move nested contents up
    Get-ChildItem $cmdlineDir | Where-Object { $_.PSIsContainer } | ForEach-Object {
        Get-ChildItem $_.FullName | ForEach-Object { Move-Item $_.FullName $cmdlineDir -Force }
    }
}

# 4) Set ANDROID_SDK_ROOT and update PATH
[Environment]::SetEnvironmentVariable('ANDROID_SDK_ROOT',$sdkRoot,'Machine')
$machinePath = [Environment]::GetEnvironmentVariable('Path','Machine')
$platformToolsPath = Join-Path $sdkRoot 'platform-tools'
$cmdlineBin = Join-Path $cmdlineDir 'bin'
$pathsToAdd = @($cmdlineBin, $platformToolsPath)
foreach ($p in $pathsToAdd) {
    if ($machinePath -notlike "*$p*") { $machinePath = $machinePath + ';' + $p }
}
[Environment]::SetEnvironmentVariable('Path',$machinePath,'Machine')

# 5) Install SDK components via sdkmanager
Write-Log "Installing Android SDK components (platform-tools, platforms;android-33, build-tools;33.0.2)"
$env:PATH = [Environment]::GetEnvironmentVariable('Path','Machine')
$sdkmanager = Join-Path $cmdlineDir 'bin\sdkmanager.bat'
if (-not (Test-Path $sdkmanager)) { Write-Error "sdkmanager not found at $sdkmanager"; exit 1 }
# Accept licenses non-interactively
& $sdkmanager --sdk_root=$sdkRoot "platform-tools" "platforms;android-33" "build-tools;33.0.2" "emulator"
& $sdkmanager --licenses --sdk_root=$sdkRoot | ForEach-Object { $_ }

# 6) Run Gradle build to verify
Write-Log "Ejecutando build: gradlew clean assembleDebug"
Push-Location -Path (Resolve-Path "..\")
$gradle = Join-Path (Get-Location) 'android\gradlew.bat'
if (-not (Test-Path $gradle)) { Write-Error "gradlew not found at expected location: $gradle"; Pop-Location; exit 1 }
& $gradle clean assembleDebug
Pop-Location

Write-Log "Setup completado. Reinicia terminal / Android Studio para que las variables de entorno surtan efecto." 
Write-Host "Listo: si todo se instaló correctamente, abre Android Studio, carga el proyecto y haz 'Sync Project with Gradle Files' y luego usa Run ▶︎ para desplegar la app."