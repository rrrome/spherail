param([switch]$SkipUi)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$taskProjectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskVersion = (Get-Content -LiteralPath (Join-Path $taskProjectRoot 'package.json') -Raw | ConvertFrom-Json).version
$taskInstaller = Join-Path $taskProjectRoot "dist\Spherail-$taskVersion-Windows-x64-Setup.exe"
$taskTemporaryRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$taskTestRoot = [IO.Path]::GetFullPath((Join-Path $taskTemporaryRoot ('spherail-installer-' + [guid]::NewGuid().ToString('N'))))
$taskInstallRoot = Join-Path $taskTestRoot '绘轨 Install'
if (-not $taskTestRoot.StartsWith($taskTemporaryRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe installer test directory' }
New-Item -ItemType Directory -Path $taskTestRoot | Out-Null
$taskPreviousExecutable = $env:SPHERAIL_EXE
try {
    $taskProcess = Start-Process -FilePath $taskInstaller -ArgumentList "/S /D=$taskInstallRoot" -WindowStyle Hidden -Wait -PassThru
    if ($taskProcess.ExitCode -ne 0) { throw "Installer failed: $($taskProcess.ExitCode)" }
    $taskExecutable = Join-Path $taskInstallRoot 'Spherail.exe'
    if (-not (Test-Path -LiteralPath $taskExecutable)) { throw 'Installed executable is missing' }
    $taskFileVersion = (Get-Item -LiteralPath $taskExecutable).VersionInfo.FileVersion
    if ($taskFileVersion -ne $taskVersion) { throw "Installed version mismatch: $taskFileVersion" }
    Write-Output "PASS: per-user installer installs version $taskVersion into a path containing Chinese and spaces"
    if (-not $SkipUi) {
        $env:SPHERAIL_EXE = $taskExecutable
        Push-Location $taskProjectRoot
        try { & npm.cmd run test:windows; if ($LASTEXITCODE -ne 0) { throw 'Installed application smoke test failed' } }
        finally { Pop-Location }
    }
} finally {
    $env:SPHERAIL_EXE = $taskPreviousExecutable
    $taskUninstaller = Get-ChildItem -LiteralPath $taskInstallRoot -Filter 'Uninstall*.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($taskUninstaller) {
        $taskRemoval = Start-Process -FilePath $taskUninstaller.FullName -ArgumentList "/S _?=$taskInstallRoot" -WindowStyle Hidden -Wait -PassThru
        if ($taskRemoval.ExitCode -ne 0) { throw "Uninstaller failed: $($taskRemoval.ExitCode)" }
        Write-Output 'PASS: silent uninstall completes'
    }
    $taskResolvedCleanup = [IO.Path]::GetFullPath($taskTestRoot)
    if (-not $taskResolvedCleanup.StartsWith($taskTemporaryRoot, [StringComparison]::OrdinalIgnoreCase) -or
        [IO.Path]::GetFileName($taskResolvedCleanup) -notlike 'spherail-installer-*') { throw 'Unsafe cleanup directory' }
    Remove-Item -LiteralPath $taskResolvedCleanup -Recurse -Force
}
