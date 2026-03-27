function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getBadgeLabel(status) {
  if (status === "answered") return "답변완료";
  if (status === "closed") return "종료";
  return "접수";
}

function getBadgeClass(status) {
  if (status === "answered") return "support-badge support-badge-answered";
  if (status === "closed") return "support-badge support-badge-closed";
  return "support-badge support-badge-open";
}

function renderInquiryCard(inquiry, { admin = false } = {}) {
  const adminMemo = inquiry.adminMemo ? `
    <div class="support-item-memo-wrap">
      <div class="support-item-memo-title">관리자 메모</div>
      <div class="support-item-memo">${escapeHtml(inquiry.adminMemo)}</div>
    </div>
  ` : "";

  const adminTools = admin ? `
    <div class="support-admin-tools">
      <select class="support-select" data-role="status">
        <option value="open" ${inquiry.status === "open" ? "selected" : ""}>접수</option>
        <option value="answered" ${inquiry.status === "answered" ? "selected" : ""}>답변완료</option>
        <option value="closed" ${inquiry.status === "closed" ? "selected" : ""}>종료</option>
      </select>
      <textarea class="support-textarea" data-role="memo" rows="4" placeholder="내부 처리 메모">${escapeHtml(inquiry.adminMemo || "")}</textarea>
      <button class="support-save" data-role="save">저장</button>
    </div>
  ` : "";

  const wrapper = document.createElement("article");
  wrapper.className = "support-item";
  wrapper.innerHTML = `
    <div class="support-item-top">
      <div>
        <h3 class="support-item-title">${escapeHtml(inquiry.subject)}</h3>
        <div class="support-item-meta">
          ${admin ? `${escapeHtml(inquiry.displayName || "User")} · ${escapeHtml(inquiry.email || "")} · ` : ""}${formatDateTime(inquiry.createdAt)}
        </div>
      </div>
      <span class="${getBadgeClass(inquiry.status)}">${getBadgeLabel(inquiry.status)}</span>
    </div>
    <div class="support-item-message">${escapeHtml(inquiry.message)}</div>
    ${adminMemo}
    ${adminTools}
  `;

  return wrapper;
}

async function fetchUserInfo() {
  const res = await fetch("/api/user/info");
  if (res.status === 401) {
    window.location.href = `/login.html?next=${encodeURIComponent("/support.html")}`;
    return null;
  }
  if (!res.ok) return null;
  const info = await res.json();
  const userNameTop = document.getElementById("user-name-top");
  if (userNameTop) userNameTop.textContent = info.displayName || "User";
  const navAdmin = document.getElementById("nav-admin");
  if (navAdmin && info.isAdmin) navAdmin.style.display = "inline-flex";
  const adminSection = document.getElementById("admin-inquiry-section");
  if (adminSection && info.isAdmin) adminSection.style.display = "block";
  return info;
}

async function loadMyInquiries() {
  const container = document.getElementById("my-inquiries");
  if (!container) return;
  const res = await fetch("/api/support/inquiries");
  if (res.status === 404) {
    container.innerHTML = `<p class="support-empty">고객센터 API가 아직 서버에 반영되지 않았습니다. 서버를 다시 실행해주세요.</p>`;
    return;
  }
  if (!res.ok) {
    container.innerHTML = `<p class="support-empty">문의 내역을 불러오지 못했습니다.</p>`;
    return;
  }
  const data = await res.json();
  const items = Array.isArray(data.inquiries) ? data.inquiries : [];
  container.innerHTML = "";
  if (!items.length) {
    container.innerHTML = `<p class="support-empty">아직 접수된 문의가 없습니다.</p>`;
    return;
  }
  items.forEach((inquiry) => container.appendChild(renderInquiryCard(inquiry)));
}

async function loadAdminInquiries() {
  const container = document.getElementById("admin-inquiries");
  if (!container || getComputedStyle(container.parentElement).display === "none") return;
  const res = await fetch("/api/admin/inquiries");
  if (!res.ok) {
    container.innerHTML = `<p class="support-empty">전체 문의를 불러오지 못했습니다.</p>`;
    return;
  }
  const data = await res.json();
  const items = Array.isArray(data.inquiries) ? data.inquiries : [];
  container.innerHTML = "";
  if (!items.length) {
    container.innerHTML = `<p class="support-empty">접수된 전체 문의가 없습니다.</p>`;
    return;
  }

  items.forEach((inquiry) => {
    const card = renderInquiryCard(inquiry, { admin: true });
    const saveBtn = card.querySelector('[data-role="save"]');
    const statusEl = card.querySelector('[data-role="status"]');
    const memoEl = card.querySelector('[data-role="memo"]');
    if (saveBtn && statusEl && memoEl) {
      saveBtn.addEventListener("click", async () => {
        saveBtn.disabled = true;
        try {
          const res = await fetch(`/api/admin/inquiries/${encodeURIComponent(inquiry.id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: statusEl.value, adminMemo: memoEl.value })
          });
          if (!res.ok) throw new Error("save_failed");
          await Promise.all([loadMyInquiries(), loadAdminInquiries()]);
        } catch {
          alert("문의 상태 저장에 실패했습니다.");
        } finally {
          saveBtn.disabled = false;
        }
      });
    }
    container.appendChild(card);
  });
}

function bindSupportForm() {
  const form = document.getElementById("support-form");
  const status = document.getElementById("support-status");
  const subjectInput = document.getElementById("subject-input");
  const messageInput = document.getElementById("message-input");
  const submitBtn = document.getElementById("submit-btn");
  if (!form || !status || !subjectInput || !messageInput || !submitBtn) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const subject = subjectInput.value.trim();
    const message = messageInput.value.trim();
    if (!subject || !message) {
      status.textContent = "제목과 문의 내용을 입력해주세요.";
      return;
    }
    submitBtn.disabled = true;
    status.textContent = "";
    try {
      const res = await fetch("/api/support/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message })
      });
      if (res.status === 404) {
        status.textContent = "고객센터 API가 아직 서버에 반영되지 않았습니다. 서버를 다시 실행해주세요.";
        return;
      }
      if (!res.ok) throw new Error("submit_failed");
      form.reset();
      status.textContent = "문의가 접수되었습니다.";
      await Promise.all([loadMyInquiries(), loadAdminInquiries()]);
    } catch {
      status.textContent = "문의 접수에 실패했습니다.";
    } finally {
      submitBtn.disabled = false;
    }
  });
}

function bindRefresh() {
  const btn = document.getElementById("refresh-btn");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    try {
      await Promise.all([loadMyInquiries(), loadAdminInquiries()]);
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

(async function initSupportPage() {
  const user = await fetchUserInfo();
  if (!user) return;
  bindLogout();
  bindSupportForm();
  bindRefresh();
  await Promise.all([loadMyInquiries(), loadAdminInquiries()]);
})();
