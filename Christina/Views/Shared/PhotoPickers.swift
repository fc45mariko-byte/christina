import PhotosUI
import SwiftUI
import UIKit

/// PhotosUI library picker.
struct LibraryPicker: UIViewControllerRepresentable {
    var selectionLimit: Int
    var onPick: ([UIImage]) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> PHPickerViewController {
        var configuration = PHPickerConfiguration()
        configuration.filter = .images
        configuration.selectionLimit = max(1, selectionLimit)
        let picker = PHPickerViewController(configuration: configuration)
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: PHPickerViewController, context: Context) {
        context.coordinator.parent = self
    }

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, PHPickerViewControllerDelegate {
        var parent: LibraryPicker

        init(_ parent: LibraryPicker) {
            self.parent = parent
        }

        func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
            parent.dismiss()
            guard !results.isEmpty else { return }

            var images = [UIImage?](repeating: nil, count: results.count)
            let group = DispatchGroup()
            for (index, result) in results.enumerated() {
                let provider = result.itemProvider
                guard provider.canLoadObject(ofClass: UIImage.self) else { continue }
                group.enter()
                provider.loadObject(ofClass: UIImage.self) { object, _ in
                    DispatchQueue.main.async {
                        images[index] = object as? UIImage
                        group.leave()
                    }
                }
            }
            let onPick = parent.onPick
            group.notify(queue: .main) {
                onPick(images.compactMap { $0 })
            }
        }
    }
}

/// Camera capture.
struct CameraPicker: UIViewControllerRepresentable {
    var onPick: (UIImage) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {
        context.coordinator.parent = self
    }

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        var parent: CameraPicker

        init(_ parent: CameraPicker) {
            self.parent = parent
        }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let image = info[.originalImage] as? UIImage {
                parent.onPick(image)
            }
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}

/// Presents "Take Photo / Choose from Library", then the matching picker.
private struct PhotoSourcePicker: ViewModifier {
    @Binding var isPresented: Bool
    let selectionLimit: Int
    let onPick: ([UIImage]) -> Void

    @State private var showLibrary = false
    @State private var showCamera = false

    func body(content: Content) -> some View {
        content
            .confirmationDialog("Add photo", isPresented: $isPresented, titleVisibility: .hidden) {
                if UIImagePickerController.isSourceTypeAvailable(.camera) {
                    Button("Take Photo") { showCamera = true }
                }
                Button("Choose from Library") { showLibrary = true }
                Button("Cancel", role: .cancel) {}
            }
            .sheet(isPresented: $showLibrary) {
                LibraryPicker(selectionLimit: selectionLimit, onPick: onPick)
                    .ignoresSafeArea()
            }
            .fullScreenCover(isPresented: $showCamera) {
                CameraPicker(onPick: { onPick([$0]) })
                    .ignoresSafeArea()
            }
    }
}

extension View {
    func photoSourcePicker(
        isPresented: Binding<Bool>,
        selectionLimit: Int = 1,
        onPick: @escaping ([UIImage]) -> Void
    ) -> some View {
        modifier(PhotoSourcePicker(isPresented: isPresented, selectionLimit: selectionLimit, onPick: onPick))
    }
}
