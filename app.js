const defaultItems = [
  { rank: 1, title: "Rank 1", duration: "10.0s", file: "", playOrder: 1, videoKey: "" },
  { rank: 2, title: "Rank 2", duration: "10.0s", file: "", playOrder: 2, videoKey: "" },
  { rank: 3, title: "Rank 3", duration: "10.0s", file: "", playOrder: 3, videoKey: "" },
  { rank: 4, title: "Rank 4", duration: "10.0s", file: "", playOrder: 4, videoKey: "" },
  { rank: 5, title: "Rank 5", duration: "10.0s", file: "", playOrder: 5, videoKey: "" }
];

const DB_NAME = "shortsmaker-local-db";
const DB_VERSION = 1;
const DB_STORE = "rankingVideos";

const rankingListEl = document.getElementById("rankingItemList");
const previewListEl = document.getElementById("previewRankingList");
const backToCreateBtnEl = document.getElementById("back-to-create-btn");
const titleLine1InputEl = document.getElementById("title-line-1-input");
const titleLine2InputEl = document.getElementById("title-line-2-input");
const titleXOffsetEl = document.getElementById("title-x-offset");
const titleYOffsetEl = document.getElementById("title-y-offset");
const titleLine1FontSizeEl = document.getElementById("title-line1-font-size");
const titleLine2FontSizeEl = document.getElementById("title-line2-font-size");
const titleFontWeightEl = document.getElementById("title-font-weight");
const titleLine1ColorEl = document.getElementById("title-line1-color");
const titleLine2ColorEl = document.getElementById("title-line2-color");
const previewTitleLine1El = document.querySelector(".preview-title-line1");
const previewTitleLine2El = document.querySelector(".preview-title-line2");
const previewTitleWrapEl = document.querySelector(".preview-title-wrap");
const previewVideoAreaEl = document.querySelector(".preview-video-area");
const navMainWorkLinkEl = document.getElementById("nav-main-work-link");
const navDashboardBrandEl = document.getElementById("nav-dashboard-brand");
const navDashboardLinkEl = document.getElementById("nav-dashboard-link");
const previewVideoEl = document.getElementById("preview-video-player");
const previewVideoEmptyEl = document.getElementById("preview-video-empty");
const previewSubtitleEl = document.getElementById("preview-subtitle");
const itemCountEl = document.getElementById("ranking-item-count");
const timelineAddBtnEl = document.getElementById("timeline-add-btn");
const timelineTrackEl = document.getElementById("timeline-track");
const timelineCaptionRowEl = document.getElementById("timeline-caption-row");
const subtitlePositionSelectEl = document.getElementById("subtitle-position-select");
const generateVideoBtnEl = document.getElementById("generate-video-btn");
const subtitleStylePositionEl = document.getElementById("subtitle-style-position");
const subtitleYOffsetEl = document.getElementById("subtitle-y-offset");
const subtitleFontSizeEl = document.getElementById("subtitle-font-size");
const subtitleFontWeightEl = document.getElementById("subtitle-font-weight");
const subtitleTextColorEl = document.getElementById("subtitle-text-color");
const subtitleBgColorEl = document.getElementById("subtitle-bg-color");
const subtitleBgOpacityEl = document.getElementById("subtitle-bg-opacity");
const subtitleShadowEnabledEl = document.getElementById("subtitle-shadow-enabled");
const rankingListXOffsetEl = document.getElementById("ranking-list-x-offset");
const rankingListYOffsetEl = document.getElementById("ranking-list-y-offset");
const rankingListFontSizeEl = document.getElementById("ranking-list-font-size");
const rankingListFontWeightEl = document.getElementById("ranking-list-font-weight");
const rankingListColorEl = document.getElementById("ranking-list-color");
const rankingListActiveColorEl = document.getElementById("ranking-list-active-color");
const layoutTopPaddingEl = document.getElementById("layout-top-padding");
const videoScaleEl = document.getElementById("video-scale");
const videoYOffsetEl = document.getElementById("video-y-offset");
const layoutTopPaddingValueEl = document.getElementById("layout-top-padding-value");
const videoScaleValueEl = document.getElementById("video-scale-value");
const videoYOffsetValueEl = document.getElementById("video-y-offset-value");
const bgmVolumeEl = document.getElementById("bgm-volume");
const transitionBlackEnabledEl = document.getElementById("transition-black-enabled");
const backgroundColorEl = document.getElementById("background-color");

let currentVideoObjectUrl = null;
let isGeneratingVideo = false;
const defaultSubtitleStyle = {
  position: "bottom",
  yOffset: 0,
  fontSize: 26,
  fontWeight: 800,
  textColor: "#ffffff",
  backgroundColor: "#000000",
  backgroundOpacity: 0,
  shadowEnabled: true
};
const defaultTitleStyle = {
  xOffset: 0,
  yOffset: 0,
  line1FontSize: 24,
  line2FontSize: 32,
  fontWeight: 900,
  line1Color: "#ff2727",
  line2Color: "#efefef"
};
const defaultRankingListStyle = {
  xOffset: 0,
  yOffset: 0,
  fontSize: 16,
  fontWeight: 900,
  color: "#ffffff",
  activeColor: "#ff2de1"
};
const defaultLayoutStyle = {
  topPadding: 0,
  videoScale: 1,
  videoYOffset: 0
};
const defaultSceneStyle = {
  backgroundColor: "#000000",
  transitionBlackEnabled: false,
  bgmVolume: 30
};

function getSiblingFileUrl(fileName) {
  const path = window.location.pathname.replace(/\\/g, "/");
  const baseDir = path.slice(0, path.lastIndexOf("/") + 1);
  return `file://${baseDir}${fileName}`;
}

function openVideoDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readVideoBlob(videoKey) {
  if (!videoKey) return null;
  try {
    const db = await openVideoDb();
    const row = await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const store = tx.objectStore(DB_STORE);
      const req = store.get(videoKey);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return row?.blob || null;
  } catch {
    return null;
  }
}

function loadDraftData() {
  try {
    const raw = localStorage.getItem("rankingDraft");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.rankingItems)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function buildItemsFromDraft(draft) {
  const requestedCount = Number(draft.rankingCount || 0);
  const safeCount = Number.isFinite(requestedCount) && requestedCount > 0
    ? requestedCount
    : draft.rankingItems.length;

  return draft.rankingItems.slice(0, safeCount).map((item, idx) => ({
    rank: idx + 1,
    title: (item.title || `Rank ${idx + 1}`).trim(),
    duration: `${Number(item.duration || 10).toFixed(1)}s`,
    file: item.fileName || "",
    playOrder: item.playOrder || idx + 1,
    videoKey: item.videoKey || (draft.draftId ? `${draft.draftId}_${idx + 1}` : "")
  }));
}

function saveDraftItems(items) {
  try {
    const raw = localStorage.getItem("rankingDraft");
    const parsed = raw ? JSON.parse(raw) : {};
    parsed.rankingCount = items.length;
    parsed.rankingItems = items.map((x, idx) => ({
      rank: idx + 1,
      title: x.title,
      duration: Number(String(x.duration).replace("s", "")) || 10,
      playOrder: x.playOrder || idx + 1,
      fileName: x.file || "",
      videoKey: x.videoKey || ""
    }));
    localStorage.setItem("rankingDraft", JSON.stringify(parsed));
  } catch {
    // ignore
  }
}

const draft = loadDraftData();
const items = draft ? buildItemsFromDraft(draft) : defaultItems;
let selectedRank = items[0]?.rank || 1;
let subtitlePosition = draft?.subtitlePosition || draft?.subtitleStyle?.position || "bottom";
let subtitles = Array.isArray(draft?.subtitles) ? draft.subtitles : [];
let subtitleStyle = {
  ...defaultSubtitleStyle,
  ...(draft?.subtitleStyle || {}),
  position: draft?.subtitleStyle?.position || subtitlePosition
};
let titleStyle = {
  ...defaultTitleStyle,
  ...(draft?.titleStyle || {})
};
let rankingListStyle = {
  ...defaultRankingListStyle,
  ...(draft?.rankingListStyle || {})
};
let layoutStyle = {
  ...defaultLayoutStyle,
  ...(draft?.layoutStyle || {})
};
let sceneStyle = {
  ...defaultSceneStyle,
  ...(draft?.sceneStyle || {})
};

function saveSubtitleDraft() {
  try {
    const raw = localStorage.getItem("rankingDraft");
    const parsed = raw ? JSON.parse(raw) : {};
    parsed.subtitlePosition = subtitlePosition;
    parsed.subtitleStyle = subtitleStyle;
    parsed.titleStyle = titleStyle;
    parsed.rankingListStyle = rankingListStyle;
    parsed.layoutStyle = layoutStyle;
    parsed.sceneStyle = sceneStyle;
    parsed.subtitles = subtitles;
    localStorage.setItem("rankingDraft", JSON.stringify(parsed));
  } catch {
    // ignore
  }
}

function hexToRgba(hex, alpha) {
  const safeHex = String(hex || "#000000").replace("#", "");
  const normalized = safeHex.length === 3
    ? safeHex.split("").map((x) => x + x).join("")
    : safeHex.padEnd(6, "0").slice(0, 6);
  const intVal = Number.parseInt(normalized, 16);
  const r = (intVal >> 16) & 255;
  const g = (intVal >> 8) & 255;
  const b = intVal & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function applySubtitlePosition() {
  if (!previewSubtitleEl) return;
  previewSubtitleEl.classList.remove("pos-top", "pos-middle");
  if (subtitlePosition === "top") previewSubtitleEl.classList.add("pos-top");
  if (subtitlePosition === "middle") previewSubtitleEl.classList.add("pos-middle");
}

function applySubtitleStyles() {
  if (!previewSubtitleEl) return;

  previewSubtitleEl.style.fontSize = `${subtitleStyle.fontSize}px`;
  previewSubtitleEl.style.fontWeight = String(subtitleStyle.fontWeight);
  previewSubtitleEl.style.color = subtitleStyle.textColor;
  previewSubtitleEl.style.backgroundColor = hexToRgba(
    subtitleStyle.backgroundColor,
    Math.max(0, Math.min(1, Number(subtitleStyle.backgroundOpacity) / 100))
  );
  previewSubtitleEl.style.textShadow = subtitleStyle.shadowEnabled
    ? "0 3px 12px rgba(0, 0, 0, 0.95)"
    : "none";

  if (subtitlePosition === "middle") {
    previewSubtitleEl.style.transform = `translate(-50%, calc(-50% + ${subtitleStyle.yOffset}px))`;
  } else {
    previewSubtitleEl.style.transform = "translateX(-50%)";
    previewSubtitleEl.style.marginTop = "0";
    previewSubtitleEl.style.marginBottom = "0";
    if (subtitlePosition === "top") {
      previewSubtitleEl.style.top = `${24 + subtitleStyle.yOffset}px`;
      previewSubtitleEl.style.bottom = "auto";
    } else {
      previewSubtitleEl.style.bottom = `${34 + subtitleStyle.yOffset}px`;
      previewSubtitleEl.style.top = "auto";
    }
  }
}

function applyTitleStyles() {
  if (!previewTitleWrapEl || !previewTitleLine1El || !previewTitleLine2El) return;

  previewTitleWrapEl.style.transform = `translate(${titleStyle.xOffset}px, ${titleStyle.yOffset}px)`;
  previewTitleLine1El.style.fontSize = `${titleStyle.line1FontSize}px`;
  previewTitleLine2El.style.fontSize = `${titleStyle.line2FontSize}px`;
  previewTitleLine1El.style.fontWeight = String(titleStyle.fontWeight);
  previewTitleLine2El.style.fontWeight = String(titleStyle.fontWeight);
  previewTitleLine1El.style.color = titleStyle.line1Color;
  previewTitleLine2El.style.color = titleStyle.line2Color;
}

function applyRankingListStyles() {
  if (!previewListEl) return;

  previewListEl.style.transform = `translate(${rankingListStyle.xOffset}px, ${rankingListStyle.yOffset}px)`;
  previewListEl.querySelectorAll(".preview-rank-line").forEach((lineEl) => {
    lineEl.style.fontSize = `${rankingListStyle.fontSize}px`;
    lineEl.style.fontWeight = String(rankingListStyle.fontWeight);
    lineEl.style.color = lineEl.classList.contains("active")
      ? rankingListStyle.activeColor
      : rankingListStyle.color;
  });
}

function applyLayoutStyles() {
  if (previewTitleWrapEl) {
    previewTitleWrapEl.style.paddingTop = `${24 + Number(layoutStyle.topPadding || 0)}px`;
  }

  if (previewVideoEl) {
    previewVideoEl.style.transform = `scale(${Number(layoutStyle.videoScale || 1)})`;
    previewVideoEl.style.transformOrigin = "center center";
    previewVideoEl.style.objectPosition = `center calc(50% + ${Number(layoutStyle.videoYOffset || 0)}px)`;
  }

  if (layoutTopPaddingValueEl) {
    layoutTopPaddingValueEl.textContent = String(Number(layoutStyle.topPadding || 0));
  }

  if (videoScaleValueEl) {
    videoScaleValueEl.textContent = `${Math.round(Number(layoutStyle.videoScale || 1) * 100)}%`;
  }

  if (videoYOffsetValueEl) {
    videoYOffsetValueEl.textContent = String(Number(layoutStyle.videoYOffset || 0));
  }
}

function applySceneStyles() {
  if (previewTitleWrapEl) {
    previewTitleWrapEl.style.backgroundColor = sceneStyle.backgroundColor;
  }

  if (previewVideoAreaEl) {
    previewVideoAreaEl.style.background = sceneStyle.backgroundColor;
  }
}

function getSelectedItemDuration() {
  const item = items.find((x) => x.rank === selectedRank);
  const parsed = Number.parseFloat(String(item?.duration || "0").replace("s", ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}

function getItemDurationValue(item) {
  const parsed = Number.parseFloat(String(item?.duration || "0").replace("s", ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}

function getOrderedItems() {
  return [...items].sort((a, b) => Number(a.playOrder || a.rank) - Number(b.playOrder || b.rank));
}

function moveItemPlayOrder(rank, direction) {
  const ordered = getOrderedItems();
  const currentIndex = ordered.findIndex((item) => Number(item.rank) === Number(rank));
  if (currentIndex < 0) return false;

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= ordered.length) return false;

  const currentItem = ordered[currentIndex];
  const targetItem = ordered[targetIndex];
  const currentOrder = Number(currentItem.playOrder || currentItem.rank);
  const targetOrder = Number(targetItem.playOrder || targetItem.rank);

  currentItem.playOrder = targetOrder;
  targetItem.playOrder = currentOrder;
  saveDraftItems(items);
  return true;
}

function getSubtitlesForSelectedRank() {
  return subtitles
    .filter((s) => Number(s.rank) === selectedRank)
    .sort((a, b) => a.start - b.start);
}

function getSubtitlesForRank(rank) {
  return subtitles
    .filter((s) => Number(s.rank) === Number(rank))
    .sort((a, b) => a.start - b.start);
}

function getActiveSubtitleForRank(rank, timeSec) {
  const clipTime = Number(timeSec) || 0;
  return getSubtitlesForRank(rank).find((s) => {
    const start = Number(s.start) || 0;
    const end = Number(s.end) || 0;
    return clipTime >= (start - 0.15) && clipTime <= (end + 0.15);
  }) || null;
}

function getActiveSubtitleFromList(subtitleList, timeSec) {
  const clipTime = Number(timeSec) || 0;
  return (subtitleList || []).find((s) => {
    const start = Number(s.start) || 0;
    const end = Number(s.end) || 0;
    return clipTime >= (start - 0.15) && clipTime <= (end + 0.15);
  }) || null;
}

function renderSubtitleTimeline() {
  if (!timelineCaptionRowEl || !timelineTrackEl) return;

  const selectedSubtitles = getSubtitlesForSelectedRank();
  const duration = getSelectedItemDuration();

  timelineTrackEl.innerHTML = "";
  selectedSubtitles.forEach((s) => {
    const left = Math.max(0, Math.min(100, (s.start / duration) * 100));
    const width = Math.max(2, Math.min(100 - left, ((s.end - s.start) / duration) * 100));
    const seg = document.createElement("div");
    seg.className = "timeline-segment";
    seg.dataset.id = String(s.id);
    seg.style.left = `${left}%`;
    seg.style.width = `${width}%`;
    seg.title = `${s.text} (${s.start.toFixed(1)}s-${s.end.toFixed(1)}s)`;
    seg.innerHTML = `
      <span class="resize-handle left" data-id="${s.id}" data-side="left"></span>
      <span class="resize-handle right" data-id="${s.id}" data-side="right"></span>
    `;
    timelineTrackEl.appendChild(seg);
  });

  timelineCaptionRowEl.innerHTML = "";
  if (selectedSubtitles.length === 0) {
    const empty = document.createElement("span");
    empty.className = "timeline-chip";
    empty.textContent = "자막 없음";
    timelineCaptionRowEl.appendChild(empty);
    return;
  }

  selectedSubtitles.forEach((s) => {
    const chip = document.createElement("span");
    chip.className = "timeline-chip";
    chip.innerHTML = `<span>${s.text}</span><button type="button" data-id="${s.id}">×</button>`;
    timelineCaptionRowEl.appendChild(chip);
  });

  timelineCaptionRowEl.querySelectorAll("button[data-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      subtitles = subtitles.filter((s) => String(s.id) !== String(id));
      saveSubtitleDraft();
      renderSubtitleTimeline();
      updateActiveSubtitle();
    });
  });

  bindSubtitleResizeHandlers(duration);
}

function bindSubtitleResizeHandlers(duration) {
  if (!timelineTrackEl) return;

  const handles = timelineTrackEl.querySelectorAll(".resize-handle");
  handles.forEach((handleEl) => {
    handleEl.addEventListener("mousedown", (downEvent) => {
      downEvent.preventDefault();
      downEvent.stopPropagation();

      const subtitleId = handleEl.dataset.id;
      const side = handleEl.dataset.side;
      if (!subtitleId || !side) return;

      const target = subtitles.find((s) => String(s.id) === String(subtitleId) && Number(s.rank) === selectedRank);
      if (!target) return;

      const startAtMouseDown = target.start;
      const endAtMouseDown = target.end;
      const trackRect = timelineTrackEl.getBoundingClientRect();
      const minLen = 0.2;

      const onMove = (moveEvent) => {
        const x = Math.max(0, Math.min(trackRect.width, moveEvent.clientX - trackRect.left));
        const sec = (x / trackRect.width) * duration;

        if (side === "left") {
          const nextStart = Math.min(endAtMouseDown - minLen, Math.max(0, sec));
          target.start = Number(nextStart.toFixed(2));
          target.end = Number(endAtMouseDown.toFixed(2));
        } else {
          const nextEnd = Math.max(startAtMouseDown + minLen, Math.min(duration, sec));
          target.start = Number(startAtMouseDown.toFixed(2));
          target.end = Number(nextEnd.toFixed(2));
        }

        saveSubtitleDraft();
        renderSubtitleTimeline();
        updateActiveSubtitle();
      };

      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  });
}

function updateActiveSubtitle() {
  if (!previewSubtitleEl || !previewVideoEl) return;
  const t = previewVideoEl.currentTime || 0;
  const active = getSubtitlesForSelectedRank().find((s) => t >= s.start && t <= s.end);
  previewSubtitleEl.textContent = active ? active.text : "";
}

function addSubtitleAtCurrentTime() {
  const text = prompt("자막 텍스트를 입력하세요");
  if (!text || !text.trim()) return;

  const duration = getSelectedItemDuration();
  const start = Math.max(0, Math.min(duration - 0.2, previewVideoEl?.currentTime || 0));
  const end = Math.min(duration, start + 2.5);

  subtitles.push({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    rank: selectedRank,
    text: text.trim(),
    start,
    end
  });

  saveSubtitleDraft();
  renderSubtitleTimeline();
  updateActiveSubtitle();
}

function applyDraftTitleToPreview() {
  if (!draft || !draft.titleSettings) return;
  const text1 = (draft.titleSettings.text1 || "").trim();
  const text2 = (draft.titleSettings.text2 || "").trim();
  if (previewTitleLine1El && text1) previewTitleLine1El.textContent = text1;
  if (previewTitleLine2El && text2) previewTitleLine2El.textContent = text2;
  if (titleLine1InputEl && text1) titleLine1InputEl.value = text1;
  if (titleLine2InputEl && text2) titleLine2InputEl.value = text2;
}

function saveTitleDraft(text1, text2) {
  try {
    const raw = localStorage.getItem("rankingDraft");
    const parsed = raw ? JSON.parse(raw) : {};
    parsed.titleSettings = { text1, text2 };
    localStorage.setItem("rankingDraft", JSON.stringify(parsed));
  } catch {
    // ignore
  }
}

function syncPreviewTitleFromInputs() {
  const text1 = (titleLine1InputEl?.value || "").trim();
  const text2 = (titleLine2InputEl?.value || "").trim();
  if (previewTitleLine1El) previewTitleLine1El.textContent = text1 || "Top Picks 2026";
  if (previewTitleLine2El) previewTitleLine2El.textContent = text2 || "Animal Legend TOP";
  saveTitleDraft(text1, text2);
}

function initTitleInputs() {
  if (titleLine1InputEl) {
    titleLine1InputEl.addEventListener("input", syncPreviewTitleFromInputs);
  }
  if (titleLine2InputEl) {
    titleLine2InputEl.addEventListener("input", syncPreviewTitleFromInputs);
  }
  if (titleXOffsetEl) {
    titleXOffsetEl.value = String(titleStyle.xOffset);
    titleXOffsetEl.addEventListener("input", () => {
      titleStyle.xOffset = Number(titleXOffsetEl.value);
      applyTitleStyles();
      saveSubtitleDraft();
    });
  }
  if (titleYOffsetEl) {
    titleYOffsetEl.value = String(titleStyle.yOffset);
    titleYOffsetEl.addEventListener("input", () => {
      titleStyle.yOffset = Number(titleYOffsetEl.value);
      applyTitleStyles();
      saveSubtitleDraft();
    });
  }
  if (titleLine1FontSizeEl) {
    titleLine1FontSizeEl.value = String(titleStyle.line1FontSize);
    titleLine1FontSizeEl.addEventListener("input", () => {
      titleStyle.line1FontSize = Number(titleLine1FontSizeEl.value);
      applyTitleStyles();
      saveSubtitleDraft();
    });
  }
  if (titleLine2FontSizeEl) {
    titleLine2FontSizeEl.value = String(titleStyle.line2FontSize);
    titleLine2FontSizeEl.addEventListener("input", () => {
      titleStyle.line2FontSize = Number(titleLine2FontSizeEl.value);
      applyTitleStyles();
      saveSubtitleDraft();
    });
  }
  if (titleFontWeightEl) {
    titleFontWeightEl.value = String(titleStyle.fontWeight);
    titleFontWeightEl.addEventListener("change", () => {
      titleStyle.fontWeight = Number(titleFontWeightEl.value);
      applyTitleStyles();
      saveSubtitleDraft();
    });
  }
  if (titleLine1ColorEl) {
    titleLine1ColorEl.value = titleStyle.line1Color;
    titleLine1ColorEl.addEventListener("input", () => {
      titleStyle.line1Color = titleLine1ColorEl.value;
      applyTitleStyles();
      saveSubtitleDraft();
    });
  }
  if (titleLine2ColorEl) {
    titleLine2ColorEl.value = titleStyle.line2Color;
    titleLine2ColorEl.addEventListener("input", () => {
      titleStyle.line2Color = titleLine2ColorEl.value;
      applyTitleStyles();
      saveSubtitleDraft();
    });
  }
}

function initLayoutControls() {
  if (layoutTopPaddingEl) {
    layoutTopPaddingEl.value = String(layoutStyle.topPadding);
    layoutTopPaddingEl.addEventListener("input", () => {
      layoutStyle.topPadding = Number(layoutTopPaddingEl.value);
      applyLayoutStyles();
      saveSubtitleDraft();
    });
  }

  if (videoScaleEl) {
    videoScaleEl.value = String(Math.round(Number(layoutStyle.videoScale || 1) * 100));
    videoScaleEl.addEventListener("input", () => {
      layoutStyle.videoScale = Number(videoScaleEl.value) / 100;
      applyLayoutStyles();
      saveSubtitleDraft();
    });
  }

  if (videoYOffsetEl) {
    videoYOffsetEl.value = String(Number(layoutStyle.videoYOffset || 0));
    videoYOffsetEl.addEventListener("input", () => {
      layoutStyle.videoYOffset = Number(videoYOffsetEl.value);
      applyLayoutStyles();
      saveSubtitleDraft();
    });
  }
}

function initSceneControls() {
  if (bgmVolumeEl) {
    bgmVolumeEl.value = String(Number(sceneStyle.bgmVolume || 30));
    bgmVolumeEl.addEventListener("input", () => {
      sceneStyle.bgmVolume = Number(bgmVolumeEl.value);
      saveSubtitleDraft();
    });
  }

  if (transitionBlackEnabledEl) {
    transitionBlackEnabledEl.checked = Boolean(sceneStyle.transitionBlackEnabled);
    transitionBlackEnabledEl.addEventListener("change", () => {
      sceneStyle.transitionBlackEnabled = transitionBlackEnabledEl.checked;
      saveSubtitleDraft();
    });
  }

  if (backgroundColorEl) {
    backgroundColorEl.value = sceneStyle.backgroundColor;
    backgroundColorEl.addEventListener("input", () => {
      sceneStyle.backgroundColor = backgroundColorEl.value;
      applySceneStyles();
      saveSubtitleDraft();
    });
  }
}

function initActionButtons() {
  if (window.location.protocol === "file:") {
    const dashboardUrl = getSiblingFileUrl("dashboard.html");
    const createUrl = getSiblingFileUrl("ranking-create.html");

    if (navDashboardBrandEl) navDashboardBrandEl.href = dashboardUrl;
    if (navDashboardLinkEl) navDashboardLinkEl.href = dashboardUrl;
    if (navMainWorkLinkEl) navMainWorkLinkEl.href = createUrl;
  }

  if (backToCreateBtnEl) {
    backToCreateBtnEl.addEventListener("click", () => {
      window.location.href =
        window.location.protocol === "file:"
          ? getSiblingFileUrl("ranking-create.html")
          : "./ranking-create.html";
    });
  }

  if (generateVideoBtnEl) {
    generateVideoBtnEl.addEventListener("click", generateFinalVideo);
  }
}

function initSubtitleControls() {
  if (subtitlePositionSelectEl) {
    subtitlePositionSelectEl.value = subtitlePosition;
    subtitlePositionSelectEl.addEventListener("change", () => {
      subtitlePosition = subtitlePositionSelectEl.value;
      subtitleStyle.position = subtitlePosition;
      if (subtitleStylePositionEl) subtitleStylePositionEl.value = subtitlePosition;
      applySubtitlePosition();
      applySubtitleStyles();
      saveSubtitleDraft();
    });
  }

  if (subtitleStylePositionEl) {
    subtitleStylePositionEl.value = subtitlePosition;
    subtitleStylePositionEl.addEventListener("change", () => {
      subtitlePosition = subtitleStylePositionEl.value;
      subtitleStyle.position = subtitlePosition;
      if (subtitlePositionSelectEl) subtitlePositionSelectEl.value = subtitlePosition;
      applySubtitlePosition();
      applySubtitleStyles();
      saveSubtitleDraft();
    });
  }

  if (subtitleYOffsetEl) {
    subtitleYOffsetEl.value = String(subtitleStyle.yOffset);
    subtitleYOffsetEl.addEventListener("input", () => {
      subtitleStyle.yOffset = Number(subtitleYOffsetEl.value);
      applySubtitleStyles();
      saveSubtitleDraft();
    });
  }

  if (subtitleFontSizeEl) {
    subtitleFontSizeEl.value = String(subtitleStyle.fontSize);
    subtitleFontSizeEl.addEventListener("input", () => {
      subtitleStyle.fontSize = Number(subtitleFontSizeEl.value);
      applySubtitleStyles();
      saveSubtitleDraft();
    });
  }

  if (subtitleFontWeightEl) {
    subtitleFontWeightEl.value = String(subtitleStyle.fontWeight);
    subtitleFontWeightEl.addEventListener("change", () => {
      subtitleStyle.fontWeight = Number(subtitleFontWeightEl.value);
      applySubtitleStyles();
      saveSubtitleDraft();
    });
  }

  if (subtitleTextColorEl) {
    subtitleTextColorEl.value = subtitleStyle.textColor;
    subtitleTextColorEl.addEventListener("input", () => {
      subtitleStyle.textColor = subtitleTextColorEl.value;
      applySubtitleStyles();
      saveSubtitleDraft();
    });
  }

  if (subtitleBgColorEl) {
    subtitleBgColorEl.value = subtitleStyle.backgroundColor;
    subtitleBgColorEl.addEventListener("input", () => {
      subtitleStyle.backgroundColor = subtitleBgColorEl.value;
      applySubtitleStyles();
      saveSubtitleDraft();
    });
  }

  if (subtitleBgOpacityEl) {
    subtitleBgOpacityEl.value = String(subtitleStyle.backgroundOpacity);
    subtitleBgOpacityEl.addEventListener("input", () => {
      subtitleStyle.backgroundOpacity = Number(subtitleBgOpacityEl.value);
      applySubtitleStyles();
      saveSubtitleDraft();
    });
  }

  if (subtitleShadowEnabledEl) {
    subtitleShadowEnabledEl.checked = Boolean(subtitleStyle.shadowEnabled);
    subtitleShadowEnabledEl.addEventListener("change", () => {
      subtitleStyle.shadowEnabled = subtitleShadowEnabledEl.checked;
      applySubtitleStyles();
      saveSubtitleDraft();
    });
  }

  if (timelineAddBtnEl) {
    timelineAddBtnEl.addEventListener("click", addSubtitleAtCurrentTime);
  }

  if (previewVideoEl) {
    previewVideoEl.addEventListener("timeupdate", updateActiveSubtitle);
    previewVideoEl.addEventListener("seeked", updateActiveSubtitle);
    previewVideoEl.addEventListener("loadedmetadata", updateActiveSubtitle);
  }
}

function initRankingListControls() {
  if (rankingListXOffsetEl) {
    rankingListXOffsetEl.value = String(rankingListStyle.xOffset);
    rankingListXOffsetEl.addEventListener("input", () => {
      rankingListStyle.xOffset = Number(rankingListXOffsetEl.value);
      applyRankingListStyles();
      saveSubtitleDraft();
    });
  }
  if (rankingListYOffsetEl) {
    rankingListYOffsetEl.value = String(rankingListStyle.yOffset);
    rankingListYOffsetEl.addEventListener("input", () => {
      rankingListStyle.yOffset = Number(rankingListYOffsetEl.value);
      applyRankingListStyles();
      saveSubtitleDraft();
    });
  }
  if (rankingListFontSizeEl) {
    rankingListFontSizeEl.value = String(rankingListStyle.fontSize);
    rankingListFontSizeEl.addEventListener("input", () => {
      rankingListStyle.fontSize = Number(rankingListFontSizeEl.value);
      applyRankingListStyles();
      saveSubtitleDraft();
    });
  }
  if (rankingListFontWeightEl) {
    rankingListFontWeightEl.value = String(rankingListStyle.fontWeight);
    rankingListFontWeightEl.addEventListener("change", () => {
      rankingListStyle.fontWeight = Number(rankingListFontWeightEl.value);
      applyRankingListStyles();
      saveSubtitleDraft();
    });
  }
  if (rankingListColorEl) {
    rankingListColorEl.value = rankingListStyle.color;
    rankingListColorEl.addEventListener("input", () => {
      rankingListStyle.color = rankingListColorEl.value;
      applyRankingListStyles();
      saveSubtitleDraft();
    });
  }
  if (rankingListActiveColorEl) {
    rankingListActiveColorEl.value = rankingListStyle.activeColor;
    rankingListActiveColorEl.addEventListener("input", () => {
      rankingListStyle.activeColor = rankingListActiveColorEl.value;
      applyRankingListStyles();
      saveSubtitleDraft();
    });
  }
}

function buildPlayOrderOptions(selected, count) {
  return Array.from({ length: count }, (_, i) => i + 1)
    .map((n) => `<option ${n === selected ? "selected" : ""}>Play ${n}</option>`)
    .join("");
}

async function updatePreviewVideoForSelected() {
  if (!previewVideoEl) return;

  const selectedItem = items.find((x) => x.rank === selectedRank);
  const videoKey = selectedItem?.videoKey || "";

  if (currentVideoObjectUrl) {
    URL.revokeObjectURL(currentVideoObjectUrl);
    currentVideoObjectUrl = null;
  }

  if (!videoKey) {
    previewVideoEl.removeAttribute("src");
    previewVideoEl.load();
    if (previewVideoEmptyEl) previewVideoEmptyEl.style.display = "block";
    updateActiveSubtitle();
    return;
  }

  const blob = await readVideoBlob(videoKey);
  if (!blob) {
    previewVideoEl.removeAttribute("src");
    previewVideoEl.load();
    if (previewVideoEmptyEl) previewVideoEmptyEl.style.display = "block";
    updateActiveSubtitle();
    return;
  }

  currentVideoObjectUrl = URL.createObjectURL(blob);
  previewVideoEl.src = currentVideoObjectUrl;
  if (previewVideoEmptyEl) previewVideoEmptyEl.style.display = "none";
  updateActiveSubtitle();
}

function render() {
  if (!rankingListEl || !previewListEl) return;
  const orderedItems = getOrderedItems();

  if (itemCountEl) {
    itemCountEl.textContent = `${items.length}개의 비디오 클립`;
  }

  rankingListEl.innerHTML = orderedItems
    .map((item) => {
      const selected = item.rank === selectedRank;
      const metaText = item.file ? `${item.duration} | ${item.file}` : `${item.duration}`;
      const order = Number(item.playOrder || item.rank);
      const canMoveUp = order > 1;
      const canMoveDown = order < orderedItems.length;
      return `
      <article class="rank-card ${selected ? "is-selected" : ""}" data-rank="${item.rank}">
        <div class="rank-row">
          <div class="rank-pill">#${item.rank}</div>
          <div class="rank-meta">
            <label>Play Order</label>
            <select data-rank="${item.rank}">${buildPlayOrderOptions(order, items.length)}</select>
          </div>
          <div class="rank-title-wrap">
            <h4>${item.title || `Rank ${item.rank}`}</h4>
            <p>${metaText}</p>
          </div>
          <div class="rank-actions">
            <button type="button" class="move-up" data-rank="${item.rank}" ${canMoveUp ? "" : "disabled"}>Up</button>
            <button type="button" class="move-down" data-rank="${item.rank}" ${canMoveDown ? "" : "disabled"}>Down</button>
            <button type="button" class="play" data-rank="${item.rank}">Play</button>
          </div>
        </div>
        <div class="rank-detail ${selected ? "expanded" : ""}">
          <div class="rank-field">
            <label>Title</label>
            <input class="rank-title-input" data-rank="${item.rank}" type="text" value="${item.title}" />
          </div>
          <div class="rank-field">
            <label>Description (optional)</label>
            <textarea rows="2" placeholder="Rank item description"></textarea>
          </div>
          <div class="rank-field row">
            <div>
              <label>Transition Sound</label>
              <select><option>None</option></select>
            </div>
            <div>
              <label>Mute Video</label>
              <div class="checkbox-row"><label><input type="checkbox" /> Enable</label></div>
            </div>
          </div>
        </div>
      </article>`;
    })
    .join("");

  previewListEl.innerHTML = orderedItems
    .map((item) => {
      const active = item.rank === selectedRank;
      return `<p class="preview-rank-line ${active ? "active" : ""}">${Number(item.playOrder || item.rank)}. ${item.title || `Rank ${item.rank}`}</p>`;
    })
    .join("");

  applyTitleStyles();
  applyRankingListStyles();

  rankingListEl.querySelectorAll(".rank-card").forEach((card) => {
    card.addEventListener("click", () => {
      selectedRank = Number(card.dataset.rank);
      render();
      renderSubtitleTimeline();
      updatePreviewVideoForSelected();
    });
  });

  rankingListEl.querySelectorAll(".rank-title-input").forEach((inputEl) => {
    inputEl.addEventListener("click", (e) => e.stopPropagation());
    inputEl.addEventListener("input", (e) => {
      const rank = Number(e.target.dataset.rank);
      const nextTitle = e.target.value;
      const item = items.find((x) => x.rank === rank);
      if (!item) return;
      item.title = nextTitle;

      const card = e.target.closest(".rank-card");
      const titleInCard = card?.querySelector(".rank-title-wrap h4");
      if (titleInCard) titleInCard.textContent = nextTitle || `Rank ${rank}`;

      saveDraftItems(items);
      render();
    });
  });

  rankingListEl.querySelectorAll(".rank-meta select").forEach((selectEl) => {
    selectEl.addEventListener("click", (e) => e.stopPropagation());
    selectEl.addEventListener("change", (e) => {
      const rank = Number(selectEl.dataset.rank);
      const item = items.find((x) => x.rank === rank);
      if (!item) return;
      item.playOrder = Number(e.target.value);
      saveDraftItems(items);
      render();
    });
  });

  rankingListEl.querySelectorAll(".rank-actions .move-up").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const rank = Number(btn.dataset.rank);
      if (!moveItemPlayOrder(rank, "up")) return;
      render();
    });
  });

  rankingListEl.querySelectorAll(".rank-actions .move-down").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const rank = Number(btn.dataset.rank);
      if (!moveItemPlayOrder(rank, "down")) return;
      render();
    });
  });

  rankingListEl.querySelectorAll(".rank-actions .play").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const rank = Number(btn.dataset.rank);
      selectedRank = rank;
      render();
      renderSubtitleTimeline();
      await updatePreviewVideoForSelected();
      if (previewVideoEl?.src) {
        previewVideoEl.play().catch(() => {});
      }
    });
  });
}

function getSupportedRecordingMimeType() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function downloadBlob(blob, fileName) {
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
}

function parseDownloadFileName(response, fallbackName) {
  const customHeader = response.headers.get("X-Download-Filename");
  if (customHeader) return customHeader;

  const contentDisposition = response.headers.get("Content-Disposition") || "";
  const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    return decodeURIComponent(utfMatch[1]);
  }

  const plainMatch = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
  if (plainMatch?.[1]) {
    return plainMatch[1];
  }

  return fallbackName;
}

function waitForMediaEvent(element, eventName) {
  return new Promise((resolve) => {
    const onDone = () => resolve();
    element.addEventListener(eventName, onDone, { once: true });
  });
}

function waitForAnimationFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function getExportScale(canvas) {
  return canvas.width / 540;
}

function getPreviewTitleText() {
  return {
    line1: (previewTitleLine1El?.textContent || titleLine1InputEl?.value || "").trim(),
    line2: (previewTitleLine2El?.textContent || titleLine2InputEl?.value || "").trim()
  };
}

function drawVideoCover(ctx, video, x, y, width, height, scaleMultiplier = 1, yOffset = 0) {
  if (!video || video.videoWidth <= 0 || video.videoHeight <= 0) {
    ctx.fillStyle = "#7f97ac";
    ctx.fillRect(x, y, width, height);
    return;
  }

  const baseScale = Math.max(width / video.videoWidth, height / video.videoHeight);
  const drawWidth = video.videoWidth * baseScale * scaleMultiplier;
  const drawHeight = video.videoHeight * baseScale * scaleMultiplier;
  const drawX = x + ((width - drawWidth) / 2);
  const drawY = y + ((height - drawHeight) / 2) + yOffset;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();
  ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight);
  ctx.restore();
}

function drawSubtitleOverlay(ctx, canvas, subtitleText, style, videoAreaTop, videoAreaHeight) {
  if (!subtitleText) return;

  const scale = getExportScale(canvas);

  ctx.save();
  ctx.font = `${style.fontWeight} ${Math.round(style.fontSize * scale)}px "Noto Sans KR", sans-serif`;
  const metrics = ctx.measureText(subtitleText);
  const boxWidth = Math.min(canvas.width - (48 * scale), metrics.width + (28 * scale));
  const boxHeight = (style.fontSize * scale) + (18 * scale);
  const x = (canvas.width - boxWidth) / 2;

  const videoAreaBottom = videoAreaTop + videoAreaHeight;
  let y = videoAreaBottom - (34 * scale) - boxHeight + (style.yOffset * scale);
  if (style.position === "top") {
    y = videoAreaTop + (24 * scale) + (style.yOffset * scale);
  } else if (style.position === "middle") {
    y = videoAreaTop + ((videoAreaHeight - boxHeight) / 2) + (style.yOffset * scale);
  }

  const minY = videoAreaTop + (24 * scale);
  const maxY = videoAreaBottom - boxHeight - (24 * scale);
  y = Math.max(minY, Math.min(maxY, y));

  const bgAlpha = Math.max(0, Math.min(1, Number(style.backgroundOpacity) / 100));
  if (bgAlpha > 0) {
    ctx.fillStyle = hexToRgba(style.backgroundColor, bgAlpha);
    drawRoundedRect(ctx, x, y, boxWidth, boxHeight, 10 * scale);
    ctx.fill();
  }

  ctx.fillStyle = style.textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = style.shadowEnabled ? "rgba(0, 0, 0, 0.95)" : "transparent";
  ctx.shadowBlur = style.shadowEnabled ? (10 * scale) : 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = style.shadowEnabled ? (3 * scale) : 0;
  ctx.fillText(subtitleText, canvas.width / 2, y + boxHeight / 2 + scale);
  ctx.restore();
}

function drawExportFrame(ctx, canvas, video, activeItem, clipTimeSec, clipDurationSec, activeSubtitles = []) {
  const scale = getExportScale(canvas);
  const progressAreaHeight = 40 * scale;
  const titleTopPadding = Number(layoutStyle.topPadding || 0) * scale;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = sceneStyle.backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const titleAreaHeight = (180 * scale) + titleTopPadding;
  ctx.fillStyle = sceneStyle.backgroundColor;
  ctx.fillRect(0, 0, canvas.width, titleAreaHeight);

  const previewTitle = getPreviewTitleText();
  const topLine = previewTitle.line1;
  const secondLine = previewTitle.line2;

  if (topLine) {
    ctx.save();
    ctx.fillStyle = titleStyle.line1Color;
    ctx.font = `${titleStyle.fontWeight} ${Math.round(titleStyle.line1FontSize * scale)}px "Noto Sans KR", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(topLine, canvas.width / 2 + (titleStyle.xOffset * scale), (24 * scale) + titleTopPadding + (titleStyle.yOffset * scale));
    ctx.restore();
  }

  if (secondLine) {
    ctx.save();
    ctx.fillStyle = titleStyle.line2Color;
    ctx.font = `${titleStyle.fontWeight} ${Math.round(titleStyle.line2FontSize * scale)}px "Noto Sans KR", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const secondLineY = (24 * scale) + titleTopPadding + (titleStyle.yOffset * scale) + (titleStyle.line1FontSize * 1.2 * scale) + (8 * scale);
    ctx.fillText(secondLine, canvas.width / 2 + (titleStyle.xOffset * scale), secondLineY);
    ctx.restore();
  }

  const videoAreaTop = titleAreaHeight;
  const videoAreaHeight = canvas.height - videoAreaTop - progressAreaHeight;

  drawVideoCover(
    ctx,
    video,
    0,
    videoAreaTop,
    canvas.width,
    videoAreaHeight,
    Number(layoutStyle.videoScale || 1),
    Number(layoutStyle.videoYOffset || 0) * scale
  );

  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = `${rankingListStyle.fontWeight} ${Math.round(rankingListStyle.fontSize * scale)}px "Noto Sans KR", sans-serif`;
  const listStep = (rankingListStyle.fontSize + 24) * scale;
  getOrderedItems().forEach((item, index) => {
    ctx.fillStyle = item.rank === activeItem.rank ? rankingListStyle.activeColor : rankingListStyle.color;
    ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 3 * scale;
    ctx.fillText(
      `${item.rank}. ${item.title || `Rank ${item.rank}`}`,
      (24 * scale) + (rankingListStyle.xOffset * scale),
      videoAreaTop + (100 * scale) + (rankingListStyle.yOffset * scale) + (index * listStep)
    );
  });
  ctx.restore();

  const activeSubtitle = getActiveSubtitleFromList(activeSubtitles, clipTimeSec);
  drawSubtitleOverlay(ctx, canvas, activeSubtitle?.text || "", subtitleStyle, videoAreaTop, videoAreaHeight);

  if (sceneStyle.transitionBlackEnabled) {
    const fadeWindow = Math.min(0.25, clipDurationSec / 4);
    let alpha = 0;
    if (clipTimeSec < fadeWindow) {
      alpha = 1 - (clipTimeSec / fadeWindow);
    } else if ((clipDurationSec - clipTimeSec) < fadeWindow) {
      alpha = 1 - ((clipDurationSec - clipTimeSec) / fadeWindow);
    }

    if (alpha > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.max(0, Math.min(1, alpha))})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
  }
}

async function generateFinalVideo() {
  if (isGeneratingVideo) return;

  const orderedItems = getOrderedItems().filter((item) => item.videoKey);
  if (orderedItems.length === 0) {
    alert("먼저 영상을 하나 이상 첨부해야 합니다.");
    return;
  }

  const mimeType = getSupportedRecordingMimeType();
  if (!mimeType) {
    alert("이 브라우저는 영상 내보내기를 지원하지 않습니다.");
    return;
  }

  isGeneratingVideo = true;
  if (generateVideoBtnEl) {
    generateVideoBtnEl.disabled = true;
    generateVideoBtnEl.textContent = "생성 중...";
  }

  const renderCanvas = document.createElement("canvas");
  renderCanvas.width = 1080;
  renderCanvas.height = 1920;
  const ctx = renderCanvas.getContext("2d");
  const renderVideo = document.createElement("video");
  renderVideo.playsInline = true;
  renderVideo.preload = "auto";
  renderVideo.crossOrigin = "anonymous";

  let audioContext;
  let audioDestination;
  let objectUrl = null;

  try {
    audioContext = new AudioContext();
    audioDestination = audioContext.createMediaStreamDestination();
    const sourceNode = audioContext.createMediaElementSource(renderVideo);
    sourceNode.connect(audioDestination);

    const exportFps = 24;
    const frameDurationMs = 1000 / exportFps;
    const stream = renderCanvas.captureStream(exportFps);
    audioDestination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));

    const chunks = [];
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 8000000,
      audioBitsPerSecond: 192000
    });
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    recorder.start(1000);

    for (const item of orderedItems) {
      const blob = await readVideoBlob(item.videoKey);
      if (!blob) continue;
      const itemSubtitles = getSubtitlesForRank(item.rank);

      objectUrl = URL.createObjectURL(blob);
      renderVideo.src = objectUrl;

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      if (renderVideo.readyState < 1) {
        await waitForMediaEvent(renderVideo, "loadedmetadata");
      }

      const clipDuration = Math.min(getItemDurationValue(item), renderVideo.duration || getItemDurationValue(item));
      renderVideo.currentTime = 0;
      await waitForMediaEvent(renderVideo, "seeked").catch(() => {});
      if (renderVideo.readyState < 2) {
        await waitForMediaEvent(renderVideo, "loadeddata");
      }
      await renderVideo.play();

      const startedAt = performance.now();
      let lastFrameAt = startedAt - frameDurationMs;
      while ((performance.now() - startedAt) / 1000 < clipDuration) {
        await waitForAnimationFrame();
        const now = performance.now();
        if ((now - lastFrameAt) < frameDurationMs) {
          continue;
        }
        lastFrameAt = now;
        const elapsedSec = Math.min(clipDuration, (now - startedAt) / 1000);
        const clipTimeSec = Math.min(
          clipDuration,
          Math.max(elapsedSec, renderVideo.currentTime || 0)
        );
        drawExportFrame(ctx, renderCanvas, renderVideo, item, clipTimeSec, clipDuration, itemSubtitles);
      }

      drawExportFrame(ctx, renderCanvas, renderVideo, item, clipDuration, clipDuration, itemSubtitles);

      renderVideo.pause();
      renderVideo.removeAttribute("src");
      renderVideo.load();

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    }

    await new Promise((resolve) => {
      recorder.onstop = resolve;
      recorder.stop();
    });

    const outputBlob = new Blob(chunks, { type: mimeType });

    try {
      if (generateVideoBtnEl) {
        generateVideoBtnEl.textContent = "MP4 변환 중...";
      }

      const response = await fetch("/api/transcode-webm", {
        method: "POST",
        headers: {
          "Content-Type": outputBlob.type || "video/webm"
        },
        body: outputBlob
      });

      if (!response.ok) {
        throw new Error(`transcode failed: ${response.status}`);
      }

      const fallbackName = `shortsmaker-export-${Date.now()}.mp4`;
      const fileName = parseDownloadFileName(response, fallbackName);
      const arrayBuffer = await response.arrayBuffer();
      const mp4Blob = new Blob([arrayBuffer], { type: "video/mp4" });
      downloadBlob(mp4Blob, fileName);
    } catch (error) {
      console.error("Failed to convert webm to mp4:", error);
      alert("MP4 변환 서버에 연결하지 못했습니다. start-server.bat를 먼저 실행해야 합니다. 이번에는 WEBM으로 저장합니다.");
      downloadBlob(outputBlob, `shortsmaker-export-${Date.now()}.webm`);
    }
  } catch (error) {
    console.error("Failed to generate video:", error);
    alert("영상 생성 중 오류가 발생했습니다.");
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
    renderVideo.pause();
    renderVideo.removeAttribute("src");
    renderVideo.load();
    if (audioContext) {
      audioContext.close().catch(() => {});
    }
    isGeneratingVideo = false;
    if (generateVideoBtnEl) {
      generateVideoBtnEl.disabled = false;
      generateVideoBtnEl.textContent = "영상 생성";
    }
  }
}

function initCollapsible() {
  document.querySelectorAll(".collapsible-header").forEach((header) => {
    header.addEventListener("click", () => {
      const section = header.closest(".collapsible-section");
      const content = section.querySelector(".collapsible-content");
      const arrow = section.querySelector(".collapsible-arrow");
      section.classList.toggle("expanded");
      content.classList.toggle("expanded");
      arrow.classList.toggle("expanded");
    });
  });
}

applyDraftTitleToPreview();
initTitleInputs();
initLayoutControls();
initSceneControls();
initActionButtons();
initSubtitleControls();
initRankingListControls();
applySubtitlePosition();
applySubtitleStyles();
applyTitleStyles();
applyLayoutStyles();
applySceneStyles();
syncPreviewTitleFromInputs();
render();
renderSubtitleTimeline();
updatePreviewVideoForSelected();
initCollapsible();
