---
name: auto-photo-picker-demo
description: Build, install, repair, or explain the local Auto Photo Picker demo: a FastAPI + HTML/CSS/JS web app for AI-assisted portrait photo culling with local OpenCV scoring, recommended keeps, second-pass similar-photo comparison, click-to-zoom previews, manual final deletion, folder export, and optional OpenAI cloud review. Use when the user wants this photo picker created on a new machine, copied from the bundled template, run locally, debugged, customized, packaged, or connected to cloud review.
---

# Auto Photo Picker Demo

Use this skill to create or maintain the local photo selection web demo.

## Create A New Copy

Copy `assets/app-template` into the user's target folder, usually as `auto-photo-picker`.

Keep these runtime folders out of source control:

- `backend/venv`
- `backend/uploads`
- `backend/selected_exports`
- `backend/__pycache__`

## Install And Run

From the copied project:

```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Open:

```text
http://127.0.0.1:8000
```

If Python is installed in a custom location, update `backend/setup_backend.bat`.

## Optional Cloud Review

Cloud review is disabled until `OPENAI_API_KEY` is set in the backend process.

Use:

```powershell
cd backend
start_backend_with_openai.bat
```

Then paste the API key. The frontend button `云端复评推荐照片` reviews only the recommended keep pool, not every uploaded photo.

## Feature Map

- `backend/main.py`: local scoring, upload handling, static frontend serving, cloud-review route.
- `backend/cloud_review.py`: OpenAI Responses API visual review adapter.
- `frontend/index.html`: page structure.
- `frontend/styles.css`: glass UI, comparison layout, hover delete button.
- `frontend/app.js`: upload previews, local analysis, second-pass grouping, lightbox, folder save, cloud review.

## Validation

Run:

```powershell
cd backend
venv\Scripts\python.exe -m py_compile main.py cloud_review.py
```

When changing frontend behavior, manually verify:

- upload previews appear
- local analysis returns recommended photos
- second-pass comparison starts from recommended photos only
- final selected photos can be deleted with the hover trash button
- `选择文件夹保存` opens a browser folder picker in Chrome or Edge

