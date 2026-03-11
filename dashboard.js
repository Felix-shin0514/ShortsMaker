let currentProjectPage = 1;
const PROJECTS_PER_PAGE = 10;
let allProjectsCache = [];

function goToLocalPage(fileName) {
  const pathname = window.location.pathname.replace(/\\/g, "/");
  const baseDir = pathname.slice(0, pathname.lastIndexOf("/") + 1);
  const target =
    window.location.protocol === "file:"
      ? `file://${baseDir}${fileName}`
      : `${window.location.origin}${baseDir}${fileName}`;
  window.location.href = target;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

async function loadUserData() {
  const res = await fetch("/api/user/info");
  if (res.status === 401) {
    window.location.href = `/login.html?next=${encodeURIComponent("/dashboard.html")}`;
    return null;
  }
  if (!res.ok) return null;
  const data = await res.json();

  const displayName = data.displayName || "User";
  setText("user-name", displayName);
  setText("user-name-top", displayName);
  setText("credit-balance", (data.credits || 0).toLocaleString());
  setText("video-count", String(data.videoCount || 0));
  setText("subscription-plan", data.subscriptionPlan || "무료");
  setText("subscription-info", `${data.subscriptionPlan || "무료"} 플랜`);

  const adminLink = document.getElementById("nav-admin");
  if (adminLink) adminLink.style.display = data.isAdmin ? "" : "none";

  return data;
}

async function loadRankingProjects() {
  const res = await fetch("/api/ranking/projects?limit=100");
  if (!res.ok) return [];
  const data = await res.json();
  const projects = Array.isArray(data.projects) ? data.projects : [];
  projects.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  return projects;
}

function renderProjects(page = 1) {
  const container = document.getElementById("projects-container");
  const pagination = document.getElementById("projects-pagination");
  if (!container || !pagination) return;

  if (!allProjectsCache.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"></div>
        <p class="empty-state-text">저장된 프로젝트가 없습니다</p>
        <p class="empty-state-subtext">메인 작업에서 프로젝트를 저장해보세요.</p>
      </div>
    `;
    pagination.classList.remove("visible");
    return;
  }

  const totalPages = Math.ceil(allProjectsCache.length / PROJECTS_PER_PAGE);
  currentProjectPage = Math.max(1, Math.min(page, totalPages));

  const startIndex = (currentProjectPage - 1) * PROJECTS_PER_PAGE;
  const pageProjects = allProjectsCache.slice(startIndex, startIndex + PROJECTS_PER_PAGE);

  container.innerHTML = "";
  pageProjects.forEach((p) => container.appendChild(createProjectItem(p)));

  if (totalPages <= 1) {
    pagination.classList.remove("visible");
    return;
  }

  pagination.classList.add("visible");
  pagination.innerHTML = "";

  const prevBtn = document.createElement("button");
  prevBtn.className = "pagination-btn" + (currentProjectPage === 1 ? " disabled" : "");
  prevBtn.textContent = "이전";
  prevBtn.disabled = currentProjectPage === 1;
  prevBtn.onclick = () => renderProjects(currentProjectPage - 1);
  pagination.appendChild(prevBtn);

  const pageInfo = document.createElement("span");
  pageInfo.className = "pagination-info";
  pageInfo.textContent = `${currentProjectPage} / ${totalPages}`;
  pagination.appendChild(pageInfo);

  const nextBtn = document.createElement("button");
  nextBtn.className = "pagination-btn" + (currentProjectPage === totalPages ? " disabled" : "");
  nextBtn.textContent = "다음";
  nextBtn.disabled = currentProjectPage === totalPages;
  nextBtn.onclick = () => renderProjects(currentProjectPage + 1);
  pagination.appendChild(nextBtn);
}

function createProjectItem(project) {
  const item = document.createElement("div");
  item.className = "project-item";

  const projectTitle = project.project_name || "제목 없음";
  const updatedAt = formatDate(project.updated_at);

  item.innerHTML = `
    <div class="item-left">
      <div class="item-icon">🏁</div>
      <div class="item-info">
        <div class="item-title">${escapeHtml(projectTitle)}</div>
        <div class="item-meta">랭킹 영상 · ${updatedAt}</div>
      </div>
    </div>
    <div class="item-actions">
      <button class="item-action-btn item-continue-btn" data-action="open">계속 편집</button>
      <button class="item-action-btn item-delete-btn" data-action="delete">삭제</button>
    </div>
  `;

  item.querySelector('[data-action="open"]')?.addEventListener("click", () => {
    goToLocalPage(`ranking-create.html?projectId=${encodeURIComponent(project.id)}`);
  });

  item.querySelector('[data-action="delete"]')?.addEventListener("click", async () => {
    if (!confirm("프로젝트를 삭제할까요?")) return;
    const res = await fetch(`/api/ranking/project/${encodeURIComponent(project.id)}`, { method: "DELETE" });
    if (!res.ok) {
      alert("삭제에 실패했습니다.");
      return;
    }
    allProjectsCache = allProjectsCache.filter((p) => p.id !== project.id);
    renderProjects(currentProjectPage);
  });

  return item;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function renderEmptyVideos() {
  const container = document.getElementById("videos-container");
  const pagination = document.getElementById("videos-pagination");
  if (!container) return;
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon"></div>
      <p class="empty-state-text">아직 만든 영상이 없습니다</p>
      <p class="empty-state-subtext">랭킹 영상을 만들어보세요.</p>
    </div>
  `;
  if (pagination) pagination.classList.remove("visible");
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadUserData();

  allProjectsCache = await loadRankingProjects();
  renderProjects(1);
  renderEmptyVideos();

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) logoutBtn.addEventListener("click", () => (window.location.href = "/logout"));
});
