# Church Treasury: system architecture

## 1. The big picture

Everything runs on one computer. There is no internet and no outside server.

```
  Browser / Electron window
  React + TypeScript screens (tabs)
            |
            |  HTTP calls to /api/...   (localhost only, 127.0.0.1:8765)
            v
  Spring Boot backend (Java 21)
  Controller  ->  Service  ->  Repository
  (HTTP only)     (rules)      (SQL only)
                                   |
                                   v
                      PostgreSQL database (on the same computer)
```

Each layer has one job, and a layer only talks to the one directly below it:

| Layer | Job | Never does |
|---|---|---|
| Screen (React) | Shows data, collects typing, calls the API | Decides the final numbers or saves anything by itself |
| Controller | Reads the HTTP request, calls a service, returns JSON | Business rules, SQL |
| Service | All business rules (numbering, checks, 50/50 split, edit, delete, restore, audit) | SQL |
| Repository | All SQL, one class per area of the database | Business rules |
| Database | Stores the records | |

## 2. Backend classes (`backend/src/main/java/com/church/treasury`)

### Classes that talk to the database (repositories and set-up)
| Class | What it does |
|---|---|
| `db/DatabaseConfig` | Connects to PostgreSQL, creates the tables and starting items on first run (all or nothing) |
| `db/DatabaseProperties` | Reads the connection details (`treasury.db.url`, `username`, `password`, optional `schema`) from `application.yml` or environment variables |
| `repository/ReceiptRepository` | SQL for `receipts` and `receipt_lines`: next number, number check, insert, update, search with filters, header, lines, mark deleted, restore |
| `repository/PersonRepository` | SQL for `people`: find by name (ignoring case), insert, name search for suggestions |
| `repository/CatalogRepository` | SQL for `funds`, `items`, `subgroups`: lists, item and sub-group checks, Offering item ids |
| `repository/AuditRepository` | SQL for `audit_log`: read the last hash, insert an entry, search, read all entries in order |
| `repository/ItemRepository` | SQL for managing items and sub-groups: list, name checks, insert, rename, mark deleted, restore |
| `repository/ReportRepository` | SQL for reports: totals per fund, item and sub-group for a period, and one person's lines |
| `repository/DeletedRepository` | SQL that lists deleted receipts, items and sub-groups |
| `repository/SettingsRepository` | SQL for the `settings` table (read all, save one value) |
| `repository/SqlText` | Helper that makes typed text safe inside `LIKE` searches |

### Classes that handle the logic (services)
| Class | What it does |
|---|---|
| `receipt/ReceiptService` | **The main logic class.** Receipt numbering, checking every line, the 50/50 offering split, creating, editing (old lines are kept and flagged), deleting with a reason, restoring, building the receipt detail, writing audit entries |
| `money/Money` | Exact money as whole hundredths (500.50 is stored as 50050), no floating point |
| `money/OfferingSplitter` | Splits an offering 50/50, decimals kept; an odd hundredth goes to the Local Fund |
| `audit/AuditService` | Writes audit entries (each hash includes the previous one), searches the log, and **checks the whole chain** for tampering |
| `item/ItemAdminService` | Rules for items and sub-groups: add to a fund, rename, delete with a reason, restore. Built-in Offering items are locked; an item with receipts cannot change fund |
| `report/ReportService` | Builds the period totals (per item, fund, overall) and a person's statement; an Offering is shown as one amount |
| `settings/SettingsService` | Church name, address, treasurer name, currency and receipt note, with defaults |
| `deleted/DeletedService` | Everything deleted, most recent first |
| `catalog/CatalogService` | Gives the screens the funds, items and sub-groups |
| `people/PeopleService` | Turns what is typed into a safe search for name suggestions |

### Classes that talk HTTP (controllers) and shape errors
| Class | What it does |
|---|---|
| `api/ReceiptController` | `/api/receipts...` endpoints, calls `ReceiptService` |
| `api/CatalogController` | `/api/catalog`, calls `CatalogService` |
| `api/PeopleController` | `/api/people`, calls `PeopleService` |
| `api/ItemAdminController` | Items and sub-groups tab calls, calls `ItemAdminService` |
| `api/ReportController` | `/api/reports/...`, calls `ReportService` |
| `api/AuditController`, `api/DeletedController` | Audit log, integrity check and the deleted list |
| `api/SettingsController` | `/api/settings` |
| `api/HealthController` | `/api/health` check |
| `api/ApiException`, `api/ApiExceptionHandler` | Every error becomes `{"message": "..."}` with status 400, 404 or 409 so the screen can show it as written |

Data carriers: `CreateReceiptRequest`, `ReceiptSummary`, `ReceiptDetail`, `CatalogDto`.

## 3. API calls

All calls are JSON over HTTP on `127.0.0.1:8765`. Errors return `{"message": "..."}`.

| Call | Used by | What it does |
|---|---|---|
| `GET /api/health` | tests, start-up check | Confirms the backend and database are up |
| `GET /api/catalog` | New receipt, Edit receipt | Funds, items and their sub-groups for the dropdowns |
| `GET /api/people?q=ma` | Name field while typing | Up to 8 saved names containing the text, names starting with it first |
| `GET /api/receipts/next-number` | New receipt (on opening) | Highest number ever used + 1 (deleted receipts keep their numbers) |
| `GET /api/receipts?date=2026-10-03` | New receipt ("Saved on" list) | Receipts of one date |
| `GET /api/receipts/search?from=&to=&q=&includeDeleted=` | Receipts tab | Filter by date range, name or receipt number, newest first |
| `GET /api/receipts/{id}` | Receipts tab (Open) | One receipt with its lines (an Offering shown as one line) |
| `POST /api/receipts` | New receipt (Save) | Creates a receipt, returns 201 |
| `PUT /api/receipts/{id}` | Edit receipt (Save changes) | Replaces number, date, person and lines |
| `DELETE /api/receipts/{id}?reason=...` | Receipts tab (Delete) | Hides the receipt, keeps all data, records the reason |
| `POST /api/receipts/{id}/restore` | Receipts tab (Restore) | Brings a deleted receipt back |

| `GET /api/items` | Items and sub-groups tab | Both funds with items and sub-groups (shows which are already used) |
| `POST /api/items` | Items tab | Add an item to a chosen fund |
| `PUT /api/items/{id}` | Items tab | Rename an item |
| `DELETE /api/items/{id}?reason=` | Items tab | Delete an item (kept in history) |
| `POST /api/items/{id}/restore` | Deleted tab | Restore an item |
| `POST /api/items/{id}/subgroups` | Items tab | Add a sub-group (for example under Lunch) |
| `PUT /api/subgroups/{id}` | Items tab | Rename a sub-group |
| `DELETE /api/subgroups/{id}?reason=` | Items tab | Delete a sub-group |
| `POST /api/subgroups/{id}/restore` | Deleted tab | Restore a sub-group |
| `GET /api/reports/summary?from=&to=` | Reports | Totals per item, fund and overall (one Sabbath is from = to) |
| `GET /api/reports/person?name=&from=&to=&item=` | Person statements | One person's total, per item and receipt by receipt |
| `GET /api/audit?from=&to=&action=&q=` | Audit log tab | Newest 500 matching entries |
| `GET /api/audit/verify` | Audit log tab | Checks every entry's hash and link; reports the first broken entry |
| `GET /api/deleted` | Deleted tab | Deleted receipts, items and sub-groups with the reason |
| `GET /api/settings`, `PUT /api/settings` | Settings, receipts, exports | Church name and the other options |

Error codes: 400 something to fix (empty name, zero amount, missing reason), 404 receipt not found,
409 conflict (receipt number already used, editing a deleted receipt, deleting twice).

Example, saving a receipt (an Offering line sets `offering` to true):

    POST /api/receipts
    { "receiptNumber": 12, "date": "2026-10-03", "personName": "Jane Doe",
      "lines": [ { "itemId": 1,    "offering": false, "subgroupId": null, "amount": "50000" },
                 { "itemId": null, "offering": true,  "subgroupId": null, "amount": "1001"  } ] }

## 4. What happens when the treasurer saves a receipt

1. `ReceiptForm` checks the form (name, amounts, sub-group) and sends `POST /api/receipts`.
2. `ReceiptController` passes it to `ReceiptService.create` (one transaction: all or nothing).
3. The service checks the number is unused, parses every amount with `Money`, checks every item and sub-group
   through `CatalogRepository`. If any line is wrong, nothing is written.
4. `PersonRepository` finds the person (ignoring case) or adds them.
5. `ReceiptRepository` inserts the receipt and its lines. An Offering becomes two linked lines
   (Offerings 50% in Trust Fund, LCB 50% in Local Fund) using `OfferingSplitter`.
6. `AuditService` writes the audit entry (through `AuditRepository`).
7. The summary goes back, the screen shows "Receipt 12 saved", sets the next number to 13 and refreshes the list from the database.

## 5. Database tables

`funds`, `items`, `subgroups`, `people`, `receipts`, `receipt_lines`, `settings`, `audit_log`
(full definition and starting items: `backend/src/main/resources/db/V1__schema.sql`).

- Money is stored as whole hundredths.
- Nothing is ever hard-deleted: rows get `deleted_at` and `delete_reason`. Edited receipts keep their old lines, flagged "replaced by edit".
- Receipt numbers are unique across all receipts, deleted ones included, so a number is never reused.
- Ids are generated by PostgreSQL (identity columns); inserts use `RETURNING id`.
- Name searches use `ILIKE` (ignores upper and lower case). Each backend test class uses its own `test_*` schema.

## 6. PDF and Excel export

Files are made in the app window (not by the Java backend), from the same data the screens show. This works
offline and is covered by automated tests that open the generated files.

| File | Makes |
|---|---|
| `exports/reportExport.ts` | Collections report: PDF, and Excel with real SUM formulas |
| `exports/statementExport.ts` | Person statement: PDF, and Excel (statement sheet and by-item sheet) |
| `exports/receiptPdf.ts` | One receipt as an A5 PDF (Receipts tab, PDF button) |
| `exports/common.ts` | Logo loading (top right), header with church name, footer with page numbers, download helper |

Every file shows the church name from Settings and the logo at the top right. The PDF and Excel libraries load only when a download is clicked, so the app starts quickly.

## 7. Frontend files (`frontend/src`)

| File | Job |
|---|---|
| `api.ts` | Every call to the backend, with types |
| `lib/money.ts`, `lib/dates.ts` | Money and date helpers (money mirrors the Java rules) |
| `components/ReceiptForm.tsx` | The receipt form and live preview, used for New and Edit |
| `components/NameInput.tsx` | Name field with suggestions while typing |
| `components/Sidebar.tsx` | The tabs |
| `components/ReasonDialog.tsx`, `PeriodPicker.tsx`, `ExportButtons.tsx` | Delete-with-reason box, Sabbath/month/year picker, PDF and Excel buttons |
| `hooks/useSettings.ts` | Loads the church settings |
| `lib/periods.ts` | Last Sabbath, month, last month, year ranges |
| `pages/NewReceipt`, `Receipts`, `Items`, `Reports`, `Statements`, `AuditLog`, `Settings` | One screen per tab |

## 8. Tests

| Test | Covers |
|---|---|
| `MoneyTest`, `OfferingSplitterTest` | Exact money, the 50/50 split |
| `DatabaseSetupTest` | Tables created, items seeded, database rules (no zero amounts, links enforced, unique numbers) |
| `ReceiptApiTest` | Saving, numbering, duplicates, sub-groups, name suggestions, audit chain, HTTP errors |
| `ReceiptManagementTest` | Detail view, edit, delete, restore, search, HTTP endpoints |
| `ItemAdminTest` | Adding sub-groups and items, built-in items locked, delete and restore, names unique |
| `ReportServiceTest` | A hand-calculated set of receipts: Sabbath, period, deleted and edited receipts, person statements |
| `AuditAndSettingsTest` | Settings, audit search, the chain check catching a changed or removed entry, the deleted list |
| `money.test.ts`, `periods.test.ts` (frontend) | Money rules, Sabbath and month dates |
| `exports.test.ts` (frontend) | PDFs are real, Excel has the logo and working formulas, empty data is handled |

## 9. Not built yet

Login and recovery key, backup and restore (and the password option in Settings), and the Windows installer
(Electron). Database encryption is now done outside the app (disk encryption on the computer and encrypted
`pg_dump` backups), because the SQLCipher plan only applied to SQLite.
