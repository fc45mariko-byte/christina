# Christina

A personal dashboard for seeing life accumulate over time — what you did, what you plan, what you write, and what
you notice in your body and mood. It runs in the browser and installs on iPhone from Safari (Share → Add to Home
Screen). Everything stays on your device.

## What's in it

| Section | What it does |
|---|---|
| **Overview** | A dashboard of widgets you arrange: this month, today, reminders, upcoming plans, tasks, habits, projects, journal, Body Oracle, this week, insights. Presets and saved layouts. |
| **Calendar** | Day, week and month. Thread bars, record dots, plans (rings) and tasks due (squares). Plans with times and in-app reminders. |
| **Journal** | Dated entries with optional title, category, tags and thread; links to Body Oracle observations or events; search and tag filter. |
| **Tasks** | Due dates, priority, category, project; Overdue / Today / Upcoming / No date; done list. |
| **Habits** | Daily or times-a-week habits, check-ins, current and longest streaks, 16-week history. |
| **Projects** | Milestones, tasks and progress; an optional thread whose records show on the project. |
| **Insights** | Counts over 4 weeks, 3 months or 12 months; habits, states, body observations; "recorded together" by days. Every bar opens its records. |
| **Threads** | Long-running parts of life, drawn as bars on the calendar when they have dates. |
| **Archive** | Every month as a read-only calendar, and one search across everything. |
| **Body Oracle** | Self-observation: body map, states, notes, dreams, signs, rituals with guided run mode, prayers, intentions, sigils, and an Oracle that counts patterns (archetype readings are optional). |
| **Add (+)** | "I did something", "I want this to happen", and links to plan, task, journal and habit. |

Past months are read-only. Categories are shared everywhere and editable. Appearance (theme, accent, background,
font, density, widget style), the four tab-bar slots and which sections show are yours to set.

## Privacy and your data

- Everything is stored in this browser's storage on this device (IndexedDB). Nothing is synced, uploaded or sent
  anywhere. No account, no tracking, no API keys, no AI.
- **Back up:** Settings → Data & Export → Export backup (a JSON file with everything, photos included) or Export
  events (CSV). **Restore** and **Erase everything** are on the same screen.
- Removing the app from the Home Screen or clearing the site's data deletes everything, so export a backup now and then.
- **Body Oracle data from the old Body Oracle app:** export a backup there (Settings → Backup), then in Christina open
  Body Oracle → settings → Backup → Restore from a backup.

## For developers

Plain HTML, CSS and JavaScript modules. No build step and no dependencies. GitHub Pages serves `docs/`.

```
docs/
  index.html  sw.js  manifest.webmanifest  icons/
  app/
    main.js        boot: open the database, register modules, render
    core/          router/state, render loop, events, IndexedDB + schema, registry, preferences, appearance
    services/      media, backup (export / restore / erase), search
    ui/            tokens.css, base.css, components.css, components.js, icons.js
    shell/         tab bar, sidebar, More
    modules/       overview, calendar, journal, tasks, habits, projects, insights, threads, archive,
                   records, add, settings, body-oracle
```

Modules add themselves with `register({ nav, tabs, screens, actions, validators, widgets, kinds, … })`; the core only
reads the registry. The data model is documented in `docs/app/core/schema.js`; the integration history, decisions and
verification are in `INTEGRATION.md`.

To run locally: serve `docs/` with any static server (e.g. `python3 -m http.server -d docs`) and open
`http://localhost:8000/`. When app files change, bump `RELEASE` in `docs/sw.js` and keep its file list complete.
