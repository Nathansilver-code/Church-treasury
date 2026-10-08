const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { Backend } = require("../lib/backend");
const { freePort } = require("../lib/ports");

const quiet = { info() {}, error() {} };
const fake = path.join(__dirname, "fake-backend.js");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "be-"));

test("waits until the application answers, then stops it", async () => {
  const port = await freePort();
  const b = new Backend({ command: process.execPath, args: [fake], env: { SERVER_PORT: String(port) }, logFile: path.join(tmp(), "b.log"), log: quiet });
  b.start();
  const t0 = Date.now();
  await b.waitHealthy(port, { timeoutMs: 15000 });
  assert.ok(Date.now() - t0 >= 400, "it really waited for the slow start");
  await b.stop();
  assert.equal(b.exited, true);
});

test("reports a clear error, with the log, if the application stops while starting", async () => {
  const port = await freePort();
  const b = new Backend({ command: process.execPath, args: [fake], env: { SERVER_PORT: String(port), FAKE_EXIT: "1" }, logFile: path.join(tmp(), "b.log"), log: quiet });
  b.start();
  await assert.rejects(() => b.waitHealthy(port, { timeoutMs: 15000 }), /stopped while starting[\s\S]*cannot connect to the database/);
});

test("gives up with a message if it never answers", async () => {
  const b = new Backend({ command: process.execPath, args: ["-e", "setTimeout(()=>{},60000)"], env: {}, logFile: path.join(tmp(), "b.log"), log: quiet });
  b.start();
  await assert.rejects(() => b.waitHealthy(await0(), { timeoutMs: 800 }), /took too long/);
  await b.stop();
});
function await0() { return 1; }   // a port nothing listens on
