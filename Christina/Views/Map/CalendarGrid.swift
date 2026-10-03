import CoreData
import SwiftUI
import UIKit

/// One horizontal thread bar inside a single week row.
struct BarSegment: Identifiable {
    let id: Int
    let startColumn: Int
    let endColumn: Int
    /// Last column the label may occupy (labels get at least 3 columns of room).
    let labelEndColumn: Int
    let lane: Int
    /// Present only on the segment where the thread's range starts in view,
    /// so the name is written once.
    let label: String?
    let colorHex: String
}

enum CalendarLayout {
    /// Weeks of a month; days outside the month are nil.
    static func monthWeeks(_ month: MonthID, calendar: Calendar) -> [[Date?]] {
        let first = month.firstDay
        let dayCount = calendar.range(of: .day, in: .month, for: first)?.count ?? 30
        let weekday = calendar.component(.weekday, from: first)
        let leading = (weekday - calendar.firstWeekday + 7) % 7

        var cells: [Date?] = Array(repeating: nil, count: leading)
        for offset in 0..<dayCount {
            cells.append(calendar.date(byAdding: .day, value: offset, to: first))
        }
        while cells.count % 7 != 0 {
            cells.append(nil)
        }
        return stride(from: 0, to: cells.count, by: 7).map { Array(cells[$0..<($0 + 7)]) }
    }

    /// A single week starting at `start`.
    static func week(startingAt start: Date, calendar: Calendar) -> [[Date?]] {
        [(0..<7).map { calendar.date(byAdding: .day, value: $0, to: start) }]
    }

    /// Lays out thread bars for one week row. Lanes are assigned greedily so
    /// bars (and their labels) never overlap.
    static func segments(
        days: [Date?],
        threads: [ThreadSpan],
        visibleStart: Date,
        calendar: Calendar
    ) -> (segments: [BarSegment], laneCount: Int) {
        struct Candidate {
            let span: ThreadSpan
            let start: Int
            let end: Int
            let labelEnd: Int
            let label: String?
        }

        let firstVisibleDay = calendar.startOfDay(for: visibleStart)
        var candidates: [Candidate] = []

        for span in threads {
            let spanStart = calendar.startOfDay(for: span.start)
            let spanEnd = span.end.map { calendar.startOfDay(for: $0) }
            let columns = days.indices.filter { index in
                guard let day = days[index] else { return false }
                if let spanEnd = spanEnd, day > spanEnd { return false }
                return day >= spanStart
            }
            guard let first = columns.first, let last = columns.last, let firstDay = days[first] else { continue }

            let labelDay = max(spanStart, firstVisibleDay)
            let showsLabel = calendar.isDate(firstDay, inSameDayAs: labelDay)
            let label: String?
            if showsLabel {
                label = span.end == nil ? "\(span.title) · ongoing" : span.title
            } else {
                label = nil
            }
            let labelEnd = showsLabel ? min(days.count - 1, max(last, first + 2)) : last
            candidates.append(Candidate(span: span, start: first, end: last, labelEnd: labelEnd, label: label))
        }

        candidates.sort { lhs, rhs in
            if lhs.start != rhs.start { return lhs.start < rhs.start }
            return lhs.span.start < rhs.span.start
        }

        var laneEnds: [Int] = []
        var segments: [BarSegment] = []
        for (index, candidate) in candidates.enumerated() {
            let occupiedEnd = max(candidate.end, candidate.labelEnd)
            let lane: Int
            if let free = laneEnds.firstIndex(where: { $0 < candidate.start }) {
                lane = free
                laneEnds[free] = occupiedEnd
            } else {
                lane = laneEnds.count
                laneEnds.append(occupiedEnd)
            }
            segments.append(BarSegment(
                id: index,
                startColumn: candidate.start,
                endColumn: candidate.end,
                labelEndColumn: candidate.labelEnd,
                lane: lane,
                label: candidate.label,
                colorHex: candidate.span.colorHex
            ))
        }
        return (segments, laneEnds.count)
    }
}

/// Visual temporal field: weeks as rows, threads as translucent bars, events as dots.
struct CalendarGrid: View {
    let weeks: [[Date?]]
    let calendar: Calendar
    /// Start of the displayed period (month or week).
    let visibleStart: Date
    let events: [EventDot]
    let threads: [ThreadSpan]
    var accentHex: String?
    var onSelectEvent: (NSManagedObjectID) -> Void

    var body: some View {
        let eventsByDay = Dictionary(grouping: events) { calendar.startOfDay(for: $0.date) }
        VStack(spacing: 0) {
            weekdayHeader
                .padding(.bottom, Theme.gap)
            Rectangle().fill(Theme.hairline).frame(height: 1)
            ForEach(weeks.indices, id: \.self) { index in
                let layout = CalendarLayout.segments(
                    days: weeks[index],
                    threads: threads,
                    visibleStart: visibleStart,
                    calendar: calendar
                )
                WeekRow(
                    days: weeks[index],
                    calendar: calendar,
                    eventsByDay: eventsByDay,
                    segments: layout.segments,
                    laneCount: layout.laneCount,
                    accentHex: accentHex,
                    onSelectEvent: onSelectEvent
                )
                Rectangle().fill(Theme.hairline).frame(height: 1)
            }
        }
    }

    private var weekdayHeader: some View {
        let symbols = calendar.shortStandaloneWeekdaySymbols
        let ordered = (0..<7).map { symbols[(calendar.firstWeekday - 1 + $0) % 7] }
        return HStack(spacing: 0) {
            ForEach(0..<7, id: \.self) { column in
                Text(ordered[column])
                    .font(Theme.captionFont)
                    .foregroundColor(Theme.secondaryText)
                    .frame(maxWidth: .infinity)
            }
        }
    }
}

private struct WeekRow: View {
    let days: [Date?]
    let calendar: Calendar
    let eventsByDay: [Date: [EventDot]]
    let segments: [BarSegment]
    let laneCount: Int
    let accentHex: String?
    let onSelectEvent: (NSManagedObjectID) -> Void

    private static let dotsPerRow = 3

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 0) {
                ForEach(0..<7, id: \.self) { column in
                    dayNumber(days[column])
                        .frame(maxWidth: .infinity)
                }
            }

            // Bars underneath, dots on top.
            if laneCount > 0 {
                ThreadBars(segments: segments, laneCount: laneCount)
                    .zIndex(0)
            }

            HStack(alignment: .top, spacing: 0) {
                ForEach(0..<7, id: \.self) { column in
                    dots(for: days[column])
                        .frame(maxWidth: .infinity, alignment: .top)
                }
            }
            .frame(minHeight: 10)
            .zIndex(1)
        }
        .padding(.vertical, 10)
    }

    @ViewBuilder
    private func dayNumber(_ day: Date?) -> some View {
        if let day = day {
            let isToday = calendar.isDateInToday(day)
            let accent = accentHex.map { Color(hex: $0) } ?? Theme.text
            let accentIsLight = accentHex.map { UIColor(hex: $0).perceivedBrightness > 0.6 } ?? false
            let todayText: Color = accentHex == nil ? Theme.background : (accentIsLight ? .black : .white)
            Text("\(calendar.component(.day, from: day))")
                .font(Theme.labelFont.weight(isToday ? .semibold : .regular))
                .foregroundColor(isToday ? todayText : Theme.text)
                .frame(width: 28, height: 28)
                .background(Circle().fill(isToday ? accent : Color.clear))
        } else {
            Color.clear.frame(height: 28)
        }
    }

    @ViewBuilder
    private func dots(for day: Date?) -> some View {
        if let day = day, let items = eventsByDay[calendar.startOfDay(for: day)], !items.isEmpty {
            let rows = stride(from: 0, to: items.count, by: Self.dotsPerRow).map {
                Array(items[$0..<min($0 + Self.dotsPerRow, items.count)])
            }
            VStack(spacing: 2) {
                ForEach(rows.indices, id: \.self) { rowIndex in
                    HStack(spacing: 2) {
                        ForEach(rows[rowIndex]) { dot in
                            Button {
                                onSelectEvent(dot.id)
                            } label: {
                                Circle()
                                    .fill(Color(hex: dot.colorHex))
                                    .frame(width: 7, height: 7)
                                    .padding(2)
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Event")
                        }
                    }
                }
            }
        } else {
            Color.clear.frame(height: 7)
        }
    }
}

/// Thread bars for one week: translucent (50%), ~10pt thick, rounded ends.
private struct ThreadBars: View {
    let segments: [BarSegment]
    let laneCount: Int

    private static let labelHeight: CGFloat = 15
    private static let barHeight: CGFloat = 10
    private static let laneSpacing: CGFloat = 4
    private static var laneHeight: CGFloat { labelHeight + 2 + barHeight + laneSpacing }

    var body: some View {
        GeometryReader { geometry in
            let columnWidth = geometry.size.width / 7
            ZStack(alignment: .topLeading) {
                ForEach(segments) { segment in
                    let barWidth = max(CGFloat(segment.endColumn - segment.startColumn + 1) * columnWidth - 6, 8)
                    let labelWidth = max(CGFloat(segment.labelEndColumn - segment.startColumn + 1) * columnWidth - 6, 8)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(segment.label ?? " ")
                            .font(Theme.captionFont.weight(.medium))
                            .foregroundColor(Theme.text)
                            .lineLimit(1)
                            .frame(width: labelWidth, height: Self.labelHeight, alignment: .leading)
                            .opacity(segment.label == nil ? 0 : 1)
                        Capsule()
                            .fill(Color(hex: segment.colorHex).opacity(0.5))
                            .frame(width: barWidth, height: Self.barHeight)
                    }
                    .offset(x: CGFloat(segment.startColumn) * columnWidth + 3,
                            y: CGFloat(segment.lane) * Self.laneHeight)
                }
            }
            .frame(width: geometry.size.width, height: geometry.size.height, alignment: .topLeading)
        }
        .frame(height: CGFloat(laneCount) * Self.laneHeight)
        .accessibilityElement(children: .combine)
    }
}
