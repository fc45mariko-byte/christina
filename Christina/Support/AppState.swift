import SwiftUI

enum AppTab: Hashable {
    case home, map, add, threads, archive, settings
}

/// App-wide UI state: selected tab, save confirmations and error alerts.
final class AppState: ObservableObject {
    @Published var selectedTab: AppTab = .home
    @Published var toast: String?
    @Published var errorMessage: String?

    private var toastDismissal: DispatchWorkItem?

    func showToast(_ message: String) {
        toastDismissal?.cancel()
        withAnimation { toast = message }
        let dismissal = DispatchWorkItem { [weak self] in
            withAnimation { self?.toast = nil }
        }
        toastDismissal = dismissal
        DispatchQueue.main.asyncAfter(deadline: .now() + 2, execute: dismissal)
    }

    func report(_ error: Error, while action: String = "save") {
        errorMessage = "Couldn't \(action). \(error.localizedDescription)"
    }
}
