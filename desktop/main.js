"use strict";
const { app, BrowserWindow, Menu, dialog } = require("electron");
const path = require("path");
const { createLogger } = require("./lib/log");
const { resolvePaths } = require("./lib/paths");
const { startAll } = require("./lib/services");

const ICON = path.join(__dirname, "assets", "icon.png");
let splash = null;
let win = null;
let services = null;
let quitting = false;
let log = null;

// Only one copy of the app may run (two would fight over the same database).
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(boot);
}

function showStatus(text) {
  if (splash && !splash.isDestroyed()) {
    splash.webContents.executeJavaScript(`document.getElementById("status").textContent = ${JSON.stringify(text)}`).catch(() => {});
  }
}

function createSplash() {
  const w = new BrowserWindow({
    width: 460, height: 340, frame: false, resizable: false, movable: true, center: true,
    alwaysOnTop: true, show: false, icon: ICON, backgroundColor: "#ffffff",
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  w.loadFile(path.join(__dirname, "splash.html"));
  w.once("ready-to-show", () => w.show());   // the logo appears at once, before anything else starts
  return w;
}

async function boot() {
  Menu.setApplicationMenu(null);
  splash = createSplash();

  const paths = resolvePaths({
    packaged: app.isPackaged,
    resourcesDir: process.resourcesPath,
    userDataDir: app.getPath("userData"),
    stageDir: process.env.TREASURY_STAGE_DIR,
  });
  log = createLogger(paths.logDir);
  log.info(`Starting Church Treasury ${app.getVersion()}`);

  try {
    services = await startAll({ paths, log, onStatus: showStatus });
  } catch (e) {
    log.error(`Start-up failed: ${e.message}`);
    if (splash && !splash.isDestroyed()) splash.close();
    dialog.showErrorBox("Church Treasury could not start",
      `${e.message}\n\nMore details are in the log folder:\n${paths.logDir}`);
    quitting = true;
    app.exit(1);
    return;
  }

  showStatus("Opening...");
  win = new BrowserWindow({
    width: 1360, height: 860, minWidth: 1000, minHeight: 640, show: false, icon: ICON, autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  const origin = new URL(services.url).origin;
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin !== origin) event.preventDefault();   // the app never leaves its own pages
  });
  win.once("ready-to-show", () => {
    if (splash && !splash.isDestroyed()) splash.close();
    win.maximize();
    win.show();
  });
  win.on("closed", () => {
    win = null;
    app.quit();
  });
  win.loadURL(services.url);

  // test hook: lets an automatic test close the app by itself (never set in normal use)
  if (process.env.TREASURY_AUTOQUIT_MS) setTimeout(() => app.quit(), Number(process.env.TREASURY_AUTOQUIT_MS));
}

// When the window closes, stop the application and the database cleanly before the program exits.
app.on("before-quit", (event) => {
  if (quitting) return;
  quitting = true;
  if (!services) return;
  event.preventDefault();
  Promise.resolve(services.stop())
    .catch((e) => log && log.error(`Shutdown: ${e.message}`))
    .finally(() => app.exit(0));
});

app.on("window-all-closed", () => {
  if (!win && !splash) app.quit();
});
