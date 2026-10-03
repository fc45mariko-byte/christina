import CoreData
import SwiftUI

/// Edit a thread's title, category, color and dates (from long-press > Edit).
struct ThreadEditView: View {
    @ObservedObject var thread: ThreadEntity

    @Environment(\.managedObjectContext) private var context
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState

    @State private var title = ""
    @State private var category: EventCategory?
    @State private var colorHex = Theme.threadColors[0]
    @State private var startDate = Date().startOfDay
    @State private var endDate = Date().startOfDay
    @State private var ongoing = false
    @State private var loaded = false
    @State private var showDuplicateWarning = false

    private var canSave: Bool {
        !title.trimmed.isEmpty && category != nil && (ongoing || endDate.startOfDay >= startDate.startOfDay)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.gap * 2.5) {
                FormSection("Title") {
                    TextField("Title", text: $title)
                        .font(Theme.bodyFont)
                        .fieldBackground()
                }
                FormSection("Category") {
                    CategoryChips(selection: $category)
                }
                FormSection("Color") {
                    ColorSwatches(selection: $colorHex, colors: swatchColors)
                }
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
            }
            .padding(Theme.margin)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Edit thread")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") { attemptSave() }
                    .disabled(!canSave)
            }
        }
        .onAppear(perform: load)
        .onChange(of: startDate) { newStart in
            if endDate < newStart { endDate = newStart }
        }
        .alert("A thread named “\(title.trimmed)” already exists.", isPresented: $showDuplicateWarning) {
            Button("Save anyway") { commit() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Both threads will be kept separately.")
        }
    }

    /// Presets plus the thread's current color if it isn't one of them.
    private var swatchColors: [String] {
        let current = thread.colorHex.uppercased()
        return Theme.threadColors.contains(current) ? Theme.threadColors : Theme.threadColors + [current]
    }

    private func load() {
        guard !loaded else { return }
        loaded = true
        title = thread.titleText
        category = EventCategory(rawValue: thread.categoryText)
        colorHex = thread.colorHex.uppercased()
        startDate = thread.startDate ?? Date().startOfDay
        endDate = thread.endDate ?? startDate
        ongoing = thread.endDate == nil
    }

    private func attemptSave() {
        let newTitle = title.trimmed
        let renamed = newTitle.caseInsensitiveCompare(thread.titleText) != .orderedSame
        if renamed, DataStore.threadTitleExists(newTitle, excluding: thread.objectID, in: context) {
            showDuplicateWarning = true
        } else {
            commit()
        }
    }

    private func commit() {
        guard let category = category else { return }
        thread.title = title.trimmed
        thread.category = category.rawValue
        thread.color = colorHex
        thread.startDate = startDate.startOfDay
        thread.endDate = ongoing ? nil : endDate.startOfDay
        do {
            try DataStore.save(context)
            dismiss()
        } catch {
            appState.report(error, while: "update this thread")
        }
    }
}
