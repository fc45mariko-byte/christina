import CoreData
import SwiftUI

/// Full details of a recorded event: notes, photo, thread link.
struct EventDetailView: View {
    @ObservedObject var event: EventEntity
    /// Archived (past-month) events cannot be edited or deleted.
    let readOnly: Bool

    @Environment(\.managedObjectContext) private var context
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppState
    @State private var confirmDelete = false

    var body: some View {
        ScrollView {
            if event.managedObjectContext != nil && !event.isDeleted {
                content
                    .padding(Theme.margin)
            }
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationBarHidden(false)
        .navigationBarTitleDisplayMode(.inline)
        .alert(deleteMessage, isPresented: $confirmDelete) {
            Button("Delete", role: .destructive) { delete() }
            Button("Cancel", role: .cancel) {}
        }
    }

    private var content: some View {
        let category = event.eventCategory
        return VStack(alignment: .leading, spacing: Theme.gap * 2) {
            HStack(spacing: Theme.gap) {
                CategoryIcon(category: category, size: 28)
                Text(category.rawValue)
                    .font(Theme.labelFont)
                    .foregroundColor(Theme.secondaryText)
                if readOnly {
                    Spacer()
                    Text("Archived")
                        .font(Theme.captionFont)
                        .foregroundColor(Theme.secondaryText)
                }
            }

            Text(event.titleText)
                .font(Theme.headerFont)
                .foregroundColor(Theme.text)
                .fixedSize(horizontal: false, vertical: true)

            if let date = event.dateOccurred {
                detail("When", Formatters.full.string(from: date))
            }

            if let minutes = event.durationMinutes {
                detail("Duration", "\(minutes) min")
            }

            if event.threadId != nil {
                VStack(alignment: .leading, spacing: Theme.gap) {
                    FieldLabel("Thread")
                    ThreadLinkRow(threadId: event.threadId, readOnly: readOnly)
                }
            }

            if let notes = event.notes, !notes.isEmpty {
                VStack(alignment: .leading, spacing: Theme.gap) {
                    FieldLabel("Notes")
                    Text(notes)
                        .font(Theme.bodyFont)
                        .foregroundColor(Theme.text)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }

            if let path = event.photoPath {
                DiskImage(url: ImageStore.eventPhotoURL(path), contentMode: .fit)
                    .frame(maxWidth: .infinity)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.photoCornerRadius))
                    .imageBorder()
            }

            if !readOnly {
                Button(role: .destructive) {
                    confirmDelete = true
                } label: {
                    Text("Delete")
                }
                .buttonStyle(SecondaryButtonStyle(tint: .red))
                .padding(.top, Theme.gap * 2)
            }
        }
    }

    private func detail(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            FieldLabel(label)
            Text(value)
                .font(Theme.bodyFont)
                .foregroundColor(Theme.text)
        }
    }

    private var deleteMessage: String {
        event.photoPath == nil ? "Delete this event?" : "Delete this event and its photo?"
    }

    private func delete() {
        do {
            try DataStore.deleteEvent(event, in: context)
            dismiss()
        } catch {
            appState.report(error, while: "delete this event")
        }
    }
}

/// Link from an event to its thread.
struct ThreadLinkRow: View {
    @FetchRequest private var threads: FetchedResults<ThreadEntity>
    private let readOnly: Bool

    init(threadId: UUID?, readOnly: Bool) {
        let predicate = threadId.map { NSPredicate(format: "id == %@", $0 as CVarArg) } ?? NSPredicate(value: false)
        _threads = FetchRequest(fetchRequest: ThreadEntity.fetch(
            predicate: predicate,
            sort: [NSSortDescriptor(key: "createdAt", ascending: true)]
        ))
        self.readOnly = readOnly
    }

    var body: some View {
        if let thread = threads.first {
            if readOnly {
                row(thread, showsChevron: false)
            } else {
                NavigationLink(destination: ThreadDetailView(thread: thread)) {
                    row(thread, showsChevron: true)
                }
                .buttonStyle(.plain)
            }
        } else {
            Text("Thread removed")
                .font(Theme.bodyFont)
                .foregroundColor(Theme.secondaryText)
        }
    }

    private func row(_ thread: ThreadEntity, showsChevron: Bool) -> some View {
        HStack(spacing: Theme.gap) {
            Circle().fill(thread.swiftUIColor).frame(width: 12, height: 12)
            VStack(alignment: .leading, spacing: 2) {
                Text(thread.titleText)
                    .font(Theme.bodyFont)
                    .foregroundColor(Theme.text)
                Text(thread.dateRangeText)
                    .font(Theme.captionFont)
                    .foregroundColor(Theme.secondaryText)
            }
            Spacer()
            if showsChevron {
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(Theme.secondaryText)
            }
        }
        .fieldBackground()
    }
}
