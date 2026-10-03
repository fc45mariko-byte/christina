import Combine
import SwiftUI
import UIKit

/// Tabs: Home → Map → Add (+) → Threads → Archive → Settings.
struct RootView: View {
    @EnvironmentObject private var appState: AppState
    @State private var keyboardVisible = false

    var body: some View {
        VStack(spacing: 0) {
            Group {
                switch appState.selectedTab {
                case .home: HomeView()
                case .map: MapScreen()
                case .add: AddView()
                case .threads: ThreadsView()
                case .archive: ArchiveView()
                case .settings: SettingsView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            if !keyboardVisible {
                ChristinaTabBar(selection: $appState.selectedTab)
            }
        }
        .background(Theme.background.ignoresSafeArea())
        .overlay(alignment: .top) {
            if let toast = appState.toast {
                Text(toast)
                    .font(Theme.labelFont.weight(.medium))
                    .foregroundColor(Theme.background)
                    .padding(.horizontal, Theme.margin)
                    .padding(.vertical, Theme.gap + 2)
                    .background(Capsule().fill(Theme.text))
                    .padding(.top, Theme.gap)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .accessibilityAddTraits(.isStaticText)
            }
        }
        .alert("Something went wrong", isPresented: Binding(
            get: { appState.errorMessage != nil },
            set: { if !$0 { appState.errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(appState.errorMessage ?? "")
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in
            keyboardVisible = true
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
            keyboardVisible = false
        }
    }
}

/// Custom tab bar so the center Add tab can be larger.
struct ChristinaTabBar: View {
    @Binding var selection: AppTab

    var body: some View {
        HStack(alignment: .center, spacing: 0) {
            item(.home, title: "Home", icon: "house", selectedIcon: "house.fill")
            item(.map, title: "Map", icon: "calendar", selectedIcon: "calendar")
            addButton
            item(.threads, title: "Threads", icon: "lineweight", selectedIcon: "lineweight")
            item(.archive, title: "Archive", icon: "archivebox", selectedIcon: "archivebox.fill")
            item(.settings, title: "Settings", icon: "gearshape", selectedIcon: "gearshape.fill")
        }
        .padding(.horizontal, 4)
        .padding(.top, 6)
        .padding(.bottom, 2)
        .background(
            Theme.background
                .overlay(Rectangle().fill(Theme.hairline).frame(height: 1), alignment: .top)
                .ignoresSafeArea(edges: .bottom)
        )
    }

    private func item(_ tab: AppTab, title: String, icon: String, selectedIcon: String) -> some View {
        let isSelected = selection == tab
        return Button {
            selection = tab
        } label: {
            VStack(spacing: 3) {
                Image(systemName: isSelected ? selectedIcon : icon)
                    .font(.system(size: 19, weight: isSelected ? .semibold : .regular))
                    .frame(height: 24)
                Text(title)
                    .font(.system(size: 10, weight: isSelected ? .semibold : .regular))
                    .lineLimit(1)
            }
            .foregroundColor(isSelected ? Theme.text : Theme.secondaryText)
            .frame(maxWidth: .infinity, minHeight: 48)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private var addButton: some View {
        Button {
            selection = .add
        } label: {
            Image(systemName: "plus")
                .font(.system(size: 26, weight: .semibold))
                .foregroundColor(Theme.background)
                .frame(width: 58, height: 58)
                .background(Circle().fill(Theme.text))
                .shadow(color: Color.black.opacity(0.15), radius: 6, x: 0, y: 3)
        }
        .buttonStyle(.plain)
        .offset(y: -12)
        .frame(maxWidth: .infinity)
        .accessibilityLabel("Add")
        .accessibilityAddTraits(selection == .add ? .isSelected : [])
    }
}

#if DEBUG
struct RootView_Previews: PreviewProvider {
    static var previews: some View {
        RootView()
            .environment(\.managedObjectContext, PersistenceController.preview.container.viewContext)
            .environmentObject(AppState())
    }
}
#endif
