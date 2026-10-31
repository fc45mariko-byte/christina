# Christina × Body Oracle — integration plan

Christina is the personal dashboard. Body Oracle (from `fc45mariko-byte/bodyoracle`, left unchanged)
becomes its self-observation module. Christina's interface is the foundation; Body Oracle is restyled to match it.

Work happens on the branch `claude/christina-dashboard-integration-4nuu33`. `main` and the live site are not touched
until cut-over.

## Principles

- Local-first: all data stays on the device (IndexedDB). No accounts, no API keys, no network calls.
- No build step and no dependencies: plain ES modules served by GitHub Pages from `docs/`.
- AI is not part of the core. Insights are counts the person can trace back to their own records.
- Nothing existing is removed without approval.

## Structure

```
docs/
  index.html  sw.js  manifest.webmanifest  icons/
  app/
    main.js              boot: register modules, open DB, render
    core/                knows nothing about specific modules
      registry.js        modules register tabs, screens, actions, validators
      state.js           one navigation stack per tab
      render.js          render loop
      events.js          delegated data-action / data-bind / data-change / data-file-input / data-longpress
      db.js              IndexedDB
      prefs.js           per-device preferences
      queries.js  catalog.js  util.js  validation.js
    services/            media.js (photos), backup.js (export)
    ui/                  tokens.css, base.css, components.css, components.js, icons.js
    modules/
      overview/  calendar/  add/  records/  threads/  archive/  settings/
      (planned) journal/  tasks/  projects/  habits/  body-oracle/  insights/
```

Each module registers itself with `register({ tabs, screens, actions, changeActions, fileActions, validators })`.
The core only reads the registry, so new modules never require core changes.

## Data stores (database `christina`, schema v2 — in place)

The full schema is documented in `docs/app/core/schema.js`. Every record has `id`, `createdAt`, `updatedAt` (ISO 8601).

| Store | Holds | Source |
|---|---|---|
| `records` | Everything that happened. `kind` = `activity` now; later `journal`, `note`, `body`, `state`, `dream`, `sign`, `ritual-done`. Shared fields: `occurredAt`, `title`, `text`, `categoryIds`, `threadIds`, `tagIds`, `mediaIds`, `linkedRecordIds`, `payload`, `archived` | Christina events (migrated), Body Oracle entries (step 4) |
| `threads` | One shared thread type: `title`, `categoryId`, `color`, `startDate`/`endDate` (bar on the calendar); Body Oracle's cover, icon and description added in step 4 | both apps' threads, merged |
| `months` | Month images, palette, title | Christina |
| `files` | Photos and other media, keyed by path | Christina (Body Oracle media in step 4) |
| `categories` | `name`, `color`, `icon`, `order`; Christina's 8 seeded as presets (`cat-study` …) | Christina presets, Body Oracle categories (step 4) |
| `schedule` | Planned calendar items | new (step 7) |
| `tasks`, `projects`, `habits`, `habitLogs` | Task, project and habit data; one log row per habit check-in | new (step 7) |
| `tags`, `states` | Editable labels | Body Oracle (step 4) |
| `rituals`, `prayers`, `intentions`, `sigils`, `oracleReadings` | Body Oracle library | Body Oracle (step 4) |
| `legacy` | Untouched copies of v1 `events`, `threads`, `months` as they were before the upgrade | migration |
| `meta` | Schema version and when the upgrade ran | migration |

Per-device preferences (week start, week view, dashboard layout, tab slots) stay in `localStorage` under `christina.*` and are included in the backup.

Insights are computed on demand and always link to the records they were counted from.

## Build order

1. **Split Christina into modules with no change in behaviour; add export.** — done
2. **Database v2 and migration of existing data (old data kept in `legacy`).** — done
3. Shell: tab bar (Overview · Calendar · + · Journal · More, four slots user-chosen), More screen, desktop sidebar, + sheet.
4. Port Body Oracle as a module, restyled; import from its backup file.
5. One Archive and one search; Journal module.
6. Dashboard widgets, sizes and layouts.
7. Calendar events, Tasks, Projects, Habits.
8. Insights.
9. Appearance and customisation settings.
10. Tests on phone and desktop sizes, preview deploy, cut-over.

## Decisions

| Question | Decision |
|---|---|
| Habit progress | Streaks (current and longest) |
| Christina threads vs Body Oracle threads | Merge into one thread type |
| Preview hosting | No preference given; build and test on the branch for now |
| Oracle archetype readings | Opt-in: count lines always shown, archetype text only when turned on in Settings |
| Rituals, prayers, sigils, intentions, sample content | Keep inside Body Oracle |
| Read-only past months scope | Everything: all records lock once their month has passed |
| Relationships, boundaries, sleep, energy, mood intensity | New features, built after the core modules (Tasks, Habits, Projects, Insights) |
| Reminders | In-app now; push server planned later |
| Calendar tab | Named "Calendar"; the four tab slots are chosen by the user |

## Step 1 — what changed

- `docs/app.js` (1,644 lines) split into `docs/app/` modules; `docs/styles.css` split into `docs/app/ui/*.css`, content unchanged.
- Settings → Data & Export: "Export to CSV" was a placeholder. It now exports, along with a full backup:
  - **Export backup (JSON)**: every event, thread, month, photo (as data URLs) and preference.
  - **Export events (CSV)**: one row per event, for spreadsheets.
  On iPhone the file goes to the share sheet; elsewhere it downloads. "iCloud backup" is still marked "Not in this build".
- Service worker cache bumped to `christina-v3` with the new file list.
- Database name and version unchanged, so existing data on a phone loads as before.

Verified by running the original and the restructured app side by side in Chromium through the same 45-step
session (adding events with photos, threads, editing, archiving, long-press menu, personalized month,
week view, deleting, reloading): the rendered HTML was identical at every step, with no console errors.

## Step 2 — what changed

- Database `christina` upgraded from version 1 to 2 (`docs/app/core/schema.js`). The upgrade runs once, inside one
  transaction: if anything fails, version 1 stays exactly as it was.
  - Each v1 event becomes a record of kind `activity` with the same id. Notes → `text`, duration → `payload.duration`,
    photo → `mediaIds`, thread → `threadIds`, category name → `categoryIds`.
  - Threads get `categoryId` in place of the category name.
  - Christina's 8 categories are stored as editable category records with fixed ids.
  - Copies of the v1 `events`, `threads` and `months` are kept in `legacy`. Photos are not copied or moved.
  - Empty stores for the coming modules are created now, so later modules don't need another upgrade prompt.
- All screens read the new shape. Nothing visible changes.
- Backup format version 2: every data store under `stores`, plus photos and preferences.
- Service worker cache bumped to `christina-v4`.

Verified:
- New install: the 45-step side-by-side session against the original app renders identical HTML at every step.
- Upgrade: data created with the original app (a thread, events in two months with photo, notes, duration and thread,
  a personalized month), then the new code loaded at the same address: 11 screens identical before and after,
  every field carried over, `legacy` holds the originals, a second reload changes nothing, no console errors.
- Export: backup contains every store and the photo; the CSV reads the new records.
