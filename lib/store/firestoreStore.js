const { nowIso, createId } = require("../db");

function getServiceAccountFromEnv() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT_JSON (must be valid JSON).");
  }
}

function createFirestoreStore() {
  let admin = null;
  let firestore = null;

  function ensureInit() {
    if (firestore) return;

    try {
      // Lazy require so JSON mode works without deps.
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

    firestore = admin.firestore();
  }

  function col(name) {
    ensureInit();
    return firestore.collection(name);
  }

  async function getUser(userId) {
    const snap = await col("users").doc(userId).get();
    return snap.exists ? { id: snap.id, ...snap.data() } : null;
  }

  async function upsertGoogleUser({ providerUserId, email, displayName, pictureUrl }) {
    return upsertOAuthUser({ provider: "google", providerUserId, email, displayName, pictureUrl });
  }

  async function upsertFirebaseUser({ providerUserId, email, displayName, pictureUrl }) {
    return upsertOAuthUser({ provider: "firebase", providerUserId, email, displayName, pictureUrl });
  }

  async function upsertOAuthUser({ provider, providerUserId, email, displayName, pictureUrl }) {
    ensureInit();
    const providerKey = String(provider || "").trim().toLowerCase();
    const identityKey = String(providerUserId || "").trim();
    if (!providerKey || !identityKey) return null;

    const identityId = `${providerKey}:${identityKey}`;
    const identities = col("identities");
    const users = col("users");

    return firestore.runTransaction(async (tx) => {
      const identityRef = identities.doc(identityId);
      const identitySnap = await tx.get(identityRef);

      if (identitySnap.exists) {
        const { userId } = identitySnap.data() || {};
        if (userId) {
          const userRef = users.doc(userId);
          const patch = { updatedAt: nowIso() };
          if (email) patch.email = email;
          if (displayName) patch.displayName = displayName;
          if (pictureUrl) patch.pictureUrl = pictureUrl;
          tx.set(userRef, patch, { merge: true });
        }
        return userId;
      }

      const userId = createId("usr");
      const createdAt = nowIso();
      tx.set(users.doc(userId), {
        email: email || "",
        displayName: displayName || email || "User",
        pictureUrl: pictureUrl || "",
        credits: 0,
        createdAt,
        updatedAt: createdAt,
        lastSeenAt: null,
        defaultWorkspaceId: null
      });
      tx.set(identityRef, {
        provider: providerKey,
        providerUserId: identityKey,
        userId,
        createdAt
      });
      return userId;
    });
  }

  async function ensurePersonalWorkspace(userId) {
    const users = col("users");
    const memberships = col("memberships");
    const workspaces = col("workspaces");

    return firestore.runTransaction(async (tx) => {
      const userRef = users.doc(userId);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) return null;
      const user = userSnap.data() || {};

      if (user.defaultWorkspaceId) return user.defaultWorkspaceId;

      const existingMembershipQuery = memberships.where("userId", "==", userId).limit(1);
      const existingMembershipSnap = await tx.get(existingMembershipQuery);
      if (!existingMembershipSnap.empty) {
        const wsId = existingMembershipSnap.docs[0].data().workspaceId || null;
        if (wsId) tx.set(userRef, { defaultWorkspaceId: wsId, updatedAt: nowIso() }, { merge: true });
        return wsId;
      }

      const wsId = createId("ws");
      const createdAt = nowIso();
      tx.set(workspaces.doc(wsId), {
        name: `${user.displayName || "내"} 워크스페이스`,
        ownerUserId: userId,
        createdAt,
        updatedAt: createdAt
      });
      tx.set(memberships.doc(`${wsId}_${userId}`), {
        workspaceId: wsId,
        userId,
        role: "owner",
        createdAt
      });
      tx.set(userRef, { defaultWorkspaceId: wsId, updatedAt: createdAt }, { merge: true });
      return wsId;
    });
  }

  async function getWorkspaceIdForUser(userId) {
    const user = await getUser(userId);
    if (user && user.defaultWorkspaceId) return user.defaultWorkspaceId;
    const snap = await col("memberships").where("userId", "==", userId).limit(1).get();
    if (snap.empty) return null;
    return snap.docs[0].data().workspaceId || null;
  }

  async function createSession({ userId, expiresAtMs }) {
    const id = createId("sess");
    const createdAt = nowIso();
    await col("sessions").doc(id).set({ userId, createdAt, lastSeenAt: createdAt, expiresAtMs });
    await col("users").doc(userId).set({ lastSeenAt: createdAt, updatedAt: createdAt }, { merge: true });
    return id;
  }

  async function getSession(sessionId) {
    const snap = await col("sessions").doc(sessionId).get();
    return snap.exists ? { id: snap.id, ...snap.data() } : null;
  }

  async function deleteSession(sessionId) {
    await col("sessions").doc(sessionId).delete();
  }

  async function touchSession(sessionId) {
    const session = await getSession(sessionId);
    if (!session) return;
    const t = nowIso();
    await col("sessions").doc(sessionId).set({ lastSeenAt: t }, { merge: true });
    await col("users").doc(session.userId).set({ lastSeenAt: t, updatedAt: t }, { merge: true });
  }

  async function listUsers() {
    const snap = await col("users").orderBy("createdAt", "desc").get();
    return snap.docs.map((d) => {
      const u = d.data() || {};
      return {
        id: d.id,
        email: u.email || "",
        displayName: u.displayName || "User",
        credits: u.credits || 0,
        createdAt: u.createdAt || null,
        lastSeenAt: u.lastSeenAt || null
      };
    });
  }

  async function updateUserCredits(userId, { set, delta }) {
    const userRef = col("users").doc(userId);
    return firestore.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) return null;
      const user = snap.data() || {};
      const current = Number(user.credits || 0);
      let next = current;
      if (set !== undefined) next = Number(set);
      if (delta !== undefined) next = next + Number(delta);
      if (!Number.isFinite(next)) next = current;
      next = Math.max(0, Math.min(10_000_000, Math.trunc(next)));
      tx.set(userRef, { credits: next, updatedAt: nowIso() }, { merge: true });
      return { id: userId, email: user.email || "", displayName: user.displayName || "User", credits: next };
    });
  }

  async function listProjects({ workspaceId, type, limit = 10 }) {
    // Avoid composite index requirements by not ordering in Firestore; sort in memory.
    const snap = await col("projects")
      .where("workspaceId", "==", workspaceId)
      .where("type", "==", type)
      .get();
    const projects = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return projects.slice(0, limit);
  }

  async function createProject({ workspaceId, type, name, data }) {
    const createdAt = nowIso();
    const id = createId("prj");
    const doc = { workspaceId, type, name, data, createdAt, updatedAt: createdAt };
    await col("projects").doc(id).set(doc);
    return { id, ...doc };
  }

  async function getProject(projectId) {
    const snap = await col("projects").doc(projectId).get();
    return snap.exists ? { id: snap.id, ...snap.data() } : null;
  }

  async function updateProject(projectId, { name, data }) {
    const ref = col("projects").doc(projectId);
    return firestore.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return null;
      const patch = { updatedAt: nowIso() };
      if (name) patch.name = name;
      if (data !== undefined) patch.data = data;
      tx.set(ref, patch, { merge: true });
      return { id: projectId, ...snap.data(), ...patch };
    });
  }

  async function deleteProject(projectId) {
    const ref = col("projects").doc(projectId);
    const snap = await ref.get();
    if (!snap.exists) return false;
    await ref.delete();
    return true;
  }

  return {
    kind: "firestore",
    nowIso,
    createId,
    getUser,
    upsertOAuthUser,
    upsertGoogleUser,
    upsertFirebaseUser,
    ensurePersonalWorkspace,
    getWorkspaceIdForUser,
    createSession,
    getSession,
    deleteSession,
    touchSession,
    listUsers,
    updateUserCredits,
    listProjects,
    createProject,
    getProject,
    updateProject,
    deleteProject
  };
}

module.exports = { createFirestoreStore };
