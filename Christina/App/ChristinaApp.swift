import SwiftUI
import UIKit

@main
struct ChristinaApp: App {
    private let persistence = PersistenceController.shared
    @StateObject private var appState = AppState()

    init() {
        // iOS 15 lists and text editors draw their own opaque backgrounds;
        // clear them so the app background shows through.
        UITableView.appearance().backgroundColor = .clear
        UITextView.appearance().backgroundColor = .clear
        ImageStore.prepareDirectories()
    }

    var body: some Scene {
        WindowGroup {
            if let error = persistence.loadError {
                StoreErrorView(message: error)
            } else {
                RootView()
                    .environment(\.managedObjectContext, persistence.container.viewContext)
                    .environmentObject(appState)
            }
        }
    }
}

/// Shown if the Core Data store cannot be opened.
private struct StoreErrorView: View {
    let message: String

    var body: some View {
        VStack(spacing: Theme.padding) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 32))
            Text("Christina couldn't open its data")
                .font(Theme.headerFont)
                .multilineTextAlignment(.center)
            Text(message)
                .font(Theme.bodyFont)
                .foregroundColor(Theme.secondaryText)
                .multilineTextAlignment(.center)
        }
        .foregroundColor(Theme.text)
        .padding(Theme.margin)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.background.ignoresSafeArea())
    }
}
