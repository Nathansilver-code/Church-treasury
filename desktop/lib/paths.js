"use strict";
const path = require("path");

const JVM_ARGS = [
  "-Xms32m", "-Xmx384m",          // small memory use, fine for a church computer
  "-XX:+UseSerialGC",             // simplest collector, quickest to start
  "-XX:TieredStopAtLevel=1",      // faster start-up
  "-Dspring.jmx.enabled=false",
  "-Dfile.encoding=UTF-8",
];

/**
 * Where everything lives.
 *  - installed app: the bundled programs are in the app's "resources" folder
 *  - development:   they are in packaging/stage (made by packaging/build-windows.ps1)
 * The data (database, logs, settings) is always in the user's own app-data folder,
 * so updating or reinstalling the app never touches it.
 */
function resolvePaths({ packaged, resourcesDir, userDataDir, stageDir }) {
  const base = packaged ? resourcesDir : stageDir || path.join(__dirname, "..", "..", "packaging", "stage");
  const exe = process.platform === "win32" ? ".exe" : "";
  return {
    pgBin: path.join(base, "postgres", "bin"),
    javaExe: path.join(base, "runtime", "bin", "java" + exe),
    jar: path.join(base, "backend", "treasury.jar"),
    dataDir: userDataDir,
    logDir: path.join(userDataDir, "logs"),
  };
}

module.exports = { resolvePaths, JVM_ARGS };
