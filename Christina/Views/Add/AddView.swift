import SwiftUI

enum AddMode: String, CaseIterable, Identifiable {
    case didSomething = "I did something"
    case wantToHappen = "I want this to happen"

    var id: String { rawValue }
}

/// Fast capture. Mode A records an event; Mode B creates a thread.
struct AddView: View {
    @State private var mode: AddMode = .didSomething

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                Picker("Mode", selection: $mode) {
                    ForEach(AddMode.allCases) { mode in
                        Text(mode.rawValue).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, Theme.margin)
                .padding(.vertical, Theme.padding)

                switch mode {
                case .didSomething:
                    EventForm()
                case .wantToHappen:
                    ThreadForm()
                }
            }
            .background(Theme.background.ignoresSafeArea())
            .navigationTitle("")
            .navigationBarHidden(true)
        }
        .navigationViewStyle(.stack)
    }
}

#if DEBUG
struct AddView_Previews: PreviewProvider {
    static var previews: some View {
        AddView()
            .environment(\.managedObjectContext, PersistenceController.preview.container.viewContext)
            .environmentObject(AppState())
    }
}
#endif
