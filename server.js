const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");
const crypto = require("crypto");
try {
  require("dotenv").config();
} catch {
  // optional (works without dependencies in JSON-only mode)
}

const { nowIso } = require("./lib/db");
const { createStore } = require("./lib/store");
const { readRequestBody, parseJsonBody, parseCookies, setCookie, clearCookie, sendJson, redirect, fetchJson } = require("./lib/http");

const HOST = "0.0.0.0";
const PORT = 3000;
const ROOT = __dirname;
const FFMPEG_PATH = "C:\\ffmpeg-8.0.1-full_build\\ffmpeg-8.0.1-full_build\\bin\\ffmpeg.exe";
const store = createStore();

const SESSION_COOKIE = "sm_session";
const OAUTH_STATE_COOKIE = "sm_oauth_state";
const OAUTH_NEXT_COOKIE = "sm_oauth_next";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days
const OAUTH_TTL_SECONDS = 60 * 10; // 10 minutes

const PUBLIC_HTML = new Set(["/login.html"]);
const MASTER_EMAIL = (process.env.MASTER_EMAIL || "shindong0514@gmail.com").trim().toLowerCase();

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
    res.writeHead(200, { "Content-Type": mimeType });
    fs.createReadStream(absPath).pipe(res);
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
  return String(user.email).trim().toLowerCase() === MASTER_EMAIL;
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
  return { apiKey, authDomain, projectId, appId, measurementId };
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

function runFfmpeg(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(FFMPEG_PATH, [
      "-y",
      "-i",
      inputPath,
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "19",
      "-pix_fmt",
      "yuv420p",
      "-r",
      "24",
      "-profile:v",
      "high",
      "-level",
      "4.2",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
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

    ffmpeg.on("error", reject);
  });
}

async function handleTranscode(req, res) {
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
    await runFfmpeg(inputPath, outputPath);
    const fileBuffer = await fsp.readFile(outputPath);
    const fileName = `shortsmaker-export-${Date.now()}.mp4`;

    setCorsHeaders(res);
    res.writeHead(200, {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${fileName}`,
      "X-Download-Filename": fileName,
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

      const userId = store.upsertFirebaseUser
        ? await store.upsertFirebaseUser({ providerUserId: uid, email, displayName, pictureUrl })
        : await store.upsertOAuthUser({ provider: "firebase", providerUserId: uid, email, displayName, pictureUrl });

      if (!userId) {
        sendApiJson(res, 500, { error: "Failed to create user" });
        return;
      }

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

      const userId = await store.upsertGoogleUser({ providerUserId, email, displayName, pictureUrl });
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
    sendApiJson(res, 200, {
      displayName: ctx.user.displayName || "User",
      email: ctx.user.email || "",
      credits: ctx.user.credits || 0,
      videoCount: 0,
      subscriptionPlan: "무료",
      subscriptionStatus: "free",
      isAdmin: isAdminUser(ctx.user)
    });
    return;
  }

  // --- Admin endpoints ---
  if (req.method === "GET" && url.pathname === "/api/admin/users") {
    const ctx = await requireAuth(req, res);
    if (!ctx) return;
    if (!isAdminUser(ctx.user)) {
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
      sendApiJson(res, 403, { error: "Forbidden" });
      return;
    }

    const parts = url.pathname.split("/").filter(Boolean);
    const userId = parts[2] || "";

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
    sendApiJson(res, 200, { status: "free", plan: "무료" });
    return;
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
    console.error(`Port ${PORT} is already in use. Close the other process or change PORT in server.js.`);
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`Shortsmaker local server running at http://127.0.0.1:${PORT}`);

  const lanAddresses = getLanAddresses();
  lanAddresses.forEach((address) => {
    console.log(`LAN access: http://${address}:${PORT}`);
  });
});
