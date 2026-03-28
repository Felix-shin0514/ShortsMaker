let allUsers = [];

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
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

async function readApiError(res) {
  const text = await res.text().catch(() => "");
  if (!text) return "";
  try {
    const data = JSON.parse(text);
    return data.detail || data.error || "";
  } catch {
    return text.slice(0, 200);
  }
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
    if (res.status === 403) {
      setStatus("관리자 권한이 없습니다.");
    } else {
      setStatus("사용자 목록을 불러오지 못했습니다.");
    }
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
    .map(
      (u) => `
        <tr data-user-id="${escapeHtml(u.id)}">
          <td>${escapeHtml(u.displayName || "-")}</td>
          <td>${escapeHtml(u.email || "-")}</td>
          <td>${escapeHtml(translatePlanName(u.subscriptionPlanKey || "free", "ko"))}</td>
          <td>${Number(u.credits || 0).toLocaleString("ko-KR")}</td>
          <td>
            <div class="admin-credit-actions">
              <input class="admin-credit-input" type="number" step="1" placeholder="예: 100" />
              <button class="admin-small-btn" data-action="grant">지급</button>
              <button class="admin-small-btn danger" data-action="revoke">회수</button>
            </div>
          </td>
          <td>
            <div class="admin-setting-actions">
              <button class="admin-small-btn" data-action="set">설정</button>
              <button class="admin-small-btn danger" data-action="delete">탈퇴</button>
            </div>
          </td>
          <td>${formatDate(u.createdAt)}</td>
          <td>${formatDate(u.lastSeenAt)}</td>
        </tr>
      `
    )
    .join("");
}

async function patchCredits(userId, action, amount) {
  const payload =
    action === "set"
      ? { set: amount }
      : { delta: action === "grant" ? amount : -amount };

  const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/credits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const detail = await readApiError(res);
    throw new Error(detail || "credit_update_failed");
  }
}

async function deleteUser(userId) {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: "DELETE"
  });
  if (!res.ok) {
    const detail = await readApiError(res);
    throw new Error(detail || "user_delete_failed");
  }
}

function bindTableActions() {
  const tbody = document.getElementById("usersTbody");
  if (!tbody) return;

  tbody.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const row = button.closest("tr[data-user-id]");
    if (!row) return;

    const userId = row.dataset.userId;
    const amountInput = row.querySelector(".admin-credit-input");
    const amount = Number(amountInput?.value || 0);
    const action = button.dataset.action;

    try {
      if (action === "grant" || action === "revoke" || action === "set") {
        if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount < 0 || (action !== "set" && amount <= 0)) {
          setStatus("유효한 크레딧 수치를 입력해주세요.");
          return;
        }

        button.disabled = true;
        await patchCredits(userId, action, amount);
        setStatus("크레딧 조정이 반영되었습니다.");
        allUsers = await fetchUsers();
        renderUsers(document.getElementById("searchInput")?.value || "");
        return;
      }

      if (action === "delete") {
        if (!confirm("해당 사용자를 탈퇴 처리하시겠습니까? 관련 데이터도 함께 삭제됩니다.")) return;
        button.disabled = true;
        await deleteUser(userId);
        setStatus("사용자 탈퇴가 완료되었습니다.");
        allUsers = await fetchUsers();
        renderUsers(document.getElementById("searchInput")?.value || "");
      }
    } catch (err) {
      setStatus(err.message || "작업 처리 중 오류가 발생했습니다.");
    } finally {
      button.disabled = false;
    }
  });
}

function bindSearch() {
  const input = document.getElementById("searchInput");
  if (!input) return;
  input.addEventListener("input", () => renderUsers(input.value));
}

function bindRefresh() {
  const btn = document.getElementById("refreshBtn");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    try {
      allUsers = await fetchUsers();
      renderUsers(document.getElementById("searchInput")?.value || "");
      setStatus("");
    } finally {
      btn.disabled = false;
    }
  });
}

function bindLogout() {
  const btn = document.getElementById("logout-btn");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login.html";
    }
  });
}

(async function initAdminPage() {
  const admin = await ensureAdmin();
  if (!admin) return;

  bindLogout();
  bindSearch();
  bindRefresh();
  bindTableActions();

  allUsers = await fetchUsers();
  renderUsers();
})();
