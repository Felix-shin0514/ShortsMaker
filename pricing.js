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

  // Modal elements
  const paymentModal = document.getElementById("paymentModal");
  const closePaymentModal = document.getElementById("closePaymentModal");
  const paymentModalPlanName = document.getElementById("paymentModalPlanName");
  const paymentButton = document.getElementById("payment-button");

  let userInfo = null;
  let paymentWidget = null;
  let paymentMethodsWidget = null;
  let currentOrder = null;

  function getLang() {
    return typeof window.getSiteLang === "function" ? window.getSiteLang() : "ko";
  }

  function t(ko, en) {
    return getLang() === "en" ? en : ko;
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text || "";
  }

  function formatNumber(n) {
    return Number(n || 0).toLocaleString("ko-KR");
  }

  async function getClientKey() {
    const configRes = await fetch("/api/payments/config");
    const config = await configRes.json().catch(() => ({}));
    return config.tossClientKey || "test_ck_D5bZzxlz67dn099lO5DlV696E7vg";
  }

  async function initPaymentWidget(amount) {
    if (paymentWidget) {
      paymentMethodsWidget.updateAmount(amount);
      return;
    }

    const clientKey = await getClientKey();
    const customerKey = userInfo ? userInfo.id : "ANONYMOUS_" + Date.now();

    // Initialize PaymentWidget
    // @ts-ignore
    paymentWidget = loadPaymentWidget(clientKey, customerKey);

    // Render Payment Methods
    paymentMethodsWidget = paymentWidget.renderPaymentMethods(
      "#payment-method",
      { value: amount },
      { variantKey: "DEFAULT" }
    );

    // Render Agreement
    paymentWidget.renderAgreement("#agreement", { variantKey: "AGREEMENT" });
  }

  function openModal(title, amount, orderInfo) {
    paymentModalPlanName.textContent = `${title} - ${formatNumber(amount)}원`;
    currentOrder = orderInfo;
    paymentModal.style.display = "flex";

    paymentButton.disabled = true;
    initPaymentWidget(amount).then(() => {
      paymentButton.disabled = false;
    }).catch(err => {
      console.error("Widget init failed", err);
      alert(t("결제 모듈을 불러오지 못했습니다.", "Failed to load payment module."));
      closeModal();
    });
  }

  function closeModal() {
    paymentModal.style.display = "none";
    statusEl.textContent = "";
    document.querySelectorAll(".plan-cta, .support-cta").forEach(b => b.disabled = false);
  }

  if (closePaymentModal) {
    closePaymentModal.addEventListener("click", closeModal);
  }

  if (paymentButton) {
    paymentButton.addEventListener("click", async () => {
      if (!paymentWidget || !currentOrder) return;

      paymentButton.disabled = true;
      setStatus(t("결제 요청 중...", "Requesting payment..."));

      try {
        await paymentWidget.requestPayment({
          orderId: currentOrder.orderId,
          orderName: currentOrder.orderName,
          customerName: userInfo ? userInfo.displayName : "User",
          successUrl: currentOrder.successUrl,
          failUrl: currentOrder.failUrl,
        });
      } catch (err) {
        paymentButton.disabled = false;
        if (err.code === "USER_CANCEL") return;
        alert(t("결제 요청 실패: ", "Payment request failed: ") + err.message);
      }
    });
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
      userInfo = await res.json();

      if (userNameTop) {
        userNameTop.style.display = "";
        userNameTop.textContent = userInfo.displayName || "User";
      }
      if (logoutBtn) {
        logoutBtn.style.display = "";
        logoutBtn.addEventListener("click", () => (window.location.href = "/logout"));
      }
      if (adminLink) adminLink.style.display = userInfo.isAdmin ? "" : "none";
      setStatus(`${t("현재 플랜", "Current plan")}: ${userInfo.subscriptionPlan || t("무료", "Free")}`);
    } catch {
      // ignore
    }
  }

  // Set up plan buttons
  document.querySelectorAll("[data-plan]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const planKey = btn.getAttribute("data-plan");
      if (!userInfo) {
        window.location.href = `/login.html?next=${encodeURIComponent("/pricing.html")}`;
        return;
      }

      if (userInfo.subscriptionPlanKey === planKey) {
        alert(t("이미 해당 플랜으로 구독이 활성화되어 있습니다.", "This subscription plan is already active."));
        return;
      }

      if (planKey === "free") {
        const mockRes = await fetch("/api/billing/mock/success", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planKey })
        });
        if (mockRes.ok) {
          alert(t("무료 플랜이 적용되었습니다.", "Free plan applied."));
          window.location.reload();
        }
        return;
      }

      const amounts = { basic: 9900, pro: 16900, creator: 29900 };
      const names = { basic: t("베이직", "Basic"), pro: "Pro", creator: t("크리에이터", "Creator") };
      const amount = amounts[planKey];
      const orderId = "order_" + Date.now() + "_" + Math.floor(Math.random() * 1000);

      openModal(`${names[planKey]} ${t("구독", "Subscription")}`, amount, {
        orderId,
        orderName: `ShortsMaker ${names[planKey]} 요금제`,
        successUrl: window.location.origin + `/api/payments/toss/success?planKey=${planKey}`,
        failUrl: window.location.origin + `/api/payments/toss/fail`
      });
    });
  });

  // Set up donation buttons
  document.querySelectorAll("[data-donation]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const amount = Number(btn.getAttribute("data-donation"));
      const name = btn.parentElement.querySelector("h3").textContent;

      if (!userInfo) {
        window.location.href = `/login.html?next=${encodeURIComponent("/pricing.html")}`;
        return;
      }

      const orderId = "donation_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
      openModal(`${t("개발자 후원", "Developer Support")}: ${name}`, amount, {
        orderId,
        orderName: `ShortsMaker 개발자 후원: ${name}`,
        successUrl: window.location.origin + `/api/payments/toss/success?type=donation&amount=${amount}`,
        failUrl: window.location.origin + `/api/payments/toss/fail`
      });
    });
  });

  // Calculator logic
  function clampInt(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.trunc(n)));
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

  window.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error) {
      alert(t("결제 실패: ", "Payment failed: ") + error);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  });

  document.addEventListener("site-language-change", updateCalculator);
  if (avgSecondsInput) avgSecondsInput.addEventListener("input", updateCalculator);
  if (monthlyCountInput) monthlyCountInput.addEventListener("input", updateCalculator);

  updateCalculator();
  hydrateNav();
})();
