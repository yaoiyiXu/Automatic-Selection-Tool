import base64
import json
import os
import urllib.error
import urllib.request

import cv2


OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"


def compressed_image_data_url(image_path, max_size=1280, quality=82):
    image_data = cv2.imdecode(
        __import__("numpy").fromfile(str(image_path), dtype=__import__("numpy").uint8),
        cv2.IMREAD_COLOR,
    )
    if image_data is None:
        raise ValueError("image could not be read")

    height, width = image_data.shape[:2]
    scale = min(max_size / max(height, width), 1)
    if scale < 1:
        image_data = cv2.resize(
            image_data,
            (int(width * scale), int(height * scale)),
            interpolation=cv2.INTER_AREA,
        )

    ok, encoded = cv2.imencode(".jpg", image_data, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not ok:
        raise ValueError("image could not be compressed")

    image_base64 = base64.b64encode(encoded.tobytes()).decode("ascii")
    return f"data:image/jpeg;base64,{image_base64}"


def extract_text(response_data):
    if isinstance(response_data.get("output_text"), str):
        return response_data["output_text"]

    for output in response_data.get("output", []):
        for content in output.get("content", []):
            if isinstance(content.get("text"), str):
                return content["text"]

    raise ValueError("cloud response did not include text")


def review_photo_with_openai(image_path, local_scores):
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")

    model = os.environ.get("OPENAI_PHOTO_MODEL", "gpt-5.4-mini")
    image_url = compressed_image_data_url(image_path)
    prompt = (
        "你是一位商业人像摄影选片师。请基于照片本身和本地算法分数做云端复评。"
        "重点判断：构图、光线、模特姿态、神态、闭眼/表情、虚焦、主体突出、是否值得保留。"
        "分数要严格，普通可用照片 60-75，优秀照片 80-90，非常突出才超过 90。"
        "只返回 JSON，不要返回 Markdown。"
        f"本地算法分数：{json.dumps(local_scores, ensure_ascii=False)}"
    )

    payload = {
        "model": model,
        "input": [
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": prompt},
                    {"type": "input_image", "image_url": image_url},
                ],
            }
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "photo_cloud_review",
                "schema": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "cloud_score": {"type": "number"},
                        "keep": {"type": "boolean"},
                        "composition": {"type": "number"},
                        "lighting": {"type": "number"},
                        "pose": {"type": "number"},
                        "expression": {"type": "number"},
                        "focus": {"type": "number"},
                        "reason": {"type": "string"},
                        "problem": {"type": "string"},
                    },
                    "required": [
                        "cloud_score",
                        "keep",
                        "composition",
                        "lighting",
                        "pose",
                        "expression",
                        "focus",
                        "reason",
                        "problem",
                    ],
                },
                "strict": True,
            }
        },
    }

    request = urllib.request.Request(
        OPENAI_RESPONSES_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            response_data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"OpenAI API error: {detail}") from error

    return json.loads(extract_text(response_data))
