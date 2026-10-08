"use strict";
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { tail } = require("./log");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function ping(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 1500 }, (res) => {
      res.resume();
      res.statusCode === 200 ? resolve() : reject(new Error(`status ${res.statusCode}`));
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

/** Runs the Spring Boot application (the backend) as a hidden background program. */
class Backend {
  constructor({ command, args, env, logFile, log }) {
    this.command = command;
    this.args = args;
    this.env = env;
    this.logFile = logFile;
    this.log = log;
    this.child = null;
    this.exited = false;
  }

  start() {
    fs.mkdirSync(path.dirname(this.logFile), { recursive: true });
    const out = fs.openSync(this.logFile, "a");
    this.exited = false;
    this.child = spawn(this.command, this.args, {
      env: { ...process.env, ...this.env },
      stdio: ["ignore", out, out],
      windowsHide: true,
    });
    fs.closeSync(out);
    this.child.on("error", (e) => {
      this.exited = true;
      this.log.error(`Cannot start the application: ${e.message}`);
    });
    this.child.on("exit", (code) => {
      this.exited = true;
      this.log.info(`Application stopped (exit ${code})`);
    });
  }

  /** Waits until the backend answers /api/health. Gives a clear error if it stops or takes too long. */
  async waitHealthy(port, { timeoutMs = 120000 } = {}) {
    const url = `http://127.0.0.1:${port}/api/health`;
    const started = Date.now();
    for (;;) {
      if (this.exited) throw new Error(`The application stopped while starting.\n${tail(this.logFile)}`);
      try {
        await ping(url);
        return;
      } catch {
        /* not ready yet */
      }
      if (Date.now() - started > timeoutMs) throw new Error(`The application took too long to start.\n${tail(this.logFile)}`);
      await sleep(250);
    }
  }

  async stop() {
    if (!this.child || this.exited) return;
    const gone = new Promise((resolve) => this.child.once("exit", resolve));
    this.child.kill();
    await Promise.race([gone, sleep(10000)]);
    if (!this.exited) this.child.kill("SIGKILL");
  }
}

module.exports = { Backend };
