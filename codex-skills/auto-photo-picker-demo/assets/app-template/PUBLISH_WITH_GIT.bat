@echo off
git --version
if errorlevel 1 (
  echo Git is not installed or not available in PATH.
  pause
  exit /b 1
)

git init
git add .
git commit -m "Add auto photo picker demo"
git branch -M main
git remote remove origin 2>nul
git remote add origin https://github.com/yaoiyiXu/Automatic-Selection-Tool.git
git push -u origin main
