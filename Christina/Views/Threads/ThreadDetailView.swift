import CoreData
import SwiftUI

/// Title, color, category, editable dates, linked events, delete and archive.
struct ThreadDetailView: View {
    @ObservedObject var thread: ThreadEntity

    @Environment(\.managedObjectContext) private var context
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState
    @State private var confirmDelete = false
    @State private var editing = false

    var body: some View {
        ScrollView {
            if thread.managedObjectContext != nil && !thread.isDeleted {
                content
                    .padding(Theme.margin)
            }
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationBarHidden(false)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button("Edit") { editing = true }
            }
        }
        .sheet(isPresented: $editing) {
            NavigationView {
                ThreadEditView(thread: thread)
            }
            .navigationViewStyle(.stack)
            .environment(\.managedObjectContext, context)
            .environmentObject(appState)
        }
        .alert("Remove this thread? Linked events will remain.", isPresented: $confirmDelete) {
            Button("Remove", role: .destructive) { delete() }
            Button("Cancel", role: .cancel) {}
        }
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: Theme.gap * 2) {
            HStack(spacing: Theme.gap) {
                Circle()
                    .fill(thread.swiftUIColor)
                    .frame(width: 14, height: 14)
                if !thread.categoryText.isEmpty {
                    CategoryBadge(text: thread.categoryText, color: EventCategory.from(thread.category).color)
                }
                if thread.archived {
                    Text("Archived")
                        .font(Theme.captionFont)
                        .foregroundColor(Theme.secondaryText)
                }
            }

            Text(thread.titleText)
                .font(Theme.headerFont)
                .foregroundColor(Theme.text)
                .fixedSize(horizontal: false, vertical: true)

            VStack(alignment: .leading, spacing: Theme.gap) {
                DatePicker("Start", selection: startBinding, displayedComponents: .date)
                Toggle("No end date (ongoing)", isOn: ongoingBinding)
                if thread.endDate != nil {
                    DatePicker("End", selection: endBinding, in: (thread.startDate ?? .distantPast)..., displayedComponents: .date)
                }
            }
            .font(Theme.bodyFont)
            .fieldBackground()

            VStack(alignment: .leading, spacing: Theme.gap) {
                FieldLabel("Linked events")
                LinkedEventsList(threadId: thread.id)
            }

            VStack(spacing: Theme.gap) {
                Button(thread.archived ? "Unarchive" : "Archive") { toggleArchive() }
                    .buttonStyle(SecondaryButtonStyle())
                Button("Delete", role: .destructive) { confirmDelete = true }
                    .buttonStyle(SecondaryButtonStyle(tint: .red))
            }
            .padding(.top, Theme.gap * 2)
        }
    }

    // MARK: Editable dates

    private var startBinding: Binding<Date> {
        Binding(
            get: { thread.startDate ?? Date() },
            set: { newValue in
                let start = newValue.startOfDay
                thread.startDate = start
                if let end = thread.endDate, end < start {
                    thread.endDate = start
                }
                persist()
            }
        )
    }

    private var endBinding: Binding<Date> {
        Binding(
            get: { thread.endDate ?? thread.startDate ?? Date() },
            set: { newValue in
                thread.endDate = max(newValue.startOfDay, (thread.startDate ?? newValue).startOfDay)
                persist()
            }
        )
    }

    private var ongoingBinding: Binding<Bool> {
        Binding(
            get: { thread.endDate == nil },
            set: { isOngoing in
                thread.endDate = isOngoing ? nil : (thread.startDate ?? Date()).startOfDay
                persist()
            }
        )
    }

    // MARK: Actions

    private func persist() {
        do {
            try DataStore.save(context)
        } catch {
            appState.report(error, while: "update this thread")
        }
    }

    private func toggleArchive() {
        thread.archived.toggle()
        persist()
    }

    private func delete() {
        do {
            try DataStore.deleteThread(thread, in: context)
            dismiss()
        } catch {
            appState.report(error, while: "remove this thread")
        }
    }
}

/// All events linked to a thread.
struct LinkedEventsList: View {
    @FetchRequest private var events: FetchedResults<EventEntity>

    init(threadId: UUID?) {
        let predicate = threadId.map {
            NSPredicate(format: "archived == NO AND threadId == %@", $0 as CVarArg)
        } ?? NSPredicate(value: false)
        _events = FetchRequest(fetchRequest: EventEntity.fetch(
            predicate: predicate,
            sort: [
                NSSortDescriptor(key: "dateOccurred", ascending: false),
                NSSortDescriptor(key: "createdAt", ascending: false),
            ]
        ))
    }

    var body: some View {
        if events.isEmpty {
            Text("No linked events.")
                .font(Theme.bodyFont)
                .foregroundColor(Theme.secondaryText)
        } else {
            VStack(spacing: 0) {
                ForEach(events, id: \.objectID) { event in
                    NavigationLink(destination: EventDetailView(event: event, readOnly: event.isInPastMonth)) {
                        EventRow(event: event)
                    }
                    .buttonStyle(.plain)
                    Rectangle().fill(Theme.hairline).frame(height: 1)
                }
            }
        }
    }
}
