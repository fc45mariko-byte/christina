import CoreData
import SwiftUI

struct PalettePreset: Identifiable {
    let name: String
    let colors: [String]
    var id: String { name }

    static let all: [PalettePreset] = [
        PalettePreset(name: "Paper", colors: ["F2EDE4", "D9CBB8", "A68A64", "5E503F", "2B2118"]),
        PalettePreset(name: "Dusk", colors: ["2E2A4F", "5B4B8A", "A675A1", "E8A0BF", "F7D6E0"]),
        PalettePreset(name: "Coast", colors: ["0B3954", "087E8B", "BFD7EA", "FF5A5F", "C81D25"]),
        PalettePreset(name: "Moss", colors: ["283618", "606C38", "DDA15E", "BC6C25", "FEFAE0"]),
        PalettePreset(name: "Citrus", colors: ["FFBE0B", "FB5607", "FF006E", "8338EC", "3A86FF"]),
        PalettePreset(name: "Ink", colors: ["111111", "3D3D3D", "7A7A7A", "BDBDBD", "F0F0F0"]),
        PalettePreset(name: "Bloom", colors: ["FF6B9D", "FFB347", "FFF3B0", "9ED8DB", "467599"]),
        PalettePreset(name: "Winter", colors: ["E0FBFC", "C2DFE3", "9DB4C0", "5C6B73", "253237"]),
    ]
}

/// A month image that is either already on disk or picked but not yet saved.
private struct PendingImage: Identifiable {
    enum Source {
        case existing(fileName: String)
        case new(data: Data, preview: UIImage)
    }

    let id = UUID()
    let source: Source
}

private enum PhotoTarget {
    case add
    case replace(UUID)
}

/// Images, color palette and title for one month. Only the current month is
/// editable; past months are archived and shown read-only. Each month is a
/// separate MonthPersonalization record, so saving one never touches another.
struct PersonalizedModeView: View {
    @Environment(\.managedObjectContext) private var context
    @EnvironmentObject private var appState: AppState

    @FetchRequest(fetchRequest: EventEntity.fetch(
        predicate: NSPredicate(format: "archived == NO"),
        sort: [NSSortDescriptor(key: "dateOccurred", ascending: true)]
    )) private var events: FetchedResults<EventEntity>

    @FetchRequest(fetchRequest: MonthPersonalization.fetch(
        predicate: nil,
        sort: [NSSortDescriptor(key: "month", ascending: true)]
    )) private var personalizations: FetchedResults<MonthPersonalization>

    @State private var selectedMonth = MonthID.current
    @State private var loadedMonthKey: String?
    @State private var images: [PendingImage] = []
    @State private var originalFileNames: [String] = []
    @State private var palette: [String] = []
    @State private var monthTitle = ""
    @State private var customColor = Color(hex: "4A90E2")

    @State private var photoTarget: PhotoTarget = .add
    @State private var showPhotoSource = false
    @State private var isProcessing = false
    @State private var photoError: String?
    @FocusState private var titleFocused: Bool

    private let currentMonth = MonthID.current
    private let gridColumns = Array(repeating: GridItem(.flexible(), spacing: Theme.gap), count: 3)

    private var isEditable: Bool { selectedMonth == currentMonth }

    private var pastMonths: [MonthID] {
        var set = Set(events.compactMap { $0.dateOccurred.map(MonthID.init(date:)) })
        for personalization in personalizations {
            if let key = personalization.month, let month = MonthID(key: key) {
                set.insert(month)
            }
        }
        return set.filter { $0 < currentMonth }.sorted(by: >)
    }

    private var paletteIsValid: Bool {
        palette.isEmpty || (3...5).contains(palette.count)
    }

    private var photoSelectionLimit: Int {
        if case .replace = photoTarget { return 1 }
        return max(1, DataStore.maxMonthImages - images.count)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.gap * 3) {
                monthSection
                imagesSection
                paletteSection
                titleSection
                if isEditable {
                    Button("Save") { save() }
                        .buttonStyle(PrimaryButtonStyle())
                        .disabled(!paletteIsValid || isProcessing)
                }
            }
            .padding(Theme.margin)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("Personalized Mode")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            if loadedMonthKey != selectedMonth.key { load() }
        }
        .onChange(of: selectedMonth) { _ in load() }
        .photoSourcePicker(isPresented: $showPhotoSource, selectionLimit: photoSelectionLimit) { picked in
            handlePicked(picked)
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

    // MARK: Sections

    private var monthSection: some View {
        FormSection("Month") {
            MenuField(selectedMonth == currentMonth ? "Current month (\(currentMonth.title))" : selectedMonth.title) {
                Button("Current month (\(currentMonth.title))") { selectedMonth = currentMonth }
                ForEach(pastMonths) { month in
                    Button(month.title) { selectedMonth = month }
                }
            }
            if !isEditable {
                Text("Past months are archived and read-only. Changing the current month never affects them.")
                    .font(Theme.captionFont)
                    .foregroundColor(Theme.secondaryText)
            }
        }
    }

    private var imagesSection: some View {
        FormSection("Images (\(images.count)/\(DataStore.maxMonthImages))") {
            LazyVGrid(columns: gridColumns, spacing: Theme.gap) {
                ForEach(images) { item in
                    ZStack(alignment: .topTrailing) {
                        Button {
                            photoTarget = .replace(item.id)
                            showPhotoSource = true
                        } label: {
                            thumbnail(item)
                        }
                        .buttonStyle(.plain)
                        .disabled(!isEditable || isProcessing)
                        .accessibilityLabel("Replace image")

                        if isEditable {
                            Button {
                                images.removeAll { $0.id == item.id }
                            } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .font(.system(size: 22))
                                    .symbolRenderingMode(.palette)
                                    .foregroundStyle(Color.white, Color.black.opacity(0.6))
                            }
                            .padding(4)
                            .accessibilityLabel("Remove image")
                        }
                    }
                }

                if isEditable && images.count < DataStore.maxMonthImages {
                    Button {
                        photoTarget = .add
                        showPhotoSource = true
                    } label: {
                        Color.clear
                            .aspectRatio(1, contentMode: .fit)
                            .overlay(
                                Group {
                                    if isProcessing {
                                        ProgressView()
                                    } else {
                                        Image(systemName: "plus")
                                            .font(.system(size: 22, weight: .medium))
                                            .foregroundColor(Theme.secondaryText)
                                    }
                                }
                            )
                            .background(RoundedRectangle(cornerRadius: Theme.photoCornerRadius).fill(Theme.surface))
                    }
                    .buttonStyle(.plain)
                    .disabled(isProcessing)
                    .accessibilityLabel("Add images")
                }
            }

            if images.isEmpty && !isEditable {
                Text("No images.")
                    .font(Theme.bodyFont)
                    .foregroundColor(Theme.secondaryText)
            }
        }
    }

    @ViewBuilder
    private func thumbnail(_ item: PendingImage) -> some View {
        switch item.source {
        case .existing(let fileName):
            SquareImage(url: ImageStore.monthImageURL(month: selectedMonth.key, fileName: fileName))
        case .new(_, let preview):
            Color.clear
                .aspectRatio(1, contentMode: .fit)
                .overlay(Image(uiImage: preview).resizable().scaledToFill())
                .clipShape(RoundedRectangle(cornerRadius: Theme.photoCornerRadius))
                .contentShape(Rectangle())
                .imageBorder()
        }
    }

    private var paletteSection: some View {
        FormSection("Color palette") {
            VStack(alignment: .leading, spacing: Theme.padding) {
                HStack(spacing: Theme.gap) {
                    if palette.isEmpty {
                        Text("No colors selected")
                            .font(Theme.bodyFont)
                            .foregroundColor(Theme.secondaryText)
                    } else {
                        ForEach(palette, id: \.self) { hex in
                            Button {
                                if isEditable { palette.removeAll { $0 == hex } }
                            } label: {
                                Circle()
                                    .fill(Color(hex: hex))
                                    .frame(width: 28, height: 28)
                                    .overlay(Circle().stroke(Theme.hairline, lineWidth: 1))
                            }
                            .buttonStyle(.plain)
                            .disabled(!isEditable)
                            .accessibilityLabel("Remove color \(hex)")
                        }
                    }
                    Spacer()
                    Text("\(palette.count) of 3–5")
                        .font(Theme.captionFont)
                        .foregroundColor(paletteIsValid ? Theme.secondaryText : .red)
                }
                .fieldBackground()

                if isEditable {
                    ForEach(PalettePreset.all) { preset in
                        presetRow(preset)
                    }

                    HStack(spacing: Theme.padding) {
                        ColorPicker("Custom color", selection: $customColor, supportsOpacity: false)
                            .font(Theme.bodyFont)
                        Button("Add") { toggle(customColor.hexString) }
                            .font(Theme.bodyFont.weight(.semibold))
                            .disabled(palette.count >= 5 || palette.contains(customColor.hexString))
                    }
                    .fieldBackground()

                    Text("Tap a palette name to use it, or tap single colors to build your own (3–5 colors).")
                        .font(Theme.captionFont)
                        .foregroundColor(Theme.secondaryText)
                }
            }
        }
    }

    private func presetRow(_ preset: PalettePreset) -> some View {
        HStack(spacing: Theme.gap) {
            Button {
                palette = Array(preset.colors.prefix(5))
            } label: {
                Text(preset.name)
                    .font(Theme.labelFont)
                    .foregroundColor(Theme.text)
                    .frame(width: 64, alignment: .leading)
            }
            .buttonStyle(.plain)

            ForEach(preset.colors, id: \.self) { hex in
                let isSelected = palette.contains(hex)
                Button {
                    toggle(hex)
                } label: {
                    Circle()
                        .fill(Color(hex: hex))
                        .frame(width: 30, height: 30)
                        .overlay(Circle().stroke(Theme.hairline, lineWidth: 1))
                        .overlay(
                            Circle()
                                .stroke(Theme.text, lineWidth: 2)
                                .padding(-4)
                                .opacity(isSelected ? 1 : 0)
                        )
                        .frame(maxWidth: .infinity, minHeight: 40)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Color \(hex)")
                .accessibilityAddTraits(isSelected ? .isSelected : [])
            }
        }
    }

    private var titleSection: some View {
        FormSection("Month title (optional)") {
            if isEditable {
                TextField("e.g. Becoming serious", text: $monthTitle)
                    .font(Theme.bodyFont)
                    .focused($titleFocused)
                    .submitLabel(.done)
                    .fieldBackground()
            } else {
                Text(monthTitle.isEmpty ? "No title" : monthTitle)
                    .font(Theme.bodyFont)
                    .foregroundColor(monthTitle.isEmpty ? Theme.secondaryText : Theme.text)
                    .fieldBackground()
            }
        }
    }

    // MARK: Actions

    private func toggle(_ hex: String) {
        guard isEditable else { return }
        if let index = palette.firstIndex(of: hex) {
            palette.remove(at: index)
        } else if palette.count < 5 {
            palette.append(hex)
        }
    }

    private func load() {
        let personalization = DataStore.personalization(for: selectedMonth.key, in: context)
        let fileNames = personalization?.imagePaths ?? []
        originalFileNames = fileNames
        images = fileNames.map { PendingImage(source: .existing(fileName: $0)) }
        palette = personalization?.colorPalette ?? []
        monthTitle = personalization?.monthTitle ?? ""
        loadedMonthKey = selectedMonth.key
    }

    private func handlePicked(_ picked: [UIImage]) {
        guard isEditable else { return }
        guard !picked.isEmpty else {
            photoError = PhotoError.unreadable.localizedDescription
            return
        }
        let target = photoTarget
        isProcessing = true
        Task { @MainActor in
            var prepared: [(Data, UIImage)] = []
            var failure: Error?
            for image in picked {
                do {
                    let data = try await Task.detached(priority: .userInitiated) {
                        try ImageStore.prepareJPEG(from: image)
                    }.value
                    if let preview = UIImage(data: data) {
                        prepared.append((data, preview))
                    } else {
                        failure = PhotoError.unreadable
                    }
                } catch {
                    failure = error
                }
            }

            switch target {
            case .replace(let id):
                if let first = prepared.first, let index = images.firstIndex(where: { $0.id == id }) {
                    images[index] = PendingImage(source: .new(data: first.0, preview: first.1))
                }
            case .add:
                let room = max(0, DataStore.maxMonthImages - images.count)
                images.append(contentsOf: prepared.prefix(room).map {
                    PendingImage(source: .new(data: $0.0, preview: $0.1))
                })
            }

            if let failure = failure {
                photoError = failure.localizedDescription
            }
            isProcessing = false
        }
    }

    private func save() {
        guard isEditable, paletteIsValid else { return }
        titleFocused = false

        let key = selectedMonth.key
        var writtenFiles: [String] = []
        do {
            var fileNames: [String] = []
            for item in images {
                switch item.source {
                case .existing(let fileName):
                    fileNames.append(fileName)
                case .new(let data, _):
                    let fileName = try ImageStore.saveMonthImage(data, month: key)
                    writtenFiles.append(fileName)
                    fileNames.append(fileName)
                }
            }

            let personalization = DataStore.personalization(for: key, in: context)
                ?? DataStore.newPersonalization(month: key, in: context)
            personalization.imagePaths = fileNames.isEmpty ? nil : fileNames
            personalization.colorPalette = palette.isEmpty ? nil : palette
            let title = monthTitle.trimmed
            personalization.monthTitle = title.isEmpty ? nil : title
            try DataStore.save(context)

            // Only after a successful save: remove files no longer referenced.
            for removed in Set(originalFileNames).subtracting(fileNames) {
                ImageStore.deleteFile(at: ImageStore.monthImageURL(month: key, fileName: removed))
            }
            originalFileNames = fileNames
            images = fileNames.map { PendingImage(source: .existing(fileName: $0)) }
            monthTitle = title
            appState.showToast("Saved \(selectedMonth.title)")
        } catch {
            for fileName in writtenFiles {
                ImageStore.deleteFile(at: ImageStore.monthImageURL(month: key, fileName: fileName))
            }
            if error is PhotoError {
                photoError = error.localizedDescription
            } else {
                appState.report(error, while: "save this month")
            }
        }
    }
}
