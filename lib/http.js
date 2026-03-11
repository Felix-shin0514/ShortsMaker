const https = require("https");

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseJsonBody(buffer) {
  if (!buffer || !buffer.length) return null;
  const text = buffer.toString("utf8");
  if (!text.trim()) return null;
  return JSON.parse(text);
}

function parseCookies(cookieHeader) {
  const cookieStr = cookieHeader || "";
  const out = {};
  cookieStr.split(";").forEach((part) => {
    const [k, ...rest] = part.trim().split("=");
    if (!k) return;
    out[k] = decodeURIComponent(rest.join("=") || "");
  });
  return out;
}

function setCookie(res, name, value, options = {}) {
  const attrs = [];
  attrs.push(`${name}=${encodeURIComponent(value)}`);
  if (options.maxAgeSeconds != null) attrs.push(`Max-Age=${options.maxAgeSeconds}`);
  if (options.path) attrs.push(`Path=${options.path}`);
  if (options.httpOnly) attrs.push("HttpOnly");
  if (options.secure) attrs.push("Secure");
  if (options.sameSite) attrs.push(`SameSite=${options.sameSite}`);
  const headerValue = attrs.join("; ");
  const prev = res.getHeader("Set-Cookie");
  if (!prev) {
    res.setHeader("Set-Cookie", headerValue);
    return;
  }
  if (Array.isArray(prev)) {
    res.setHeader("Set-Cookie", [...prev, headerValue]);
    return;
  }
  res.setHeader("Set-Cookie", [prev, headerValue]);
}

function clearCookie(res, name, options = {}) {
  setCookie(res, name, "", { ...options, maxAgeSeconds: 0 });
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8", ...extraHeaders });
  res.end(JSON.stringify(payload));
}

function redirect(res, location, statusCode = 302) {
  res.writeHead(statusCode, { Location: location });
  res.end();
}

function fetchJson(url, { method = "GET", headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method, headers }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        let parsed = null;
        try {
          parsed = raw ? JSON.parse(raw) : null;
        } catch {
          // ignore
        }
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, headers: res.headers, json: parsed, raw });
          return;
        }
        const error = new Error(`HTTP ${res.statusCode} ${url}`);
        error.statusCode = res.statusCode;
        error.response = { headers: res.headers, json: parsed, raw };
        reject(error);
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

module.exports = {
  readRequestBody,
  parseJsonBody,
  parseCookies,
  setCookie,
  clearCookie,
  sendJson,
  redirect,
  fetchJson
};

