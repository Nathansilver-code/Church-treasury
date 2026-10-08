"use strict";
const fs = require("fs");
const path = require("path");
const { Backend } = require("./backend");
const { loadOrCreate } = require("./config");
const { JVM_ARGS } = require("./paths");
const { freePort } = require("./ports");
const { Postgres } = require("./postgres");

/**
 * Starts everything the app needs, in order: the database, then the application.
 * Returns { url, stop }. If any step fails, what was already started is stopped again.
 * `paths.backendLaunch` can replace the Java command (the tests use this).
 */
async function startAll({ paths, log, onStatus = () => {} }) {
  const { config, created } = loadOrCreate(paths.dataDir);
  const pg = new Postgres({ binDir: paths.pgBin, dataDir: paths.dataDir, config, log });

  if (created && pg.clusterExists()) {
    throw new Error("The database folder exists but its settings file (config.json) is missing, so the app cannot open it. "
      + `Restore config.json into ${paths.dataDir} from a backup.`);
  }

  let backend = null;
  try {
    onStatus(pg.clusterExists() ? "Starting the database..." : "Setting up the database for the first time. This takes a little longer...");
    await pg.ensureCluster();
    const pgPort = await freePort();
    await pg.start(pgPort);
    await pg.ensureDatabase(pgPort);

    onStatus("Starting the application...");
    const appPort = await freePort();
    const launch = paths.backendLaunch || { command: paths.javaExe, args: [...JVM_ARGS, "-jar", paths.jar] };
    backend = new Backend({
      command: launch.command,
      args: launch.args,
      logFile: path.join(paths.logDir, "backend.log"),
      log,
      env: {
        SERVER_PORT: String(appPort),
        TREASURY_DB_URL: `jdbc:postgresql://127.0.0.1:${pgPort}/${config.dbName}`,
        TREASURY_DB_USER: config.dbUser,
        TREASURY_DB_PASSWORD: config.dbPassword,
        SPRING_MAIN_BANNER_MODE: "off",
      },
    });
    backend.start();
    await backend.waitHealthy(appPort);
    log.info(`Ready on port ${appPort}`);

    return {
      url: `http://127.0.0.1:${appPort}/`,
      async stop() {
        await backend.stop();
        await pg.stop();
      },
    };
  } catch (e) {
    log.error(e.message);
    if (backend) await backend.stop();
    await pg.stop();
    throw e;
  }
}

module.exports = { startAll };
