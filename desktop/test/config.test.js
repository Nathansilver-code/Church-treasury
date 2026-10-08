const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { loadOrCreate } = require("../lib/config");

test("creates random passwords the first time and keeps them afterwards", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cfg-"));
  const first = loadOrCreate(dir);
  assert.equal(first.created, true);
  assert.match(first.config.dbPassword, /^[A-Za-z0-9_-]{30,}$/);
  assert.notEqual(first.config.dbPassword, first.config.pgSuperPassword);
  const second = loadOrCreate(dir);
  assert.equal(second.created, false);
  assert.deepEqual(second.config, first.config);
});

test("two installations never share passwords", () => {
  const a = loadOrCreate(fs.mkdtempSync(path.join(os.tmpdir(), "cfg-"))).config;
  const b = loadOrCreate(fs.mkdtempSync(path.join(os.tmpdir(), "cfg-"))).config;
  assert.notEqual(a.dbPassword, b.dbPassword);
});
