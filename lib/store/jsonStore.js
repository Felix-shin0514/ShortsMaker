const path = require("path");
const { loadJsonDb, saveJsonDb, nowIso, createId } = require("../db");

function createJsonStore() {
  const root = process.cwd();
  const dbPath = path.join(root, "data", "shortsmaker-db.json");

  let dbLoaded = false;
  let db = null;
  let writeChain = Promise.resolve();

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function isTruthyString(value) {
    return Boolean(String(value || "").trim());
  }

  function dedupeDbByEmail(d) {
    const groups = new Map();
    d.users.forEach((u) => {
      const email = normalizeEmail(u.email);
      if (!email) return;
      const arr = groups.get(email) || [];
      arr.push(u);
      groups.set(email, arr);
    });

    const userById = new Map(d.users.map((u) => [u.id, u]));
    const keepUserIds = new Set(d.users.map((u) => u.id));

    let changed = false;

    for (const [email, users] of groups.entries()) {
      if (users.length <= 1) continue;

      const sorted = users.slice().sort((a, b) => {
        const at = new Date(a.createdAt || 0).getTime();
        const bt = new Date(b.createdAt || 0).getTime();
        return at - bt;
      });

      const primary = sorted[0];
      const primaryId = primary.id;
      const duplicates = sorted.slice(1);

      duplicates.forEach((dup) => {
        const dupId = dup.id;
        if (!dupId || dupId === primaryId) return;

        // Merge user fields.
        if ((dup.credits || 0) > (primary.credits || 0)) primary.credits = dup.credits || 0;
        if (!isTruthyString(primary.displayName) && isTruthyString(dup.displayName)) primary.displayName = dup.displayName;
        if (!isTruthyString(primary.pictureUrl) && isTruthyString(dup.pictureUrl)) primary.pictureUrl = dup.pictureUrl;
        if (!isTruthyString(primary.defaultWorkspaceId) && isTruthyString(dup.defaultWorkspaceId)) primary.defaultWorkspaceId = dup.defaultWorkspaceId;
        if (!isTruthyString(primary.lastSeenAt) && isTruthyString(dup.lastSeenAt)) primary.lastSeenAt = dup.lastSeenAt;

        // Re-point identities, sessions, memberships to primary.
        d.identities.forEach((i) => {
          if (i.userId === dupId) i.userId = primaryId;
        });
        d.sessions.forEach((s) => {
          if (s.userId === dupId) s.userId = primaryId;
        });
        d.memberships.forEach((m) => {
          if (m.userId === dupId) m.userId = primaryId;
        });
        d.workspaces.forEach((w) => {
          if (w.ownerUserId === dupId) w.ownerUserId = primaryId;
        });

        keepUserIds.delete(dupId);
        userById.delete(dupId);
        changed = true;
      });

      primary.email = email;
      primary.updatedAt = nowIso();
    }

    if (!changed) return false;

    // Remove duplicate users.
    d.users = d.users.filter((u) => keepUserIds.has(u.id));

    // Remove duplicate memberships (workspaceId+userId)
    const membershipKey = new Set();
    d.memberships = d.memberships.filter((m) => {
      const key = `${m.workspaceId}_${m.userId}`;
      if (membershipKey.has(key)) return false;
      membershipKey.add(key);
      return true;
    });

    // Remove duplicate identities (provider+providerUserId)
    const identityKey = new Set();
    d.identities = d.identities.filter((i) => {
      const key = `${i.provider}:${i.providerUserId}`;
      if (identityKey.has(key)) return false;
      identityKey.add(key);
      return true;
    });

    return true;
  }

  async function ensureLoaded() {
    if (dbLoaded && db) return;
    db = await loadJsonDb(dbPath);
    const deduped = dedupeDbByEmail(db);
    dbLoaded = true;
    if (deduped) {
      await saveJsonDb(dbPath, db);
    }
  }

  function queueWrite() {
    writeChain = writeChain.then(() => saveJsonDb(dbPath, db));
    return writeChain;
  }

  async function withDb(mutator) {
    await ensureLoaded();
    const result = await mutator(db);
    await queueWrite();
    return result;
  }

  async function getUser(userId) {
    await ensureLoaded();
    return db.users.find((u) => u.id === userId) || null;
  }

  async function upsertOAuthUser({ provider, providerUserId, email, displayName, pictureUrl }) {
    return withDb((d) => {
      const providerKey = String(provider || "").trim().toLowerCase();
      const identityKey = String(providerUserId || "").trim();
      if (!providerKey || !identityKey) return null;
      const existingIdentity = d.identities.find((i) => i.provider === providerKey && i.providerUserId === identityKey);

      if (existingIdentity) {
        const user = d.users.find((u) => u.id === existingIdentity.userId);
        if (user) {
          if (email) user.email = email;
          if (displayName) user.displayName = displayName;
          if (pictureUrl) user.pictureUrl = pictureUrl;
          user.updatedAt = nowIso();
        }
        return { userId: existingIdentity.userId, isNewUser: false };
      }

      const normalizedEmail = normalizeEmail(email);
      if (normalizedEmail) {
        const existingUser = d.users.find((u) => normalizeEmail(u.email) === normalizedEmail);
        if (existingUser) {
          const createdAt = nowIso();
          d.identities.push({
            provider: providerKey,
            providerUserId: identityKey,
            userId: existingUser.id,
            createdAt
          });
          if (displayName) existingUser.displayName = displayName;
          if (pictureUrl) existingUser.pictureUrl = pictureUrl;
          existingUser.email = normalizedEmail;
          existingUser.updatedAt = createdAt;
          return { userId: existingUser.id, isNewUser: false };
        }
      }

      const createdAt = nowIso();
      const newUserId = createId("usr");
      d.users.push({
        id: newUserId,
        email: normalizedEmail || (email || ""),
        displayName: displayName || normalizedEmail || email || "User",
        pictureUrl: pictureUrl || "",
        credits: 0,
        createdAt,
        updatedAt: createdAt,
        lastSeenAt: null,
        defaultWorkspaceId: null
      });
      d.identities.push({
        provider: providerKey,
        providerUserId: identityKey,
        userId: newUserId,
        createdAt
      });
      return { userId: newUserId, isNewUser: true };
    });
  }

  async function upsertGoogleUser({ providerUserId, email, displayName, pictureUrl }) {
    return upsertOAuthUser({ provider: "google", providerUserId, email, displayName, pictureUrl });
  }

  async function upsertFirebaseUser({ providerUserId, email, displayName, pictureUrl }) {
    return upsertOAuthUser({ provider: "firebase", providerUserId, email, displayName, pictureUrl });
  }

  async function ensurePersonalWorkspace(userId) {
    return withDb((d) => {
      const user = d.users.find((u) => u.id === userId);
      if (!user) return null;

      if (user.defaultWorkspaceId) return user.defaultWorkspaceId;

      const existingMembership = d.memberships.find((m) => m.userId === userId);
      if (existingMembership) {
        user.defaultWorkspaceId = existingMembership.workspaceId;
        user.updatedAt = nowIso();
        return existingMembership.workspaceId;
      }

      const workspaceId = createId("ws");
      const createdAt = nowIso();
      d.workspaces.push({
        id: workspaceId,
        name: `${user.displayName || "내"} 워크스페이스`,
        ownerUserId: userId,
        createdAt,
        updatedAt: createdAt
      });
      d.memberships.push({
        workspaceId,
        userId,
        role: "owner",
        createdAt
      });
      user.defaultWorkspaceId = workspaceId;
      user.updatedAt = createdAt;
      return workspaceId;
    });
  }

  async function getWorkspaceIdForUser(userId) {
    await ensureLoaded();
    const user = db.users.find((u) => u.id === userId);
    if (user && user.defaultWorkspaceId) return user.defaultWorkspaceId;
    const membership = db.memberships.find((m) => m.userId === userId) || null;
    return membership ? membership.workspaceId : null;
  }

  async function createSession({ userId, expiresAtMs }) {
    const id = createId("sess");
    const createdAt = nowIso();
    await withDb((d) => {
      d.sessions.push({ id, userId, createdAt, lastSeenAt: createdAt, expiresAtMs });
      const user = d.users.find((u) => u.id === userId);
      if (user) {
        user.lastSeenAt = createdAt;
        user.updatedAt = createdAt;
      }
    });
    return id;
  }

  async function getSession(sessionId) {
    await ensureLoaded();
    return db.sessions.find((s) => s.id === sessionId) || null;
  }

  async function deleteSession(sessionId) {
    return withDb((d) => {
      d.sessions = d.sessions.filter((s) => s.id !== sessionId);
    });
  }

  async function touchSession(sessionId) {
    return withDb((d) => {
      const session = d.sessions.find((s) => s.id === sessionId);
      if (!session) return;
      session.lastSeenAt = nowIso();
      const user = d.users.find((u) => u.id === session.userId);
      if (user) {
        user.lastSeenAt = session.lastSeenAt;
        user.updatedAt = session.lastSeenAt;
      }
    });
  }

  async function listUsers() {
    await ensureLoaded();
    return db.users
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((u) => ({
        id: u.id,
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
      }));
  }

  async function updateUser(userId, patch) {
    const safePatch = patch && typeof patch === "object" ? patch : {};
    return withDb((d) => {
      const user = d.users.find((u) => u.id === userId);
      if (!user) return null;
      Object.assign(user, safePatch);
      user.updatedAt = nowIso();
      return {
        id: user.id,
        email: user.email || "",
        displayName: user.displayName || "User",
        credits: user.credits || 0,
        subscriptionPlanKey: user.subscriptionPlanKey || "free",
        subscriptionPlanName: user.subscriptionPlanName || "무료",
        subscriptionPriority: user.subscriptionPriority || 0,
        subscriptionMonthlyCredits: user.subscriptionMonthlyCredits || 0,
        subscriptionRenewAtMs: user.subscriptionRenewAtMs || null
      };
    });
  }

  async function updateUserCredits(userId, { set, delta }) {
    return withDb((d) => {
      const user = d.users.find((u) => u.id === userId);
      if (!user) return null;
      const current = Number(user.credits || 0);
      let next = current;
      if (set !== undefined) next = Number(set);
      if (delta !== undefined) next = next + Number(delta);
      if (!Number.isFinite(next)) next = current;
      next = Math.max(0, Math.min(10_000_000, Math.trunc(next)));
      user.credits = next;
      user.updatedAt = nowIso();
      return {
        id: user.id,
        email: user.email || "",
        displayName: user.displayName || "User",
        credits: user.credits || 0,
        subscriptionPlanKey: user.subscriptionPlanKey || "free",
        subscriptionPlanName: user.subscriptionPlanName || "무료",
        subscriptionPriority: user.subscriptionPriority || 0,
        subscriptionMonthlyCredits: user.subscriptionMonthlyCredits || 0,
        subscriptionRenewAtMs: user.subscriptionRenewAtMs || null
      };
    });
  }

  async function listProjects({ workspaceId, type, limit = 10 }) {
    await ensureLoaded();
    const projects = db.projects
      .filter((p) => p.workspaceId === workspaceId && p.type === type)
      .slice()
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);
    return projects;
  }

  async function createProject({ workspaceId, type, name, data }) {
    const createdAt = nowIso();
    const id = createId("prj");
    await withDb((d) => {
      d.projects.push({ id, workspaceId, type, name, data, createdAt, updatedAt: createdAt });
    });
    return { id, workspaceId, type, name, data, createdAt, updatedAt: createdAt };
  }

  async function getProject(projectId) {
    await ensureLoaded();
    return db.projects.find((p) => p.id === projectId) || null;
  }

  async function updateProject(projectId, { name, data }) {
    return withDb((d) => {
      const project = d.projects.find((p) => p.id === projectId);
      if (!project) return null;
      if (name) project.name = name;
      if (data !== undefined) project.data = data;
      project.updatedAt = nowIso();
      return project;
    });
  }

  async function deleteProject(projectId) {
    return withDb((d) => {
      const before = d.projects.length;
      d.projects = d.projects.filter((p) => p.id !== projectId);
      return d.projects.length !== before;
    });
  }

  async function createInquiry({ userId, email, displayName, subject, message }) {
    const createdAt = nowIso();
    const id = createId("inq");
    await withDb((d) => {
      d.inquiries.push({
        id,
        userId,
        email: email || "",
        displayName: displayName || "User",
        subject,
        message,
        status: "open",
        adminMemo: "",
        createdAt,
        updatedAt: createdAt
      });
    });
    return { id, userId, email, displayName, subject, message, status: "open", adminMemo: "", createdAt, updatedAt: createdAt };
  }

  async function listInquiries({ userId, isAdmin = false, limit = 100 }) {
    await ensureLoaded();
    const rows = db.inquiries
      .filter((inquiry) => (isAdmin ? true : inquiry.userId === userId))
      .slice()
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, Math.max(1, limit));

    return rows.map((inquiry) => ({ ...inquiry }));
  }

  async function updateInquiry(inquiryId, patch) {
    const safePatch = patch && typeof patch === "object" ? patch : {};
    return withDb((d) => {
      const inquiry = d.inquiries.find((row) => row.id === inquiryId);
      if (!inquiry) return null;
      Object.assign(inquiry, safePatch);
      inquiry.updatedAt = nowIso();
      return { ...inquiry };
    });
  }

  async function listUserIdentities(userId) {
    await ensureLoaded();
    return db.identities
      .filter((row) => row.userId === userId)
      .map((row) => ({ ...row }));
  }

  async function deleteUser(userId) {
    return withDb((d) => {
      const user = d.users.find((row) => row.id === userId);
      if (!user) return false;

      const ownedWorkspaceIds = new Set(
        d.workspaces
          .filter((workspace) => workspace.ownerUserId === userId)
          .map((workspace) => workspace.id)
      );

      d.users = d.users.filter((row) => row.id !== userId);
      d.identities = d.identities.filter((row) => row.userId !== userId);
      d.sessions = d.sessions.filter((row) => row.userId !== userId);
      d.memberships = d.memberships.filter((row) => row.userId !== userId && !ownedWorkspaceIds.has(row.workspaceId));
      d.inquiries = d.inquiries.filter((row) => row.userId !== userId);
      d.projects = d.projects.filter((row) => !ownedWorkspaceIds.has(row.workspaceId));
      d.workspaces = d.workspaces.filter((row) => row.ownerUserId !== userId);

      return true;
    });
  }

  return {
    kind: "json",
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

module.exports = { createJsonStore };
