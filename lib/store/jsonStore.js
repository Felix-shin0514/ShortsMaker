const path = require("path");
const { loadJsonDb, saveJsonDb, nowIso, createId } = require("../db");

function createJsonStore() {
  const root = process.cwd();
  const dbPath = path.join(root, "data", "shortsmaker-db.json");

  let dbLoaded = false;
  let db = null;
  let writeChain = Promise.resolve();

  async function ensureLoaded() {
    if (dbLoaded && db) return;
    db = await loadJsonDb(dbPath);
    dbLoaded = true;
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
        return existingIdentity.userId;
      }

      const createdAt = nowIso();
      const newUserId = createId("usr");
      d.users.push({
        id: newUserId,
        email: email || "",
        displayName: displayName || email || "User",
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
      return newUserId;
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
        createdAt: u.createdAt || null,
        lastSeenAt: u.lastSeenAt || null
      }));
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
      return { id: user.id, email: user.email || "", displayName: user.displayName || "User", credits: user.credits || 0 };
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
    updateUserCredits,
    listProjects,
    createProject,
    getProject,
    updateProject,
    deleteProject
  };
}

module.exports = { createJsonStore };
