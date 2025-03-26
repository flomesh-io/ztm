@echo off
setlocal

if "%~1"=="" (
    exit /b 1
)

set Action=%~1
set Proxy=%~2
set RegPath="HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings"

if "%Action%"=="register" (
    if "%Proxy%"=="" (
        echo Proxy address is required for registration.
        exit /b 1
    )
    reg add %RegPath% /v ProxyEnable /t REG_DWORD /d 1 /f >nul 2>&1
    reg add %RegPath% /v ProxyServer /t REG_SZ /d "%Proxy%" /f >nul 2>&1
    exit /b 0
)

if "%Action%"=="unregister" (
    reg add %RegPath% /v ProxyEnable /t REG_DWORD /d 0 /f >nul 2>&1
    reg delete %RegPath% /v ProxyServer /f >nul 2>&1
    exit /b 0
)

exit /b 1

