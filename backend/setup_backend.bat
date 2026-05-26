@echo off
set PYTHON_EXE=C:\Users\PC\AppData\Local\Python\pythoncore-3.14-64\python.exe

if not exist "%PYTHON_EXE%" (
  echo Python was not found at:
  echo %PYTHON_EXE%
  pause
  exit /b 1
)

"%PYTHON_EXE%" -m venv venv
call venv\Scripts\activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
uvicorn main:app --reload
