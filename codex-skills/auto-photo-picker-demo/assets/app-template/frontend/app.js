const API_URL = "http://127.0.0.1:8000";

const photoInput = document.getElementById("photoInput");
const dropzone = document.getElementById("dropzone");
const analyzeButton = document.getElementById("analyzeButton");
const clearButton = document.getElementById("clearButton");
const previewGrid = document.getElementById("previewGrid");
const rankingList = document.getElementById("rankingList");
const countText = document.getElementById("countText");
const resultHint = document.getElementById("resultHint");
const statusText = document.getElementById("statusText");
const cloudReviewButton = document.getElementById("cloudReviewButton");
const cloudReviewHint = document.getElementById("cloudReviewHint");
const comparePanel = document.getElementById("comparePanel");
const finalPanel = document.getElementById("finalPanel");
const compareHint = document.getElementById("compareHint");
const compareStage = document.getElementById("compareStage");
const startCompareButton = document.getElementById("startCompareButton");
const keepBothButton = document.getElementById("keepBothButton");
const skipPairButton = document.getElementById("skipPairButton");
const finalGrid = document.getElementById("finalGrid");
const finalHint = document.getElementById("finalHint");
const saveButton = document.getElementById("saveButton");
const saveHint = document.getElementById("saveHint");
const lightbox = document.getElementById("lightbox");
const lightboxImage = document.getElementById("lightboxImage");
const lightboxClose = document.getElementById("lightboxClose");

let selectedPhotos = [];
let analyzedPhotos = [];
let recommendedPhotos = [];
let similarGroups = [];
let currentGroupIndex = 0;
let currentGroupQueue = [];
let currentWinner = null;
let finalSelected = new Map();
let lockedSelected = new Map();

function setStatus(text, type = "") {
  statusText.textContent = text;
  statusText.className = `status-pill ${type}`.trim();
}

function fileKey(file, index) {
  return `${file.name}-${file.size}-${file.lastModified}-${index}`;
}

function setPhotos(files) {
  selectedPhotos.forEach((photo) => URL.revokeObjectURL(photo.url));
  selectedPhotos = Array.from(files)
    .filter((file) => file.type.startsWith("image/"))
    .map((file, index) => ({
      file,
      key: fileKey(file, index),
      url: URL.createObjectURL(file),
    }));

  renderPreviews();
  renderEmptyRanking();
  resetSecondSelection();
}

function renderPreviews() {
  countText.textContent = `${selectedPhotos.length} 张`;
  analyzeButton.disabled = selectedPhotos.length === 0;
  clearButton.disabled = selectedPhotos.length === 0;

  if (selectedPhotos.length === 0) {
    previewGrid.innerHTML = '<p class="empty-text">还没有选择照片。</p>';
    return;
  }

  previewGrid.innerHTML = selectedPhotos
    .map(
      (photo) => `
        <article class="photo-card">
          <img src="${photo.url}" alt="${photo.file.name}" />
          <span title="${photo.file.name}">${photo.file.name}</span>
        </article>
      `
    )
    .join("");
}

function renderEmptyRanking() {
  resultHint.textContent = "等待分析";
  rankingList.innerHTML = '<p class="empty-text">分析完成后，这里只显示推荐保留的照片。</p>';
}

function resetSecondSelection() {
  analyzedPhotos = [];
  recommendedPhotos = [];
  similarGroups = [];
  currentGroupIndex = 0;
  currentGroupQueue = [];
  currentWinner = null;
  finalSelected = new Map();
  lockedSelected = new Map();
  comparePanel.hidden = true;
  finalPanel.hidden = true;
  cloudReviewButton.disabled = true;
  cloudReviewHint.textContent = "本地分析完成后可用";
  compareHint.textContent = "等待开始";
  compareStage.innerHTML = '<p class="empty-text">点击开始后，会把相似照片尽量大地放在左右两侧，方便你挑更好的。</p>';
  keepBothButton.disabled = true;
  skipPairButton.disabled = true;
  saveHint.textContent = "";
  renderFinalGrid();
}

function findPhotoForResult(result, usedKeys) {
  const match = selectedPhotos.find(
    (photo) => photo.file.name === result.original_name && !usedKeys.has(photo.key)
  );
  if (match) {
    usedKeys.add(match.key);
  }
  return match;
}

function findLocalPhotoByName(name) {
  return selectedPhotos.find((photo) => photo.file.name === name);
}

function scoreLine(photo) {
  if (photo.cloud_score !== undefined) {
    return `云端 ${photo.cloud_score} · 构图 ${photo.cloud_composition} · 姿态 ${photo.cloud_pose} · 神态 ${photo.cloud_expression} · 光线 ${photo.cloud_lighting}`;
  }
  return `本地 ${photo.score} · 构图 ${photo.composition_score} · 姿态 ${photo.pose_score} · 神态 ${photo.expression_score} · 光线 ${photo.lighting_score}`;
}

function reasonLine(photo) {
  if (!photo.cloud_reason && !photo.cloud_problem) {
    return "";
  }
  const problem = photo.cloud_problem ? `；注意：${photo.cloud_problem}` : "";
  return `<span class="cloud-reason">${photo.cloud_reason || ""}${problem}</span>`;
}

function renderRanking(data) {
  const photos = data.photos || [];
  const selectedPhotosResult = photos.filter((photo) => photo.selected);
  const usedKeys = new Set();
  analyzedPhotos = photos;
  recommendedPhotos = selectedPhotosResult;
  resultHint.textContent = `推荐 ${data.selected_count || selectedPhotosResult.length} 张，隐藏 ${data.hidden_count || 0} 张`;
  comparePanel.hidden = selectedPhotosResult.length < 2;
  finalPanel.hidden = selectedPhotosResult.length === 0;
  cloudReviewButton.disabled = selectedPhotosResult.length === 0;
  cloudReviewHint.textContent = selectedPhotosResult.length > 0 ? "可对推荐照片做云端审美复评" : "本地分析完成后可用";
  finalSelected = new Map();
  lockedSelected = new Map();
  selectedPhotosResult.forEach((photo) => {
    finalSelected.set(photo.filename, photo);
  });
  renderFinalGrid();

  if (selectedPhotosResult.length === 0) {
    rankingList.innerHTML = '<p class="empty-text">没有筛选出推荐照片。</p>';
    return;
  }

  rankingList.innerHTML = selectedPhotosResult
    .map((photo, index) => {
      const localPhoto = findPhotoForResult(photo, usedKeys);
      const imageUrl = localPhoto ? localPhoto.url : "";
      return `
        <article class="rank-item selected">
          <div class="rank-number">${index + 1}</div>
          <img class="rank-thumb" src="${imageUrl}" alt="${photo.original_name}" />
          <div class="rank-name">
            <strong title="${photo.original_name}">${photo.original_name}</strong>
            <span>${scoreLine(photo)}</span>
            ${reasonLine(photo)}
          </div>
          <div class="score">${photo.cloud_score ?? photo.score}</div>
        </article>
      `;
    })
    .join("");
}

function rerenderReviewedRanking() {
  recommendedPhotos.sort((a, b) => (b.cloud_score ?? b.score) - (a.cloud_score ?? a.score));
  finalSelected = new Map();
  recommendedPhotos
    .filter((photo) => photo.cloud_keep !== false)
    .forEach((photo) => finalSelected.set(photo.filename, photo));
  renderFinalGrid();

  const usedKeys = new Set();
  rankingList.innerHTML = recommendedPhotos
    .map((photo, index) => {
      const localPhoto = findPhotoForResult(photo, usedKeys);
      const imageUrl = localPhoto ? localPhoto.url : "";
      const keepText = photo.cloud_keep === false ? "云端建议淘汰" : "云端建议保留";
      return `
        <article class="rank-item selected">
          <div class="rank-number">${index + 1}</div>
          <img class="rank-thumb" src="${imageUrl}" alt="${photo.original_name}" />
          <div class="rank-name">
            <strong title="${photo.original_name}">${photo.original_name}</strong>
            <span>${keepText} · ${scoreLine(photo)}</span>
            ${reasonLine(photo)}
          </div>
          <div class="score">${photo.cloud_score ?? photo.score}</div>
        </article>
      `;
    })
    .join("");
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

async function buildImageHash(url) {
  const image = await loadImage(url);
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 8;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, 8, 8);
  const { data } = context.getImageData(0, 0, 8, 8);
  const grays = [];

  for (let index = 0; index < data.length; index += 4) {
    grays.push(data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114);
  }

  const average = grays.reduce((sum, value) => sum + value, 0) / grays.length;
  return grays.map((value) => (value >= average ? "1" : "0")).join("");
}

function hammingDistance(left, right) {
  let distance = 0;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      distance += 1;
    }
  }
  return distance;
}

async function buildSimilarGroups() {
  const withHashes = [];

  for (const photo of recommendedPhotos) {
    const localPhoto = findLocalPhotoByName(photo.original_name);
    if (!localPhoto) {
      continue;
    }
    withHashes.push({
      ...photo,
      url: localPhoto.url,
      hash: await buildImageHash(localPhoto.url),
    });
  }

  const parent = withHashes.map((_, index) => index);

  function find(index) {
    if (parent[index] !== index) {
      parent[index] = find(parent[index]);
    }
    return parent[index];
  }

  function unite(leftIndex, rightIndex) {
    const leftRoot = find(leftIndex);
    const rightRoot = find(rightIndex);
    if (leftRoot !== rightRoot) {
      parent[rightRoot] = leftRoot;
    }
  }

  for (let leftIndex = 0; leftIndex < withHashes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < withHashes.length; rightIndex += 1) {
      const distance = hammingDistance(withHashes[leftIndex].hash, withHashes[rightIndex].hash);
      if (distance <= 10) {
        unite(leftIndex, rightIndex);
      }
    }
  }

  const grouped = new Map();
  withHashes.forEach((photo, index) => {
    const groupKey = find(index);
    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, []);
    }
    grouped.get(groupKey).push(photo);
  });

  return Array.from(grouped.values())
    .filter((group) => group.length > 1)
    .map((group) => group.sort((a, b) => b.score - a.score))
    .sort((a, b) => b.length - a.length);
}

function getCurrentChallenger() {
  return currentGroupQueue[0] || null;
}

function startGroup(index) {
  const group = similarGroups[index];
  if (!group) {
    currentWinner = null;
    currentGroupQueue = [];
    compareHint.textContent = "相似照片已对比完";
    compareStage.innerHTML = '<p class="empty-text">这一轮相似照片已经看完了，最终预选框里就是当前保留结果。</p>';
    keepBothButton.disabled = true;
    skipPairButton.disabled = true;
    return;
  }

  currentWinner = group[0];
  currentGroupQueue = group.slice(1);
  renderComparePair();
}

function finishCurrentGroup() {
  const group = similarGroups[currentGroupIndex] || [];
  group.forEach((photo) => finalSelected.delete(photo.filename));
  lockedSelected.forEach((photo, filename) => finalSelected.set(filename, photo));
  if (currentWinner) {
    finalSelected.set(currentWinner.filename, currentWinner);
  }
  renderFinalGrid();
  currentGroupIndex += 1;
  startGroup(currentGroupIndex);
}

function renderComparePair() {
  const challenger = getCurrentChallenger();

  if (!currentWinner || !challenger) {
    finishCurrentGroup();
    return;
  }

  const group = similarGroups[currentGroupIndex] || [];
  const stepInGroup = group.length - currentGroupQueue.length;
  compareHint.textContent = `第 ${currentGroupIndex + 1} / ${similarGroups.length} 组 · ${stepInGroup} / ${group.length - 1} 次`;
  keepBothButton.disabled = false;
  skipPairButton.disabled = false;
  compareStage.innerHTML = `
    <article class="compare-card">
      <button class="image-button" data-zoom="${currentWinner.url}">
        <img src="${currentWinner.url}" alt="${currentWinner.original_name}" />
      </button>
      <div class="compare-meta">
        <strong>${currentWinner.original_name}</strong>
        <span>当前保留 · ${scoreLine(currentWinner)}</span>
      </div>
      <button class="choose-button" data-choose="left">留下左边</button>
    </article>
    <article class="compare-card">
      <button class="image-button" data-zoom="${challenger.url}">
        <img src="${challenger.url}" alt="${challenger.original_name}" />
      </button>
      <div class="compare-meta">
        <strong>${challenger.original_name}</strong>
        <span>待比较 · ${scoreLine(challenger)}</span>
      </div>
      <button class="choose-button" data-choose="right">留下右边</button>
    </article>
  `;
}

function moveToNextPair() {
  currentGroupQueue.shift();
  if (currentGroupQueue.length === 0) {
    finishCurrentGroup();
    return;
  }
  renderComparePair();
}

function chooseFromCurrentPair(choice) {
  const challenger = getCurrentChallenger();
  if (!currentWinner || !challenger) {
    return;
  }

  if (choice === "left") {
    moveToNextPair();
    return;
  }

  if (choice === "right") {
    currentWinner = challenger;
    moveToNextPair();
    return;
  }

  if (choice === "both") {
    lockedSelected.set(currentWinner.filename, currentWinner);
    lockedSelected.set(challenger.filename, challenger);
    finalSelected.set(currentWinner.filename, currentWinner);
    finalSelected.set(challenger.filename, challenger);
    moveToNextPair();
  }
}

function renderFinalGrid() {
  const finalPhotos = Array.from(finalSelected.values());
  finalHint.textContent = `${finalPhotos.length} 张`;
  saveButton.disabled = finalPhotos.length === 0;

  if (finalPhotos.length === 0) {
    finalGrid.innerHTML = '<p class="empty-text">你在二次预选中留下的照片会出现在这里。</p>';
    return;
  }

  finalGrid.innerHTML = finalPhotos
    .map((photo) => {
      const localPhoto = findLocalPhotoByName(photo.original_name);
      const imageUrl = localPhoto ? localPhoto.url : "";
      return `
        <article class="photo-card final-card">
          <button class="delete-photo-button" data-delete-final="${photo.filename}" aria-label="删除 ${photo.original_name}">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 3h6l1 2h4v2H4V5h4l1-2Z"></path>
              <path d="M6 9h12l-1 11H7L6 9Zm4 2v7h2v-7h-2Zm4 0v7h2v-7h-2Z"></path>
            </svg>
          </button>
          <button class="image-button" data-zoom="${imageUrl}">
            <img src="${imageUrl}" alt="${photo.original_name}" />
          </button>
          <span title="${photo.original_name}">${photo.original_name}</span>
        </article>
      `;
    })
    .join("");
}

function openLightbox(imageUrl) {
  if (!imageUrl) {
    return;
  }
  lightboxImage.src = imageUrl;
  lightbox.hidden = false;
}

function closeLightbox() {
  lightbox.hidden = true;
  lightboxImage.src = "";
}

function deleteFinalPhoto(filename) {
  finalSelected.delete(filename);
  lockedSelected.delete(filename);
  renderFinalGrid();
  saveHint.textContent = "";
}

async function checkBackend() {
  try {
    const response = await fetch(`${API_URL}/openapi.json`);
    if (!response.ok) {
      throw new Error("backend unavailable");
    }
    setStatus("后端已连接", "ok");
  } catch (error) {
    setStatus("后端未连接", "bad");
  }
}

async function analyzePhotos() {
  if (selectedPhotos.length === 0) {
    return;
  }

  analyzeButton.disabled = true;
  analyzeButton.textContent = "分析中...";
  resultHint.textContent = "正在分析";

  const formData = new FormData();
  selectedPhotos.forEach((photo) => {
    formData.append("files", photo.file);
  });

  try {
    const response = await fetch(`${API_URL}/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("upload failed");
    }

    const data = await response.json();
    renderRanking(data);
    setStatus("分析完成", "ok");
  } catch (error) {
    setStatus("分析失败", "bad");
    resultHint.textContent = "分析失败";
    rankingList.innerHTML =
      '<p class="empty-text">没有连接到后端服务。请确认黑色终端窗口还开着，并显示 127.0.0.1:8000。</p>';
  } finally {
    analyzeButton.disabled = selectedPhotos.length === 0;
    analyzeButton.textContent = "开始分析";
  }
}

async function startSecondSelection() {
  if (recommendedPhotos.length < 2) {
    compareHint.textContent = "推荐照片太少，无需二次预选";
    return;
  }

  startCompareButton.disabled = true;
  compareHint.textContent = "正在寻找相似照片";
  compareStage.innerHTML = '<p class="empty-text">正在对推荐照片进行相似度分析...</p>';

  try {
    similarGroups = await buildSimilarGroups();
    currentGroupIndex = 0;

    if (similarGroups.length === 0) {
      compareHint.textContent = "没有找到明显相似照片";
      compareStage.innerHTML = '<p class="empty-text">这一组推荐照片差异比较明显，已全部放入最终预选框。</p>';
      return;
    }

    startGroup(0);
  } catch (error) {
    compareHint.textContent = "相似度分析失败";
    compareStage.innerHTML = '<p class="empty-text">二次预选暂时无法开始，请重新选择照片再试。</p>';
  } finally {
    startCompareButton.disabled = false;
  }
}

async function cloudReviewRecommendedPhotos() {
  if (recommendedPhotos.length === 0) {
    return;
  }

  cloudReviewButton.disabled = true;
  cloudReviewHint.textContent = `正在云端复评 ${recommendedPhotos.length} 张...`;

  try {
    const response = await fetch(`${API_URL}/cloud-review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ filenames: recommendedPhotos.map((photo) => photo.filename) }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || "cloud review failed");
    }

    const reviewMap = new Map(data.reviews.map((review) => [review.filename, review]));
    recommendedPhotos = recommendedPhotos.map((photo) => {
      const review = reviewMap.get(photo.filename);
      if (!review || review.error) {
        return photo;
      }
      return {
        ...photo,
        cloud_score: review.cloud_score,
        cloud_keep: review.keep,
        cloud_composition: review.composition,
        cloud_lighting: review.lighting,
        cloud_pose: review.pose,
        cloud_expression: review.expression,
        cloud_focus: review.focus,
        cloud_reason: review.reason,
        cloud_problem: review.problem,
      };
    });

    similarGroups = [];
    currentGroupIndex = 0;
    currentGroupQueue = [];
    currentWinner = null;
    cloudReviewHint.textContent = `云端复评完成：${data.count} 张`;
    resultHint.textContent = "已按云端分数重新排序";
    rerenderReviewedRanking();
  } catch (error) {
    cloudReviewHint.textContent = error.message || "云端复评失败，请确认 API Key 和网络。";
  } finally {
    cloudReviewButton.disabled = false;
  }
}

async function saveFinalSelection() {
  const finalPhotos = Array.from(finalSelected.values());
  if (finalPhotos.length === 0) {
    return;
  }

  if (!window.showDirectoryPicker) {
    saveHint.textContent = "当前浏览器不支持选择文件夹，请用 Chrome 或 Edge 打开本页面。";
    return;
  }

  saveButton.disabled = true;
  saveHint.textContent = "请选择保存文件夹...";

  try {
    const directory = await window.showDirectoryPicker({ mode: "readwrite" });
    let savedCount = 0;

    for (const photo of finalPhotos) {
      const localPhoto = findLocalPhotoByName(photo.original_name);
      if (!localPhoto) {
        continue;
      }

      const fileHandle = await directory.getFileHandle(localPhoto.file.name, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(localPhoto.file);
      await writable.close();
      savedCount += 1;
    }

    saveHint.textContent = `已保存 ${savedCount} 张到你选择的文件夹`;
  } catch (error) {
    if (error.name === "AbortError") {
      saveHint.textContent = "已取消保存";
    } else {
      saveHint.textContent = "保存失败，请重新选择文件夹再试。";
    }
  } finally {
    saveButton.disabled = finalPhotos.length === 0;
  }
}

photoInput.addEventListener("change", (event) => {
  setPhotos(event.target.files);
});

dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropzone.classList.add("dragging");
});

dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("dragging");
});

dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropzone.classList.remove("dragging");
  setPhotos(event.dataTransfer.files);
});

analyzeButton.addEventListener("click", analyzePhotos);
cloudReviewButton.addEventListener("click", cloudReviewRecommendedPhotos);

clearButton.addEventListener("click", () => {
  photoInput.value = "";
  setPhotos([]);
});

startCompareButton.addEventListener("click", startSecondSelection);
keepBothButton.addEventListener("click", () => chooseFromCurrentPair("both"));
skipPairButton.addEventListener("click", moveToNextPair);
saveButton.addEventListener("click", saveFinalSelection);
lightboxClose.addEventListener("click", closeLightbox);
lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) {
    closeLightbox();
  }
});

document.addEventListener("click", (event) => {
  const zoomButton = event.target.closest("[data-zoom]");
  if (zoomButton) {
    openLightbox(zoomButton.dataset.zoom);
    return;
  }

  const deleteButton = event.target.closest("[data-delete-final]");
  if (deleteButton) {
    deleteFinalPhoto(deleteButton.dataset.deleteFinal);
    return;
  }

  const chooseButton = event.target.closest("[data-choose]");
  if (chooseButton) {
    chooseFromCurrentPair(chooseButton.dataset.choose);
  }
});

checkBackend();
