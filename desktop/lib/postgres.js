"use strict";
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

/**
 * Runs the PostgreSQL that is shipped inside the app. It keeps its data in the user's
 * data folder (pgdata), listens only on this computer, and is started and stopped by the app.
 */
class Postgres {
  constructor({ binDir, dataDir, config, log, exe }) {
    this.binDir = binDir;
    this.dataDir = dataDir;
    this.clusterDir = path.join(dataDir, "pgdata");
    this.logFile = path.join(dataDir, "logs", "postgres.log");
    this.config = config;
    this.log = log;
    this.exe = exe ?? (process.platform === "win32" ? ".exe" : "");
  }

  bin(name) {
    return path.join(this.binDir, name + this.exe);
  }

  clusterExists() {
    return fs.existsSync(path.join(this.clusterDir, "PG_VERSION"));
  }

  /** Runs one PostgreSQL program. Rejects with a readable message if it fails. */
  run(name, args, { input, env } = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(this.bin(name), args, { env: { ...process.env, ...env }, windowsHide: true });
      let out = "";
      let err = "";
      child.stdout.on("data", (d) => (out += d));
      child.stderr.on("data", (d) => (err += d));
      child.on("error", (e) => reject(new Error(`Cannot run ${name}: ${e.message}`)));
      child.on("close", (code) => {
        if (code === 0) return resolve({ out, err, code });
        const detail = (err || out).trim().split(/\r?\n/).slice(-6).join(" | ");
        const e = new Error(`${name} failed (exit ${code}): ${detail}`);
        e.code = code;
        reject(e);
      });
      child.stdin.on("error", () => {});   // a program that never reads its input closes the pipe: not an error
      child.stdin.end(input ?? "");
    });
  }

  /** First run only: creates the database files. Returns true if it just created them. */
  async ensureCluster() {
    if (this.clusterExists()) return false;
    fs.mkdirSync(this.dataDir, { recursive: true });
    const pwFile = path.join(this.dataDir, ".pgpass-init");
    fs.writeFileSync(pwFile, this.config.pgSuperPassword, { mode: 0o600 });
    try {
      this.log.info("Creating the database files (first run)");
      // locale C keeps this working on every Windows language; text is stored as UTF-8
      await this.run("initdb", ["-D", this.clusterDir, "-U", "postgres", "--auth=scram-sha-256",
        `--pwfile=${pwFile}`, "-E", "UTF8", "--locale=C"]);
    } catch (e) {
      fs.rmSync(this.clusterDir, { recursive: true, force: true });   // so the next start can try again cleanly
      throw e;
    } finally {
      fs.rmSync(pwFile, { force: true });
    }
    return true;
  }

  async isRunning() {
    try {
      await this.run("pg_ctl", ["status", "-D", this.clusterDir]);
      return true;
    } catch {
      return false;
    }
  }

  /** Starts the database on the given port, only reachable from this computer. */
  async start(port) {
    if (await this.isRunning()) {
      this.log.info("The database was still running from before; restarting it");
      await this.stop();
    }
    fs.mkdirSync(path.dirname(this.logFile), { recursive: true });
    const opts = [`-p ${port}`, "-c listen_addresses=127.0.0.1", "-c max_connections=30", "-c shared_buffers=64MB"];
    if (process.platform !== "win32") {
      const sock = path.join(this.dataDir, "sock");
      fs.mkdirSync(sock, { recursive: true });
      opts.push(`-c 'unix_socket_directories=${sock}'`);   // quoted: the folder name may contain spaces. Windows has no unix sockets
    }
    await this.run("pg_ctl", ["start", "-D", this.clusterDir, "-w", "-t", "60", "-l", this.logFile, "-o", opts.join(" ")]);
    this.port = port;
    this.log.info(`Database started on port ${port}`);
  }

  /** Makes sure the app's own user and database exist (safe to run on every start). */
  async ensureDatabase(port) {
    const { dbUser: user, dbName: name, dbPassword, pgSuperPassword } = this.config;
    const env = { PGPASSWORD: pgSuperPassword };
    const base = ["-h", "127.0.0.1", "-p", String(port), "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qtA"];
    const ask = (sql) => this.run("psql", [...base, "-c", sql], { env });

    if (!(await ask(`SELECT 1 FROM pg_roles WHERE rolname='${user}'`)).out.trim()) {
      // the password goes in through stdin so it never appears in a command line
      await this.run("psql", [...base, "-f", "-"], { env, input: `CREATE ROLE ${user} LOGIN PASSWORD '${dbPassword}';\n` });
    }
    if (!(await ask(`SELECT 1 FROM pg_database WHERE datname='${name}'`)).out.trim()) {
      await ask(`CREATE DATABASE ${name} OWNER ${user} ENCODING 'UTF8' TEMPLATE template0`);
    }
  }

  /** Stops the database cleanly (waits until everything is safely written). */
  async stop() {
    try {
      await this.run("pg_ctl", ["stop", "-D", this.clusterDir, "-m", "fast", "-w", "-t", "30"]);
      this.log.info("Database stopped");
    } catch (e) {
      this.log.error(`Stopping the database: ${e.message}`);
    }
  }
}

module.exports = { Postgres };
