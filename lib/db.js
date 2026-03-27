const fs = require("fs/promises");
const path = require("path");

const DEFAULT_DB = {
  version: 1,
  users: [],
  identities: [],
  workspaces: [],
  memberships: [],
  projects: [],
  sessions: [],
  inquiries: []
};

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix = "") {
  const crypto = require("crypto");
  const id = crypto.randomBytes(16).toString("hex");
  return prefix ? `${prefix}_${id}` : id;
}

async function loadJsonDb(dbPath) {
  try {
    const raw = await fs.readFile(dbPath, "utf8");
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_DB, ...parsed };
  } catch (error) {
    if (error && error.code === "ENOENT") return { ...DEFAULT_DB };
    throw error;
  }
}

async function saveJsonDb(dbPath, db) {
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  const tmpPath = `${dbPath}.tmp`;
  const body = `${JSON.stringify(db, null, 2)}\n`;
  await fs.writeFile(tmpPath, body, "utf8");
  await fs.rename(tmpPath, dbPath);
}

module.exports = {
  DEFAULT_DB,
  nowIso,
  createId,
  loadJsonDb,
  saveJsonDb
};
