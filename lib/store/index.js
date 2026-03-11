function createStore({ kind = "" } = {}) {
  const selected = (kind || process.env.STORE || "json").toLowerCase().trim();
  if (selected === "firestore") {
    const { createFirestoreStore } = require("./firestoreStore");
    return createFirestoreStore();
  }
  const { createJsonStore } = require("./jsonStore");
  return createJsonStore();
}

module.exports = { createStore };

