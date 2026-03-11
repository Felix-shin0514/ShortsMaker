let allUsers = [];

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function setStatus(text) {
  const el = document.getElementById("adminStatus");
  if (el) el.textContent = text || "";
}

async function ensureAdmin() {
  const res = await fetch("/api/user/info");
  if (res.status === 401) {
    window.location.href = `/login.html?next=${encodeURIComponent("/admin.html")}`;
    return null;
  }
  if (!res.ok) return null;
  const info = await res.json();
  if (!info.isAdmin) {
    window.location.href = "/dashboard.html";
    return null;
  }
  const nameTop = document.getElementById("admin-name-top");
  if (nameTop) nameTop.textContent = info.displayName || "Admin";
  return info;
}

async function fetchUsers() {
  const res = await fetch("/api/admin/users");
  if (!res.ok) {
    if (res.status === 403) setStatus("권한이 없습니다.");
    else setStatus("사용자 목록을 불러오지 못했습니다.");
    return [];
  }
  const data = await res.json();
  return Array.isArray(data.users) ? data.users : [];
}

function renderUsers(filterText = "") {
  const tbody = document.getElementById("usersTbody");
  if (!tbody) return;
  const q = (filterText || "").trim().toLowerCase();
  const filtered = q
    ? allUsers.filter((u) => (u.email || "").toLowerCase().includes(q) || (u.displayName || "").toLowerCase().includes(q))
    : allUsers;

  tbody.innerHTML = filtered
    .map((u) => {
      return `
        <tr data-user-id="${escapeHtml(u.id)}">
          <td>${escapeHtml(u.displayName || "User")}</td>
          <td>${escapeHtml(u.email || "")}</td>
          <td class="admin-credit" data-credit>${Number(u.credits || 0).toLocaleString()}</td>
          <td>
            <div class="credit-actions">
              <input type="number" step="1" inputmode="numeric" placeholder="예: 100" data-delta />
              <button type="button" data-action="give">지급</button>
              <button type="button" class="is-danger" data-action="take">회수</button>
              <button type="button" data-action="set">설정</button>
            </div>
          </td>
          <td>${escapeHtml(formatDate(u.createdAt))}</td>
          <td>${escapeHtml(formatDate(u.lastSeenAt))}</td>
        </tr>
      `;
    })
    .join("");

  tbody.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const tr = btn.closest("tr");
      const userId = tr?.getAttribute("data-user-id") || "";
      const input = tr?.querySelector("input[data-delta]");
      const raw = (input?.value || "").trim();
      const value = raw ? Number(raw) : 0;
      if (!Number.isFinite(value) || !Number.isInteger(value)) {
        alert("정수 크레딧만 입력해 주세요.");
        return;
      }

      const action = btn.getAttribute("data-action");
      let payload;
      if (action === "give") payload = { delta: Math.abs(value) };
      else if (action === "take") payload = { delta: -Math.abs(value) };
      else payload = { set: value };

      setStatus("처리 중...");
      try {
        const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/credits`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          setStatus("실패했습니다.");
          return;
        }

        const idx = allUsers.findIndex((u) => u.id === userId);
        if (idx >= 0) allUsers[idx].credits = data.user.credits;

        const creditEl = tr?.querySelector("[data-credit]");
        if (creditEl) creditEl.textContent = Number(data.user.credits || 0).toLocaleString();
        setStatus("완료");
      } catch (e) {
        console.error(e);
        setStatus("오류가 발생했습니다.");
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await ensureAdmin();

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) logoutBtn.addEventListener("click", () => (window.location.href = "/logout"));

  const search = document.getElementById("searchInput");
  if (search) search.addEventListener("input", () => renderUsers(search.value));

  const refresh = document.getElementById("refreshBtn");
  if (refresh) refresh.addEventListener("click", async () => {
    setStatus("불러오는 중...");
    allUsers = await fetchUsers();
    renderUsers(search?.value || "");
    setStatus(`총 ${allUsers.length.toLocaleString()}명`);
  });

  setStatus("불러오는 중...");
  allUsers = await fetchUsers();
  renderUsers("");
  setStatus(`총 ${allUsers.length.toLocaleString()}명`);
});

