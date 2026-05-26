# Automatic Selection Tool

一个本地自动选片 Demo，帮助摄影师或摄影爱好者快速完成照片初筛、相似照片二次预选和最终导出。

## 功能概览

- 本地网页上传多张照片
- FastAPI 后端处理图片
- OpenCV 本地智能评分
- 评分维度包含清晰度、光线、构图、模特姿态、神态
- 自动推荐保留前 30% 照片
- 推荐照片进入二次预选池
- 相似照片左右大图对比
- 点击图片可放大预览
- 最终预选框支持悬浮垃圾桶删除
- 可选择本地文件夹保存最终照片
- 可选 OpenAI 云端复评推荐照片
- 附带 Codex Skill，方便在其它设备复用

## 项目结构

```text
auto-photo-picker
├─ backend
│  ├─ main.py
│  ├─ cloud_review.py
│  ├─ requirements.txt
│  ├─ setup_backend.bat
│  ├─ start_backend.bat
│  └─ start_backend_with_openai.bat
├─ frontend
│  ├─ index.html
│  ├─ styles.css
│  └─ app.js
├─ codex-skills
│  └─ auto-photo-picker-demo
├─ .gitignore
└─ README.md
```

## 环境要求

- Windows 10 或以上
- Python 3.10 或以上
- Chrome 或 Edge 浏览器
- 可选：OpenAI API Key，用于云端复评

## 快速启动

进入后端目录：

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

启动后打开：

```text
http://127.0.0.1:8000
```

也可以在 Windows 上运行：

```bash
cd backend
setup_backend.bat
```

## 使用流程

1. 打开网页
2. 点击“选择照片”并导入一组照片
3. 点击“开始分析”
4. 查看“推荐保留”列表
5. 点击“开始相似照片对比”
6. 在左右大图中选择更好的照片
7. 最终照片会进入“最终预选框”
8. 鼠标悬浮到最终照片上，可点击右上角垃圾桶删除
9. 点击“选择文件夹保存”，选择本地文件夹导出最终照片

## 本地评分逻辑

当前本地评分是启发式算法，不是深度学习模型。它会综合：

- 清晰度：检测画面主体区域的边缘细节
- 光线：判断曝光、对比度、高光溢出和暗部比例
- 构图：判断主体位置、画面比例、边缘裁切
- 姿态：根据人脸或主体位置估算主体呈现效果
- 神态：根据面部区域亮度、对比和细节估算表现力

本地算法适合快速粗筛，不能完全替代人工审美判断。

## 二次预选逻辑

第一轮只推荐保留一部分照片。二次预选只会从这些推荐照片中寻找相似照片。

相似照片不会被两两组合成大量重复对比，而是先归为相似组，再在组内逐张淘汰，减少重复判断。

## 云端复评

云端复评是可选功能，需要 OpenAI API Key。

运行：

```bash
cd backend
start_backend_with_openai.bat
```

终端提示：

```text
Enter OpenAI API Key:
```

粘贴你的 API Key 后回车。

网页中点击：

```text
云端复评推荐照片
```

云端复评只会处理“推荐保留”的照片，不会把所有上传照片都发送到云端。

云端返回内容包括：

- 云端总分
- 构图评分
- 光线评分
- 姿态评分
- 神态评分
- 对焦评分
- 推荐理由
- 问题提醒
- 是否建议保留

## 隐私说明

默认情况下，照片只在本机处理。

只有点击“云端复评推荐照片”时，推荐保留池里的照片才会被压缩后发送到云端模型。

请不要把 API Key 写进代码或提交到 GitHub。

## 不要提交的内容

`.gitignore` 已经排除：

```text
backend/venv/
backend/uploads/
backend/selected_exports/
backend/__pycache__/
.env
.env.*
*.pyc
```

这些内容包含虚拟环境、临时上传照片、导出照片和密钥文件，不应该进入仓库。

## Codex Skill

项目附带一个 Codex Skill：

```text
codex-skills/auto-photo-picker-demo
```

在另一台设备上使用时，可以把该文件夹复制到：

```text
%USERPROFILE%\.codex\skills\auto-photo-picker-demo
```

然后重启 Codex。

## 常见问题

### 打不开网页

确认后端终端仍然打开，并显示：

```text
Uvicorn running on http://127.0.0.1:8000
```

### 保存时没有弹出文件夹选择器

请使用 Chrome 或 Edge 打开页面。部分浏览器不支持文件夹写入接口。

### 云端复评失败

检查：

- 是否设置了 `OPENAI_API_KEY`
- API Key 是否有效
- 账户是否有可用额度
- 网络是否能访问 OpenAI API

### 分数不是我预期的审美结果

本地评分是启发式算法，只适合初筛。建议把最终决定放在二次预选和人工判断上；如果需要更强审美判断，可以启用云端复评。

