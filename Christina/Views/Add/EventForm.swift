import CoreData
import SwiftUI

/// Mode A: "I did something".
struct EventForm: View {
    @Environment(\.managedObjectContext) private var context
    @EnvironmentObject private var appState: AppState
    @FetchRequest(fetchRequest: ThreadEntity.fetch(
        predicate: NSPredicate(format: "archived == NO"),
        sort: [NSSortDescriptor(key: "title", ascending: true), NSSortDescriptor(key: "startDate", ascending: true)]
    )) private var threads: FetchedResults<ThreadEntity>

    @State private var date = Date()
    @State private var title = ""
    @State private var category: EventCategory?
    @State private var durationText = ""
    @State private var threadID: NSManagedObjectID?
    @State private var notes = ""
    @State private var photoData: Data?
    @State private var photoPreview: UIImage?
    @State private var showPhotoSource = false
    @State private var isProcessingPhoto = false
    @State private var photoError: String?
    @FocusState private var keyboardFocused: Bool

    private var trimmedTitle: String { title.trimmed }

    private var duration: Int? { Int(durationText.trimmed) }

    private var durationIsValid: Bool {
        durationText.trimmed.isEmpty || (duration ?? 0) > 0
    }

    private var canSave: Bool {
        !trimmedTitle.isEmpty && category != nil && durationIsValid && !isProcessingPhoto
    }

    private var selectedThread: ThreadEntity? {
        DataStore.object(threadID, as: ThreadEntity.self, in: context)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.gap * 2.5) {
                FormSection("When") {
                    DatePicker("When", selection: $date, in: ...Date(), displayedComponents: [.date, .hourAndMinute])
                        .labelsHidden()
                        .fieldBackground()
                }

                FormSection("Title") {
                    TextField("e.g. Studied Spanish", text: $title)
                        .font(Theme.bodyFont)
                        .focused($keyboardFocused)
                        .submitLabel(.done)
                        .fieldBackground()
                }

                FormSection("Category") {
                    CategoryChips(selection: $category)
                }

                FormSection("Duration (minutes, optional)") {
                    TextField("e.g. 25", text: $durationText)
                        .font(Theme.bodyFont)
                        .keyboardType(.numberPad)
                        .focused($keyboardFocused)
                        .fieldBackground()
                    if !durationIsValid {
                        Text("Enter a whole number of minutes.")
                            .font(Theme.captionFont)
                            .foregroundColor(.red)
                    }
                }

                FormSection("Thread (optional)") {
                    MenuField(selectedThread.map { "\($0.titleText) · \($0.dateRangeText)" } ?? "None") {
                        Button("None") { threadID = nil }
                        ForEach(threads, id: \.objectID) { thread in
                            Button("\(thread.titleText) · \(thread.dateRangeText)") {
                                threadID = thread.objectID
                            }
                        }
                    }
                }

                FormSection("Notes (optional)") {
                    TextEditor(text: $notes)
                        .font(Theme.bodyFont)
                        .focused($keyboardFocused)
                        .frame(minHeight: 100)
                        .padding(Theme.padding - 4)
                        .background(RoundedRectangle(cornerRadius: 10).fill(Theme.surface))
                }

                FormSection("Photo (optional)") {
                    photoSection
                }

                Button("Save") { save() }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(!canSave)
                    .padding(.top, Theme.gap)
            }
            .padding(.horizontal, Theme.margin)
            .padding(.bottom, Theme.margin * 2)
        }
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { keyboardFocused = false }
            }
        }
        .photoSourcePicker(isPresented: $showPhotoSource) { images in
            process(images.first)
        }
        .alert("Photo problem", isPresented: Binding(
            get: { photoError != nil },
            set: { if !$0 { photoError = nil } }
        )) {
            Button("Retry") { showPhotoSource = true }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text(photoError ?? "")
        }
    }

    private var photoSection: some View {
        VStack(alignment: .leading, spacing: Theme.gap) {
            Button {
                keyboardFocused = false
                showPhotoSource = true
            } label: {
                HStack(spacing: Theme.gap) {
                    Image(systemName: "camera")
                    Text(photoPreview == nil ? "Add photo" : "Replace photo")
                        .font(Theme.bodyFont)
                    Spacer()
                    if isProcessingPhoto {
                        ProgressView()
                    }
                }
                .foregroundColor(Theme.text)
                .fieldBackground()
            }
            .buttonStyle(.plain)
            .disabled(isProcessingPhoto)

            if let preview = photoPreview {
                ZStack(alignment: .topTrailing) {
                    Image(uiImage: preview)
                        .resizable()
                        .scaledToFit()
                        .frame(maxWidth: .infinity)
                        .clipShape(RoundedRectangle(cornerRadius: Theme.photoCornerRadius))
                        .imageBorder()
                    Button {
                        photoData = nil
                        photoPreview = nil
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 24))
                            .symbolRenderingMode(.palette)
                            .foregroundStyle(Color.white, Color.black.opacity(0.6))
                    }
                    .padding(Theme.gap)
                    .accessibilityLabel("Remove photo")
                }
            }
        }
    }

    private func process(_ image: UIImage?) {
        guard let image = image else {
            photoError = PhotoError.unreadable.localizedDescription
            return
        }
        isProcessingPhoto = true
        Task { @MainActor in
            do {
                let data = try await Task.detached(priority: .userInitiated) {
                    try ImageStore.prepareJPEG(from: image)
                }.value
                photoData = data
                photoPreview = UIImage(data: data)
            } catch {
                photoError = error.localizedDescription
            }
            isProcessingPhoto = false
        }
    }

    private func save() {
        guard let category = category, canSave else { return }
        keyboardFocused = false

        var savedPhotoPath: String?
        do {
            if let data = photoData {
                savedPhotoPath = try ImageStore.saveEventPhoto(data)
            }
            let event = DataStore.newEvent(in: context)
            event.id = UUID()
            event.dateOccurred = date
            event.category = category.rawValue
            event.title = trimmedTitle
            event.durationMinutes = duration
            event.notes = notes.trimmed.isEmpty ? nil : notes.trimmed
            event.photoPath = savedPhotoPath
            event.threadId = selectedThread?.id
            event.createdAt = Date()
            event.archived = false
            try DataStore.save(context)

            let savedMonth = MonthID(date: date)
            reset()
            appState.showToast("Saved to \(savedMonth.title)")
            appState.selectedTab = .home
        } catch {
            context.rollback()
            if let path = savedPhotoPath {
                ImageStore.deleteFile(at: ImageStore.eventPhotoURL(path))
            }
            if error is PhotoError {
                photoError = error.localizedDescription
            } else {
                appState.report(error, while: "save this event")
            }
        }
    }

    private func reset() {
        date = Date()
        title = ""
        category = nil
        durationText = ""
        threadID = nil
        notes = ""
        photoData = nil
        photoPreview = nil
    }
}
