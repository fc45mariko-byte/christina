import CoreData
import SwiftUI

/// Persistent projects / areas / habits that span time.
struct ThreadsView: View {
    enum SortOrder: String, CaseIterable, Identifiable {
        case relevance = "Relevance"
        case alphabet = "A–Z"
        var id: String { rawValue }
    }

    @Environment(\.managedObjectContext) private var context
    @EnvironmentObject private var appState: AppState
    @FetchRequest(fetchRequest: ThreadEntity.fetch(
        predicate: nil,
        sort: [NSSortDescriptor(key: "title", ascending: true), NSSortDescriptor(key: "createdAt", ascending: true)]
    )) private var threads: FetchedResults<ThreadEntity>

    @State private var sortOrder: SortOrder = .relevance
    @State private var editing: ThreadEntity?
    @State private var pendingDelete: ThreadEntity?

    private var activeThreads: [ThreadEntity] { sorted(threads.filter { !$0.archived }) }
    private var archivedThreads: [ThreadEntity] { sorted(threads.filter { $0.archived }) }

    var body: some View {
        NavigationView {
            Group {
                if threads.isEmpty {
                    VStack(alignment: .leading, spacing: 0) {
                        header
                        Spacer()
                        Text("No threads yet. Create one in Add > Mode B or via +.")
                            .font(Theme.bodyFont)
                            .foregroundColor(Theme.secondaryText)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: .infinity)
                        Spacer()
                    }
                    .padding(Theme.margin)
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: Theme.gap) {
                            header
                            Picker("Sort", selection: $sortOrder) {
                                ForEach(SortOrder.allCases) { order in
                                    Text(order.rawValue).tag(order)
                                }
                            }
                            .pickerStyle(.segmented)
                            .padding(.bottom, Theme.gap)

                            ForEach(activeThreads, id: \.objectID) { thread in
                                card(thread)
                            }

                            if !archivedThreads.isEmpty {
                                FieldLabel("Archived")
                                    .padding(.top, Theme.gap * 2)
                                ForEach(archivedThreads, id: \.objectID) { thread in
                                    card(thread)
                                        .opacity(0.6)
                                }
                            }
                        }
                        .padding(Theme.margin)
                    }
                }
            }
            .background(Theme.background.ignoresSafeArea())
            .navigationTitle("")
            .navigationBarHidden(true)
            .sheet(item: $editing) { thread in
                NavigationView {
                    ThreadEditView(thread: thread)
                }
                .navigationViewStyle(.stack)
                .environment(\.managedObjectContext, context)
                .environmentObject(appState)
            }
            .alert(
                "Remove this thread? Linked events will remain.",
                isPresented: Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } }),
                presenting: pendingDelete
            ) { thread in
                Button("Remove", role: .destructive) { delete(thread) }
                Button("Cancel", role: .cancel) {}
            }
        }
        .navigationViewStyle(.stack)
    }

    private var header: some View {
        Text("Threads")
            .font(Theme.headerFont)
            .foregroundColor(Theme.text)
            .padding(.bottom, Theme.gap)
    }

    private func card(_ thread: ThreadEntity) -> some View {
        NavigationLink(destination: ThreadDetailView(thread: thread)) {
            ThreadCard(thread: thread)
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button {
                editing = thread
            } label: {
                Label("Edit", systemImage: "pencil")
            }
            Button(role: .destructive) {
                pendingDelete = thread
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
    }

    private func delete(_ thread: ThreadEntity) {
        do {
            try DataStore.deleteThread(thread, in: context)
        } catch {
            appState.report(error, while: "remove this thread")
        }
    }

    private func sorted(_ list: [ThreadEntity]) -> [ThreadEntity] {
        switch sortOrder {
        case .alphabet:
            return list.sorted {
                $0.titleText.localizedCaseInsensitiveCompare($1.titleText) == .orderedAscending
            }
        case .relevance:
            return Self.byRelevance(list)
        }
    }

    /// Running today first (most recently started first), then upcoming
    /// (soonest first), then finished (most recently ended first).
    static func byRelevance(_ list: [ThreadEntity]) -> [ThreadEntity] {
        let today = Date().startOfDay
        func rank(_ thread: ThreadEntity) -> Int {
            let start = thread.startDate ?? .distantPast
            if start > today { return 1 }
            if let end = thread.endDate, end < today { return 2 }
            return 0
        }
        return list.sorted { lhs, rhs in
            let leftRank = rank(lhs), rightRank = rank(rhs)
            if leftRank != rightRank { return leftRank < rightRank }
            let leftStart = lhs.startDate ?? .distantPast
            let rightStart = rhs.startDate ?? .distantPast
            switch leftRank {
            case 0: return leftStart > rightStart
            case 1: return leftStart < rightStart
            default: return (lhs.endDate ?? .distantPast) > (rhs.endDate ?? .distantPast)
            }
        }
    }
}

struct ThreadCard: View {
    @ObservedObject var thread: ThreadEntity

    var body: some View {
        HStack(spacing: Theme.padding) {
            Circle()
                .fill(thread.swiftUIColor)
                .frame(width: 12, height: 12)
            VStack(alignment: .leading, spacing: 4) {
                Text(thread.titleText)
                    .font(Theme.bodyFont)
                    .foregroundColor(Theme.text)
                    .lineLimit(2)
                Text(thread.dateRangeText)
                    .font(Theme.captionFont)
                    .foregroundColor(Theme.secondaryText)
            }
            Spacer(minLength: Theme.gap)
            if !thread.categoryText.isEmpty {
                CategoryBadge(text: thread.categoryText, color: EventCategory.from(thread.category).color)
            }
        }
        .padding(Theme.padding)
        .frame(minHeight: 56)
        .background(RoundedRectangle(cornerRadius: 12).fill(Theme.surface))
        .contentShape(RoundedRectangle(cornerRadius: 12))
    }
}

#if DEBUG
struct ThreadsView_Previews: PreviewProvider {
    static var previews: some View {
        ThreadsView()
            .environment(\.managedObjectContext, PersistenceController.preview.container.viewContext)
            .environmentObject(AppState())
    }
}
#endif
