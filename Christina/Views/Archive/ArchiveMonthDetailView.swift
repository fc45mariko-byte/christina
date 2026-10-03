import CoreData
import SwiftUI

/// A past month as it was: calendar, threads, events, personalization. Read-only.
struct ArchiveMonthDetailView: View {
    let month: MonthID

    @Environment(\.managedObjectContext) private var context
    @EnvironmentObject private var appState: AppState
    @AppStorage(AppSettings.weekStartsOnMondayKey) private var mondayFirst = true
    @State private var selectedEvent: EventEntity?

    private var calendar: Calendar { .christina(mondayFirst: mondayFirst) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.gap * 2) {
                Text(month.title)
                    .font(Theme.headerFont)
                    .foregroundColor(Theme.text)

                PersonalizationReader(month: month.key) { look in
                    MonthField(
                        monthKey: month.key,
                        look: look,
                        interval: month.interval,
                        weeks: CalendarLayout.monthWeeks(month, calendar: calendar),
                        calendar: calendar,
                        onSelectEvent: { id in
                            selectedEvent = DataStore.object(id, as: EventEntity.self, in: context)
                        }
                    )
                }
            }
            .padding(Theme.margin)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationBarHidden(false)
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $selectedEvent) { event in
            NavigationView {
                EventDetailView(event: event, readOnly: true)
            }
            .navigationViewStyle(.stack)
            .environment(\.managedObjectContext, context)
            .environmentObject(appState)
        }
    }
}
