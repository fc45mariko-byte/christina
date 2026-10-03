import CoreData
import SwiftUI

/// Recorded evidence for the current month. No streaks, no overdue warnings,
/// no motivational quotes.
struct HomeView: View {
    var body: some View {
        let month = MonthID.current
        NavigationView {
            PersonalizationReader(month: month.key) { look in
                HomeContent(month: month, look: look)
            }
            .id(month.key)
            .background(Theme.background.ignoresSafeArea())
            .navigationTitle("")
            .navigationBarHidden(true)
        }
        .navigationViewStyle(.stack)
    }
}

private struct HomeContent: View {
    let month: MonthID
    let look: MonthLook
    @FetchRequest private var events: FetchedResults<EventEntity>

    init(month: MonthID, look: MonthLook) {
        self.month = month
        self.look = look
        let interval = month.interval
        _events = FetchRequest(fetchRequest: EventEntity.fetch(
            predicate: NSPredicate(
                format: "archived == NO AND dateOccurred >= %@ AND dateOccurred < %@",
                interval.start as NSDate, interval.end as NSDate
            ),
            sort: [
                NSSortDescriptor(key: "dateOccurred", ascending: false),
                NSSortDescriptor(key: "createdAt", ascending: false),
            ]
        ))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
                .padding(.horizontal, Theme.margin)
                .padding(.top, Theme.margin)
                .padding(.bottom, Theme.gap)

            if events.isEmpty {
                Spacer()
                Text("\(month.name) is blank. Tap + to add something.")
                    .font(Theme.bodyFont)
                    .foregroundColor(Theme.secondaryText)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, Theme.margin)
                Spacer()
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        ForEach(events, id: \.objectID) { event in
                            NavigationLink(destination: EventDetailView(event: event, readOnly: event.isInPastMonth)) {
                                EventRow(event: event)
                            }
                            .buttonStyle(.plain)
                            Rectangle().fill(Theme.hairline).frame(height: 1)
                        }
                    }
                    .padding(.horizontal, Theme.margin)
                    .padding(.bottom, Theme.margin)
                }
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: Theme.gap) {
            Text(month.title)
                .font(Theme.headerFont)
                .foregroundColor(Theme.text)

            if let title = look.title {
                Text(title)
                    .font(Theme.bodyFont)
                    .foregroundColor(Theme.secondaryText)
            }

            if !look.palette.isEmpty {
                PaletteDots(colors: look.palette)
            }

            if !look.images.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: Theme.gap) {
                        ForEach(look.images, id: \.self) { name in
                            SquareImage(url: ImageStore.monthImageURL(month: month.key, fileName: name))
                                .frame(width: 64, height: 64)
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
        }
    }
}

struct EventRow: View {
    @ObservedObject var event: EventEntity

    var body: some View {
        HStack(spacing: Theme.padding) {
            CategoryIcon(category: event.eventCategory)
            VStack(alignment: .leading, spacing: 3) {
                Text(event.displayLine)
                    .font(Theme.bodyFont)
                    .foregroundColor(Theme.text)
                    .lineLimit(2)
                if let date = event.dateOccurred {
                    Text(Formatters.timestamp(date))
                        .font(Theme.captionFont)
                        .foregroundColor(Theme.secondaryText)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, Theme.padding)
        .contentShape(Rectangle())
    }
}

#if DEBUG
struct HomeView_Previews: PreviewProvider {
    static var previews: some View {
        HomeView()
            .environment(\.managedObjectContext, PersistenceController.preview.container.viewContext)
            .environmentObject(AppState())
    }
}
#endif
