import SwiftUI

/// Loads an image from Documents off the main thread, with a loading state.
struct DiskImage: View {
    let url: URL?
    var contentMode: ContentMode = .fill

    @State private var image: UIImage?
    @State private var failed = false

    var body: some View {
        ZStack {
            if let image = image {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: contentMode)
            } else if failed {
                Image(systemName: "photo")
                    .foregroundColor(Theme.secondaryText)
                    .frame(maxWidth: .infinity, minHeight: 80)
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity, minHeight: 80)
            }
        }
        .task(id: url) { await load() }
    }

    @MainActor
    private func load() async {
        guard let url = url else {
            failed = true
            return
        }
        if let cached = ImageCache.shared.image(for: url) {
            image = cached
            return
        }
        let loaded = await Task.detached(priority: .userInitiated) {
            ImageStore.loadImage(at: url)
        }.value
        image = loaded
        failed = loaded == nil
    }
}

/// Square, center-cropped image with rounded corners (month images, archive covers).
struct SquareImage: View {
    let url: URL?

    var body: some View {
        Color.clear
            .aspectRatio(1, contentMode: .fit)
            .overlay(DiskImage(url: url))
            .clipShape(RoundedRectangle(cornerRadius: Theme.photoCornerRadius))
            .contentShape(Rectangle())
            .imageBorder()
    }
}

/// Month personalization images: grid layout, 3 columns, square aspect ratio.
struct PersonalizationImagesGrid: View {
    let month: String
    let fileNames: [String]

    private let columns = Array(repeating: GridItem(.flexible(), spacing: Theme.gap), count: 3)

    var body: some View {
        LazyVGrid(columns: columns, spacing: Theme.gap) {
            ForEach(fileNames, id: \.self) { name in
                SquareImage(url: ImageStore.monthImageURL(month: month, fileName: name))
            }
        }
    }
}
