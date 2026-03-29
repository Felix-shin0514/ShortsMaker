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
      const isFree = (plan === "free");

      try {
        const infoRes = await fetch("/api/user/info");
        if (infoRes.status === 401) {
          window.location.href = `/login.html?next=${encodeURIComponent("/pricing.html")}`;
          return;
        }
        const userInfo = await infoRes.json();
        if (userInfo.subscriptionPlanKey === plan) {
          alert(t("이미 해당 플랜으로 구독이 활성화되어 있습니다.", "This subscription plan is already active."));
          return;
        }

        if (isFree) {
          const mockRes = await fetch("/api/billing/mock/success", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ planKey: plan })
          });
          if (mockRes.ok) {
            alert(t("무료 플랜이 적용되었습니다.", "Free plan applied."));
            window.location.reload();
          }
          return;
        }

        btn.disabled = true;
        setStatus(t("결제창을 불러오는 중...", "Loading payment window..."));

        const configRes = await fetch("/api/payments/config");
        const config = await configRes.json().catch(() => ({}));
        const clientKey = config.tossClientKey || "test_ck_D5bZzxlz67dn099lO5DlV696E7vg";

        const tossPayments = TossPayments(clientKey);
        const amounts = { basic: 9900, pro: 16900, creator: 29900 };
        const names = { basic: "베이직", pro: "프로", creator: "크리에이터" };
        const orderId = "order_" + Date.now() + "_" + Math.floor(Math.random() * 1000);

        tossPayments.requestPayment('카드', {
          amount: amounts[plan],
          orderId: orderId,
          orderName: `ShortsMaker ${names[plan]} 요금제`,
          customerName: userInfo.displayName || "User",
          successUrl: window.location.origin + `/api/payments/toss/success?planKey=${plan}`,
          failUrl: window.location.origin + `/api/payments/toss/fail`,
        }).catch((err) => {
          btn.disabled = false;
          setStatus("");
          if (err.code === 'USER_CANCEL') return;
          alert(t("결제 요청 중 오류가 발생했습니다: ", "Error during payment request: ") + err.message);
        });
      } catch (err) {
        btn.disabled = false;
        setStatus("");
        alert(t("처리에 실패했습니다.", "Failed to process."));
      }
    });
  });

  document.querySelectorAll("[data-donation]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const amount = Number(btn.getAttribute("data-donation"));
      const name = btn.parentElement.querySelector("h3").textContent;

      try {
        const infoRes = await fetch("/api/user/info");
        if (infoRes.status === 401) {
          window.location.href = `/login.html?next=${encodeURIComponent("/pricing.html")}`;
          return;
        }
        const userInfo = await infoRes.json();

        btn.disabled = true;
        setStatus(t("결제창을 불러오는 중...", "Loading payment window..."));

        const configRes = await fetch("/api/payments/config");
        const config = await configRes.json().catch(() => ({}));
        const clientKey = config.tossClientKey || "test_ck_D5bZzxlz67dn099lO5DlV696E7vg";

        const tossPayments = TossPayments(clientKey);
        const orderId = "donation_" + Date.now() + "_" + Math.floor(Math.random() * 1000);

        tossPayments.requestPayment('카드', {
          amount: amount,
          orderId: orderId,
          orderName: `ShortsMaker 개발자 후원: ${name}`,
          customerName: userInfo.displayName || "User",
          successUrl: window.location.origin + `/api/payments/toss/success?type=donation&amount=${amount}`,
          failUrl: window.location.origin + `/api/payments/toss/fail`,
        }).catch((err) => {
          btn.disabled = false;
          setStatus("");
          if (err.code === 'USER_CANCEL') return;
          alert(t("결제 요청 중 오류가 발생했습니다: ", "Error during payment request: ") + err.message);
        });
      } catch (err) {
        btn.disabled = false;
        setStatus("");
        alert(t("처리에 실패했습니다.", "Failed to process."));
      }
    });
  });

  window.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error) {
      alert(t("결제 실패: ", "Payment failed: ") + error);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  });

  document.addEventListener("site-language-change", updateCalculator);

  if (avgSecondsInput) avgSecondsInput.addEventListener("input", updateCalculator);
  if (monthlyCountInput) monthlyCountInput.addEventListener("input", updateCalculator);
  updateCalculator();
  hydrateNav();
})();
