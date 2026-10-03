import SwiftUI

struct SettingsView: View {
    var body: some View {
        NavigationView {
            List {
                row("Appearance", systemImage: "paintpalette", destination: AppearanceSettingsView())
                row("Calendar & Time", systemImage: "calendar", destination: CalendarSettingsView())
                row("Categories", systemImage: "square.grid.2x2", destination: CategoriesSettingsView())
                row("Data & Export", systemImage: "externaldrive", destination: DataExportSettingsView())
                row("Notifications", systemImage: "bell", destination: NotificationsSettingsView())
                row("Privacy", systemImage: "lock", destination: PrivacySettingsView())
                row("About", systemImage: "info.circle", destination: AboutView())
            }
            .settingsListStyle()
            .navigationTitle("Settings")
        }
        .navigationViewStyle(.stack)
    }

    private func row<Destination: View>(_ title: String, systemImage: String, destination: Destination) -> some View {
        NavigationLink(destination: destination) {
            Label(title, systemImage: systemImage)
                .font(Theme.bodyFont)
                .foregroundColor(Theme.text)
                .frame(minHeight: 36)
        }
        .listRowBackground(Theme.surface)
    }
}

extension View {
    func settingsListStyle() -> some View {
        self
            .listStyle(.insetGrouped)
            .hiddenListBackground()
            .background(Theme.background.ignoresSafeArea())
    }
}

// MARK: - Appearance

struct AppearanceSettingsView: View {
    var body: some View {
        List {
            Section {
                NavigationLink(destination: PersonalizedModeView()) {
                    Text("Personalized Mode")
                        .font(Theme.bodyFont)
                        .frame(minHeight: 36)
                }
                .listRowBackground(Theme.surface)
            } footer: {
                Text("Give each month its own images, colors and title.")
            }
        }
        .settingsListStyle()
        .navigationTitle("Appearance")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Calendar & Time

struct CalendarSettingsView: View {
    @AppStorage(AppSettings.weekStartsOnMondayKey) private var mondayFirst = true
    @AppStorage(AppSettings.weekViewKey) private var weekView = false

    var body: some View {
        List {
            Section {
                Picker("Start day", selection: $mondayFirst) {
                    Text("Monday").tag(true)
                    Text("Sunday").tag(false)
                }
                .listRowBackground(Theme.surface)
                Toggle("Week view", isOn: $weekView)
                    .listRowBackground(Theme.surface)
            } footer: {
                Text("Week view shows one week at a time on the Map.")
            }
        }
        .font(Theme.bodyFont)
        .settingsListStyle()
        .navigationTitle("Calendar & Time")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Categories

struct CategoriesSettingsView: View {
    var body: some View {
        List {
            Section {
                ForEach(EventCategory.allCases) { category in
                    HStack(spacing: Theme.padding) {
                        CategoryIcon(category: category, size: 28)
                        Text(category.rawValue)
                            .font(Theme.bodyFont)
                        Spacer()
                        Text("#\(category.hex)")
                            .font(Theme.captionFont)
                            .foregroundColor(Theme.secondaryText)
                    }
                    .listRowBackground(Theme.surface)
                }
            } footer: {
                Text("Preset list. Custom categories are not in this build.")
            }
        }
        .settingsListStyle()
        .navigationTitle("Categories")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Data & Export

struct DataExportSettingsView: View {
    var body: some View {
        List {
            Section {
                NotInThisBuildRow(title: "iCloud backup")
                NotInThisBuildRow(title: "Export to CSV")
            } footer: {
                Text("All data stays on this device.")
            }
        }
        .settingsListStyle()
        .navigationTitle("Data & Export")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Notifications

struct NotificationsSettingsView: View {
    var body: some View {
        List {
            Section {
                NotInThisBuildRow(title: "Notifications")
            }
        }
        .settingsListStyle()
        .navigationTitle("Notifications")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct NotInThisBuildRow: View {
    let title: String

    var body: some View {
        HStack {
            Text(title)
                .font(Theme.bodyFont)
                .foregroundColor(Theme.text)
            Spacer()
            Text("Not in this build")
                .font(Theme.labelFont)
                .foregroundColor(Theme.secondaryText)
        }
        .frame(minHeight: 36)
        .listRowBackground(Theme.surface)
    }
}

// MARK: - Privacy

struct PrivacySettingsView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.padding) {
                Text("Everything stays on this device.")
                    .font(Theme.headerFont)
                Text("Events, threads, photos and month personalization are stored locally with Core Data and in the app's Documents folder. Nothing is synced, uploaded or sent to any server. There is no account and no API.")
                    .font(Theme.bodyFont)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .foregroundColor(Theme.text)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Theme.margin)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Privacy")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - About

struct AboutView: View {
    private var version: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.padding) {
                Text("Christina")
                    .font(Theme.headerFont)
                Text("Version \(version)")
                    .font(Theme.labelFont)
                    .foregroundColor(Theme.secondaryText)
                Text("A visual system for seeing life accumulate over time.")
                    .font(Theme.bodyFont)
                    .padding(.top, Theme.gap)
                Text("What actually happened?")
                    .font(Theme.bodyFont)
                Text("Evidence over guilt. Temporal continuity over streaks.")
                    .font(Theme.bodyFont)
            }
            .foregroundColor(Theme.text)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Theme.margin)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("About")
        .navigationBarTitleDisplayMode(.inline)
    }
}
