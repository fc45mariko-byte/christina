import UIKit

enum PhotoError: LocalizedError {
    case unreadable
    case tooLarge(bytes: Int)
    case insufficientStorage
    case writeFailed(String)

    var errorDescription: String? {
        switch self {
        case .unreadable:
            return "This photo couldn't be read."
        case .tooLarge(let bytes):
            let size = ByteCountFormatter.string(fromByteCount: Int64(bytes), countStyle: .file)
            return "This photo is still too large after compression (\(size))."
        case .insufficientStorage:
            return "There isn't enough free storage on this device to save this photo."
        case .writeFailed(let message):
            return "The photo couldn't be saved. \(message)"
        }
    }
}

/// File storage for images.
///
///     Documents/
///     ├── photos/<UUID>.jpg            (event photos)
///     └── months/<YYYY-MM>/<UUID>.jpg  (month personalization)
enum ImageStore {
    static let maxDimension: CGFloat = 1080
    static let jpegQuality: CGFloat = 0.8
    /// Upper bound for a compressed photo before the user is warned.
    static let maxBytes = 2 * 1024 * 1024

    static var documentsURL: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }

    static var photosURL: URL {
        documentsURL.appendingPathComponent("photos", isDirectory: true)
    }

    static var monthsURL: URL {
        documentsURL.appendingPathComponent("months", isDirectory: true)
    }

    static func monthDirectoryURL(_ month: String) -> URL {
        monthsURL.appendingPathComponent(month, isDirectory: true)
    }

    /// `relativePath` is EventEntity.photoPath, e.g. "photos/<UUID>.jpg".
    static func eventPhotoURL(_ relativePath: String) -> URL {
        documentsURL.appendingPathComponent(relativePath)
    }

    static func monthImageURL(month: String, fileName: String) -> URL {
        monthDirectoryURL(month).appendingPathComponent(fileName)
    }

    static func prepareDirectories() {
        let manager = FileManager.default
        try? manager.createDirectory(at: photosURL, withIntermediateDirectories: true)
        try? manager.createDirectory(at: monthsURL, withIntermediateDirectories: true)
    }

    // MARK: Compression

    /// Scales to fit 1080×1080 and encodes as JPEG at quality 0.8.
    /// Throws `.tooLarge` if the result still exceeds `maxBytes`.
    static func prepareJPEG(from image: UIImage) throws -> Data {
        let size = image.size
        guard size.width > 0, size.height > 0 else { throw PhotoError.unreadable }

        let scale = min(1, maxDimension / max(size.width, size.height))
        let target = CGSize(width: (size.width * scale).rounded(), height: (size.height * scale).rounded())
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = true
        let resized = UIGraphicsImageRenderer(size: target, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: target))
        }

        guard let data = resized.jpegData(compressionQuality: jpegQuality) else { throw PhotoError.unreadable }
        guard data.count <= maxBytes else { throw PhotoError.tooLarge(bytes: data.count) }
        return data
    }

    // MARK: Writing

    /// Writes an event photo and returns its path relative to Documents ("photos/<UUID>.jpg").
    static func saveEventPhoto(_ data: Data) throws -> String {
        let fileName = "\(UUID().uuidString).jpg"
        try write(data, to: photosURL.appendingPathComponent(fileName))
        return "photos/\(fileName)"
    }

    /// Writes a month image and returns its file name, relative to Documents/months/<month>/.
    static func saveMonthImage(_ data: Data, month: String) throws -> String {
        let fileName = "\(UUID().uuidString).jpg"
        try write(data, to: monthImageURL(month: month, fileName: fileName))
        return fileName
    }

    private static func write(_ data: Data, to url: URL) throws {
        if let values = try? documentsURL.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey]),
           let available = values.volumeAvailableCapacityForImportantUsage,
           available < Int64(data.count) * 2 {
            throw PhotoError.insufficientStorage
        }
        do {
            try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            try data.write(to: url, options: [.atomic, .completeFileProtection])
        } catch {
            throw PhotoError.writeFailed(error.localizedDescription)
        }
    }

    // MARK: Reading / deleting

    static func loadImage(at url: URL) -> UIImage? {
        if let cached = ImageCache.shared.image(for: url) { return cached }
        guard let image = UIImage(contentsOfFile: url.path) else { return nil }
        ImageCache.shared.insert(image, for: url)
        return image
    }

    static func deleteFile(at url: URL) {
        ImageCache.shared.remove(url)
        try? FileManager.default.removeItem(at: url)
    }
}

final class ImageCache {
    static let shared = ImageCache()
    private let cache = NSCache<NSURL, UIImage>()

    func image(for url: URL) -> UIImage? { cache.object(forKey: url as NSURL) }
    func insert(_ image: UIImage, for url: URL) { cache.setObject(image, forKey: url as NSURL) }
    func remove(_ url: URL) { cache.removeObject(forKey: url as NSURL) }
}
