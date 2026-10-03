import Foundation

enum AppSettings {
    /// true = weeks start on Monday, false = Sunday.
    static let weekStartsOnMondayKey = "calendar.weekStartsOnMonday"
    /// true = Map shows one week at a time.
    static let weekViewKey = "calendar.weekView"

    static var weekStartsOnMonday: Bool {
        UserDefaults.standard.object(forKey: weekStartsOnMondayKey) as? Bool ?? true
    }
}

extension Calendar {
    /// Gregorian calendar in the user's time zone with the configured first weekday.
    static func christina(mondayFirst: Bool = AppSettings.weekStartsOnMonday) -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.locale = Locale.current
        calendar.timeZone = TimeZone.current
        calendar.firstWeekday = mondayFirst ? 2 : 1
        return calendar
    }
}

extension Date {
    var startOfDay: Date { Calendar.christina().startOfDay(for: self) }
}

/// A calendar month, keyed as "YYYY-MM".
struct MonthID: Hashable, Comparable, Identifiable {
    let year: Int
    let month: Int

    var id: String { key }

    init(year: Int, month: Int) {
        self.year = year
        self.month = month
    }

    init(date: Date) {
        let calendar = Calendar.christina()
        year = calendar.component(.year, from: date)
        month = calendar.component(.month, from: date)
    }

    init?(key: String) {
        let parts = key.split(separator: "-")
        guard parts.count == 2, let year = Int(parts[0]), let month = Int(parts[1]), (1...12).contains(month) else {
            return nil
        }
        self.init(year: year, month: month)
    }

    static var current: MonthID { MonthID(date: Date()) }

    var key: String { String(format: "%04d-%02d", year, month) }

    var firstDay: Date {
        Calendar.christina().date(from: DateComponents(year: year, month: month, day: 1))!
    }

    var interval: DateInterval {
        let start = firstDay
        let end = Calendar.christina().date(byAdding: .month, value: 1, to: start)!
        return DateInterval(start: start, end: end)
    }

    func adding(months: Int) -> MonthID {
        MonthID(date: Calendar.christina().date(byAdding: .month, value: months, to: firstDay)!)
    }

    /// "October 2026"
    var title: String { Formatters.monthYear.string(from: firstDay) }
    /// "Oct 2026"
    var shortTitle: String { Formatters.shortMonthYear.string(from: firstDay) }
    /// "October"
    var name: String { Formatters.monthName.string(from: firstDay) }

    static func < (lhs: MonthID, rhs: MonthID) -> Bool {
        (lhs.year, lhs.month) < (rhs.year, rhs.month)
    }
}

enum Formatters {
    private static func template(_ format: String) -> DateFormatter {
        let formatter = DateFormatter()
        formatter.locale = Locale.current
        formatter.setLocalizedDateFormatFromTemplate(format)
        return formatter
    }

    static let monthYear = template("MMMMyyyy")
    static let shortMonthYear = template("MMMyyyy")
    static let monthName = template("LLLL")
    static let dayMonth = template("MMMd")
    static let weekdayDayMonth = template("EEEMMMd")

    static let time: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale.current
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter
    }()

    static let full: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale.current
        formatter.dateStyle = .full
        formatter.timeStyle = .short
        return formatter
    }()

    /// "Fri, Oct 3 · 14:05"
    static func timestamp(_ date: Date) -> String {
        "\(weekdayDayMonth.string(from: date)) · \(time.string(from: date))"
    }

    /// "Oct 5 – Oct 12" or "Oct 5 – ongoing"
    static func range(start: Date, end: Date?) -> String {
        let endText = end.map { dayMonth.string(from: $0) } ?? "ongoing"
        return "\(dayMonth.string(from: start)) – \(endText)"
    }
}
