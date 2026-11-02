@echo off
rem Launch Pip, the OfficeAuto AI desktop buddy. First run installs Electron (~100 MB).
cd /d "%~dp0buddy"
if not exist node_modules\electron\dist\electron.exe (
  where npm >nul 2>nul || (
    echo Node.js is not installed. Get the LTS version from https://nodejs.org then run this again.
    start "" https://nodejs.org
    pause
    exit /b 1
  )
  echo Installing Pip for the first time, please wait a few minutes...
  call npm install --no-fund --no-audit
)
if not exist node_modules\electron\dist\electron.exe (
  echo Install failed - check your internet connection and run Start-Buddy.cmd again.
  pause
  exit /b 1
)
start "" node_modules\electron\dist\electron.exe .
