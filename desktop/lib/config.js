"use strict";
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const secret = () => crypto.randomBytes(24).toString("base64url");   // letters, digits, - and _ only

/**
 * Reads config.json from the data folder, or creates it the first time.
 * It holds two random passwords for the private database: nobody types or knows them.
 * Returns { config, created }.
 */
function loadOrCreate(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, "config.json");
  if (fs.existsSync(file)) {
    const config = JSON.parse(fs.readFileSync(file, "utf8"));
    if (config.pgSuperPassword && config.dbPassword) return { config, created: false };
  }
  const config = {
    version: 1,
    createdAt: new Date().toISOString(),
    dbName: "treasury",
    dbUser: "treasury",
    pgSuperPassword: secret(),
    dbPassword: secret(),
  };
  fs.writeFileSync(file, JSON.stringify(config, null, 2), { mode: 0o600 });
  return { config, created: true };
}

module.exports = { loadOrCreate };
