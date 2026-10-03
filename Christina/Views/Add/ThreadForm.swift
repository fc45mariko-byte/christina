import CoreData
import SwiftUI

/// Mode B: "I want this to happen". Creates a thread.
///
/// "Tie to" an existing thread creates a new ThreadEntity that reuses the
/// existing thread's title and color over the newly selected date range.
struct ThreadForm: View {
    @Environment(\.managedObjectContext) private var context
    @EnvironmentObject private var appState: AppState
    @FetchRequest(fetchRequest: ThreadEntity.fetch(
        predicate: NSPredicate(format: "archived == NO"),
        sort: [NSSortDescriptor(key: "title", ascending: true), NSSortDescriptor(key: "startDate", ascending: true)]
    )) private var threads: FetchedResults<ThreadEntity>

    @State private var startDate = Date().startOfDay
    @State private var endDate = Date().startOfDay
    @State private var ongoing = false
    @State private var title = ""
    @State private var category: EventCategory?
    @State private var tiedThreadID: NSManagedObjectID?
    @State private var colorHex = Theme.threadColors[0]
    @State private var showDuplicateWarning = false
    @FocusState private var keyboardFocused: Bool

    private var tiedThread: ThreadEntity? {
        DataStore.object(tiedThreadID, as: ThreadEntity.self, in: context)
    }

    private var effectiveTitle: String { tiedThread?.titleText ?? title.trimmed }
    private var effectiveColor: String { tiedThread?.colorHex ?? colorHex }

    private var canSave: Bool {
        !effectiveTitle.isEmpty && category != nil && (ongoing || endDate.startOfDay >= startDate.startOfDay)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.gap * 2.5) {
                FormSection("Start date") {
                    DatePicker("Start date", selection: $startDate, displayedComponents: .date)
                        .labelsHidden()
                        .fieldBackground()
                }

                FormSection("End date") {
                    VStack(alignment: .leading, spacing: Theme.gap) {
                        Toggle("No end date (ongoing)", isOn: $ongoing)
                            .font(Theme.bodyFont)
                        if !ongoing {
                            DatePicker("End date", selection: $endDate, in: startDate..., displayedComponents: .date)
                                .labelsHidden()
                        }
                    }
                    .fieldBackground()
                }

                FormSection("Title") {
                    if let tied = tiedThread {
                        Text(tied.titleText)
                            .font(Theme.bodyFont)
                            .foregroundColor(Theme.secondaryText)
                            .fieldBackground()
                    } else {
                        TextField("e.g. Master applications", text: $title)
                            .font(Theme.bodyFont)
                            .focused($keyboardFocused)
                            .submitLabel(.done)
                            .fieldBackground()
                    }
                }

                FormSection("Category") {
                    CategoryChips(selection: $category)
                }

                FormSection("Thread") {
                    MenuField(tiedThread.map { "Tie to: \($0.titleText) · \($0.dateRangeText)" } ?? "Create a new thread") {
                        Button("Create a new thread") { tiedThreadID = nil }
                        ForEach(threads, id: \.objectID) { thread in
                            Button("Tie to: \(thread.titleText) · \(thread.dateRangeText)") {
                                tiedThreadID = thread.objectID
                            }
                        }
                    }
                }

                FormSection("Color") {
                    if let tied = tiedThread {
                        HStack(spacing: Theme.gap) {
                            Circle().fill(tied.swiftUIColor).frame(width: 24, height: 24)
                            Text("Uses the color of “\(tied.titleText)”")
                                .font(Theme.labelFont)
                                .foregroundColor(Theme.secondaryText)
                        }
                        .fieldBackground()
                    } else {
                        ColorSwatches(selection: $colorHex)
                    }
                }

                Button("Save") { attemptSave() }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(!canSave)
                    .padding(.top, Theme.gap)
            }
            .padding(.horizontal, Theme.margin)
            .padding(.bottom, Theme.margin * 2)
        }
        .onChange(of: startDate) { newStart in
            if endDate < newStart { endDate = newStart }
        }
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { keyboardFocused = false }
            }
        }
        .alert("A thread named “\(effectiveTitle)” already exists.", isPresented: $showDuplicateWarning) {
            Button("Save anyway") { commit() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("It will be saved as a separate thread.")
        }
    }

    private func attemptSave() {
        guard canSave else { return }
        keyboardFocused = false
        if tiedThread == nil, DataStore.threadTitleExists(effectiveTitle, excluding: nil, in: context) {
            showDuplicateWarning = true
        } else {
            commit()
        }
    }

    private func commit() {
        guard let category = category else { return }
        let thread = DataStore.newThread(in: context)
        thread.id = UUID()
        thread.title = effectiveTitle
        thread.category = category.rawValue
        thread.color = effectiveColor
        thread.startDate = startDate.startOfDay
        thread.endDate = ongoing ? nil : endDate.startOfDay
        thread.archived = false
        thread.createdAt = Date()
        do {
            try DataStore.save(context)
            reset()
            appState.showToast("Thread saved")
            appState.selectedTab = .map
        } catch {
            appState.report(error, while: "save this thread")
        }
    }

    private func reset() {
        startDate = Date().startOfDay
        endDate = Date().startOfDay
        ongoing = false
        title = ""
        category = nil
        tiedThreadID = nil
        colorHex = Theme.threadColors[0]
    }
}
