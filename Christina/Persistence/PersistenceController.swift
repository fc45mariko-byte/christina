import CoreData

/// Owns the Core Data stack. The managed object model is defined in code so the
/// three entities in the spec (EventEntity, ThreadEntity, MonthPersonalization)
/// live in one place alongside their attribute types.
final class PersistenceController {
    static let shared = PersistenceController()

    let container: NSPersistentContainer
    /// Non-nil when the persistent store failed to load.
    let loadError: String?

    init(inMemory: Bool = false) {
        container = NSPersistentContainer(name: "Christina", managedObjectModel: Self.model)
        if inMemory {
            container.persistentStoreDescriptions.first?.url = URL(fileURLWithPath: "/dev/null")
        }

        // SQLite stores load synchronously by default, so the error is known
        // before init returns.
        var storeError: Error?
        container.loadPersistentStores { _, error in
            storeError = error
        }
        loadError = storeError.map { "The local database couldn't be opened. \($0.localizedDescription)" }

        container.viewContext.automaticallyMergesChangesFromParent = true
        container.viewContext.mergePolicy = NSMergeByPropertyObjectTrumpMergePolicy
    }

    // MARK: - Model

    /// One shared model instance so every container (app and previews) resolves
    /// the same entity descriptions.
    static let model: NSManagedObjectModel = {
        let event = NSEntityDescription()
        event.name = EventEntity.entityName
        event.managedObjectClassName = NSStringFromClass(EventEntity.self)
        event.properties = [
            attribute("id", .UUIDAttributeType),
            attribute("dateOccurred", .dateAttributeType),
            attribute("category", .stringAttributeType),
            attribute("title", .stringAttributeType),
            attribute("duration", .integer32AttributeType, optional: true),
            attribute("notes", .stringAttributeType, optional: true),
            attribute("photoPath", .stringAttributeType, optional: true),
            attribute("threadId", .UUIDAttributeType, optional: true),
            attribute("createdAt", .dateAttributeType),
            attribute("archived", .booleanAttributeType, defaultValue: false),
        ]

        let thread = NSEntityDescription()
        thread.name = ThreadEntity.entityName
        thread.managedObjectClassName = NSStringFromClass(ThreadEntity.self)
        thread.properties = [
            attribute("id", .UUIDAttributeType),
            attribute("title", .stringAttributeType),
            attribute("category", .stringAttributeType),
            attribute("color", .stringAttributeType),
            attribute("startDate", .dateAttributeType),
            attribute("endDate", .dateAttributeType, optional: true),
            attribute("archived", .booleanAttributeType, defaultValue: false),
            attribute("createdAt", .dateAttributeType),
        ]

        let personalization = NSEntityDescription()
        personalization.name = MonthPersonalization.entityName
        personalization.managedObjectClassName = NSStringFromClass(MonthPersonalization.self)
        personalization.properties = [
            attribute("month", .stringAttributeType),
            stringArrayAttribute("imagePaths"),
            stringArrayAttribute("colorPalette"),
            attribute("monthTitle", .stringAttributeType, optional: true),
            attribute("createdAt", .dateAttributeType),
        ]
        personalization.uniquenessConstraints = [["month"]]

        let model = NSManagedObjectModel()
        model.entities = [event, thread, personalization]
        return model
    }()

    private static func attribute(
        _ name: String,
        _ type: NSAttributeType,
        optional: Bool = false,
        defaultValue: Any? = nil
    ) -> NSAttributeDescription {
        let attribute = NSAttributeDescription()
        attribute.name = name
        attribute.attributeType = type
        attribute.isOptional = optional
        attribute.defaultValue = defaultValue
        return attribute
    }

    /// `[String]?` stored as a securely-coded NSArray of NSString.
    private static func stringArrayAttribute(_ name: String) -> NSAttributeDescription {
        let description = attribute(name, .transformableAttributeType, optional: true)
        description.valueTransformerName = NSValueTransformerName.secureUnarchiveFromDataTransformerName.rawValue
        description.attributeValueClassName = NSStringFromClass(NSArray.self)
        return description
    }
}
