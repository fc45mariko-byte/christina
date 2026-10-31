/* Christina — photo compression and storage checks. */
const MAX_DIMENSION = 1080;
const JPEG_QUALITY = 0.8;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

/** Scales to fit 1080×1080 and encodes JPEG at quality 0.8. */
async function compressImage(file) {
  const source = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("This photo couldn't be read."));
      image.src = source;
    });
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) throw new Error("This photo couldn't be read.");
    const scale = Math.min(1, MAX_DIMENSION / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob) throw new Error("This photo couldn't be read.");
    if (blob.size > MAX_PHOTO_BYTES) {
      throw new Error(`This photo is still too large after compression (${(blob.size / 1048576).toFixed(1)} MB). Choose another photo to try again.`);
    }
    return blob;
  } finally {
    URL.revokeObjectURL(source);
  }
}

async function ensureSpace(bytes) {
  if (!navigator.storage || !navigator.storage.estimate) return;
  const { quota, usage } = await navigator.storage.estimate();
  if (quota && usage != null && quota - usage < bytes * 2) {
    throw new Error("There isn't enough free storage on this device to save this photo.");
  }
}
export { compressImage, ensureSpace };
