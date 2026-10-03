import CoreData
import SwiftUI

/// Signature screen: the month (or week) as a temporal field.
struct MapScreen: View {
    @Environment(\.managedObjectContext) private var context
    @EnvironmentObject private var appState: AppState
    @AppStorage(AppSettings.weekStartsOnMondayKey) private var mondayFirst = true
    @AppStorage(AppSettings.weekViewKey) private var weekView = false

    @State private var month = MonthID.current
    @State private var weekAnchor = Date()
    @State private var selectedEvent: EventEntity?

    private var calendar: Calendar { .christina(mondayFirst: mondayFirst) }

    private var weekInterval: DateInterval {
        calendar.dateInterval(of: .weekOfYear, for: weekAnchor)
            ?? DateInterval(start: weekAnchor.startOfDay, duration: 7 * 24 * 3600)
    }

    private var interval: DateInterval { weekView ? weekInterval : month.interval }

    private var weeks: [[Date?]] {
        weekView
            ? CalendarLayout.week(startingAt: weekInterval.start, calendar: calendar)
            : CalendarLayout.monthWeeks(month, calendar: calendar)
    }

    /// Month whose personalization is applied (in week view: the month holding most of the week).
    private var lookMonth: MonthID {
        weekView
            ? MonthID(date: calendar.date(byAdding: .day, value: 3, to: weekInterval.start) ?? weekInterval.start)
            : month
    }

    private var headerTitle: String {
        guard weekView else { return month.title }
        let lastDay = calendar.date(byAdding: .day, value: 6, to: weekInterval.start) ?? weekInterval.start
        return Formatters.range(start: weekInterval.start, end: lastDay)
    }

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.gap * 2) {
                    header
                    PersonalizationReader(month: lookMonth.key) { look in
                        MonthField(
                            monthKey: lookMonth.key,
                            look: look,
                            interval: interval,
                            weeks: weeks,
                            calendar: calendar,
                            onSelectEvent: select
                        )
                    }
                    .id(lookMonth.key)
                }
                .padding(Theme.margin)
            }
            .background(Theme.background.ignoresSafeArea())
            .navigationTitle("")
            .navigationBarHidden(true)
            .sheet(item: $selectedEvent) { event in
                NavigationView {
                    EventDetailView(event: event, readOnly: event.isInPastMonth)
                }
                .navigationViewStyle(.stack)
                .environment(\.managedObjectContext, context)
                .environmentObject(appState)
            }
        }
        .navigationViewStyle(.stack)
    }

    private var header: some View {
        HStack {
            Button {
                step(-1)
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 18, weight: .medium))
                    .frame(width: 44, height: 44)
            }
            .accessibilityLabel(weekView ? "Previous week" : "Previous month")

            Spacer()
            Text(headerTitle)
                .font(Theme.headerFont)
                .foregroundColor(Theme.text)
            Spacer()

            Button {
                step(1)
            } label: {
                Image(systemName: "chevron.right")
                    .font(.system(size: 18, weight: .medium))
                    .frame(width: 44, height: 44)
            }
            .accessibilityLabel(weekView ? "Next week" : "Next month")
        }
        .foregroundColor(Theme.text)
    }

    private func step(_ direction: Int) {
        if weekView {
            weekAnchor = calendar.date(byAdding: .day, value: 7 * direction, to: weekAnchor) ?? weekAnchor
        } else {
            month = month.adding(months: direction)
        }
    }

    private func select(_ id: NSManagedObjectID) {
        selectedEvent = DataStore.object(id, as: EventEntity.self, in: context)
    }
}

/// Calendar plus the month's personalization (title, palette, images).
/// Shared by the Map and the Archive month detail.
struct MonthField: View {
    let monthKey: String
    let look: MonthLook
    let interval: DateInterval
    let weeks: [[Date?]]
    let calendar: Calendar
    let onSelectEvent: (NSManagedObjectID) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.gap * 2) {
            if look.title != nil || !look.palette.isEmpty {
                VStack(alignment: .leading, spacing: Theme.gap) {
                    if let title = look.title {
                        Text(title)
                            .font(Theme.bodyFont)
                            .foregroundColor(Theme.secondaryText)
                    }
                    if !look.palette.isEmpty {
                        PaletteDots(colors: look.palette)
                    }
                }
            }

            CalendarDataReader(interval: interval) { events, threads in
                CalendarGrid(
                    weeks: weeks,
                    calendar: calendar,
                    visibleStart: interval.start,
                    events: events,
                    threads: threads,
                    accentHex: look.accentHex,
                    onSelectEvent: onSelectEvent
                )
            }
            .id("\(interval.start.timeIntervalSinceReferenceDate)-\(interval.end.timeIntervalSinceReferenceDate)")

            if !look.images.isEmpty {
                PersonalizationImagesGrid(month: monthKey, fileNames: look.images)
                    .padding(.top, Theme.gap)
            }
        }
    }
}

#if DEBUG
struct MapScreen_Previews: PreviewProvider {
    static var previews: some View {
        MapScreen()
            .environment(\.managedObjectContext, PersistenceController.preview.container.viewContext)
            .environmentObject(AppState())
    }
}
#endif
