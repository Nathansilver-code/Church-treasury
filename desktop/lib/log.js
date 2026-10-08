"use strict";
const fs = require("fs");
const path = require("path");

/** Writes a simple log file (logs/app.log) so a problem can be understood later. */
function createLogger(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "app.log");
  try {
    if (fs.statSync(file).size > 2 * 1024 * 1024) fs.renameSync(file, file + ".old");   // keep the log small
  } catch {
    /* no log yet */
  }
  const write = (level, message) => {
    const line = `${new Date().toISOString()} ${level} ${message}\n`;
    try {
      fs.appendFileSync(file, line);
    } catch {
      /* logging must never stop the app */
    }
    if (process.env.TREASURY_LOG_CONSOLE) process.stderr.write(line);
  };
  return { dir, file, info: (m) => write("INFO", m), error: (m) => write("ERROR", m) };
}

/** The last few lines of a file, for error messages. */
function tail(file, lines = 15) {
  try {
    return fs.readFileSync(file, "utf8").trim().split(/\r?\n/).slice(-lines).join("\n");
  } catch {
    return "";
  }
}

module.exports = { createLogger, tail };
