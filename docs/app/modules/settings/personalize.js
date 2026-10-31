/* Personalized Mode: images, a 3–5 colour palette and a title for the current month. */
import { esc, uuid, currentMonth, monthTitle } from '../../core/util.js';
import { DB, data, blobRecord, forgetFileURL, requestPersistence } from '../../core/db.js';
import { PALETTES, MAX_MONTH_IMAGES } from '../../core/catalog.js';
import { lookFor, monthsWithContent, monthImageKey } from '../../core/queries.js';
import { state, push } from '../../core/state.js';
import { render } from '../../core/render.js';
import { register, registry } from '../../core/registry.js';
import { icon } from '../../ui/icons.js';
import { navbar, toast, fail } from '../../ui/components.js';
import { compressImage, ensureSpace } from '../../services/media.js';
function loadPersonalization(month) {
  if (state.pm) state.pm.images.forEach((img) => img.blob && URL.revokeObjectURL(img.url));
  const look = lookFor(month);
  state.pm = {
    month,
    images: look.images.map((name) => ({ id: uuid(), name })),
    original: [...look.images],
    palette: [...look.palette],
    title: look.title || '',
    custom: '#4A90E2',
    processing: false,
  };
}

function viewPersonalize() {
  const p = state.pm;
  const cur = currentMonth();
  const editable = p.month === cur;
  const past = monthsWithContent().filter((k) => k < cur).reverse();
  const paletteOK = p.palette.length === 0 || (p.palette.length >= 3 && p.palette.length <= 5);

  const thumbs = p.images
    .map((img) => {
      const src = img.blob ? `src="${img.url}"` : `data-file="${esc(monthImageKey(p.month, img.name))}"`;
      return `<div class="sq">
        ${
          editable
            ? `<label style="display:block;width:100%;height:100%"><img ${src} alt=""><input type="file" accept="image/*" data-file-input="pmReplace" data-id="${img.id}"></label>
               <button class="remove-x" data-action="pmRemove" data-id="${img.id}" aria-label="Remove image">${icon('x')}</button>`
            : `<img ${src} alt="">`
        }
      </div>`;
    })
    .join('');
  const addTile =
    editable && p.images.length < MAX_MONTH_IMAGES
      ? `<label class="sq add-tile" aria-label="Add images">${p.processing ? '<span class="muted">…</span>' : icon('plus')}<input type="file" accept="image/*" multiple data-file-input="pmAdd"></label>`
      : '';

  return `${navbar('Personalized Mode')}<div class="page">
    <div class="section"><span class="label">Month</span>
      <select class="field" data-change="pmMonth">
        <option value="${cur}" ${editable ? 'selected' : ''}>Current month (${esc(monthTitle(cur))})</option>
        ${past.map((k) => `<option value="${k}" ${p.month === k ? 'selected' : ''}>${esc(monthTitle(k))}</option>`).join('')}
      </select>
      ${editable ? '' : '<span class="caption">Past months are archived and read-only. Changing the current month never affects them.</span>'}
    </div>

    <div class="section"><span class="label">Images (${p.images.length}/${MAX_MONTH_IMAGES})</span>
      <div class="img-grid">${thumbs}${addTile}</div>
      ${!editable && !p.images.length ? '<span class="muted">No images.</span>' : ''}
    </div>

    <div class="section"><span class="label">Color palette</span>
      <div class="field row-field">
        <div class="palette" style="gap:8px">${
          p.palette.length
            ? p.palette.map((h) => `<button data-action="pmToggle" data-hex="${h}" ${editable ? '' : 'disabled style="opacity:1"'} aria-label="Remove color ${h}"><i style="display:block;width:28px;height:28px;border-radius:50%;background:#${h};box-shadow:inset 0 0 0 1px var(--hair)"></i></button>`).join('')
            : '<span class="muted">No colors selected</span>'
        }</div>
        <span class="caption ${paletteOK ? '' : 'danger'}">${p.palette.length} of 3–5</span>
      </div>
      ${
        editable
          ? PALETTES.map(
              (pal) => `<div class="row-field">
                <button data-action="pmPreset" data-name="${pal.name}" style="width:64px;text-align:left;font-size:14px">${pal.name}</button>
                ${pal.colors
                  .map((h) => {
                    const on = p.palette.includes(h);
                    return `<button class="swatch${on ? ' on' : ''}" style="flex:1;min-height:40px" data-action="pmToggle" data-hex="${h}" aria-pressed="${on}" aria-label="Color ${h}"><span style="width:30px;height:30px;background:#${h}"></span></button>`;
                  })
                  .join('')}
              </div>`
            ).join('') +
            `<div class="field row-field"><span>Custom color</span>
              <span style="display:flex;gap:12px;align-items:center">
                <input type="color" data-bind="pm.custom" value="${esc(p.custom)}" style="width:44px;height:32px;border:0;background:none;padding:0">
                <button data-action="pmAddCustom" style="font-weight:600">Add</button>
              </span></div>
            <span class="caption">Tap a palette name to use it, or tap single colors to build your own (3–5 colors).</span>`
          : ''
      }
    </div>

    <div class="section"><span class="label">Month title (optional)</span>
      ${
        editable
          ? `<input class="field" type="text" data-bind="pm.title" value="${esc(p.title)}" placeholder="e.g. Becoming serious" autocomplete="off">`
          : `<div class="field ${p.title ? '' : 'muted'}">${esc(p.title || 'No title')}</div>`
      }
    </div>

    ${editable ? '<button class="btn-primary" data-action="pmSave" data-valid="pm">Save</button>' : ''}
  </div>`;
}

async function savePersonalization() {
  const p = state.pm;
  if (p.month !== currentMonth() || !registry.validators.pm()) return;
  const month = p.month;
  const names = [];
  const newFiles = [];
  try {
    let bytes = 0;
    for (const img of p.images) {
      if (img.blob) {
        const name = `${uuid()}.jpg`;
        newFiles.push({ key: monthImageKey(month, name), record: await blobRecord(img.blob) });
        bytes += img.blob.size;
        names.push(name);
      } else {
        names.push(img.name);
      }
    }
    if (bytes) await ensureSpace(bytes);
    const removed = p.original.filter((n) => !names.includes(n));
    const existing = data.months[month];
    const record = {
      month,
      imagePaths: names.length ? names : null,
      colorPalette: p.palette.length ? [...p.palette] : null,
      monthTitle: p.title.trim() || null,
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
    };
    await DB.write(['months', 'files'], (tx) => {
      const files = tx.objectStore('files');
      newFiles.forEach((f) => files.put(f.record, f.key));
      removed.forEach((n) => files.delete(monthImageKey(month, n)));
      tx.objectStore('months').put(record);
    });
    removed.forEach((n) => forgetFileURL(monthImageKey(month, n)));
    data.months[month] = record;
  } catch (error) {
    return fail(error, 'save this month');
  }
  requestPersistence();
  loadPersonalization(month);
  toast(`Saved ${monthTitle(month)}`);
  render();
}
register({
  screens: { personalize: () => viewPersonalize() },
  validators: {
  pm() {
    const n = state.pm ? state.pm.palette.length : 0;
    return (n === 0 || (n >= 3 && n <= 5)) && !state.pm.processing;
  },
  },
  actions: {
    openPersonalize() {
      loadPersonalization(currentMonth());
      push({ name: 'personalize' });
    },
  pmRemove(el) {
    const p = state.pm;
    const img = p.images.find((i) => i.id === el.dataset.id);
    if (img && img.blob) URL.revokeObjectURL(img.url);
    p.images = p.images.filter((i) => i.id !== el.dataset.id);
    render();
  },
  pmToggle(el) {
    const p = state.pm;
    if (p.month !== currentMonth()) return;
    const hex = el.dataset.hex;
    if (p.palette.includes(hex)) p.palette = p.palette.filter((h) => h !== hex);
    else if (p.palette.length < 5) p.palette.push(hex);
    render();
  },
  pmPreset(el) {
    const pal = PALETTES.find((x) => x.name === el.dataset.name);
    if (pal) state.pm.palette = pal.colors.slice(0, 5);
    render();
  },
  pmAddCustom() {
    const hex = state.pm.custom.replace('#', '').toUpperCase();
    if (/^[0-9A-F]{6}$/.test(hex) && !state.pm.palette.includes(hex) && state.pm.palette.length < 5) state.pm.palette.push(hex);
    render();
  },
  pmSave() {
    savePersonalization();
  },
  },
  changeActions: {
  pmMonth(el) {
    loadPersonalization(el.value);
    render();
  },
  },
  fileActions: {
  async pmAdd(files) {
    const p = state.pm;
    p.processing = true;
    render();
    const room = MAX_MONTH_IMAGES - p.images.length;
    let failure = null;
    for (const file of [...files].slice(0, room)) {
      try {
        const blob = await compressImage(file);
        p.images.push({ id: uuid(), blob, url: URL.createObjectURL(blob) });
      } catch (error) {
        failure = error;
      }
    }
    p.processing = false;
    if (files.length > room) alert(`Only ${MAX_MONTH_IMAGES} images per month. The extra ones were left out.`);
    if (failure) alert(`Photo problem. ${failure.message}`);
    render();
  },
  async pmReplace(files, el) {
    const p = state.pm;
    const index = p.images.findIndex((i) => i.id === el.dataset.id);
    if (index === -1) return;
    p.processing = true;
    render();
    try {
      const blob = await compressImage(files[0]);
      const old = p.images[index];
      if (old.blob) URL.revokeObjectURL(old.url);
      p.images[index] = { id: uuid(), blob, url: URL.createObjectURL(blob) };
    } catch (error) {
      alert(`Photo problem. ${error.message}`);
    } finally {
      p.processing = false;
      render();
    }
  },
  },
});
