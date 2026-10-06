# Church Treasury (desktop app)

React + TypeScript (frontend), Spring Boot on Java 21 (backend), PostgreSQL (database).
Electron packaging comes in a later stage.

## What is in this drop
All seven tabs work:
- New receipt and Receipts: save, search, open, edit, delete with a reason, restore, receipt PDF.
- Items and sub-groups: add items to a fund, add Lunch and Kanisa Ku Mutima sub-groups, rename, delete, restore.
- Reports: totals per item, fund and overall for a Sabbath, month, year or any dates; PDF and Excel with the logo.
- Person statements: one person's total, per item, by receipt; PDF and Excel.
- Audit log and deleted: searchable log, a check that the log was not tampered with, restore deleted things.
- Settings: church name, address, treasurer name, currency, receipt note.

Still to come: login and recovery key, backup and restore, the Windows installer.
See ARCHITECTURE.md for the layers, classes and every API call.

## Requirements
- JDK 21 and Maven 3.9+
- Node 20+
- PostgreSQL 14 or newer, running on this computer

## One-time database set-up
Create a user and an empty database (Linux; on Windows use pgAdmin or the SQL Shell with the same commands):

    sudo -u postgres psql -c "CREATE USER treasury WITH PASSWORD 'treasury';"
    sudo -u postgres psql -c "CREATE DATABASE treasury OWNER treasury;"

The tables and the starting items (both funds and all items) are created automatically the first time
the backend starts. To use other names or a password of your own, set these before starting the backend:

    TREASURY_DB_URL=jdbc:postgresql://localhost:5432/treasury
    TREASURY_DB_USER=treasury
    TREASURY_DB_PASSWORD=your-password

## Run everything (two terminals)
    # terminal 1
    cd backend && mvn spring-boot:run -Dspring-boot.run.profiles=dev
    # terminal 2
    cd frontend && npm install && npm run dev      # open http://localhost:5173

    # health:  http://127.0.0.1:8765/api/health
    # swagger: http://127.0.0.1:8765/swagger-ui.html   (dev profile only)

## Tests
    cd backend && mvn test        # needs the PostgreSQL database above
    cd frontend && npm test

Each backend test class works in its own schema called test_<name> inside the same database
(created and dropped by the tests). It never touches the real tables in the default schema.
If your database is not the default one, set TREASURY_TEST_DB_URL, TREASURY_TEST_DB_USER and
TREASURY_TEST_DB_PASSWORD.

## Database
- Schema and starting data: `backend/src/main/resources/db/V1__schema.sql` (created on first start).
- Money is stored as whole hundredths; nothing is hard-deleted (deleted_at + delete_reason);
  the audit log has a hash chain.
- Backups: use `pg_dump` (the in-app Backup and Restore buttons come later).
