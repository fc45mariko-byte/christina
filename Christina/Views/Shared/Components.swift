import SwiftUI

struct CategoryIcon: View {
    let category: EventCategory
    var size: CGFloat = 32

    var body: some View {
        ZStack {
            Circle().fill(category.color.opacity(0.18))
            Image(systemName: category.icon)
                .font(.system(size: size * 0.45, weight: .medium))
                .foregroundColor(category.color)
        }
        .frame(width: size, height: size)
        .accessibilityLabel(category.rawValue)
    }
}

struct CategoryBadge: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(Theme.captionFont)
            .foregroundColor(Theme.text)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(Capsule().fill(color.opacity(0.2)))
    }
}

struct PaletteDots: View {
    let colors: [String]
    var size: CGFloat = 10

    var body: some View {
        HStack(spacing: 4) {
            ForEach(Array(colors.enumerated()), id: \.offset) { _, hex in
                Circle()
                    .fill(Color(hex: hex))
                    .frame(width: size, height: size)
            }
        }
        .accessibilityHidden(true)
    }
}

struct FieldLabel: View {
    let text: String

    init(_ text: String) {
        self.text = text
    }

    var body: some View {
        Text(text)
            .font(Theme.labelFont)
            .foregroundColor(Theme.secondaryText)
    }
}

/// Label + content, single column.
struct FormSection<Content: View>: View {
    let title: String
    let content: Content

    init(_ title: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.gap) {
            FieldLabel(title)
            content
        }
    }
}

/// Category picker (radio-style chips): Study | Work | Body | Social | Personal | Home | Enjoyed | Other.
struct CategoryChips: View {
    @Binding var selection: EventCategory?

    private let columns = Array(repeating: GridItem(.flexible(), spacing: Theme.gap), count: 4)

    var body: some View {
        LazyVGrid(columns: columns, spacing: Theme.gap) {
            ForEach(EventCategory.allCases) { category in
                let isSelected = selection == category
                Button {
                    selection = category
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: category.icon)
                            .font(.system(size: 16, weight: .medium))
                        Text(category.rawValue)
                            .font(Theme.captionFont)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                    }
                    .frame(maxWidth: .infinity, minHeight: 56)
                    .foregroundColor(isSelected ? .white : Theme.text)
                    .background(
                        RoundedRectangle(cornerRadius: 10)
                            .fill(isSelected ? category.color : Theme.surface)
                    )
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(isSelected ? .isSelected : [])
            }
        }
    }
}

/// Preset color swatches for threads.
struct ColorSwatches: View {
    @Binding var selection: String
    var colors: [String] = Theme.threadColors

    private let columns = Array(repeating: GridItem(.flexible(), spacing: Theme.gap), count: 5)

    var body: some View {
        LazyVGrid(columns: columns, spacing: Theme.gap) {
            ForEach(colors, id: \.self) { hex in
                let isSelected = selection.uppercased() == hex.uppercased()
                Button {
                    selection = hex
                } label: {
                    ZStack {
                        Circle().fill(Color(hex: hex))
                        if isSelected {
                            Circle().stroke(Theme.text, lineWidth: 2).padding(-4)
                            Image(systemName: "checkmark")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundColor(.white)
                        }
                    }
                    .frame(width: 36, height: 36)
                    .frame(maxWidth: .infinity, minHeight: 48)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Color \(hex)")
                .accessibilityAddTraits(isSelected ? .isSelected : [])
            }
        }
    }
}

/// Large dropdown row (Menu) for picking one option.
struct MenuField<Items: View>: View {
    let label: String
    let items: Items

    init(_ label: String, @ViewBuilder items: () -> Items) {
        self.label = label
        self.items = items()
    }

    var body: some View {
        Menu {
            items
        } label: {
            HStack {
                Text(label)
                    .font(Theme.bodyFont)
                    .foregroundColor(Theme.text)
                    .lineLimit(1)
                Spacer()
                Image(systemName: "chevron.up.chevron.down")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(Theme.secondaryText)
            }
            .fieldBackground()
        }
    }
}
