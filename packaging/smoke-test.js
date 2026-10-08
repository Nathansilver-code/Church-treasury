// Starts the real database and the real application from packaging/stage, exactly like the installed app does,
// and checks them. Run by build-windows.ps1 before the installer is made, so a broken build never ships.
// Usage: TREASURY_STAGE_DIR=<stage folder> node packaging/smoke-test.js
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createLogger } = require("../desktop/lib/log");
const { resolvePaths } = require("../desktop/lib/paths");
const { startAll } = require("../desktop/lib/services");

const fail = (msg) => { console.error("SMOKE TEST FAILED: " + msg); process.exitCode = 1; };

(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "treasury-smoke-"));
  const paths = resolvePaths({ packaged: false, userDataDir: dataDir, stageDir: process.env.TREASURY_STAGE_DIR });
  const log = createLogger(paths.logDir);
  let services;
  try {
    const t0 = Date.now();
    services = await startAll({ paths, log, onStatus: (s) => console.log("  " + s) });
    console.log(`  started in ${((Date.now() - t0) / 1000).toFixed(1)} s (first run, includes creating the database)`);

    const health = await (await fetch(services.url + "api/health")).json();
    if (health.funds !== 2 || health.items !== 20) fail("unexpected health answer " + JSON.stringify(health));
    else console.log("  database and application are connected: 2 funds, 20 items");

    const page = await (await fetch(services.url)).text();
    if (!page.includes('id="root"')) fail("the app page is not being served");
    else console.log("  the app page is served");

    const catalog = await (await fetch(services.url + "api/catalog")).json();
    if (!Array.isArray(catalog.items) || catalog.items.length < 15) fail("catalog is empty");

    const logo = await fetch(services.url + "logo.png");
    if (logo.status !== 200) fail("logo.png is not served");
  } catch (e) {
    fail(e.message);
  } finally {
    if (services) await services.stop();
    console.log(process.exitCode ? "Smoke test failed. Logs: " + paths.logDir : "Smoke test passed.");
  }
})();
