(function () {
  const statusEl = document.getElementById("pricingStatus");
  const logoutBtn = document.getElementById("logout-btn");
  const loginLink = document.getElementById("login-link");
  const userNameTop = document.getElementById("user-name-top");
  const adminLink = document.getElementById("nav-admin");
  const avgSecondsInput = document.getElementById("avgSecondsInput");
  const monthlyCountInput = document.getElementById("monthlyCountInput");
  const neededCreditsEl = document.getElementById("neededCredits");
  const recommendedPlanEl = document.getElementById("recommendedPlan");

  function getLang() {
    return typeof window.getSiteLang === "function" ? window.getSiteLang() : "ko";
  }

  function t(ko, en) {
    return getLang() === "en" ? en : ko;
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text || "";
  }

  function clampInt(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.trunc(n)));
  }

  function formatNumber(n) {
    return Number(n || 0).toLocaleString("ko-KR");
  }

  function computeCredits({ avgSeconds, monthlyCount }) {
    const creditsPerSecond = 100 / 60;
    return Math.ceil(avgSeconds * monthlyCount * creditsPerSecond);
  }

  function recommendPlan(credits) {
    if (credits <= 1000) return t("베이직", "Basic");
    if (credits <= 2000) return "Pro";
    if (credits <= 4000) return t("크리에이터", "Creator");
    return t("크리에이터", "Creator");
  }

  function updateCalculator() {
    const avgSeconds = clampInt(avgSecondsInput?.value, 1, 3600, 60);
    const monthlyCount = clampInt(monthlyCountInput?.value, 1, 100000, 10);
    if (avgSecondsInput) avgSecondsInput.value = String(avgSeconds);
    if (monthlyCountInput) monthlyCountInput.value = String(monthlyCount);

    const needed = computeCredits({ avgSeconds, monthlyCount });
    if (neededCreditsEl) neededCreditsEl.textContent = formatNumber(needed);
    if (recommendedPlanEl) recommendedPlanEl.textContent = recommendPlan(needed);
  }

  async function hydrateNav() {
    try {
      const res = await fetch("/api/user/info");
      if (res.status === 401) {
        if (loginLink) loginLink.style.display = "";
        setStatus(t("로그인 후 현재 플랜을 확인할 수 있습니다.", "Sign in to check your current plan."));
        return;
      }
      if (!res.ok) return;
      const data = await res.json();

      if (userNameTop) {
        userNameTop.style.display = "";
        userNameTop.textContent = data.displayName || "User";
      }
      if (logoutBtn) {
        logoutBtn.style.display = "";
        logoutBtn.addEventListener("click", () => (window.location.href = "/logout"));
      }
      if (adminLink) adminLink.style.display = data.isAdmin ? "" : "none";
      setStatus(`${t("현재 플랜", "Current plan")}: ${data.subscriptionPlan || t("무료", "Free")}`);
    } catch {
      // ignore
    }
  }

  document.querySelectorAll("[data-plan]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const plan = btn.getAttribute("data-plan");
      try {
        const res = await fetch("/api/user/info");
        if (res.status === 401) {
          window.location.href = `/login.html?next=${encodeURIComponent("/pricing.html")}`;
          return;
        }
      } catch {
        // ignore
      }

      try {
        const res = await fetch("/api/billing/mock/success", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planKey: plan })
        });

        const data = await res.json().catch(() => null);

        if (res.status === 403) {
          alert(t(
            "지금은 테스트 단계라 관리자 계정에서만 구독(모의 결제) 적용이 가능합니다.",
            "Mock subscription is currently available only for the admin account during testing."
          ));
          return;
        }

        if (res.status === 409) {
          alert(t(
            "이미 해당 플랜으로 구독이 활성화되어 있습니다.",
            "This subscription plan is already active."
          ));
          return;
        }

        if (!res.ok) {
          alert(data && data.error ? data.error : t("구독 처리 중 오류가 발생했습니다.", "An error occurred while processing the subscription."));
          return;
        }

        alert(
          t("구독이 적용되었습니다.", "Subscription applied.") +
          `\n${t("플랜", "Plan")}: ${data.subscriptionPlan}` +
          `\n${t("현재 크레딧", "Current credits")}: ${Number(data.credits || 0).toLocaleString("ko-KR")}`
        );
        window.location.reload();
      } catch {
        alert(t("구독 처리 중 오류가 발생했습니다.", "An error occurred while processing the subscription."));
      }
    });
  });

  document.addEventListener("site-language-change", updateCalculator);

  if (avgSecondsInput) avgSecondsInput.addEventListener("input", updateCalculator);
  if (monthlyCountInput) monthlyCountInput.addEventListener("input", updateCalculator);
  updateCalculator();
  hydrateNav();
})();
