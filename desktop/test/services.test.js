// Needs a PostgreSQL "bin" folder: run with PG_BIN=/usr/lib/postgresql/16/bin (as a normal user, not root).
const test = require("node:test");
const assert = require("node:assert");
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { loadOrCreate } = require("../lib/config");
const { startAll } = require("../lib/services");

const PG_BIN = process.env.PG_BIN;
const skip = PG_BIN ? false : "set PG_BIN to a PostgreSQL bin folder to run this test";
const quiet = { info() {}, error() {} };
const fake = path.join(__dirname, "fake-backend.js");
const exe = process.platform === "win32" ? ".exe" : "";

function paths(dir, extra = {}) {
  return { pgBin: PG_BIN, dataDir: dir, logDir: path.join(dir, "logs"), backendLaunch: { command: process.execPath, args: [fake] }, ...extra };
}
function sql(config, port, query) {
  const r = spawnSync(path.join(PG_BIN, "psql" + exe), ["-h", "127.0.0.1", "-p", String(port), "-U", config.dbUser, "-d", config.dbName, "-qtA", "-c", query],
    { env: { ...process.env, PGPASSWORD: config.dbPassword }, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}
const dbStopped = (dir) => spawnSync(path.join(PG_BIN, "pg_ctl" + exe), ["status", "-D", path.join(dir, "pgdata")]).status !== 0;

test("first start builds the database, the app gets working credentials, data survives a restart", { skip, timeout: 120000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "svc test-"));
  const statuses = [];
  const run1 = await startAll({ paths: paths(dir), log: quiet, onStatus: (s) => statuses.push(s) });
  assert.match(statuses[0], /first time/);
  assert.match(run1.url, /^http:\/\/127\.0\.0\.1:\d+\/$/);

  const env = await (await fetch(run1.url + "env")).json();
  const pgPort = Number(new URL(env.url.replace("jdbc:", "")).port);
  const { config } = loadOrCreate(dir);
  assert.equal(env.user, "treasury");
  assert.equal(env.password, config.dbPassword);
  assert.match(env.url, /^jdbc:postgresql:\/\/127\.0\.0\.1:\d+\/treasury$/);
  assert.equal(sql(config, pgPort, "SELECT current_user || '/' || current_database()"), "treasury/treasury");

  sql(config, pgPort, "CREATE TABLE memo(x text); INSERT INTO memo VALUES ('kept')");
  await run1.stop();
  assert.ok(dbStopped(dir), "database is stopped when the app closes");

  const statuses2 = [];
  const run2 = await startAll({ paths: paths(dir), log: quiet, onStatus: (s) => statuses2.push(s) });
  assert.match(statuses2[0], /Starting the database/);
  const env2 = await (await fetch(run2.url + "env")).json();
  assert.equal(sql(config, Number(new URL(env2.url.replace("jdbc:", "")).port), "SELECT x FROM memo"), "kept");
  await run2.stop();
  assert.ok(dbStopped(dir));
});

test("if the application cannot start, the database is stopped again and the error says why", { skip, timeout: 120000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "svc test-"));
  process.env.FAKE_EXIT = "1";
  try {
    await assert.rejects(() => startAll({ paths: paths(dir), log: quiet }), /stopped while starting/);
  } finally {
    delete process.env.FAKE_EXIT;
  }
  assert.ok(dbStopped(dir));
});

test("a database folder without its settings file is refused with a clear message", { skip, timeout: 120000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "svc test-"));
  const run = await startAll({ paths: paths(dir), log: quiet });
  await run.stop();
  fs.rmSync(path.join(dir, "config.json"));
  await assert.rejects(() => startAll({ paths: paths(dir), log: quiet }), /config\.json\) is missing/);
});

test("a database left running by a crash is restarted cleanly", { skip, timeout: 120000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "svc test-"));
  const first = await startAll({ paths: paths(dir), log: quiet });
  // simulate a crash: the app's helper processes are gone but the database keeps running
  const second = await startAll({ paths: paths(dir), log: quiet });
  await second.stop();
  assert.ok(dbStopped(dir));
  await first.stop().catch(() => {});
});
