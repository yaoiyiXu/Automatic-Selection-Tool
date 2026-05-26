@echo off
setlocal

set "GIT_EXE=C:\Program Files\Git\cmd\git.exe"
set "REPO_DIR=%~dp0"
set "REPO_DIR=%REPO_DIR:~0,-1%"
set "GIT_DIR=%REPO_DIR%\git-store"
set "GIT_WORK_TREE=%REPO_DIR%"

echo Force uploading to:
echo https://github.com/yaoiyiXu/Automatic-Selection-Tool
echo.

"%GIT_EXE%" push -u origin main --force

echo.
if errorlevel 1 (
  echo Upload failed. Please check GitHub login and network access.
) else (
  echo Upload completed.
)
pause
