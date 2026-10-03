import CoreData
import SwiftUI

// Properties are declared optional on the Swift side so a view that still holds
// a deleted object never traps; the model itself marks required attributes
// non-optional and Core Data validates them on save.

@objc(EventEntity)
final class EventEntity: NSManagedObject {
    static let entityName = "EventEntity"

    @NSManaged var id: UUID?
    @NSManaged var dateOccurred: Date?
    @NSManaged var category: String?
    @NSManaged var title: String?
    /// Minutes. Optional.
    @NSManaged var duration: NSNumber?
    @NSManaged var notes: String?
    /// Relative to Documents, e.g. "photos/<UUID>.jpg".
    @NSManaged var photoPath: String?
    @NSManaged var threadId: UUID?
    @NSManaged var createdAt: Date?
    @NSManaged var archived: Bool

    static func fetch(predicate: NSPredicate?, sort: [NSSortDescriptor]) -> NSFetchRequest<EventEntity> {
        let request = NSFetchRequest<EventEntity>(entityName: entityName)
        request.predicate = predicate
        request.sortDescriptors = sort
        return request
    }

    var durationMinutes: Int? {
        get { duration?.intValue }
        set { duration = newValue.map { NSNumber(value: $0) } }
    }

    var eventCategory: EventCategory { EventCategory.from(category) }

    var titleText: String { title ?? "" }

    /// "Studied Spanish — 25 min" or "Went for a walk".
    var displayLine: String {
        guard let minutes = durationMinutes else { return titleText }
        return "\(titleText) — \(minutes) min"
    }

    /// Events in months before the current one belong to archived periods.
    var isInPastMonth: Bool {
        MonthID(date: dateOccurred ?? Date()) < MonthID.current
    }
}

@objc(ThreadEntity)
final class ThreadEntity: NSManagedObject {
    static let entityName = "ThreadEntity"

    @NSManaged var id: UUID?
    @NSManaged var title: String?
    @NSManaged var category: String?
    /// Hex without "#", e.g. "FF6B9D".
    @NSManaged var color: String?
    @NSManaged var startDate: Date?
    @NSManaged var endDate: Date?
    @NSManaged var archived: Bool
    @NSManaged var createdAt: Date?

    static func fetch(predicate: NSPredicate?, sort: [NSSortDescriptor]) -> NSFetchRequest<ThreadEntity> {
        let request = NSFetchRequest<ThreadEntity>(entityName: entityName)
        request.predicate = predicate
        request.sortDescriptors = sort
        return request
    }

    var titleText: String { title ?? "" }
    var colorHex: String { color ?? EventCategory.other.hex }
    var swiftUIColor: Color { Color(hex: colorHex) }
    var categoryText: String { category ?? "" }

    /// "Oct 5 – Oct 12" or "Oct 5 – ongoing".
    var dateRangeText: String {
        guard let start = startDate else { return "" }
        return Formatters.range(start: start, end: endDate)
    }
}

@objc(MonthPersonalization)
final class MonthPersonalization: NSManagedObject {
    static let entityName = "MonthPersonalization"

    /// "YYYY-MM", e.g. "2026-10".
    @NSManaged var month: String?
    /// Up to 12 file names, relative to Documents/months/<month>/.
    @NSManaged var imagePaths: [String]?
    /// Hex colors without "#".
    @NSManaged var colorPalette: [String]?
    @NSManaged var monthTitle: String?
    @NSManaged var createdAt: Date?

    static func fetch(predicate: NSPredicate?, sort: [NSSortDescriptor]) -> NSFetchRequest<MonthPersonalization> {
        let request = NSFetchRequest<MonthPersonalization>(entityName: entityName)
        request.predicate = predicate
        request.sortDescriptors = sort
        return request
    }
}

// Used by `.sheet(item:)`; `id` is the UUID attribute above.
extension EventEntity: Identifiable {}
extension ThreadEntity: Identifiable {}
