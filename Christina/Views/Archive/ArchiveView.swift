import CoreData
import SwiftUI

/// Previous months as preserved periods.
struct ArchiveView: View {
    @FetchRequest(fetchRequest: EventEntity.fetch(
        predicate: NSPredicate(format: "archived == NO"),
        sort: [NSSortDescriptor(key: "dateOccurred", ascending: true)]
    )) private var events: FetchedResults<EventEntity>

    @FetchRequest(fetchRequest: MonthPersonalization.fetch(
        predicate: nil,
        sort: [NSSortDescriptor(key: "month", ascending: true)]
    )) private var personalizations: FetchedResults<MonthPersonalization>

    private let columns = [
        GridItem(.flexible(), spacing: Theme.padding),
        GridItem(.flexible(), spacing: Theme.padding),
    ]

    /// Months that have events or a saved personalization, oldest first.
    private var months: [MonthID] {
        var set = Set(events.compactMap { $0.dateOccurred.map(MonthID.init(date:)) })
        for personalization in personalizations where !MonthLook(personalization).isEmpty {
            if let key = personalization.month, let month = MonthID(key: key) {
                set.insert(month)
            }
        }
        return set.sorted()
    }

    private var looksByMonth: [String: MonthLook] {
        var looks: [String: MonthLook] = [:]
        for personalization in personalizations {
            if let key = personalization.month {
                looks[key] = MonthLook(personalization)
            }
        }
        return looks
    }

    var body: some View {
        NavigationView {
            Group {
                if months.isEmpty {
                    VStack(alignment: .leading, spacing: 0) {
                        header
                        Spacer()
                        Text("Nothing recorded yet.")
                            .font(Theme.bodyFont)
                            .foregroundColor(Theme.secondaryText)
                            .frame(maxWidth: .infinity)
                        Spacer()
                    }
                    .padding(Theme.margin)
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: Theme.gap * 2) {
                            header
                            let looks = looksByMonth
                            LazyVGrid(columns: columns, spacing: Theme.margin) {
                                ForEach(months) { month in
                                    NavigationLink(destination: ArchiveMonthDetailView(month: month)) {
                                        ArchiveTile(month: month, look: looks[month.key] ?? .empty)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                        .padding(Theme.margin)
                    }
                }
            }
            .background(Theme.background.ignoresSafeArea())
            .navigationTitle("")
            .navigationBarHidden(true)
        }
        .navigationViewStyle(.stack)
    }

    private var header: some View {
        Text("Archive")
            .font(Theme.headerFont)
            .foregroundColor(Theme.text)
    }
}

private struct ArchiveTile: View {
    let month: MonthID
    let look: MonthLook

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.gap) {
            if let cover = look.images.first {
                SquareImage(url: ImageStore.monthImageURL(month: month.key, fileName: cover))
            } else {
                Color.clear
                    .aspectRatio(1, contentMode: .fit)
                    .overlay(
                        Text(month.name)
                            .font(Theme.labelFont)
                            .foregroundColor(Theme.secondaryText)
                    )
                    .background(RoundedRectangle(cornerRadius: Theme.photoCornerRadius).fill(Theme.surface))
            }

            Text(month.shortTitle)
                .font(Theme.labelFont.weight(.medium))
                .foregroundColor(Theme.text)

            if !look.palette.isEmpty {
                PaletteDots(colors: Array(look.palette.prefix(4)), size: 8)
            }
        }
        .contentShape(Rectangle())
    }
}

#if DEBUG
struct ArchiveView_Previews: PreviewProvider {
    static var previews: some View {
        ArchiveView()
            .environment(\.managedObjectContext, PersistenceController.preview.container.viewContext)
            .environmentObject(AppState())
    }
}
#endif
