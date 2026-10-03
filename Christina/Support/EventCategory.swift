import SwiftUI

/// Preset categories (spec: custom categories are v2).
enum EventCategory: String, CaseIterable, Identifiable {
    case study = "Study"
    case work = "Work"
    case body = "Body"
    case social = "Social"
    case personal = "Personal"
    case home = "Home"
    case enjoyed = "Enjoyed"
    case other = "Other"

    var id: String { rawValue }

    /// Default category colors (hex, no "#").
    var hex: String {
        switch self {
        case .study: return "4A90E2"
        case .work: return "7B68EE"
        case .body: return "FF6B9D"
        case .social: return "FFB347"
        case .personal: return "50C878"
        case .home: return "D4AF37"
        case .enjoyed: return "FF69B4"
        case .other: return "A9A9A9"
        }
    }

    var color: Color { Color(hex: hex) }

    /// SF Symbol shown as the category icon.
    var icon: String {
        switch self {
        case .study: return "book.fill"
        case .work: return "briefcase.fill"
        case .body: return "figure.walk"
        case .social: return "person.2.fill"
        case .personal: return "person.fill"
        case .home: return "house.fill"
        case .enjoyed: return "heart.fill"
        case .other: return "ellipsis"
        }
    }

    static func from(_ rawValue: String?) -> EventCategory {
        EventCategory(rawValue: rawValue ?? "") ?? .other
    }
}
