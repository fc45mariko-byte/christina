import CoreData

/// Creation, lookup and deletion helpers shared by the screens.
enum DataStore {
    static let maxMonthImages = 12

    // MARK: Insert

    static func newEvent(in context: NSManagedObjectContext) -> EventEntity {
        NSEntityDescription.insertNewObject(forEntityName: EventEntity.entityName, into: context) as! EventEntity
    }

    static func newThread(in context: NSManagedObjectContext) -> ThreadEntity {
        NSEntityDescription.insertNewObject(forEntityName: ThreadEntity.entityName, into: context) as! ThreadEntity
    }

    static func newPersonalization(month: String, in context: NSManagedObjectContext) -> MonthPersonalization {
        let personalization = NSEntityDescription.insertNewObject(
            forEntityName: MonthPersonalization.entityName,
            into: context
        ) as! MonthPersonalization
        personalization.month = month
        personalization.createdAt = Date()
        return personalization
    }

    // MARK: Lookup

    static func object<T: NSManagedObject>(_ id: NSManagedObjectID?, as type: T.Type, in context: NSManagedObjectContext) -> T? {
        guard let id = id else { return nil }
        return (try? context.existingObject(with: id)) as? T
    }

    static func personalization(for month: String, in context: NSManagedObjectContext) -> MonthPersonalization? {
        let request = MonthPersonalization.fetch(predicate: NSPredicate(format: "month == %@", month), sort: [])
        request.fetchLimit = 1
        return (try? context.fetch(request))?.first
    }

    /// True when another thread already uses this title (case-insensitive).
    static func threadTitleExists(_ title: String, excluding: NSManagedObjectID?, in context: NSManagedObjectContext) -> Bool {
        let request = ThreadEntity.fetch(predicate: NSPredicate(format: "title ==[c] %@", title), sort: [])
        let matches = (try? context.fetch(request)) ?? []
        return matches.contains { $0.objectID != excluding }
    }

    // MARK: Save / delete

    /// Saves, rolling back the context if the save fails so the UI never shows
    /// unsaved state as if it were stored.
    static func save(_ context: NSManagedObjectContext) throws {
        guard context.hasChanges else { return }
        do {
            try context.save()
        } catch {
            context.rollback()
            throw error
        }
    }

    /// Removes the event from Core Data and its photo from Documents/photos/.
    static func deleteEvent(_ event: EventEntity, in context: NSManagedObjectContext) throws {
        let photoPath = event.photoPath
        context.delete(event)
        try save(context)
        if let photoPath = photoPath {
            ImageStore.deleteFile(at: ImageStore.eventPhotoURL(photoPath))
        }
    }

    /// Deletes the thread. Linked events remain; their link is cleared.
    static func deleteThread(_ thread: ThreadEntity, in context: NSManagedObjectContext) throws {
        if let id = thread.id {
            let request = EventEntity.fetch(predicate: NSPredicate(format: "threadId == %@", id as CVarArg), sort: [])
            for event in try context.fetch(request) {
                event.threadId = nil
            }
        }
        context.delete(thread)
        try save(context)
    }
}
