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
    const normalizedEmail = String(email || "").trim().toLowerCase();

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
        return { userId, isNewUser: false };
      }

      if (normalizedEmail) {
        const existingUserQuery = users.where("email", "==", normalizedEmail).limit(1);
        const existingUserSnap = await tx.get(existingUserQuery);
        if (!existingUserSnap.empty) {
          const existingDoc = existingUserSnap.docs[0];
          const existingUserId = existingDoc.id;
          tx.set(identityRef, {
            provider: providerKey,
            providerUserId: identityKey,
            userId: existingUserId,
            createdAt: nowIso()
          });
          const patch = { updatedAt: nowIso() };
          if (displayName) patch.displayName = displayName;
          if (pictureUrl) patch.pictureUrl = pictureUrl;
          tx.set(users.doc(existingUserId), patch, { merge: true });
          return { userId: existingUserId, isNewUser: false };
        }
      }

      const userId = createId("usr");
      const createdAt = nowIso();
      tx.set(users.doc(userId), {
        email: normalizedEmail || (email || ""),
        displayName: displayName || normalizedEmail || email || "User",
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
      return { userId, isNewUser: true };
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
        subscriptionPlanKey: u.subscriptionPlanKey || "free",
        subscriptionPlanName: u.subscriptionPlanName || "무료",
        subscriptionPriority: u.subscriptionPriority || 0,
        subscriptionMonthlyCredits: u.subscriptionMonthlyCredits || 0,
        subscriptionRenewAtMs: u.subscriptionRenewAtMs || null,
        createdAt: u.createdAt || null,
        lastSeenAt: u.lastSeenAt || null
      };
    });
  }

  async function updateUser(userId, patch) {
    const safePatch = patch && typeof patch === "object" ? patch : {};
    const ref = col("users").doc(userId);
    return firestore.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return null;
      const prev = snap.data() || {};
      const next = { ...prev, ...safePatch, updatedAt: nowIso() };
      tx.set(ref, safePatch, { merge: true });
      tx.set(ref, { updatedAt: next.updatedAt }, { merge: true });
      return {
        id: userId,
        email: next.email || "",
        displayName: next.displayName || "User",
        credits: next.credits || 0,
        subscriptionPlanKey: next.subscriptionPlanKey || "free",
        subscriptionPlanName: next.subscriptionPlanName || "무료",
        subscriptionPriority: next.subscriptionPriority || 0,
        subscriptionMonthlyCredits: next.subscriptionMonthlyCredits || 0,
        subscriptionRenewAtMs: next.subscriptionRenewAtMs || null
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

  async function createInquiry({ userId, email, displayName, subject, message }) {
    const id = createId("inq");
    const createdAt = nowIso();
    const doc = {
      userId,
      email: email || "",
      displayName: displayName || "User",
      subject,
      message,
      status: "open",
      adminMemo: "",
      createdAt,
      updatedAt: createdAt
    };
    await col("inquiries").doc(id).set(doc);
    return { id, ...doc };
  }

  async function listInquiries({ userId, isAdmin = false, limit = 100 }) {
    let query = col("inquiries");
    if (!isAdmin) query = query.where("userId", "==", userId);
    const snap = await query.get();
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    rows.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return rows.slice(0, Math.max(1, limit));
  }

  async function updateInquiry(inquiryId, patch) {
    const safePatch = patch && typeof patch === "object" ? patch : {};
    const ref = col("inquiries").doc(inquiryId);
    return firestore.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return null;
      const next = { ...(snap.data() || {}), ...safePatch, updatedAt: nowIso() };
      tx.set(ref, { ...safePatch, updatedAt: next.updatedAt }, { merge: true });
      return { id: inquiryId, ...next };
    });
  }

  async function listUserIdentities(userId) {
    ensureInit();
    const snap = await col("identities").where("userId", "==", userId).get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async function deleteUser(userId) {
    ensureInit();
    const userRef = col("users").doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return false;

    const ownedWorkspacesSnap = await col("workspaces").where("ownerUserId", "==", userId).get();
    const ownedWorkspaceIds = ownedWorkspacesSnap.docs.map((doc) => doc.id);

    const batchRefs = [userRef];

    const identitiesSnap = await col("identities").where("userId", "==", userId).get();
    identitiesSnap.docs.forEach((doc) => batchRefs.push(doc.ref));

    const sessionsSnap = await col("sessions").where("userId", "==", userId).get();
    sessionsSnap.docs.forEach((doc) => batchRefs.push(doc.ref));

    const membershipsSnap = await col("memberships").where("userId", "==", userId).get();
    membershipsSnap.docs.forEach((doc) => batchRefs.push(doc.ref));

    const inquiriesSnap = await col("inquiries").where("userId", "==", userId).get();
    inquiriesSnap.docs.forEach((doc) => batchRefs.push(doc.ref));

    for (const workspaceId of ownedWorkspaceIds) {
      const workspaceRef = col("workspaces").doc(workspaceId);
      batchRefs.push(workspaceRef);

      const projectSnap = await col("projects").where("workspaceId", "==", workspaceId).get();
      projectSnap.docs.forEach((doc) => batchRefs.push(doc.ref));

      const workspaceMembershipSnap = await col("memberships").where("workspaceId", "==", workspaceId).get();
      workspaceMembershipSnap.docs.forEach((doc) => batchRefs.push(doc.ref));
    }

    const uniqueRefs = new Map();
    batchRefs.forEach((ref) => {
      uniqueRefs.set(ref.path, ref);
    });

    let batch = firestore.batch();
    let count = 0;
    for (const ref of uniqueRefs.values()) {
      batch.delete(ref);
      count += 1;
      if (count >= 400) {
        await batch.commit();
        batch = firestore.batch();
        count = 0;
      }
    }
    if (count > 0) {
      await batch.commit();
    }
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
    updateUser,
    updateUserCredits,
    listProjects,
    createProject,
    getProject,
    updateProject,
    deleteProject,
    listUserIdentities,
    deleteUser,
    createInquiry,
    listInquiries,
    updateInquiry
  };
}

module.exports = { createFirestoreStore };
