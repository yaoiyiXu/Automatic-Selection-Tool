@echo off
set /p OPENAI_API_KEY=Enter OpenAI API Key:
set OPENAI_PHOTO_MODEL=gpt-5.4-mini
call venv\Scripts\activate
uvicorn main:app --reload
