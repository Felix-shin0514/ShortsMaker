(function () {
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next") || "/dashboard.html";
  const error = params.get("error");

  const errorEl = document.getElementById("loginError");
  if (error && errorEl) {
    errorEl.hidden = false;
    errorEl.textContent = decodeURIComponent(error);
  }

  const closeBtn = document.getElementById("closeBtn");
  if (closeBtn) closeBtn.addEventListener("click", () => (window.location.href = next));

  function setError(message) {
    if (!errorEl) return;
    errorEl.hidden = false;
    errorEl.textContent = message;
  }

  async function getFirebaseConfig() {
    const res = await fetch("/api/firebase/config");
    if (!res.ok) throw new Error("firebase_config_missing");
    const data = await res.json();
    if (!data || !data.firebase) throw new Error("firebase_config_missing");
    return data.firebase;
  }

  async function ensureFirebaseApp(cfg) {
    if (!window.firebase || !window.firebase.initializeApp) {
      throw new Error("firebase_sdk_missing");
    }

    const current = firebase.apps && firebase.apps.length ? firebase.apps[0] : null;
    const currentProjectId = current && current.options ? current.options.projectId : "";
    const desiredProjectId = cfg && cfg.projectId ? String(cfg.projectId) : "";

    if (current && desiredProjectId && currentProjectId && currentProjectId !== desiredProjectId) {
      try {
        await Promise.all(firebase.apps.map((app) => app.delete()));
      } catch {
        // ignore
      }
    }

    if (!firebase.apps.length) firebase.initializeApp(cfg);
    return firebase.auth();
  }

  async function exchangeSession(idToken) {
    const res = await fetch("/api/auth/firebase/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, next })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data && data.error ? String(data.error) : "session_exchange_failed";
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  async function signInWithGoogle() {
    try {
      const cfg = await getFirebaseConfig();
      const auth = await ensureFirebaseApp(cfg);
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      let userCredential;
      try {
        userCredential = await auth.signInWithPopup(provider);
      } catch (e) {
        // Popup blocked or unsupported: fallback to redirect
        if (e && (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment")) {
          await auth.signInWithRedirect(provider);
          return;
        }
        throw e;
      }

      const user = userCredential && userCredential.user ? userCredential.user : auth.currentUser;
      if (!user) {
        setError("로그인에 실패했습니다.");
        return;
      }

      const idToken = await user.getIdToken(true);
      await exchangeSession(idToken);
      window.location.href = next;
    } catch (e) {
      console.error(e);
      if (e && e.status === 401) {
        setError("서버에서 로그인 토큰을 거부했습니다. 서버 로그를 확인해주세요.");
        return;
      }
      if (e && e.message === "firebase_config_missing") {
        setError("Firebase 설정이 없습니다. 서버 환경변수를 확인해주세요.");
        return;
      }
      if (e && e.message === "firebase_sdk_missing") {
        setError("Firebase SDK 로딩에 실패했습니다.");
        return;
      }
      setError("로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    }
  }

  async function handleRedirectResult() {
    try {
      const cfg = await getFirebaseConfig();
      const auth = await ensureFirebaseApp(cfg);
      const result = await auth.getRedirectResult();
      if (!result || !result.user) return;
      const idToken = await result.user.getIdToken(true);
      await exchangeSession(idToken);
      window.location.href = next;
    } catch (e) {
      console.error(e);
      // ignore; user can click login again
    }
  }

  const loginBtn = document.getElementById("googleLoginBtn");
  if (loginBtn) loginBtn.addEventListener("click", signInWithGoogle);

  handleRedirectResult();
})();
