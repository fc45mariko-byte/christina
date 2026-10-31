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
    shell/               nav.js (tab bar, sidebar, slots), more.js (More, Settings → Tab bar)
    services/            media.js (photos), backup.js (export)
    ui/                  tokens.css, base.css, components.css, components.js, icons.js
    modules/
      overview/  calendar/  add/  records/  threads/  archive/  settings/
      body-oracle/       bo.js (the module), store.js (storage adapter), body-oracle.css
      (planned) journal/  tasks/  projects/  habits/  insights/
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
3. **Shell: tab bar with four user-chosen slots + More, More screen, desktop sidebar.** — done (the + sheet comes with the modules that add to it)
4. **Port Body Oracle as a module, restyled; import from its backup file.** — done
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

## Step 3 — what changed

- **Tab bar (phone):** `[slot 1] [slot 2] [+] [slot 3] [slot 4] [More]`, the same six positions as before.
  Default slots: Overview, Calendar, Threads, Archive. Home is now labelled **Overview** and Map **Calendar**.
  Settings moved into More. Journal joins the defaults when the Journal module exists (no empty tabs before that).
- **More:** lists every section not in the tab bar, plus **Tab bar** settings. A section opened from More shows its
  usual page with a Back button; the More button stays highlighted.
- **Settings → Tab bar** (also in More): pick the module for each of the four slots. Picking one that is already in
  another slot swaps them. Saved per device (`christina.tabSlots`).
- **Wide screens (≥ 900px):** a sidebar with every section and an Add button replaces the tab bar; pages are centred
  at up to 760px wide. Widening the window while a section is open inside More moves it to its sidebar entry.
- After saving, Add returns to Overview or Calendar as before; if that section has no slot, it opens inside More.
- Modules declare their place with `register({ nav: { id, label, icon, order } })`.
- Service worker cache bumped to `christina-v5`.

Verified: at desktop width the 45-step side-by-side session renders the same page content as the original at every
step except the new "Tab bar" row in Settings; the v1 → v2 upgrade test still shows 11 identical screens; phone flows
(More, opening and leaving sections, changing and swapping slots, reload, saving into an unpinned section, resizing
between phone and desktop, dark mode) work with no console errors.

## Step 4 — what changed

Body Oracle is a section of Christina (**More → Body Oracle**, or pinned to a tab slot). Its code is in
`docs/app/modules/body-oracle/`:

- `bo.js` — Body Oracle's own code, kept as it was, with these integration changes:
  - its screens render inside Christina's page; its four sections (Today, Rituals, Prayers, Archive) are a
    segmented control at the top, with a **+** that opens its add menu as a list sheet (instead of the radial)
  - inputs use `data-bo`, overlays use `#bo-sheet` / `#bo-modal`, so nothing clashes with Christina's own
  - **past months are read-only**: an entry from an earlier month shows "Archived", with no Edit or Delete
  - **archetype readings are opt-in**: the Oracle shows plain counts by default; Settings → Oracle readings
    turns the archetype reflection and question on
  - "Erase" erases Body Oracle's data only; Christina's events, threads and categories are kept
  - restoring a Body Oracle backup merges categories and threads that have the same name as existing ones
- `store.js` — adapter between Body Oracle's item shapes and Christina's shared database:
  entries → `records`, threads and categories → the shared stores, library items → their stores,
  settings → `meta` (`bodyOracle`), photos and videos → `files` as `media/<id>`.
  Every write updates Christina's in-memory data too; when Christina changes something, Body Oracle reloads.
- `body-oracle.css` — Body Oracle's styles scoped under `.m-bo`, its colour tokens mapped onto Christina's
  (light and dark), and an adaptation layer for Christina's type scale (24/16/14/12), segmented controls,
  chips, fields, buttons, sheets and radii. Christina's own `.card`, `.row`, `.chip`, `.field`, `.list`,
  `.dot`, `.tile`, `.cal`, `.day`, `.dots`, `.swatches` rules no longer reach inside the module.

Shared with Christina:
- **Categories**: one list. Body Oracle → Settings → Categories adds, renames, recolours and reorders them;
  Christina's Add uses them. "Other" cannot be deleted. Onboarding does not duplicate an existing name.
- **Threads**: one list. Body Oracle's threads appear in Christina's Threads with "No dates" until dates are set;
  a thread without dates is not drawn on the calendar. Renaming on either side shows on the other.
- **Backup**: Christina's backup now includes Body Oracle's records, library, settings and media.
  Body Oracle's own backup export still works from its Settings.

Not yet: Body Oracle's records are not shown on Christina's Overview, Calendar or Archive (they stay in Body
Oracle's own Archive, timeline and calendar). Bringing them together is step 5.

**To bring in Body Oracle data from the old app:** in the old Body Oracle, Settings → Backup → Export a backup.
In Christina, More → Body Oracle → (settings icon) → Backup → Restore from a backup, and choose that file.

Verified (Chromium, phone and desktop sizes, light and dark):
- Body Oracle flows: onboarding, note, body map observation with sensation and intensity, state, photo with the
  cropper, Archive grid / search / calendar, entry view, rituals and run mode, prayers, settings, shared categories,
  Oracle counts and archetypes, past-month lock, reload persistence — no console errors.
- Import: a backup made with the original Body Oracle app (custom category, photo, body observation, state) restored
  into a Christina that already had events: 3 entries, photo shown, searchable, categories and threads merged by
  name with links intact, Christina's event kept, Christina backup holds both, Body Oracle export still works,
  "Erase Body Oracle data" keeps Christina's event.
- Christina: the 45-step side-by-side session at desktop width shows the same page content as step 3 (only the
  Categories footnote changed; the remaining pixel differences are the clock minute and toast timing); the v1 → v2
  upgrade test still passes.

## Deployment at the Body Oracle address

The combined app is also served from the `bodyoracle` repository, replacing the original Body Oracle there
(its last original commit is `4e4cf5d` in that repository). The source stays in this repository; the
`bodyoracle` copy is the contents of `docs/`.

- **Automatic one-time import** (`docs/app/modules/body-oracle/legacy.js`): where the old Body Oracle ran, its
  database (`body-oracle`) is still on the device. On the first launch of the combined app, everything in it is
  copied into Christina's database — entries, photos and videos, states, rituals, prayers, intentions, sigils,
  Oracle readings, threads, categories and settings — with categories and threads merged by name. The old database
  is only read and is kept as a fallback. It runs once (recorded in `meta` as `bodyOracleImport`), and not at all
  if Christina already has Body Oracle data.
- **Offline caches** are named per address (`christina-v8 <scope>`), so copies at different paths on the same site
  don't delete each other's caches. The old Body Oracle cache is removed on update.
- **First launch after the update** still shows the old Body Oracle, served from its offline cache while the new
  version downloads. From the next launch the combined app runs and brings the data in.
- The installed Home Screen icon and name stay as they were installed until the app is added to the Home Screen again.

Verified: the original Body Oracle used at one address (custom category, photo note, body observation, state,
renamed space), then that address switched to the combined app: first launch old (from cache), second launch combined
app with all 3 entries, the photo, merged categories and the settings; old database untouched; no second import on
reload; only the new, address-named cache remains.
