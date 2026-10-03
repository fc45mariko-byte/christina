import CoreData
import SwiftUI

/// Value snapshot of a month's personalization.
struct MonthLook: Equatable {
    var title: String?
    var palette: [String]
    var images: [String]

    static let empty = MonthLook(title: nil, palette: [], images: [])

    init(title: String?, palette: [String], images: [String]) {
        self.title = title
        self.palette = palette
        self.images = images
    }

    init(_ personalization: MonthPersonalization?) {
        let title = personalization?.monthTitle?.trimmed ?? ""
        self.title = title.isEmpty ? nil : title
        palette = personalization?.colorPalette ?? []
        images = personalization?.imagePaths ?? []
    }

    var isEmpty: Bool { title == nil && palette.isEmpty && images.isEmpty }

    /// First palette color, used as the month's accent.
    var accentHex: String? { palette.first }
}

/// Fetches the personalization for one month and hands its snapshot to `content`.
struct PersonalizationReader<Content: View>: View {
    @FetchRequest private var results: FetchedResults<MonthPersonalization>
    private let content: (MonthLook) -> Content

    init(month: String, @ViewBuilder content: @escaping (MonthLook) -> Content) {
        _results = FetchRequest(fetchRequest: MonthPersonalization.fetch(
            predicate: NSPredicate(format: "month == %@", month),
            sort: [NSSortDescriptor(key: "month", ascending: true)]
        ))
        self.content = content
    }

    var body: some View {
        content(MonthLook(results.first))
    }
}

/// Value snapshot of an event for the calendar.
struct EventDot: Identifiable, Hashable {
    let id: NSManagedObjectID
    let date: Date
    let colorHex: String

    init(_ event: EventEntity) {
        id = event.objectID
        date = event.dateOccurred ?? Date()
        colorHex = event.eventCategory.hex
    }
}

/// Value snapshot of a thread for the calendar.
struct ThreadSpan: Identifiable, Hashable {
    let id: NSManagedObjectID
    let title: String
    let colorHex: String
    let start: Date
    let end: Date?

    init(_ thread: ThreadEntity) {
        id = thread.objectID
        title = thread.titleText
        colorHex = thread.colorHex
        start = thread.startDate ?? Date()
        end = thread.endDate
    }
}

/// Fetches events and threads overlapping `interval`.
struct CalendarDataReader<Content: View>: View {
    @FetchRequest private var events: FetchedResults<EventEntity>
    @FetchRequest private var threads: FetchedResults<ThreadEntity>
    private let content: ([EventDot], [ThreadSpan]) -> Content

    init(interval: DateInterval, @ViewBuilder content: @escaping ([EventDot], [ThreadSpan]) -> Content) {
        _events = FetchRequest(fetchRequest: EventEntity.fetch(
            predicate: NSPredicate(
                format: "archived == NO AND dateOccurred >= %@ AND dateOccurred < %@",
                interval.start as NSDate, interval.end as NSDate
            ),
            sort: [NSSortDescriptor(key: "dateOccurred", ascending: true)]
        ))
        _threads = FetchRequest(fetchRequest: ThreadEntity.fetch(
            predicate: NSPredicate(
                format: "startDate < %@ AND (endDate == nil OR endDate >= %@)",
                interval.end as NSDate, interval.start as NSDate
            ),
            sort: [
                NSSortDescriptor(key: "startDate", ascending: true),
                NSSortDescriptor(key: "createdAt", ascending: true),
            ]
        ))
        self.content = content
    }

    var body: some View {
        content(events.map(EventDot.init), threads.map(ThreadSpan.init))
    }
}
