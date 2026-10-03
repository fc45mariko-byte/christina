import SwiftUI
import UIKit

/// Visual constants from spec section 5.
enum Theme {
    // MARK: Colors
    /// White in light mode, #1a1a1a in dark mode.
    static let background = Color(UIColor { traits in
        traits.userInterfaceStyle == .dark ? UIColor(hex: "1a1a1a") : .white
    })
    /// Black in light mode, #f5f5f5 in dark mode.
    static let text = Color(UIColor { traits in
        traits.userInterfaceStyle == .dark ? UIColor(hex: "f5f5f5") : .black
    })
    static let secondaryText = Color(UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(hex: "f5f5f5").withAlphaComponent(0.55)
            : UIColor.black.withAlphaComponent(0.5)
    })
    /// Fill for inputs and cards.
    static let surface = Color(UIColor { traits in
        traits.userInterfaceStyle == .dark ? UIColor(hex: "262626") : UIColor(hex: "f4f4f2")
    })
    static let hairline = Color(UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor.white.withAlphaComponent(0.1)
            : UIColor.black.withAlphaComponent(0.08)
    })

    // MARK: Typography
    /// SF Pro Display, 24pt, semi-bold (the system font uses Display at this size).
    static let headerFont = Font.system(size: 24, weight: .semibold)
    /// SF Pro Text, 16pt, regular.
    static let bodyFont = Font.system(size: 16, weight: .regular)
    /// SF Pro Text, 14pt, regular.
    static let labelFont = Font.system(size: 14, weight: .regular)
    /// SF Pro Text, 12pt, regular.
    static let captionFont = Font.system(size: 12, weight: .regular)

    // MARK: Spacing
    static let margin: CGFloat = 16
    static let padding: CGFloat = 12
    static let gap: CGFloat = 8

    // MARK: Images
    static let photoCornerRadius: CGFloat = 8

    // MARK: Threads
    /// Preset thread colors for Add > Mode B (hex, no "#").
    static let threadColors: [String] = [
        "FF6B9D", "4A90E2", "7B68EE", "FFB347", "50C878",
        "D4AF37", "FF69B4", "2EC4B6", "E07A5F", "A9A9A9",
    ]
}

extension UIColor {
    /// Accepts "RRGGBB" or "#RRGGBB". Falls back to gray for malformed input.
    convenience init(hex: String) {
        var string = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if string.hasPrefix("#") { string.removeFirst() }
        guard string.count == 6, let value = UInt64(string, radix: 16) else {
            self.init(white: 0.66, alpha: 1)
            return
        }
        self.init(
            red: CGFloat((value >> 16) & 0xFF) / 255,
            green: CGFloat((value >> 8) & 0xFF) / 255,
            blue: CGFloat(value & 0xFF) / 255,
            alpha: 1
        )
    }

    /// "RRGGBB", uppercase, no "#".
    var hexString: String {
        var red: CGFloat = 0, green: CGFloat = 0, blue: CGFloat = 0, alpha: CGFloat = 0
        guard getRed(&red, green: &green, blue: &blue, alpha: &alpha) else { return "A9A9A9" }
        func channel(_ value: CGFloat) -> Int { Int((min(max(value, 0), 1) * 255).rounded()) }
        return String(format: "%02X%02X%02X", channel(red), channel(green), channel(blue))
    }

    /// Perceived brightness, 0...1.
    var perceivedBrightness: CGFloat {
        var red: CGFloat = 0, green: CGFloat = 0, blue: CGFloat = 0, alpha: CGFloat = 0
        guard getRed(&red, green: &green, blue: &blue, alpha: &alpha) else { return 0.5 }
        return 0.299 * red + 0.587 * green + 0.114 * blue
    }
}

extension Color {
    init(hex: String) {
        self.init(UIColor(hex: hex))
    }

    var hexString: String { UIColor(self).hexString }
}

// MARK: - Shared view styling

extension View {
    /// Large, tappable input container.
    func fieldBackground() -> some View {
        self
            .padding(Theme.padding)
            .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 10).fill(Theme.surface))
    }

    /// Thin border and shadow on images in dark mode for contrast.
    func imageBorder(cornerRadius: CGFloat = Theme.photoCornerRadius) -> some View {
        modifier(ImageBorder(cornerRadius: cornerRadius))
    }

    /// Lets lists and forms show the app background on iOS 16+.
    /// (iOS 15 is handled by the UITableView appearance set at launch.)
    @ViewBuilder
    func hiddenListBackground() -> some View {
        if #available(iOS 16.0, *) {
            self.scrollContentBackground(.hidden)
        } else {
            self
        }
    }
}

private struct ImageBorder: ViewModifier {
    let cornerRadius: CGFloat
    @Environment(\.colorScheme) private var colorScheme

    func body(content: Content) -> some View {
        content
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(colorScheme == .dark ? Color.white.opacity(0.14) : Color.clear, lineWidth: 1)
            )
            .shadow(color: colorScheme == .dark ? Color.black.opacity(0.5) : Color.clear, radius: 4, x: 0, y: 2)
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        PrimaryButton(configuration: configuration)
    }

    private struct PrimaryButton: View {
        let configuration: ButtonStyleConfiguration
        @Environment(\.isEnabled) private var isEnabled

        var body: some View {
            configuration.label
                .font(Theme.bodyFont.weight(.semibold))
                .foregroundColor(Theme.background)
                .frame(maxWidth: .infinity, minHeight: 52)
                .background(RoundedRectangle(cornerRadius: 12).fill(Theme.text))
                .opacity(isEnabled ? (configuration.isPressed ? 0.8 : 1) : 0.3)
        }
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    var tint: Color = Theme.text

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Theme.bodyFont)
            .foregroundColor(tint)
            .frame(maxWidth: .infinity, minHeight: 48)
            .background(RoundedRectangle(cornerRadius: 12).fill(Theme.surface))
            .opacity(configuration.isPressed ? 0.7 : 1)
    }
}

extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
