#if DEBUG
import CoreData

// Sample content for Xcode previews only. The app itself launches with an
// empty store; nothing here is ever written to the on-device database.
extension PersistenceController {
    static let preview: PersistenceController = {
        let controller = PersistenceController(inMemory: true)
        let context = controller.container.viewContext
        let calendar = Calendar.christina()
        let month = MonthID.current
        func day(_ number: Int, hour: Int = 9) -> Date {
            let date = calendar.date(byAdding: .day, value: number - 1, to: month.firstDay)!
            return calendar.date(byAdding: .hour, value: hour, to: date)!
        }

        let applications = DataStore.newThread(in: context)
        applications.id = UUID()
        applications.title = "Master applications"
        applications.category = EventCategory.work.rawValue
        applications.color = "7B68EE"
        applications.startDate = calendar.startOfDay(for: day(5))
        applications.endDate = calendar.startOfDay(for: day(12))
        applications.createdAt = Date()

        let spanish = DataStore.newThread(in: context)
        spanish.id = UUID()
        spanish.title = "Spanish"
        spanish.category = EventCategory.study.rawValue
        spanish.color = "4A90E2"
        spanish.startDate = calendar.startOfDay(for: day(1))
        spanish.endDate = nil
        spanish.createdAt = Date()

        let samples: [(String, EventCategory, Int?, Int, UUID?)] = [
            ("Studied Spanish", .study, 25, 5, spanish.id),
            ("Went for a walk", .body, nil, 5, nil),
            ("Dinner with Ana", .social, 90, 8, nil),
            ("Sent first application", .work, 120, 9, applications.id),
        ]
        for (title, category, minutes, dayNumber, threadId) in samples {
            let event = DataStore.newEvent(in: context)
            event.id = UUID()
            event.title = title
            event.category = category.rawValue
            event.durationMinutes = minutes
            event.dateOccurred = day(dayNumber, hour: 10)
            event.threadId = threadId
            event.createdAt = Date()
        }

        try? context.save()
        return controller
    }()
}
#endif
