from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import cv2
import numpy as np
import os
import shutil
import uuid
from pathlib import Path
from math import ceil
from datetime import datetime
import tempfile

from fastapi import HTTPException
from cloud_review import review_photo_with_openai

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"
UPLOAD_DIR = BASE_DIR / "uploads"
EXPORT_DIR = BASE_DIR / "selected_exports"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(EXPORT_DIR, exist_ok=True)


class SaveSelectionRequest(BaseModel):
    filenames: list[str]


class CloudReviewRequest(BaseModel):
    filenames: list[str]


@app.get("/")
async def home():
    return FileResponse(FRONTEND_DIR / "index.html")


def read_image(image_path, mode=cv2.IMREAD_COLOR):
    image_data = np.fromfile(str(image_path), dtype=np.uint8)
    return cv2.imdecode(image_data, mode)


def clamp_score(value):
    return float(max(0, min(100, value)))


def resize_for_analysis(image, max_size=1200):
    height, width = image.shape[:2]
    scale = min(max_size / max(height, width), 1)
    if scale == 1:
        return image
    return cv2.resize(image, (int(width * scale), int(height * scale)), interpolation=cv2.INTER_AREA)


def detect_faces(gray):
    source_path = Path(cv2.data.haarcascades) / "haarcascade_frontalface_default.xml"
    cascade_path = Path(tempfile.gettempdir()) / "auto_photo_picker_frontalface.xml"
    if not cascade_path.exists() and source_path.exists():
        shutil.copy2(source_path, cascade_path)
    if not cascade_path.exists():
        return []
    face_cascade = cv2.CascadeClassifier(str(cascade_path))
    if face_cascade.empty():
        return []
    equalized = cv2.equalizeHist(gray)
    faces = face_cascade.detectMultiScale(equalized, scaleFactor=1.08, minNeighbors=4, minSize=(36, 36))
    return sorted(faces, key=lambda face: face[2] * face[3], reverse=True)


def calculate_sharpness_score(gray):
    height, width = gray.shape[:2]
    top = int(height * 0.18)
    bottom = int(height * 0.86)
    left = int(width * 0.12)
    right = int(width * 0.88)
    center_crop = gray[top:bottom, left:right]
    sharpness = float(cv2.Laplacian(center_crop, cv2.CV_64F).var())
    sharpness_score = clamp_score((sharpness / 55) * 100)
    return sharpness, sharpness_score


def calculate_lighting_score(gray):
    p10, p50, p90, p98 = np.percentile(gray, [10, 50, 90, 98])
    exposure = float(p90)
    contrast = float(p90 - p10)
    exposure_score = max(0, 100 - abs(p90 - 165) * 1.15)
    contrast_score = clamp_score((contrast / 125) * 100)
    highlight_ratio = float(np.mean(gray > 245))
    shadow_ratio = float(np.mean(gray < 5))
    penalty = highlight_ratio * 220 + max(0, shadow_ratio - 0.28) * 90
    lighting_score = clamp_score(exposure_score * 0.55 + contrast_score * 0.45 - penalty)
    return exposure, lighting_score


def subject_box(image, gray):
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    skin_mask = cv2.inRange(hsv, np.array([0, 18, 45]), np.array([26, 180, 255]))
    bright_threshold = np.percentile(gray, 72)
    bright_mask = cv2.inRange(gray, int(bright_threshold), 255)
    mask = cv2.bitwise_or(skin_mask, bright_mask)
    kernel = np.ones((5, 5), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    height, width = gray.shape[:2]
    min_area = width * height * 0.015
    contours = [contour for contour in contours if cv2.contourArea(contour) >= min_area]
    if not contours:
        return None
    contour = max(contours, key=cv2.contourArea)
    return cv2.boundingRect(contour)


def calculate_composition_score(image, gray, faces):
    height, width = gray.shape[:2]
    box = tuple(faces[0]) if len(faces) else subject_box(image, gray)
    if box is None:
        return 48.0

    x, y, w, h = box
    center_x = (x + w / 2) / width
    center_y = (y + h / 2) / height
    area_ratio = (w * h) / (width * height)
    thirds = [(1 / 3, 1 / 3), (2 / 3, 1 / 3), (1 / 3, 2 / 3), (2 / 3, 2 / 3)]
    nearest_third = min(((center_x - tx) ** 2 + (center_y - ty) ** 2) ** 0.5 for tx, ty in thirds)
    rule_score = clamp_score(100 - nearest_third * 190)
    center_score = clamp_score(100 - abs(center_x - 0.5) * 135)
    size_score = clamp_score(100 - abs(area_ratio - 0.18) * 260)
    edge_penalty = 0
    if x <= width * 0.03 or y <= height * 0.02 or x + w >= width * 0.98:
        edge_penalty = 18
    return clamp_score(rule_score * 0.42 + center_score * 0.25 + size_score * 0.33 - edge_penalty)


def calculate_pose_score(gray, faces):
    if len(faces) == 0:
        return 58.0
    height, width = gray.shape[:2]
    x, y, w, h = faces[0]
    face_area = (w * h) / (width * height)
    center_x = (x + w / 2) / width
    center_y = (y + h / 2) / height
    size_score = clamp_score(100 - abs(face_area - 0.055) * 900)
    position_score = clamp_score(100 - abs(center_x - 0.5) * 110 - max(0, center_y - 0.55) * 95)
    return clamp_score(size_score * 0.42 + position_score * 0.58)


def calculate_expression_score(gray, faces):
    if len(faces) == 0:
        return 55.0
    x, y, w, h = faces[0]
    face = gray[y : y + h, x : x + w]
    face_light = float(np.percentile(face, 72))
    face_contrast = float(np.percentile(face, 88) - np.percentile(face, 18))
    face_sharpness = float(cv2.Laplacian(face, cv2.CV_64F).var())
    light_score = clamp_score(100 - abs(face_light - 155) * 1.2)
    contrast_score = clamp_score((face_contrast / 82) * 100)
    detail_score = clamp_score((face_sharpness / 48) * 100)
    return clamp_score(light_score * 0.36 + contrast_score * 0.26 + detail_score * 0.38)


def score_photo(image_path):
    image = read_image(image_path)
    if image is None:
        return {
            "sharpness": 0.0,
            "exposure": 0.0,
            "sharpness_score": 0.0,
            "lighting_score": 0.0,
            "composition_score": 0.0,
            "pose_score": 0.0,
            "expression_score": 0.0,
            "score": 0.0,
        }

    image = resize_for_analysis(image)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    faces = detect_faces(gray)
    sharpness, sharpness_score = calculate_sharpness_score(gray)
    exposure, lighting_score = calculate_lighting_score(gray)
    composition_score = calculate_composition_score(image, gray, faces)
    pose_score = calculate_pose_score(gray, faces)
    expression_score = calculate_expression_score(gray, faces)
    total_score = (
        sharpness_score * 0.25
        + lighting_score * 0.25
        + composition_score * 0.2
        + pose_score * 0.15
        + expression_score * 0.15
    )

    return {
        "sharpness": float(round(sharpness, 2)),
        "exposure": float(round(exposure, 2)),
        "sharpness_score": float(round(sharpness_score, 2)),
        "lighting_score": float(round(lighting_score, 2)),
        "composition_score": float(round(composition_score, 2)),
        "pose_score": float(round(pose_score, 2)),
        "expression_score": float(round(expression_score, 2)),
        "score": float(round(total_score, 2)),
    }


@app.post("/upload")
async def upload_photos(files: list[UploadFile] = File(...)):
    results = []

    for file in files:
        file_id = str(uuid.uuid4())
        filename = f"{file_id}_{file.filename}"
        file_path = os.path.join(UPLOAD_DIR, filename)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        score = score_photo(file_path)

        results.append(
            {
                "filename": filename,
                "original_name": file.filename,
                "file_path": file_path,
                **score,
            }
        )

    results.sort(key=lambda x: x["score"], reverse=True)

    keep_count = max(1, ceil(len(results) * 0.3)) if results else 0
    for index, result in enumerate(results):
        result["selected"] = index < keep_count

    return {
        "message": "\u4e0a\u4f20\u6210\u529f",
        "count": len(results),
        "selected_count": keep_count,
        "hidden_count": max(0, len(results) - keep_count),
        "photos": results,
    }


@app.post("/save-selected")
async def save_selected_photos(payload: SaveSelectionRequest):
    folder_name = datetime.now().strftime("selected_%Y%m%d_%H%M%S")
    target_dir = EXPORT_DIR / folder_name
    target_dir.mkdir(parents=True, exist_ok=True)

    saved_files = []
    for filename in payload.filenames:
        safe_name = Path(filename).name
        source_path = UPLOAD_DIR / safe_name
        if not source_path.exists():
            continue

        original_name = safe_name.split("_", 1)[1] if "_" in safe_name else safe_name
        target_path = target_dir / original_name
        shutil.copy2(source_path, target_path)
        saved_files.append(str(target_path))

    return {
        "message": "\u4fdd\u5b58\u6210\u529f",
        "folder": str(target_dir),
        "count": len(saved_files),
        "files": saved_files,
    }


@app.post("/cloud-review")
async def cloud_review_photos(payload: CloudReviewRequest):
    if not os.environ.get("OPENAI_API_KEY"):
        raise HTTPException(status_code=400, detail="请先在后端终端设置 OPENAI_API_KEY")

    reviews = []
    for filename in payload.filenames[:50]:
        safe_name = Path(filename).name
        image_path = UPLOAD_DIR / safe_name
        if not image_path.exists():
            continue

        local_scores = score_photo(image_path)
        try:
            cloud_review = review_photo_with_openai(image_path, local_scores)
            reviews.append(
                {
                    "filename": safe_name,
                    **cloud_review,
                }
            )
        except Exception as error:
            reviews.append(
                {
                    "filename": safe_name,
                    "error": str(error),
                }
            )

    return {
        "message": "\u4e91\u7aef\u590d\u8bc4\u5b8c\u6210",
        "count": len(reviews),
        "reviews": reviews,
    }


app.mount("/assets", StaticFiles(directory=FRONTEND_DIR), name="assets")
