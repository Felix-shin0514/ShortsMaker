const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");
const crypto = require("crypto");
let ffmpegStaticPath = null;
try {
  ffmpegStaticPath = require("ffmpeg-static");
} catch {
  ffmpegStaticPath = null;
}
try {
  require("dotenv").config();
} catch {
  // optional (works without dependencies in JSON-only mode)
}

const { nowIso } = require("./lib/db");
const { createStore } = require("./lib/store");
const { readRequestBody, parseJsonBody, parseCookies, setCookie, clearCookie, sendJson, redirect, fetchJson } = require("./lib/http");

const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DEFAULT_WINDOWS_FFMPEG = "C:\\ffmpeg-8.0.1-full_build\\ffmpeg-8.0.1-full_build\\bin\\ffmpeg.exe";
const FFMPEG_PATH =
  process.env.FFMPEG_PATH ||
  (process.platform === "win32" ? DEFAULT_WINDOWS_FFMPEG : ffmpegStaticPath || "ffmpeg");
const store = createStore();

const SESSION_COOKIE = "sm_session";
const OAUTH_STATE_COOKIE = "sm_oauth_state";
const OAUTH_NEXT_COOKIE = "sm_oauth_next";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days
const OAUTH_TTL_SECONDS = 60 * 10; // 10 minutes
const BILLING_PERIOD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SIGNUP_BONUS_CREDITS = 200;

const PUBLIC_HTML = new Set([
  "/login.html",
  "/pricing.html",
  "/terms.html",
  "/privacy.html",
  "/refund.html",
  "/marketing.html"
]);
const MASTER_EMAIL = (process.env.MASTER_EMAIL || "shindong0514@gmail.com").trim().toLowerCase();

const PLANS = {
  free: { key: "free", name: "무료", priceWon: 0, monthlyCredits: 0, priority: 0 },
  basic: { key: "basic", name: "베이직", priceWon: 9900, monthlyCredits: 1000, priority: 1 },
  pro: { key: "pro", name: "프로", priceWon: 16900, monthlyCredits: 2000, priority: 2 },
  creator: { key: "creator", name: "크리에이터", priceWon: 29900, monthlyCredits: 4000, priority: 3 }
};

function getPlan(key) {
  const k = String(key || "").trim().toLowerCase();
  return PLANS[k] || PLANS.free;
}

function getUserPlanKey(user) {
  const key = user && user.subscriptionPlanKey ? String(user.subscriptionPlanKey) : "free";
  return getPlan(key).key;
}

function getUserPriority(user) {
  const planKey = getUserPlanKey(user);
  return getPlan(planKey).priority || 0;
}

async function maybeGrantMonthlyCredits(user) {
  if (!user) return null;
  const planKey = getUserPlanKey(user);
  if (planKey === "free") return user;

  const plan = getPlan(planKey);
  const renewAtMs = Number(user.subscriptionRenewAtMs || 0);
  const monthly = Number(user.subscriptionMonthlyCredits || plan.monthlyCredits || 0);
  if (!renewAtMs || !monthly) return user;

  const now = Date.now();
  if (now < renewAtMs) return user;

  const periods = Math.floor((now - renewAtMs) / BILLING_PERIOD_MS) + 1;
  const delta = periods * monthly;
  await store.updateUserCredits(user.id, { delta });

  const nextRenewAtMs = renewAtMs + periods * BILLING_PERIOD_MS;
  if (store.updateUser) {
    await store.updateUser(user.id, { subscriptionRenewAtMs: nextRenewAtMs, subscriptionLastGrantAtMs: now });
  }

  return store.getUser ? await store.getUser(user.id) : user;
}

async function applyMockSubscriptionPayment({ userId, planKey }) {
  const plan = getPlan(planKey);
  if (!plan || plan.key === "free") {
    const err = new Error("Invalid plan");
    err.statusCode = 400;
    throw err;
  }

  const user = await store.getUser(userId);
  if (!user) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }

  const now = Date.now();
  const renewAtMs = Number(user.subscriptionRenewAtMs || 0);
  const currentPlanKey = getUserPlanKey(user);

  // Prevent repeated grants while the current billing period is still active.
  if (
    renewAtMs &&
    now < renewAtMs &&
    user.subscriptionStatus === "active" &&
    user.subscriptionProvider === "toss_mock" &&
    currentPlanKey === plan.key
  ) {
    const err = new Error("Already subscribed");
    err.statusCode = 409;
    throw err;
  }

  const paymentId = "mock_" + crypto.randomUUID();

  await store.updateUser(userId, {
    subscriptionPlanKey: plan.key,
    subscriptionMonthlyCredits: plan.monthlyCredits || 0,
    subscriptionStatus: "active",
    subscriptionProvider: "toss_mock",
    subscriptionRenewAtMs: now + BILLING_PERIOD_MS,
    subscriptionLastGrantAtMs: now,
    subscriptionLastPaymentId: paymentId
  });

  if (plan.monthlyCredits) {
    await store.updateUserCredits(userId, { delta: plan.monthlyCredits });
  }

  return store.getUser ? await store.getUser(userId) : null;
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webm": "video/webm",
  ".mp4": "video/mp4"
};

function getLanAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  Object.values(interfaces).forEach((entries) => {
    (entries || []).forEach((entry) => {
      if (entry.family === "IPv4" && !entry.internal) {
        addresses.push(entry.address);
      }
    });
  });

  return [...new Set(addresses)];
}

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function sanitizeRelativePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const clean = decoded === "/" ? "/dashboard.html" : decoded;
  const resolved = path.normalize(clean).replace(/^(\.\.[/\\])+/, "");
  return resolved.startsWith(path.sep) ? resolved.slice(1) : resolved;
}

async function serveStatic(req, res) {
  const relPath = sanitizeRelativePath(req.url || "/");
  const absPath = path.join(ROOT, relPath);

  if (!absPath.startsWith(ROOT)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  try {
    const stat = await fsp.stat(absPath);
    if (stat.isDirectory()) {
      sendJson(res, 403, { error: "Directory listing is disabled" });
      return;
    }

    const ext = path.extname(absPath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || "application/octet-stream";
    setCorsHeaders(res);

    // Prevent aggressive HTML caching that ignores version query strings
    if (ext === ".html") {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }

    res.writeHead(200, { "Content-Type": mimeType });
    fs.createReadStream(absPath).pipe(res);
  } catch {
    sendJson(res, 404, { error: "Not found" });
  }
}

async function serveNewestMp4FromDir(req, res, dirAbsPath) {
  try {
    const entries = await fsp.readdir(dirAbsPath, { withFileTypes: true });
    const mp4s = entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".mp4"))
      .map((e) => path.join(dirAbsPath, e.name));

    if (!mp4s.length) {
      sendJson(res, 404, { error: "No sample video found" });
      return;
    }

    let best = mp4s[0];
    let bestMtime = 0;
    for (const p of mp4s) {
      try {
        const st = await fsp.stat(p);
        const mt = st.mtimeMs || 0;
        if (mt >= bestMtime) {
          bestMtime = mt;
          best = p;
        }
      } catch {
        // ignore
      }
    }

    const stat = await fsp.stat(best);
    const size = stat.size || 0;
    const range = String(req.headers.range || "").trim();

    setCorsHeaders(res);
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "no-store");

    if (range && range.startsWith("bytes=")) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!m) {
        res.writeHead(416);
        res.end();
        return;
      }

      const start = m[1] ? Number(m[1]) : 0;
      const end = m[2] ? Number(m[2]) : Math.max(0, size - 1);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
        res.writeHead(416);
        res.end();
        return;
      }

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(end - start + 1)
      });
      fs.createReadStream(best, { start, end }).pipe(res);
      return;
    }

    res.writeHead(200, { "Content-Length": String(size) });
    fs.createReadStream(best).pipe(res);
  } catch {
    sendJson(res, 404, { error: "Not found" });
  }
}

function getRequestOrigin(req) {
  const proto = (req.headers["x-forwarded-proto"] || "http").toString().split(",")[0].trim();
  const host = (req.headers.host || `127.0.0.1:${PORT}`).toString().split(",")[0].trim();
  return `${proto}://${host}`;
}

function isSecureRequest(req) {
  const proto = (req.headers["x-forwarded-proto"] || "").toString().split(",")[0].trim().toLowerCase();
  return proto === "https";
}

function sendApiJson(res, statusCode, payload) {
  setCorsHeaders(res);
  sendJson(res, statusCode, payload);
}

function getSessionId(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  return cookies[SESSION_COOKIE] || "";
}

async function getAuthContext(req) {
  const sessionId = getSessionId(req);
  if (!sessionId) return { user: null, workspaceId: null, sessionId: null };

  const session = await store.getSession(sessionId);
  if (!session) return { user: null, workspaceId: null, sessionId: null };

  const now = Date.now();
  if (session.expiresAtMs && session.expiresAtMs <= now) {
    await store.deleteSession(sessionId);
    return { user: null, workspaceId: null, sessionId: null };
  }

  const user = await store.getUser(session.userId);
  if (!user) return { user: null, workspaceId: null, sessionId: null };

  const workspaceId = await store.getWorkspaceIdForUser(user.id);

  // Update lastSeen without blocking the response path too much.
  store.touchSession(sessionId).catch(() => null);

  return { user, workspaceId, sessionId };
}

async function requireAuth(req, res) {
  const ctx = await getAuthContext(req);
  if (ctx.user) return ctx;
  sendApiJson(res, 401, { error: "Unauthorized" });
  return null;
}

function isAdminUser(user) {
  if (!user || !user.email) return false;
  const email = String(user.email).trim().toLowerCase();
  // Always permit the requester as a super-admin
  if (email === "shindong0514@gmail.com") return true;
  return email === MASTER_EMAIL;
}

function getGoogleConfig(req) {
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
  const configuredRedirectUri = process.env.GOOGLE_REDIRECT_URI || "";
  const redirectUri = configuredRedirectUri || `${getRequestOrigin(req)}/api/auth/google/callback`;
  return { clientId, clientSecret, redirectUri };
}

function getFirebaseWebConfig() {
  const apiKey = process.env.FIREBASE_API_KEY || "";
  const authDomain = process.env.FIREBASE_AUTH_DOMAIN || "";
  const projectId = process.env.FIREBASE_PROJECT_ID || "";
  const appId = process.env.FIREBASE_APP_ID || "";
  const measurementId = process.env.FIREBASE_MEASUREMENT_ID || "";
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || "";
  return { apiKey, authDomain, projectId, appId, measurementId, storageBucket };
}

let firebaseAdmin = null;
let firebaseAdminAuth = null;

function ensureFirebaseAdmin() {
  if (firebaseAdminAuth) return firebaseAdminAuth;
  try {
    firebaseAdmin = require("firebase-admin");
  } catch {
    throw new Error("Missing dependency: firebase-admin. Run: npm install");
  }

  if (!firebaseAdmin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const credential = raw
      ? firebaseAdmin.credential.cert(JSON.parse(raw))
      : firebaseAdmin.credential.applicationDefault();
    firebaseAdmin.initializeApp({ credential });
  }

  firebaseAdminAuth = firebaseAdmin.auth();
  return firebaseAdminAuth;
}

function buildGoogleAuthUrl({ clientId, redirectUri, state }) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

async function ensurePersonalWorkspace(user) {
  return store.ensurePersonalWorkspace(user.id);
}

async function createSessionForUser(req, userId) {
  const expiresAtMs = Date.now() + SESSION_TTL_SECONDS * 1000;
  return store.createSession({ userId, expiresAtMs });
}

function normalizeUpsertResult(result) {
  if (!result) return { userId: "", isNewUser: false };
  if (typeof result === "string") return { userId: result, isNewUser: false };
  return {
    userId: String(result.userId || "").trim(),
    isNewUser: Boolean(result.isNewUser)
  };
}

async function maybeGrantSignupBonus(userId, isNewUser) {
  if (!userId || !isNewUser) return;
  await store.updateUserCredits(userId, { delta: SIGNUP_BONUS_CREDITS });
}

async function destroyCurrentSession(res, sessionId) {
  if (sessionId) {
    try {
      await store.deleteSession(sessionId);
    } catch {
      // ignore
    }
  }
  clearCookie(res, SESSION_COOKIE, { path: "/" });
}

async function deleteFirebaseAuthAccountsForUser(userId) {
  if (!userId || !store.listUserIdentities) return;

  let identities = [];
  try {
    identities = await store.listUserIdentities(userId);
  } catch (error) {
    console.error("Failed to load user identities for auth deletion:", error);
    return;
  }

  const firebaseProviderIds = identities
    .filter((identity) => String(identity.provider || "").toLowerCase() === "firebase")
    .map((identity) => String(identity.providerUserId || "").trim())
    .filter(Boolean);

  if (!firebaseProviderIds.length) return;

  let auth = null;
  try {
    auth = ensureFirebaseAdmin();
  } catch (error) {
    console.error("Firebase Admin unavailable during auth account deletion:", error);
    return;
  }

  for (const providerUserId of firebaseProviderIds) {
    try {
      await auth.deleteUser(providerUserId);
    } catch (error) {
      const code = error && error.code ? String(error.code) : "";
      if (code === "auth/user-not-found") continue;
      console.error(`Failed to delete Firebase Auth user ${providerUserId}:`, error);
    }
  }
}

function getQualityProfile(key) {
  const k = String(key || "").trim().toLowerCase();
  if (k === "standard") return { key: "standard", fps: 30, width: 720, height: 1280, crf: 24, level: "4.0", audioBitrate: "160k" };
  return { key: "premium", fps: 60, width: 1080, height: 1920, crf: 20, level: "4.2", audioBitrate: "192k" };
}

function calcCreditsForSeconds(qualityKey, seconds) {
  const s = Math.max(0, Number(seconds || 0));
  const mins = Math.max(1, Math.ceil(s / 60));
  const k = String(qualityKey || "").trim().toLowerCase();
  const perMin = k === "standard" ? 100 : 200;
  return mins * perMin;
}

function runFfmpeg(inputPath, outputPath, { fps = 24, width = null, height = null, crf = 19, level = "4.2", audioBitrate = "192k" } = {}, seconds = 0) {
  return new Promise((resolve, reject) => {
    const safeSeconds = Math.max(0, Math.min(60 * 60 * 6, Number(seconds || 0)));
    const vfParts = [];
    if (width && height) vfParts.push(`scale=${width}:${height}:flags=lanczos`);
    // Normalize variable frame-rate / broken timestamps from browser-recorded webm
    // to avoid long frozen segments and incorrect durations in the exported mp4.
    vfParts.push(`fps=${fps}`);
    const vf = vfParts.length ? vfParts.join(",") : null;

    const ffmpeg = spawn(FFMPEG_PATH, [
      "-y",
      "-fflags",
      "+genpts",
      "-i",
      inputPath,
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      String(crf),
      "-pix_fmt",
      "yuv420p",
      ...(vf ? ["-vf", vf] : []),
      "-vsync",
      "cfr",
      "-profile:v",
      "high",
      "-level",
      String(level),
      "-c:a",
      "aac",
      "-af",
      "aresample=async=1:first_pts=0",
      "-b:a",
      String(audioBitrate),
      ...(safeSeconds ? ["-t", String(safeSeconds)] : []),
      "-shortest",
      "-movflags",
      "+faststart",
      outputPath
    ]);

    let stderr = "";
    ffmpeg.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr || `ffmpeg exited with code ${code}`));
    });

    ffmpeg.on("error", (error) => {
      if (error && error.code === "ENOENT") {
        reject(new Error(`ffmpeg executable not found. Set FFMPEG_PATH or install ffmpeg. Current value: ${FFMPEG_PATH}`));
        return;
      }
      reject(error);
    });
  });
}

async function handleTranscode(req, res) {
  const url = new URL(req.url || "", getRequestOrigin(req));
  const qualityKey = url.searchParams.get("quality") || "premium";
  const secondsParam = url.searchParams.get("seconds") || "0";
  const seconds = Math.max(0, Math.min(60 * 60 * 6, parseInt(secondsParam, 10) || 0));
  const profile = getQualityProfile(qualityKey);
  const cost = calcCreditsForSeconds(profile.key, seconds);

  const ctx = await requireAuth(req, res);
  if (!ctx) return;

  const haveCredits = Number(ctx.user?.credits || 0);
  if (!Number.isFinite(haveCredits) || haveCredits < cost) {
    sendApiJson(res, 402, { error: "insufficient_credits", needed: cost, have: haveCredits });
    return;
  }

  const body = await readRequestBody(req);
  if (!body.length) {
    sendApiJson(res, 400, { error: "Empty request body" });
    return;
  }

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "shortsmaker-"));
  const inputPath = path.join(tempDir, "input.webm");
  const outputPath = path.join(tempDir, "output.mp4");

  try {
    await fsp.writeFile(inputPath, body);
    await runFfmpeg(inputPath, outputPath, profile, seconds);
    const fileBuffer = await fsp.readFile(outputPath);

    // Deduct credits only after a successful transcode.
    const updated = await store.updateUserCredits(ctx.user.id, { delta: -cost });
    const remainingCredits = updated ? Number(updated.credits || 0) : Math.max(0, haveCredits - cost);

    const fileName = `shortsmaker-export-${profile.key}-${Date.now()}.mp4`;

    setCorsHeaders(res);
    res.writeHead(200, {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${fileName}`,
      "X-Download-Filename": fileName,
      "X-Remaining-Credits": String(remainingCredits),
      "Content-Length": fileBuffer.length
    });
    res.end(fileBuffer);
  } catch (error) {
    sendApiJson(res, 500, { error: "Transcode failed", detail: error.message });
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

const server = http.createServer(async (req, res) => {
  if (!req.url || !req.method) {
    sendApiJson(res, 400, { error: "Bad request" });
    return;
  }

  if (req.method === "OPTIONS") {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  const origin = getRequestOrigin(req);
  const url = new URL(req.url, origin);

  if (req.method === "GET" && url.pathname === "/assets/videos/ranking.mp4") {
    const dirAbs = path.join(ROOT, "assets", "videos");
    await serveNewestMp4FromDir(req, res, dirAbs);
    return;
  }

  if (req.method === "GET" && url.pathname === "/") {
    const ctx = await getAuthContext(req);
    redirect(res, ctx.user ? "/dashboard.html" : "/login.html");
    return;
  }

  if (req.method === "GET" && url.pathname === "/logout") {
    clearCookie(res, SESSION_COOKIE, { path: "/" });
    redirect(res, "/login.html");
    return;
  }

  // --- Auth (Google OAuth) ---
  if (req.method === "GET" && url.pathname === "/api/firebase/config") {
    const cfg = getFirebaseWebConfig();
    const missing = [];
    if (!cfg.apiKey) missing.push("FIREBASE_API_KEY");
    if (!cfg.authDomain) missing.push("FIREBASE_AUTH_DOMAIN");
    if (!cfg.projectId) missing.push("FIREBASE_PROJECT_ID");
    if (!cfg.appId) missing.push("FIREBASE_APP_ID");

    if (missing.length) {
      sendApiJson(res, 500, { error: `Firebase config is missing (${missing.join(", ")}).` });
      return;
    }
    sendApiJson(res, 200, { firebase: cfg });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/firebase/session") {
    let body = null;
    try {
      body = parseJsonBody(await readRequestBody(req)) || {};
    } catch {
      sendApiJson(res, 400, { error: "Invalid JSON" });
      return;
    }

    const idToken = String(body.idToken || "").trim();
    const next = String(body.next || "/dashboard.html");
    if (!idToken) {
      sendApiJson(res, 400, { error: "Missing idToken" });
      return;
    }

    try {
      const auth = ensureFirebaseAdmin();
      const decoded = await auth.verifyIdToken(idToken);
      const uid = decoded && decoded.uid ? String(decoded.uid) : "";
      const email = decoded && decoded.email ? String(decoded.email) : "";
      const displayName = decoded && decoded.name ? String(decoded.name) : (email || "User");
      const pictureUrl = decoded && decoded.picture ? String(decoded.picture) : "";

      if (!uid) {
        sendApiJson(res, 401, { error: "Invalid token" });
        return;
      }

      const upsertResult = store.upsertFirebaseUser
        ? await store.upsertFirebaseUser({ providerUserId: uid, email, displayName, pictureUrl })
        : await store.upsertOAuthUser({ provider: "firebase", providerUserId: uid, email, displayName, pictureUrl });
      const { userId, isNewUser } = normalizeUpsertResult(upsertResult);

      if (!userId) {
        sendApiJson(res, 500, { error: "Failed to create user" });
        return;
      }

      await maybeGrantSignupBonus(userId, isNewUser);

      const user = await store.getUser(userId);
      if (user) await ensurePersonalWorkspace(user);

      const sessionId = await createSessionForUser(req, userId);
      setCookie(res, SESSION_COOKIE, sessionId, {
        path: "/",
        httpOnly: true,
        secure: isSecureRequest(req),
        sameSite: "Lax",
        maxAgeSeconds: SESSION_TTL_SECONDS
      });

      sendApiJson(res, 200, { success: true, next });
      return;
    } catch (e) {
      console.error(e);
      const msg = (e && e.message) ? String(e.message) : "";
      if (msg.includes("Missing dependency: firebase-admin") || msg.includes("applicationDefault")) {
        sendApiJson(res, 500, { error: "Firebase Admin 설정이 필요합니다 (firebase-admin + 서비스계정 키)." });
        return;
      }
      if (msg.includes("FIREBASE_SERVICE_ACCOUNT_JSON")) {
        sendApiJson(res, 500, { error: "FIREBASE_SERVICE_ACCOUNT_JSON 형식이 올바르지 않습니다." });
        return;
      }
      sendApiJson(res, 401, { error: "Auth failed" });
      return;
    }
  }

  if (req.method === "GET" && url.pathname === "/api/auth/google/start") {
    const { clientId, clientSecret, redirectUri } = getGoogleConfig(req);
    if (!clientId || !clientSecret) {
      redirect(res, "/login.html?error=" + encodeURIComponent("Google 로그인 설정이 필요합니다 (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET)."));
      return;
    }

    const state = crypto.randomBytes(16).toString("hex");
    const next = url.searchParams.get("next") || "/dashboard.html";

    setCookie(res, OAUTH_STATE_COOKIE, state, {
      path: "/",
      httpOnly: true,
      secure: isSecureRequest(req),
      sameSite: "Lax",
      maxAgeSeconds: OAUTH_TTL_SECONDS
    });
    setCookie(res, OAUTH_NEXT_COOKIE, next, {
      path: "/",
      httpOnly: true,
      secure: isSecureRequest(req),
      sameSite: "Lax",
      maxAgeSeconds: OAUTH_TTL_SECONDS
    });

    const authUrl = buildGoogleAuthUrl({ clientId, redirectUri, state });
    redirect(res, authUrl);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/auth/google/callback") {
    const { clientId, clientSecret, redirectUri } = getGoogleConfig(req);
    const code = url.searchParams.get("code") || "";
    const state = url.searchParams.get("state") || "";
    const error = url.searchParams.get("error") || "";

    const cookies = parseCookies(req.headers.cookie || "");
    const expectedState = cookies[OAUTH_STATE_COOKIE] || "";
    const next = cookies[OAUTH_NEXT_COOKIE] || "/dashboard.html";

    clearCookie(res, OAUTH_STATE_COOKIE, { path: "/" });
    clearCookie(res, OAUTH_NEXT_COOKIE, { path: "/" });

    if (error) {
      redirect(res, "/login.html?error=" + encodeURIComponent(error));
      return;
    }
    if (!code || !state || !expectedState || state !== expectedState) {
      redirect(res, "/login.html?error=" + encodeURIComponent("로그인 검증에 실패했습니다. 다시 시도해주세요."));
      return;
    }

    try {
      const tokenBody = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri
      }).toString();

      const tokenRes = await fetchJson("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(tokenBody).toString()
        },
        body: tokenBody
      });

      const accessToken = tokenRes.json && tokenRes.json.access_token ? tokenRes.json.access_token : "";
      if (!accessToken) throw new Error("Missing access_token");

      const userInfoRes = await fetchJson("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      const providerUserId = (userInfoRes.json && userInfoRes.json.sub) || "";
      const email = (userInfoRes.json && userInfoRes.json.email) || "";
      const displayName = (userInfoRes.json && userInfoRes.json.name) || email || "User";
      const pictureUrl = (userInfoRes.json && userInfoRes.json.picture) || "";

      if (!providerUserId) throw new Error("Missing user sub");

      const upsertResult = await store.upsertGoogleUser({ providerUserId, email, displayName, pictureUrl });
      const { userId, isNewUser } = normalizeUpsertResult(upsertResult);
      await maybeGrantSignupBonus(userId, isNewUser);
      const user = await store.getUser(userId);
      if (user) await ensurePersonalWorkspace(user);

      const sessionId = await createSessionForUser(req, userId);
      setCookie(res, SESSION_COOKIE, sessionId, {
        path: "/",
        httpOnly: true,
        secure: isSecureRequest(req),
        sameSite: "Lax",
        maxAgeSeconds: SESSION_TTL_SECONDS
      });

      redirect(res, next);
      return;
    } catch (e) {
      redirect(res, "/login.html?error=" + encodeURIComponent("Google 로그인 처리 중 오류가 발생했습니다."));
      return;
    }
  }

  // --- Basic user endpoints (used by existing pages) ---
  if (req.method === "GET" && url.pathname === "/api/user") {
    const ctx = await getAuthContext(req);
    sendApiJson(res, 200, { user: ctx.user ? { id: ctx.user.id, displayName: ctx.user.displayName, email: ctx.user.email } : null });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/user/credits") {
    const ctx = await getAuthContext(req);
    sendApiJson(res, 200, { credits: ctx.user ? (ctx.user.credits || 0) : 0 });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/user/info") {
    const ctx = await getAuthContext(req);
    if (!ctx.user) {
      sendApiJson(res, 401, { error: "Unauthorized" });
      return;
    }
    const user = await maybeGrantMonthlyCredits(ctx.user);
    const plan = getPlan(getUserPlanKey(user));
    sendApiJson(res, 200, {
      displayName: user.displayName || "User",
      email: user.email || "",
      credits: user.credits || 0,
      videoCount: 0,
      subscriptionPlan: plan.name,
      subscriptionStatus: plan.key,
      subscriptionMonthlyCredits: plan.monthlyCredits || 0,
      subscriptionPriority: plan.priority || 0,
      isAdmin: isAdminUser(user)
    });
    return;
  }

  if (req.method === "DELETE" && url.pathname === "/api/user/account") {
    const ctx = await requireAuth(req, res);
    if (!ctx) return;
    try {
      if (!store.deleteUser) {
        sendApiJson(res, 500, { error: "account_delete_unsupported", detail: "Store does not support account deletion." });
        return;
      }

      const authDeleteTask = deleteFirebaseAuthAccountsForUser(ctx.user.id);
      const deleted = await store.deleteUser(ctx.user.id);
      if (!deleted) {
        sendApiJson(res, 404, { error: "not_found", detail: "User not found." });
        return;
      }

      await authDeleteTask;
      await destroyCurrentSession(res, ctx.sessionId);
      sendApiJson(res, 200, { success: true });
    } catch (error) {
      console.error("Failed to delete own account:", error);
      sendApiJson(res, 500, { error: "account_delete_failed", detail: error && error.message ? error.message : "" });
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/support/inquiries") {
    const ctx = await requireAuth(req, res);
    if (!ctx) return;
    const wantsAll = url.searchParams.get("all") === "1";
    const isAdmin = isAdminUser(ctx.user);
    const inquiries = await store.listInquiries({
      userId: ctx.user.id,
      isAdmin: wantsAll && isAdmin,
      limit: 200
    });
    sendApiJson(res, 200, { inquiries, isAdmin });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/support/inquiries") {
    const ctx = await requireAuth(req, res);
    if (!ctx) return;

    let body = null;
    try {
      body = parseJsonBody(await readRequestBody(req)) || {};
    } catch {
      sendApiJson(res, 400, { error: "Invalid JSON" });
      return;
    }

    const subject = String(body.subject || "").trim();
    const message = String(body.message || "").trim();

    if (subject.length < 2 || subject.length > 120) {
      sendApiJson(res, 400, { error: "subject must be 2~120 chars" });
      return;
    }
    if (message.length < 5 || message.length > 5000) {
      sendApiJson(res, 400, { error: "message must be 5~5000 chars" });
      return;
    }

    const inquiry = await store.createInquiry({
      userId: ctx.user.id,
      email: ctx.user.email || "",
      displayName: ctx.user.displayName || "User",
      subject,
      message
    });

    sendApiJson(res, 200, { success: true, inquiry });
    return;
  }

  if (req.method === "PATCH" && /^\/api\/support\/inquiries\/[^/]+$/.test(url.pathname)) {
    const ctx = await requireAuth(req, res);
    if (!ctx) return;
    if (!isAdminUser(ctx.user)) {
      sendApiJson(res, 403, { error: "Forbidden" });
      return;
    }

    let body = null;
    try {
      body = parseJsonBody(await readRequestBody(req)) || {};
    } catch {
      sendApiJson(res, 400, { error: "Invalid JSON" });
      return;
    }

    const inquiryId = url.pathname.split("/").pop();
    const patch = {};

    if (Object.prototype.hasOwnProperty.call(body, "status")) {
      const status = String(body.status || "").trim().toLowerCase();
      if (!["open", "answered", "closed"].includes(status)) {
        sendApiJson(res, 400, { error: "invalid status" });
        return;
      }
      patch.status = status;
    }

    if (Object.prototype.hasOwnProperty.call(body, "adminMemo")) {
      const adminMemo = String(body.adminMemo || "").trim();
      if (adminMemo.length > 2000) {
        sendApiJson(res, 400, { error: "adminMemo too long" });
        return;
      }
      patch.adminMemo = adminMemo;
    }

    const updated = await store.updateInquiry(inquiryId, patch);
    if (!updated) {
      sendApiJson(res, 404, { error: "Not found" });
      return;
    }

    sendApiJson(res, 200, { success: true, inquiry: updated });
    return;
  }

  // --- Admin endpoints ---
  if (req.method === "GET" && url.pathname === "/api/admin/users") {
    const ctx = await requireAuth(req, res);
    if (!ctx) return;
    if (!isAdminUser(ctx.user)) {
      console.warn(`Admin access denied for user: ${ctx.user?.email || "unknown"} to /api/admin/users`);
      sendApiJson(res, 403, { error: "Forbidden" });
      return;
    }

    const users = await store.listUsers();

    sendApiJson(res, 200, { users });
    return;
  }

  if (req.method === "POST" && /^\/api\/admin\/users\/[^/]+\/credits$/.test(url.pathname)) {
    const ctx = await requireAuth(req, res);
    if (!ctx) return;
    if (!isAdminUser(ctx.user)) {
      console.warn(`Admin credit adjustment denied for user: ${ctx.user?.email || "unknown"} targeting ${userId}`);
      sendApiJson(res, 403, { error: "Forbidden" });
      return;
    }

    const parts = url.pathname.split("/").filter(Boolean);
    // /api/admin/users/:id/credits -> ["api","admin","users",":id","credits"]
    const userId = parts[3] || "";

    let body = null;
    try {
      body = parseJsonBody(await readRequestBody(req)) || {};
    } catch {
      sendApiJson(res, 400, { error: "Invalid JSON" });
      return;
    }

    const hasSet = Object.prototype.hasOwnProperty.call(body, "set");
    const hasDelta = Object.prototype.hasOwnProperty.call(body, "delta");
    if (!hasSet && !hasDelta) {
      sendApiJson(res, 400, { error: "Missing set or delta" });
      return;
    }

    const setValue = hasSet ? Number(body.set) : null;
    const deltaValue = hasDelta ? Number(body.delta) : null;

    if (hasSet && (!Number.isFinite(setValue) || !Number.isInteger(setValue))) {
      sendApiJson(res, 400, { error: "set must be an integer" });
      return;
    }
    if (hasDelta && (!Number.isFinite(deltaValue) || !Number.isInteger(deltaValue))) {
      sendApiJson(res, 400, { error: "delta must be an integer" });
      return;
    }

    const updated = await store.updateUserCredits(userId, {
      set: hasSet ? setValue : undefined,
      delta: hasDelta ? deltaValue : undefined
    });

    if (!updated) {
      sendApiJson(res, 404, { error: "Not found" });
      return;
    }

    sendApiJson(res, 200, { success: true, user: updated });
    return;
  }

  if (req.method === "DELETE" && /^\/api\/admin\/users\/[^/]+$/.test(url.pathname)) {
    const ctx = await requireAuth(req, res);
    if (!ctx) return;
    if (!isAdminUser(ctx.user)) {
      sendApiJson(res, 403, { error: "Forbidden" });
      return;
    }

    const parts = url.pathname.split("/").filter(Boolean);
    const userId = parts[3] || "";
    if (!userId) {
      sendApiJson(res, 400, { error: "Missing userId" });
      return;
    }

    try {
      if (!store.deleteUser) {
        sendApiJson(res, 500, { error: "account_delete_unsupported", detail: "Store does not support account deletion." });
        return;
      }

      const authDeleteTask = deleteFirebaseAuthAccountsForUser(userId);
      const deleted = await store.deleteUser(userId);
      if (!deleted) {
        sendApiJson(res, 404, { error: "not_found", detail: "User not found." });
        return;
      }

      await authDeleteTask;
      sendApiJson(res, 200, { success: true });
    } catch (error) {
      console.error("Failed to delete admin target account:", error);
      sendApiJson(res, 500, { error: "account_delete_failed", detail: error && error.message ? error.message : "" });
    }
    return;
  }

  // --- Project endpoints (minimal, workspace-scoped) ---
  if (req.method === "GET" && url.pathname === "/api/ranking/projects") {
    const ctx = await requireAuth(req, res);
    if (!ctx) return;

    const limit = Math.max(1, Math.min(parseInt(url.searchParams.get("limit") || "10", 10) || 10, 100));
    const rows = await store.listProjects({ workspaceId: ctx.workspaceId, type: "ranking", limit });
    const projects = rows.map((p) => ({
      id: p.id,
      project_name: p.name,
      updated_at: p.updatedAt,
      created_at: p.createdAt,
      has_emulator_data: Boolean(p.data && p.data.draftId)
    }));

    sendApiJson(res, 200, { projects });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/ranking/project") {
    const ctx = await requireAuth(req, res);
    if (!ctx) return;
    const body = parseJsonBody(await readRequestBody(req)) || {};

    const name = String(body.project_name || body.projectName || "").trim() || "랭킹 프로젝트";
    const data = body.data || body.draftData || null;

    const created = await store.createProject({ workspaceId: ctx.workspaceId, type: "ranking", name, data });

    sendApiJson(res, 200, { success: true, project: { id: created.id, project_name: name, created_at: created.createdAt, updated_at: created.updatedAt } });
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/ranking/project/")) {
    const ctx = await requireAuth(req, res);
    if (!ctx) return;
    const id = url.pathname.split("/").pop();
    const project = await store.getProject(id);
    if (!project) {
      sendApiJson(res, 404, { error: "Not found" });
      return;
    }
    if (project.workspaceId !== ctx.workspaceId || project.type !== "ranking") {
      sendApiJson(res, 404, { error: "Not found" });
      return;
    }
    sendApiJson(res, 200, {
      project: {
        id: project.id,
        project_name: project.name,
        created_at: project.createdAt,
        updated_at: project.updatedAt,
        data: project.data
      }
    });
    return;
  }

  if (req.method === "PUT" && url.pathname.startsWith("/api/ranking/project/")) {
    const ctx = await requireAuth(req, res);
    if (!ctx) return;
    const id = url.pathname.split("/").pop();
    const body = parseJsonBody(await readRequestBody(req)) || {};

    const name = String(body.project_name || body.projectName || "").trim();
    const data = body.data || body.draftData;

    const existing = await store.getProject(id);
    if (!existing || existing.workspaceId !== ctx.workspaceId || existing.type !== "ranking") {
      sendApiJson(res, 404, { error: "Not found" });
      return;
    }
    const updated = await store.updateProject(id, { name, data });

    if (!updated) {
      sendApiJson(res, 404, { error: "Not found" });
      return;
    }
    sendApiJson(res, 200, { success: true, project: { id: updated.id, project_name: updated.name, updated_at: updated.updatedAt } });
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/ranking/project/")) {
    const ctx = await requireAuth(req, res);
    if (!ctx) return;
    const id = url.pathname.split("/").pop();
    const existing = await store.getProject(id);
    if (!existing || existing.workspaceId !== ctx.workspaceId || existing.type !== "ranking") {
      sendApiJson(res, 200, { success: false });
      return;
    }

    const deleted = await store.deleteProject(id);

    sendApiJson(res, 200, { success: deleted });
    return;
  }

  // Empty endpoints for dashboard compatibility (returning empty lists)
  if (req.method === "GET" && /^\/api\/(text-story|ssul|news|ai-shorts|object-speak)\/projects$/.test(url.pathname)) {
    const ctx = await getAuthContext(req);
    if (!ctx.user) {
      sendApiJson(res, 401, { error: "Unauthorized" });
      return;
    }
    sendApiJson(res, 200, { projects: [] });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/user/videos") {
    const ctx = await getAuthContext(req);
    if (!ctx.user) {
      sendApiJson(res, 401, { error: "Unauthorized" });
      return;
    }
    sendApiJson(res, 200, { videos: [] });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/subscription/status") {
    const ctx = await getAuthContext(req);
    if (!ctx.user) {
      sendApiJson(res, 401, { error: "Unauthorized" });
      return;
    }
    const user = await maybeGrantMonthlyCredits(ctx.user);
    const plan = getPlan(getUserPlanKey(user));
    sendApiJson(res, 200, { status: plan.key, plan: plan.name });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/billing/mock/success") {
    const ctx = await requireAuth(req, res);
    if (!ctx) return;
    if (!isAdminUser(ctx.user)) {
      sendApiJson(res, 403, { error: "Forbidden" });
      return;
    }

    let body = null;
    try {
      body = await parseJsonBody(req);
    } catch {
      sendApiJson(res, 400, { error: "Invalid JSON" });
      return;
    }

    const planKey = body && body.planKey ? String(body.planKey) : "";

    try {
      const updated = await applyMockSubscriptionPayment({ userId: ctx.user.id, planKey });
      const plan = getPlan(getUserPlanKey(updated));
      sendApiJson(res, 200, {
        ok: true,
        subscriptionPlan: plan.name,
        subscriptionStatus: plan.key,
        credits: updated ? updated.credits || 0 : 0,
        renewAtMs: updated ? updated.subscriptionRenewAtMs || null : null
      });
      return;
    } catch (e) {
      const statusCode = e && e.statusCode ? e.statusCode : 500;
      sendApiJson(res, statusCode, { error: e && e.message ? e.message : "Internal error" });
      return;
    }
  }

  if (req.method === "GET" && url.pathname === "/api/user/promotions") {
    const ctx = await getAuthContext(req);
    if (!ctx.user) {
      sendApiJson(res, 401, { error: "Unauthorized" });
      return;
    }
    sendApiJson(res, 200, { promotions: [] });
    return;
  }

  if (req.method === "POST" && req.url.startsWith("/api/transcode-webm")) {
    await handleTranscode(req, res);
    return;
  }

  if (req.method === "GET") {
    // Protect HTML pages by default.
    if (url.pathname.endsWith(".html") && !PUBLIC_HTML.has(url.pathname)) {
      const ctx = await getAuthContext(req);
      if (!ctx.user) {
        redirect(res, `/login.html?next=${encodeURIComponent(url.pathname + url.search)}`);
        return;
      }
    }

    await serveStatic(req, res);
    return;
  }

  sendApiJson(res, 405, { error: "Method not allowed" });
});

server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Close the other process or change PORT/PORT env.`);
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`Shortsmaker server running at http://127.0.0.1:${PORT}`);
  console.log(`Using ffmpeg: ${FFMPEG_PATH}`);

  const lanAddresses = getLanAddresses();
  lanAddresses.forEach((address) => {
    console.log(`LAN access: http://${address}:${PORT}`);
  });
});
