@echo off
setlocal

set "GIT_EXE=C:\Program Files\Git\cmd\git.exe"
set "REPO_DIR=%~dp0"
set "REPO_DIR=%REPO_DIR:~0,-1%"
set "GIT_DIR=%REPO_DIR%\git-store"
set "GIT_WORK_TREE=%REPO_DIR%"

echo Checking Git...
if not exist "%GIT_EXE%" (
  echo Git was not found at:
  echo %GIT_EXE%
  pause
  exit /b 1
)

echo.
echo Repository:
echo %REPO_DIR%
echo.
echo Remote:
"%GIT_EXE%" remote -v

echo.
echo Pushing to GitHub...
"%GIT_EXE%" push -u origin main

echo.
if errorlevel 1 (
  echo Normal push failed.
  echo This may happen because the GitHub repo already has a README commit.
  echo.
  echo Overwriting remote main with this complete local project...
  "%GIT_EXE%" push -u origin main --force
  if errorlevel 1 (
    echo Force push also failed.
    echo If GitHub asks you to sign in, finish sign-in and run this file again.
    echo If it says it cannot connect, check that github.com opens in your browser.
  ) else (
    echo Upload completed.
  )
) else (
  echo Push completed.
)
pause
