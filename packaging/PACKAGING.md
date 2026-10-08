# Packaging: how the installer is made and how the installed app works

## What the church computer gets
One installer, `Church Treasury Setup 0.1.0.exe`. Nothing else has to be installed: Java and PostgreSQL are
inside it. It installs for the current Windows user (no administrator password), puts a **Church Treasury**
icon (the church logo) on the desktop and in the Start menu, and opens the app.

## What is inside the installed app
```
Church Treasury.exe        the window (Electron). Starts everything below, shows the logo while it does.
resources\app.asar         the start-up code (desktop\main.js and desktop\lib\*)
resources\backend\         treasury.jar   the Spring Boot application, with the React screens inside it
resources\runtime\         a small Java, made with jlink (only the Java parts the backend needs)
resources\postgres\        PostgreSQL (bin, lib, share), started and stopped by the app
```
The user's data is **not** here. It is in `%APPDATA%\Church Treasury\`:
```
pgdata\       the database files
config.json   two random passwords for the private database (nobody types or knows them)
logs\         app.log, backend.log, postgres.log   (look here first if something goes wrong)
```
Updating or reinstalling the app never touches that folder, and uninstalling keeps it on purpose.
**Copy this folder to back up the data** (with the app closed) until the in-app backup exists.
Use the same Windows account every time: each Windows user has their own `%APPDATA%`, so their own database.

## What happens when the icon is clicked  (desktop\lib\services.js)
1. The logo window appears at once.
2. **First time only:** PostgreSQL creates its files (a few seconds). The two random passwords are made.
3. PostgreSQL starts on a free port, reachable only from this computer (`127.0.0.1`).
4. The `treasury` user and database are created if missing.
5. The backend starts (`java -jar treasury.jar`) on another free port, with the database details given to it
   through environment variables. The backend creates the tables and items the first time.
6. The app waits until `/api/health` answers, then opens the main window on `http://127.0.0.1:<port>/`.
   The backend serves both the API and the screens, so everything is one address and nothing can be reached
   from outside the computer.
7. When the window is closed, the backend is stopped, then PostgreSQL is stopped cleanly. If start-up fails,
   whatever was started is stopped again and a message shows the reason and the log folder.

Only one copy of the app can run at a time (a second click just brings the first window forward).

## Making the installer
### Easiest: GitHub does it  (.github\workflows\build-windows.yml)
1. Push the project to GitHub (it must include `frontend\package-lock.json` and `desktop\package-lock.json`).
2. On every push, GitHub runs all tests (backend against a real PostgreSQL, frontend, desktop).
3. To make the installer: GitHub, **Actions**, **Test and build Windows installer**, **Run workflow**.
   (Pushing a tag such as `v0.1.0` does the same.)
4. When it finishes, open the run and download **church-treasury-windows-installer** under *Artifacts*.
   It is a zip containing the `.exe`.

The Windows job builds the frontend and backend, makes the Java runtime with jlink, downloads and trims
PostgreSQL, **starts the real database and the real application once as a check** (`packaging\smoke-test.js`),
and only then builds the installer. A broken build stops before an installer exists.

### On a Windows computer
Install JDK 21, Node 22 and Maven, open **PowerShell 7**, and run `.\packaging\build-windows.ps1`.

### PostgreSQL download address
The script downloads PostgreSQL from EDB. If that address stops working, get the Windows **binaries** zip
from https://www.enterprisedb.com/download-postgresql-binaries, save it as `packaging\downloads\postgres.zip`
(the script uses it if it is there), or change `$PgZipUrl` at the top of `build-windows.ps1`.

## Trying it before installing
After a build, `packaging\stage` holds the same folders. On any computer with Node:
`cd desktop`, `npm install`, then `npm start` with the environment variable `TREASURY_STAGE_DIR` set to that folder.

## Installing on the church computer
1. Copy the `.exe` over (USB stick or download).
2. Double-click it. Windows may say **"Windows protected your PC"** because the installer is not signed
   (a signing certificate costs money). Click **More info**, then **Run anyway**.
3. The first start takes longer (it builds the database). Later starts are quicker.

## Known limits
- **There is no login yet.** Anyone who can open the app can use it. Do not use it for real money on a shared
  computer until the login is added.
- **No backup button yet**: copy `%APPDATA%\Church Treasury` for now.
- If a later version changes the database tables, a small upgrade step will be needed. Tables are only
  created when the database is new.
- Unsigned installer (see above). The installer is large (it contains Electron, Java and PostgreSQL).
- Built for 64-bit Windows 10 or 11.

## Troubleshooting
- Nothing opens, or an error box appears: open `%APPDATA%\Church Treasury\logs` and read `app.log`, then
  `backend.log` and `postgres.log`. The error box names the same folder.
- "settings file (config.json) is missing": the data folder was copied without `config.json`. Put it back.
- The app opened once and now will not: close all `Church Treasury` and `postgres` processes in Task Manager and try again.
