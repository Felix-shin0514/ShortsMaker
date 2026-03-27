const fs = require("fs/promises");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(process.cwd(), ".env") });

function getServiceAccountFromEnv() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT_JSON (must be valid JSON).");
  }
}

function createBatchWriter(firestore) {
  let batch = firestore.batch();
  let opCount = 0;
  let committed = 0;

  async function flush() {
    if (!opCount) return;
    await batch.commit();
    committed += opCount;
    batch = firestore.batch();
    opCount = 0;
  }

  async function set(ref, data) {
    batch.set(ref, data, { merge: true });
    opCount += 1;
    if (opCount >= 400) {
      await flush();
    }
  }

  return {
    set,
    flush,
    getCommittedCount: () => committed + opCount
  };
}

function collectSummary(db) {
  return {
    users: Array.isArray(db.users) ? db.users.length : 0,
    identities: Array.isArray(db.identities) ? db.identities.length : 0,
    workspaces: Array.isArray(db.workspaces) ? db.workspaces.length : 0,
    memberships: Array.isArray(db.memberships) ? db.memberships.length : 0,
    projects: Array.isArray(db.projects) ? db.projects.length : 0,
    inquiries: Array.isArray(db.inquiries) ? db.inquiries.length : 0
  };
}

async function main() {
  const dbPath = path.join(process.cwd(), "data", "shortsmaker-db.json");
  const raw = await fs.readFile(dbPath, "utf8");
  const db = JSON.parse(raw);

  let admin;
  try {
    admin = require("firebase-admin");
  } catch {
    throw new Error("Missing dependency: firebase-admin. Run: npm install");
  }

  if (!admin.apps.length) {
    const serviceAccount = getServiceAccountFromEnv();
    const credential = serviceAccount
      ? admin.credential.cert(serviceAccount)
      : admin.credential.applicationDefault();
    admin.initializeApp({ credential });
  }

  const firestore = admin.firestore();
  const writer = createBatchWriter(firestore);

  const collections = [
    ["users", db.users || []],
    ["identities", (db.identities || []).map((row) => ({ id: `${row.provider}:${row.providerUserId}`, ...row }))],
    ["workspaces", db.workspaces || []],
    ["memberships", (db.memberships || []).map((row) => ({ id: `${row.workspaceId}_${row.userId}`, ...row }))],
    ["projects", db.projects || []],
    ["inquiries", db.inquiries || []]
  ];

  for (const [collectionName, rows] of collections) {
    for (const row of rows) {
      if (!row || !row.id) continue;
      const { id, ...data } = row;
      await writer.set(firestore.collection(collectionName).doc(id), data);
    }
  }

  await writer.flush();

  const summary = collectSummary(db);
  console.log("Firestore migration completed.");
  console.log(`Source file: ${dbPath}`);
  console.log(`Written documents: ${writer.getCommittedCount()}`);
  console.log("Counts:", summary);
  console.log("Skipped collection: sessions");
}

main().catch((error) => {
  console.error("Firestore migration failed.");
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
