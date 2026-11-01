/* Christina — images and videos stored under 'media/<id>' (rituals, prayers, themes, journal photos).
 * A picture is one file. A video kept from the former Body Oracle app is two: its poster under 'media/<id>'
 * and the video under 'media/<id>~v'. Drafts hold new pictures in memory until they are saved. */
import { esc, uuid } from '../core/util.js';
import { DB, data, forgetFileURL } from '../core/db.js';
import { compressImage } from '../services/media.js';

const key = (id) => `media/${id}`;
const isVideo = (id) => !!id && data.videoIds && data.videoIds.has(id);

/** Inner HTML for a picture or video slot. `draftBlobs` maps ids of not-yet-saved pictures to object URLs. */
function mediaHTML(id, draftBlobs = null, { controls = false } = {}) {
  if (!id) return '';
  if (draftBlobs && draftBlobs[id]) return `<img src="${draftBlobs[id].url}" alt="">`;
  if (isVideo(id)) {
    return `<video data-file="${esc(key(id))}~v" data-poster="${esc(key(id))}" ${controls ? 'controls' : 'muted loop autoplay'} playsinline preload="metadata" aria-label="Video"></video>`;
  }
  return `<img data-file="${esc(key(id))}" alt="">`;
}

/** Compresses a chosen photo and keeps it in the draft until Save. Returns the new id. */
async function addDraftImage(draft, file) {
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
      toWrite.forEach((id) => tx.objectStore('files').put(blobs[id].blob, key(id)));
      toDelete.forEach((id) => ['', '~o', '~v'].forEach((s) => tx.objectStore('files').delete(key(id) + s)));
    });
  }
  toDelete.forEach((id) => forgetFileURL(key(id)));
  Object.values(blobs).forEach((b) => URL.revokeObjectURL(b.url));
  delete draft._blobs;
}

export { mediaHTML, addDraftImage, commitDraftImages, isVideo };
