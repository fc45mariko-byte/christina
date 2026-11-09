/* Christina — images and videos stored under 'media/<id>' (rituals, prayers, themes, journal photos).
 * A picture is one file. A video is two: its poster (first frame) under 'media/<id>' and the video under
 * 'media/<id>~v'. Drafts hold new pictures and videos in memory until they are saved. */
import { esc, uuid } from '../core/util.js';
import { DB, data, forgetFileURL } from '../core/db.js';
import { compressImage } from '../services/media.js';

const key = (id) => `media/${id}`;
const isVideo = (id) => !!id && data.videoIds && data.videoIds.has(id);

/** Inner HTML for a picture or video slot. `draftBlobs` maps ids of not-yet-saved pictures to object URLs. */
function mediaHTML(id, draftBlobs = null, { controls = false } = {}) {
  if (!id) return '';
  if (draftBlobs && draftBlobs[id]) {
    const d = draftBlobs[id];
    return d.video ? `<video src="${d.videoURL}" poster="${d.url}" muted playsinline preload="metadata" aria-label="Video"></video><span class="play-badge" aria-hidden="true"></span>` : `<img src="${d.url}" alt="">`;
  }
  if (isVideo(id)) {
    return `<video data-file="${esc(key(id))}~v" data-poster="${esc(key(id))}" ${controls ? 'controls' : 'muted loop autoplay'} playsinline preload="metadata" aria-label="Video"></video>`;
  }
  return `<img data-file="${esc(key(id))}" alt="">`;
}

const MAX_VIDEO_BYTES = 250 * 1024 * 1024;

/** The first frame of a video as a JPEG (a plain dark picture if the frame can't be read). */
function posterOf(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    let done = false;
    const finish = (blob) => {
      if (done) return;
      done = true;
      URL.revokeObjectURL(url);
      resolve(blob);
    };
    const plain = () => {
      const c = document.createElement('canvas');
      c.width = 16;
      c.height = 16;
      c.getContext('2d').fillStyle = '#333';
      c.getContext('2d').fillRect(0, 0, 16, 16);
      c.toBlob((b) => finish(b), 'image/jpeg', 0.8);
    };
    const grab = () => {
      try {
        const scale = Math.min(1, 1080 / Math.max(video.videoWidth || 1, video.videoHeight || 1));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round((video.videoWidth || 16) * scale));
        c.height = Math.max(1, Math.round((video.videoHeight || 16) * scale));
        c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
        c.toBlob((b) => (b ? finish(b) : plain()), 'image/jpeg', 0.8);
      } catch {
        plain();
      }
    };
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.addEventListener('loadeddata', () => { video.currentTime = Math.min(0.1, (video.duration || 1) / 2); });
    video.addEventListener('seeked', grab);
    video.addEventListener('error', plain);
    setTimeout(plain, 8000);
    video.src = url;
    video.load();
  });
}

/** Keeps a chosen photo (compressed) or video in the draft until Save. Returns the new id. */
async function addDraftImage(draft, file) {
  if (file && /^video\//.test(file.type)) {
    if (file.size > MAX_VIDEO_BYTES) throw new Error(`This video is too large (${Math.round(file.size / 1048576)} MB; up to 250 MB).`);
    const poster = await posterOf(file);
    const id = uuid();
    draft._blobs = draft._blobs || {};
    draft._blobs[id] = { blob: poster, url: URL.createObjectURL(poster), video: file, videoURL: URL.createObjectURL(file) };
    return id;
  }
  const blob = await compressImage(file);
  const id = uuid();
  draft._blobs = draft._blobs || {};
  draft._blobs[id] = { blob, url: URL.createObjectURL(blob) };
  return id;
}

/** Writes the draft's new pictures that are still used, and removes old pictures no longer used. */
async function commitDraftImages(draft, usedNow, usedBefore = []) {
  const blobs = draft._blobs || {};
  const toWrite = usedNow.filter((id) => blobs[id]);
  const toDelete = usedBefore.filter((id) => id && !usedNow.includes(id));
  if (toWrite.length || toDelete.length) {
    await DB.write(['files'], (tx) => {
      toWrite.forEach((id) => {
        tx.objectStore('files').put(blobs[id].blob, key(id));
        if (blobs[id].video) tx.objectStore('files').put(blobs[id].video, `${key(id)}~v`);
      });
      toDelete.forEach((id) => ['', '~o', '~v'].forEach((s) => tx.objectStore('files').delete(key(id) + s)));
    });
  }
  toWrite.forEach((id) => blobs[id].video && data.videoIds.add(id));
  toDelete.forEach((id) => {
    forgetFileURL(key(id));
    forgetFileURL(`${key(id)}~v`);
    data.videoIds.delete(id);
  });
  Object.values(blobs).forEach((b) => {
    URL.revokeObjectURL(b.url);
    if (b.videoURL) URL.revokeObjectURL(b.videoURL);
  });
  delete draft._blobs;
}

export { mediaHTML, addDraftImage, commitDraftImages, isVideo };
