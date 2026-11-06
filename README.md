# Christina

A personal dashboard for seeing life accumulate over time — what you did, what you plan, what you write, how you
are, and the rituals and prayers you keep. It runs in the browser and installs on iPhone from Safari (Share → Add to Home
Screen). Everything stays on your device.

## What's in it

| Section | What it does |
|---|---|
| **Overview** | A dashboard of widgets you arrange: this month, today, reminders, upcoming plans, tasks, habits, projects, journal, how are you?, for tonight, rituals, this week, insights. Presets and saved layouts. |
| **Calendar** | Day, week and month. Thread bars, record dots, plans (rings) and tasks due (squares). Plans with times and in-app reminders. |
| **Journal** | Entries, dreams and signs: dated, with optional title, photos, category, tags, thread and theme; links to other records; type and tag filters, search. |
| **Tasks** | Due dates, priority, category, project; Overdue / Today / Upcoming / No date; done list. |
| **Habits** | Daily or times-a-week habits with an optional start date (and "mark every day since then as done"), check-ins, current and longest streaks, 16-week history. |
| **Projects** | Milestones, tasks and progress; an optional thread whose records show on the project. |
| **Insights** | Counts over 4 weeks, 3 months or 12 months; habits, states, rituals done; "recorded together" by days. Every bar opens its records. |
| **Threads** | Spans of time in your life, drawn as bars on the calendar when they have dates. |
| **Rituals** | Rituals (picture, situations, intention, things to prepare, steps, attached prayers) with a guided run that records each time you do one; Prayers to read in a given state; "For tonight" with the moon. |
| **Themes** | Long-running parts of your inner life ("My body", "Becoming her"). Journal entries, dreams, states and rituals can belong to them. |
| **How are you?** | Your own words for how you are, logged for a day from Overview or +. Edit them in Settings → States. |
| **Archive** | Every month as a read-only calendar, and one search across everything. |
| **Add (+)** | "I did something", "I want this to happen", and links to plan, task, journal, habit, how are you?, dream and ritual. |

Past months are read-only. Categories are shared everywhere and editable. Appearance (theme, accent, background — a tone or your own picture behind the app,
font, density, widget style), the four tab-bar slots and which sections show are yours to set.

## Privacy and your data

- Everything is stored in this browser's storage on this device (IndexedDB). Nothing is synced, uploaded or sent
  anywhere. No account, no tracking, no API keys, no AI.
- **Back up:** Settings → Data & Export → Export backup (a JSON file with everything, photos included) or Export
  events (CSV). **Restore** and **Erase everything** are on the same screen.
- Removing the app from the Home Screen or clearing the site's data deletes everything, so export a backup now and then.
- **Data from the old Body Oracle app:** export a backup there (Settings → Backup), then in Christina open Settings →
  Data & Export → Import from the Body Oracle app. Its entries, rituals, prayers, states, themes and photos are added;
  nothing already in Christina is removed.

## For developers

Plain HTML, CSS and JavaScript modules. No build step and no dependencies. GitHub Pages serves `docs/`.

```
docs/
  index.html  sw.js  manifest.webmanifest  icons/
  app/
    main.js        boot: open the database, register modules, render
    core/          router/state, render loop, events, IndexedDB + schema, registry, preferences, appearance
    services/      media, backup (export / restore / erase), search, oracle-import (old Body Oracle data)
    ui/            tokens.css, base.css, components.css, components.js, icons.js, media.js, moon.js
    shell/         tab bar, sidebar, More
    modules/       overview, calendar, journal, tasks, habits, projects, insights, threads, archive,
                   records, add, settings, rituals, themes, states
```

Modules add themselves with `register({ nav, tabs, screens, actions, validators, widgets, kinds, … })`; the core only
reads the registry. The data model is documented in `docs/app/core/schema.js`; the integration history, decisions and
verification are in `INTEGRATION.md`.

To run locally: serve `docs/` with any static server (e.g. `python3 -m http.server -d docs`) and open
`http://localhost:8000/`. When app files change, bump `RELEASE` in `docs/sw.js` and keep its file list complete.
