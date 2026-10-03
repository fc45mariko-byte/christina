# Christina

An iOS SwiftUI app for seeing life accumulate over time. The question it answers is "What actually happened?"

Built from `christina-ios-spec.md` (v1.0, October 2026).

## Requirements

- Xcode 16 or later. The project uses file-system-synchronized groups, project format 77.
- iOS 15.0+ deployment target. iPhone, portrait.
- No dependencies, packages, network calls, sync or cloud.

## Run

1. Open `Christina.xcodeproj`.
2. Select the **Christina** scheme and an iPhone simulator or device.
3. To run on a device, set a development team under *Signing & Capabilities*. The bundle ID is `com.christina.app`; change it if you need to.
4. Build & Run.

The app opens on an empty store with a blank calendar for the current month, which is October 2026 at the time of writing. It seeds no sample content. Sample data exists only in SwiftUI previews (`Persistence/PreviewData.swift`, `#if DEBUG`), which use an in-memory store.

## Structure

```
Christina/
├── App/                ChristinaApp (entry, store error screen), RootView (custom tab bar, toast, error alert)
├── Persistence/        Core Data model (defined in code), entities, DataStore helpers, preview data
├── Support/            Theme (colors, type, spacing), EventCategory, dates/MonthID, ImageStore, AppState
└── Views/
    ├── Home/           Current month's events, reverse-chronological
    ├── Map/            CalendarGrid (thread bars + event dots), MapScreen, MonthField
    ├── Add/            Mode A "I did something" (EventForm), Mode B "I want this to happen" (ThreadForm)
    ├── Threads/        List, detail (editable dates, linked events, archive, delete), edit sheet
    ├── Archive/        Month tiles, read-only month detail
    ├── Settings/       Settings menu, Personalized Mode
    └── Shared/         Event detail, photo pickers (PhotosUI + camera), disk images, components, Core Data readers
```

## Storage

| What | Where |
|---|---|
| EventEntity, ThreadEntity, MonthPersonalization | Core Data (SQLite) in the app container |
| Event photos | `Documents/photos/<UUID>.jpg`. `EventEntity.photoPath` = `photos/<UUID>.jpg` |
| Month images | `Documents/months/<YYYY-MM>/<UUID>.jpg`. `MonthPersonalization.imagePaths` = file names relative to that folder |

Photos are scaled to fit 1080×1080 and saved as JPEG at quality 0.8. If a photo is still larger than 2 MB after that, or the device lacks the free space to save it, the user sees a warning with a **Retry** button. Deleting an event also deletes its photo file. Saving Personalized Mode deletes month images that were removed, and only after the Core Data save succeeds.

## Decisions on points where the spec conflicts with itself

The spec contradicts itself in four places. Each was settled by the project owner:

1. **Mode B category list.** It uses the event categories: Study, Work, Body, Social, Personal, Home, Enjoyed, Other ("same list"). That value goes into `ThreadEntity.category`. The Habit/Project/LifeArea/LongTerm/Ongoing list from the data model section is not offered, so Flow 2's "Select category (Project)" cannot be followed as written.
2. **"Tie to" an existing thread (Mode B).** This creates a **new** ThreadEntity that reuses the existing thread's title and color over the newly picked dates. Leaving it on "Create a new thread" creates a thread from the form. The duplicate-name warning appears only when creating a new thread whose title already exists.
3. **Data & Export.** "iCloud backup" and "Export to CSV" are shown as rows marked *Not in this build*, as is Notifications.
4. **Hardcoded sample bar/dots (build step 3).** These appear only in Xcode previews. The app launches blank.

## Other implementation choices

The spec leaves these open; this is how the app handles them:

- **Tab bar.** A custom bar so the center **+** can be larger. It hides while the keyboard is up.
- **Map layout.** Each week is a row: the dates on top, thread bars under them (50% opacity, 10pt, rounded ends), and event dots under the bars (category color, drawn on top). A thread's name appears once, at its first visible day in the period shown. Open-ended threads run to the end of the period and are labelled "· ongoing".
- **Week view.** When this setting is on, the Map shows one week at a time and the arrows move by week.
- **Past months are read-only.** Event detail hides Delete for events in months before the current one. Archive opens everything read-only. Personalized Mode can show past months, but only the current month can be edited and saved. Each month is its own `MonthPersonalization` record, so saving October never changes September.
- **Archive list.** It shows every month that has events or a saved personalization, oldest first.
- **Personalization on Home and Map.** Home and Map show the month title, palette dots and month images. The first palette color highlights today on the Map.
- **Threads list.** Sort by Relevance (running → upcoming → finished) or A–Z. Archived threads appear in their own section and stay visible on calendars as history.
- **Deleting a thread.** The thread's linked events are kept and their `threadId` is cleared.
- **Color palette.** There are 8 preset palettes plus a custom color picker. A month's palette holds 3–5 colors, or none.
