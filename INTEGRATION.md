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

## Planned data stores (database `christina`, v2)

| Store | Holds | Source |
|---|---|---|
| `records` | Everything that happened: activities, journal, notes, body observations, states, dreams, signs, rituals done | Christina events, Body Oracle entries |
| `events` | Scheduled calendar items | new |
| `tasks` | Tasks with due date, priority, status | new |
| `threads` | One shared thread type: optional dates (bar on the calendar), optional cover, icon, description | both apps' threads, merged |
| `projects` | Milestones and progress, backed by a thread | new |
| `habits`, `habitLogs` | Habit definitions and one log row per check-in | new |
| `categories`, `tags`, `states` | Editable labels | Christina presets, Body Oracle categories and states |
| `rituals`, `prayers`, `intentions`, `sigils`, `oracleReadings` | Body Oracle library | Body Oracle |
| `months` | Month images, palette, title | Christina |
| `media` | Photos and videos | both |
| `prefs` | Appearance, dashboard layouts, tab slots | both |

Insights are computed on demand and always link to the records they were counted from.

## Build order

1. **Split Christina into modules with no change in behaviour; add export.** — done
2. Database v2 and migration of existing data (old data left in place).
3. Shell: tab bar (Overview · Calendar · + · Journal · More), More screen, desktop sidebar, + sheet.
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
| Oracle archetype readings | open |
| Rituals, prayers, sigils, intentions, sample content | open (default: keep inside Body Oracle) |
| Read-only past months scope | open |
| Relationships, boundaries, sleep, energy, mood intensity | open (these are new features) |
| Reminders | open (no push without a server) |
| "Map" vs "Calendar", fixed vs chosen tab slots | open |

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
