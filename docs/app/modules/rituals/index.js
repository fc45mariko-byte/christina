/* Rituals: things you do, prepared now for moments that come back — and Prayers, words you return to.
 * Both live in one section (Rituals | Prayers).
 *
 * Store 'rituals': { id, name, intention, situations[], group, duration, imageId, visualIds[],
 *   steps: [{ id, text, note, imageId, productId, prayerId, sound, duration, check }],
 *   objects: [{ id, name, have }], products: [{ id, name, imageId, url, price, notes, have }],
 *   prayerIds[], themeIds[], tags, favourite, lastPerformedAt, … }
 * Store 'prayers': { id, name, text, situations[], imageId, tags, favourite, lastReadAt, … }
 * A ritual done is a record of kind 'ritual' (payload.ritualId), so it appears in Overview, Calendar, Archive
 * and Insights. "For tonight" is kept in meta 'rituals'. Pictures are kept under 'media/<id>' (ui/media.js). */
import { esc, uuid, F } from '../../core/util.js';
import { DB, data } from '../../core/db.js';
import { newestFirst, isPastMonth, recordMonth } from '../../core/queries.js';
import { state, push, back } from '../../core/state.js';
import { render } from '../../core/render.js';
import { register, registry } from '../../core/registry.js';
import { putItem, removeItem } from '../../core/repo.js';
import { icon } from '../../ui/icons.js';
import { navbar, recordRow, toast, fail } from '../../ui/components.js';
import { mediaHTML, addDraftImage, commitDraftImages } from '../../ui/media.js';
import { openModule } from '../../shell/nav.js';

const SITUATIONS = ['After a difficult day', 'Before sleep', 'When I feel disconnected', 'When I need confidence', 'When I want to begin again', 'When I am overwhelmed', 'When I cannot sleep', 'Before going out', 'Before seeing someone', 'When I want to mark an ending', 'When I feel rejected', 'When I need courage'];
state.ritualsView = 'rituals';
state.ritualFilter = 'all';
state.prayerFilter = 'all';
state.rf = null; // ritual draft
state.prf = null; // prayer draft
state.run = null; // { id, i, note }
state.rx = { situation: '', object: '' }; // small inputs in the editors

const lower = (s) => String(s || '').trim().toLowerCase();
const ritualById = (id) => data.rituals.find((r) => r.id === id);
const prayerById = (id) => data.prayers.find((p) => p.id === id);
const time = (v) => (v ? new Date(v).getTime() : 0);
const byUse = (a, b) => (b.favourite ? 1 : 0) - (a.favourite ? 1 : 0) || time(b.lastPerformedAt || b.lastReadAt) - time(a.lastPerformedAt || a.lastReadAt) || time(b.updatedAt) - time(a.updatedAt);
const realSteps = (r) => (r.steps || []).filter((s) => (s.text || '').trim() || s.imageId);
const clone = (x) => JSON.parse(JSON.stringify(x));
const meta = () => data.ritualsMeta || {};
async function saveMeta(changes) {
  const next = { ...meta(), ...changes, key: 'rituals' };
  await DB.write(['meta'], (tx) => tx.objectStore('meta').put(next));
  data.ritualsMeta = next;
}

// ------------------------------------------------------------ For tonight

const isTonight = (kind, id) => !!meta().tonight && meta().tonight.kind === kind && meta().tonight.id === id;
/** The ritual or prayer kept for tonight; after 5 pm, otherwise, one made for the night (by its situations). */
function tonightItem() {
  const t = meta().tonight;
  const kept = t && (t.kind === 'ritual' ? ritualById(t.id) : prayerById(t.id));
  if (kept) return { kind: t.kind, item: kept, kept: true };
  const h = new Date().getHours();
  if (h < 17 && h >= 5) return null;
  const night = /sleep|night|tonight|evening|bed/i;
  const r = [...data.rituals].sort(byUse).find((x) => (x.situations || []).some((s) => night.test(s)));
  if (r) return { kind: 'ritual', item: r, kept: false };
  const p = [...data.prayers].sort(byUse).find((x) => (x.situations || []).some((s) => night.test(s)));
  return p ? { kind: 'prayer', item: p, kept: false } : null;
}

// ------------------------------------------------------------ pieces

const thumb = (id, fallback, blobs = null) => `<span class="rthumb">${id ? mediaHTML(id, blobs) : icon(fallback)}</span>`;
const pills = (list) => (list || []).length ? `<div class="chip-row">${list.map((s) => `<span class="pill">${esc(s)}</span>`).join('')}</div>` : '';

function ritualCard(r) {
  const sub = (r.situations || [])[0] || r.duration || '';
  return `<button class="rcard" data-action="openRitual" data-id="${esc(r.id)}">
    <span class="sq rcover">${r.imageId ? mediaHTML(r.imageId) : icon('candle')}${r.favourite ? `<span class="rstar">${icon('star')}</span>` : ''}</span>
    <span class="rname">${esc(r.name)}</span>${sub ? `<span class="caption">${esc(sub)}</span>` : ''}
  </button>`;
}
const prayerRow = (p) => `<button class="row" data-action="openPrayer" data-id="${esc(p.id)}">${thumb(p.imageId, 'prayer')}
  <span class="row-text"><span class="body">${esc(p.name || 'Prayer')}${p.favourite ? ' ★' : ''}</span><span class="caption">${esc((p.situations || [])[0] || (p.text || '').split('\n')[0])}</span></span>${icon('right', 'chev')}</button>`;

function filterPills(kind, items, current) {
  const sits = [...new Set(items.flatMap((x) => x.situations || []))];
  const groups = kind === 'ritual' ? [...new Set(items.map((x) => x.group).filter(Boolean))] : [];
  const opts = [['all', 'All'], ...(items.some((x) => x.favourite) ? [['fav', 'Favourites']] : []), ...groups.map((g) => [`g:${g}`, g]), ...sits.map((s) => [`s:${s}`, s])];
  return opts.length > 1 ? `<div class="chip-row">${opts.map(([k, l]) => `<button class="pill ${current === k ? 'on' : ''}" data-action="${kind}Filter" data-f="${esc(k)}">${esc(l)}</button>`).join('')}</div>` : '';
}
const applyFilter = (items, f) =>
  f === 'all' ? items : f === 'fav' ? items.filter((x) => x.favourite) : f.startsWith('g:') ? items.filter((x) => x.group === f.slice(2)) : items.filter((x) => (x.situations || []).includes(f.slice(2)));

// ------------------------------------------------------------ section

function viewRituals() {
  const isR = state.ritualsView === 'rituals';
  const tonight = tonightItem();
  let body;
  if (isR) {
    const all = [...data.rituals].sort(byUse);
    const list = applyFilter(all, state.ritualFilter);
    body = all.length
      ? `${filterPills('ritual', all, state.ritualFilter)}<div class="rgrid">${list.map(ritualCard).join('')}</div>`
      : `<div class="blank">No rituals yet. A ritual is something you prepare now for a moment you know will come again. Tap New to make one.</div>`;
  } else {
    const all = [...data.prayers].sort(byUse);
    const list = applyFilter(all, state.prayerFilter);
    body = all.length
      ? `${filterPills('prayer', all, state.prayerFilter)}<div class="list">${list.map(prayerRow).join('')}</div>`
      : `<div class="blank">No prayers yet. Write words for a state you know you will be in again. Tap New.</div>`;
  }
  return `<div class="page tight">
    <div class="page-head"><h1>Rituals</h1><button class="nav-btn strong" data-action="${isR ? 'newRitual' : 'newPrayer'}">${icon('plus')}New</button></div>
    <div class="segmented" style="margin:8px 0"><button class="${isR ? 'on' : ''}" data-action="ritualsView" data-v="rituals">Rituals</button><button class="${isR ? '' : 'on'}" data-action="ritualsView" data-v="prayers">Prayers</button></div>
    ${tonight ? `<button class="card" data-action="${tonight.kind === 'ritual' ? 'openRitual' : 'openPrayer'}" data-id="${esc(tonight.item.id)}">${thumb(tonight.item.imageId, tonight.kind === 'ritual' ? 'candle' : 'prayer')}<span class="row-text"><span class="caption">For tonight${tonight.kept ? '' : ' · suggested'}</span><span class="body" style="font-weight:600">${esc(tonight.item.name)}</span></span>${icon('right', 'chev')}</button>` : ''}
    ${body}
  </div>`;
}

// ------------------------------------------------------------ a ritual

function prepareList(r, interactive = true) {
  const objs = r.objects || [];
  const prods = r.products || [];
  if (!objs.length && !prods.length) return '';
  const check = (k, i, on) =>
    interactive ? `<button class="check ${on ? 'on' : ''}" data-action="toggleHave" data-id="${esc(r.id)}" data-k="${k}" data-i="${i}" aria-pressed="${!!on}" aria-label="${on ? 'Ready' : 'Not ready yet'}">${icon('check')}</button>` : '';
  return `<div class="list">${objs.map((o, i) => `<div class="row">${check('objects', i, o.have)}<span class="row-text"><span class="body ${o.have ? 'done-text' : ''}">${esc(o.name)}</span></span></div>`).join('')}
    ${prods.map((p, i) => `<div class="row">${check('products', i, p.have)}<button class="row-text" style="text-align:left;flex-direction:row;align-items:center;gap:12px" data-action="openProduct" data-id="${esc(r.id)}" data-p="${esc(p.id)}">${thumb(p.imageId, 'bag')}<span class="row-text"><span class="body ${p.have ? 'done-text' : ''}">${esc(p.name || 'Product')}</span>${p.price || p.notes ? `<span class="caption">${esc([p.price, p.notes].filter(Boolean).join(' · '))}</span>` : ''}</span></button>${p.url ? `<a class="arrow" href="${esc(p.url)}" target="_blank" rel="noopener" aria-label="Open link">${icon('link')}</a>` : ''}</div>`).join('')}</div>`;
}

function stepBadges(s, r) {
  const b = [];
  if (s.duration) b.push(`${icon('clock')}${esc(s.duration)}`);
  const pr = (r.products || []).find((p) => p.id === s.productId);
  if (pr) b.push(`${icon('bag')}${esc(pr.name || 'Product')}`);
  const py = prayerById(s.prayerId);
  if (py) b.push(`${icon('prayer')}${esc(py.name)}`);
  if (s.sound) b.push(`${icon('music')}${esc(s.sound.length > 24 ? `${s.sound.slice(0, 23)}…` : s.sound)}`);
  if (s.note) b.push(`${icon('note')}Note`);
  if (s.imageId) b.push(`${icon('photo')}Picture`);
  return b.length ? `<span class="badges">${b.map((x) => `<span class="mini">${x}</span>`).join('')}</span>` : '';
}

function viewRitual(id) {
  const r = ritualById(id);
  if (!r) return `${navbar('')}<div class="page"><div class="blank">This ritual no longer exists.</div></div>`;
  const steps = realSteps(r);
  const prayers = (r.prayerIds || []).map(prayerById).filter(Boolean);
  const themes = (r.themeIds || []).map((t) => (data.themes || []).find((x) => x.id === t)).filter(Boolean);
  const done = data.records.filter((x) => x.kind === 'ritual' && x.payload && x.payload.ritualId === id && !x.archived).sort(newestFirst);
  return `${navbar('', `<button class="nav-btn" data-action="toggleFavourite" data-kind="ritual" data-id="${esc(id)}" aria-pressed="${!!r.favourite}" aria-label="${r.favourite ? 'Remove from favourites' : 'Add to favourites'}">${icon('star')}${r.favourite ? 'Favourite' : ''}</button><button class="nav-btn" data-action="editRitual" data-id="${esc(id)}">Edit</button>`)}
  <div class="page">
    ${r.imageId ? `<div class="photo rhero">${mediaHTML(r.imageId, null, { controls: true })}</div>` : ''}
    <h1>${esc(r.name)}</h1>
    ${(r.situations || []).length ? `<div class="section"><span class="label">For</span>${pills(r.situations)}</div>` : ''}
    ${r.intention ? `<p style="margin:0;white-space:pre-wrap;font-size:17px">${esc(r.intention)}</p>` : ''}
    <div class="section">
      <button class="btn-primary" data-action="runRitual" data-id="${esc(id)}" ${steps.length ? '' : 'disabled'}>${steps.length ? 'Begin ritual' : 'Add steps to begin'}</button>
      <button class="btn-secondary" data-action="keepTonight" data-kind="ritual" data-id="${esc(id)}">${isTonight('ritual', id) ? 'Kept for tonight' : 'Keep for tonight'}</button>
    </div>
    ${(r.objects || []).length || (r.products || []).length ? `<div class="section"><span class="label">Things to prepare</span>${prepareList(r)}</div>` : ''}
    ${(r.visualIds || []).length ? `<div class="section"><span class="label">Visual references</span><div class="img-grid">${r.visualIds.map((v) => `<div class="sq">${mediaHTML(v, null, { controls: true })}</div>`).join('')}</div></div>` : ''}
    <div class="section"><div class="page-head"><span class="label">The ritual</span>${r.duration ? `<span class="caption">${esc(r.duration)}</span>` : ''}</div>
      ${steps.length ? `<ol class="rsteps">${steps.map((s) => `<li><span>${esc(s.text)}</span>${stepBadges(s, r)}</li>`).join('')}</ol>` : '<span class="muted">No steps yet.</span>'}
    </div>
    ${prayers.length ? `<div class="section"><span class="label">Prayers</span><div class="list">${prayers.map(prayerRow).join('')}</div></div>` : ''}
    ${themes.length ? `<div class="section"><span class="label">Themes</span><div class="chip-row">${themes.map((t) => `<button class="pill" data-action="openTheme" data-id="${esc(t.id)}"><span class="dot" style="background:#${esc(t.color)};width:8px;height:8px"></span>${esc(t.name)}</button>`).join('')}</div></div>` : ''}
    <div class="section"><div class="page-head"><span class="label">Times you did it</span><button class="nav-btn" data-action="ritualDoneNow" data-id="${esc(id)}">Record without guiding</button></div>
      ${done.length ? `<div class="list">${done.slice(0, 12).map((x) => recordRow(x, isPastMonth(recordMonth(x)))).join('')}</div>` : '<span class="muted">Not yet.</span>'}
    </div>
  </div>`;
}

function viewProduct(rid, pid) {
  const r = ritualById(rid);
  const p = r && (r.products || []).find((x) => x.id === pid);
  if (!p) return `${navbar('')}<div class="page"></div>`;
  return `${navbar('Product')}<div class="page">
    ${p.imageId ? `<div class="photo">${mediaHTML(p.imageId, null, { controls: true })}</div>` : ''}
    <h1>${esc(p.name || 'Product')}</h1>
    ${p.price ? `<span class="label">${esc(p.price)}</span>` : ''}
    ${p.notes ? `<p style="margin:0;white-space:pre-wrap">${esc(p.notes)}</p>` : ''}
    ${p.url ? `<a class="btn-secondary" style="display:flex;align-items:center;justify-content:center;text-decoration:none;color:inherit" href="${esc(p.url)}" target="_blank" rel="noopener">Open link</a>` : ''}
    <span class="caption">Part of ${esc(r.name)}. Edit it from the ritual.</span>
  </div>`;
}

// ------------------------------------------------------------ ritual editor

const newStep = (text = '') => ({ id: uuid(), text, note: '', imageId: null, productId: null, prayerId: null, sound: '', duration: '', check: false });

function imageSlot(id, draft, action, attrs = '', label = 'Add a picture') {
  return `<div class="sq rslot">${id ? `${mediaHTML(id, draft._blobs)}<button class="remove-x" data-action="${action}" data-op="remove" ${attrs} aria-label="Remove picture">${icon('x')}</button>` : `<label class="add-tile" aria-label="${label}">${icon('plus')}<input type="file" accept="image/*" data-file-input="${action}" ${attrs}></label>`}</div>`;
}

function situationPicker(form, d) {
  const sel = d.situations || [];
  const used = [...new Set([...data.rituals, ...data.prayers].flatMap((x) => x.situations || []))];
  const base = (meta().situations && meta().situations.length ? meta().situations : SITUATIONS);
  const pool = [...new Set([...sel, ...used, ...base])];
  return `<div class="chip-row" style="flex-wrap:wrap">${pool.map((s) => `<button class="pill ${sel.includes(s) ? 'on' : ''}" data-action="toggleSituation" data-form="${form}" data-v="${esc(s)}" aria-pressed="${sel.includes(s)}">${esc(s)}</button>`).join('')}</div>
    <div class="row-field"><input class="field" type="text" data-bind="rx.situation" placeholder="Your own, e.g. When I feel ugly" autocomplete="off"><button class="nav-btn strong" data-action="addSituation" data-form="${form}">Add</button></div>`;
}

function viewRitualEdit() {
  const d = state.rf;
  if (!d) return `${navbar('')}<div class="page"></div>`;
  const prayers = (d.prayerIds || []).map(prayerById).filter(Boolean);
  const free = data.prayers.filter((p) => !(d.prayerIds || []).includes(p.id));
  const themes = data.themes || [];
  return `${navbar(d._new ? 'New ritual' : 'Edit ritual', '<button class="nav-btn strong" data-action="saveRitual" data-valid="ritual">Save</button>')}
  <div class="page">
    <div class="section"><span class="label">Name</span><input class="field" type="text" data-bind="rf.name" value="${esc(d.name || '')}" placeholder="e.g. Reset after a difficult day" autocomplete="off"></div>
    <div class="section"><span class="label">Picture</span><div style="max-width:160px">${imageSlot(d.imageId, d, 'ritualImage', 'data-slot="cover"')}</div></div>
    <div class="section"><span class="label">When is this for?</span>${situationPicker('rf', d)}</div>
    <div class="section"><span class="label">Intention</span><textarea class="field" data-bind="rf.intention" placeholder="What is this ritual for?">${esc(d.intention || '')}</textarea></div>
    <div class="section"><span class="label">The ritual</span>
      ${(d.steps || []).map((s, i) => `<div class="rstep-edit">
        <span class="caption" style="min-width:1.5em;text-align:right">${i + 1}</span>
        <textarea class="field" rows="2" data-bind="rf.steps.${i}.text" placeholder="Step ${i + 1}">${esc(s.text || '')}</textarea>
        <span class="rstep-tools">
          <button class="arrow" data-action="stepDetails" data-i="${i}" aria-label="Details for step ${i + 1}">${icon('more')}</button>
          <button class="arrow" data-action="moveStep" data-i="${i}" data-d="-1" aria-label="Move step ${i + 1} up" ${i === 0 ? 'disabled' : ''}>${icon('up')}</button>
        </span>
      </div>${stepBadges(s, d) ? `<div style="padding-left:2em">${stepBadges(s, d)}</div>` : ''}`).join('')}
      <button class="btn-secondary" data-action="addStep">${icon('plus')} Add a step</button>
    </div>
    <div class="section"><span class="label">Things to prepare</span>
      ${(d.objects || []).length ? `<div class="list">${d.objects.map((o, i) => `<div class="row"><span class="row-text"><span class="body">${esc(o.name)}</span></span><button class="arrow" data-action="removeObject" data-i="${i}" aria-label="Remove ${esc(o.name)}">${icon('x')}</button></div>`).join('')}</div>` : ''}
      <div class="row-field"><input class="field" type="text" data-bind="rx.object" placeholder="Something to have ready, e.g. a candle" autocomplete="off"><button class="nav-btn strong" data-action="addObject">Add</button></div>
      ${(d.products || []).length ? `<div class="list">${d.products.map((p, i) => `<button class="row" data-action="editProduct" data-i="${i}">${thumb(p.imageId, 'bag', d._blobs)}<span class="row-text"><span class="body">${esc(p.name || 'Untitled product')}</span>${p.price ? `<span class="caption">${esc(p.price)}</span>` : ''}</span>${icon('right', 'chev')}</button>`).join('')}</div>` : ''}
      <button class="btn-secondary" data-action="addProduct">${icon('plus')} Add a product</button>
    </div>
    <div class="section"><span class="label">Visual references</span>
      <div class="img-grid">${(d.visualIds || []).map((v, i) => imageSlot(v, d, 'ritualVisual', `data-i="${i}"`)).join('')}${(d.visualIds || []).length < 9 ? imageSlot(null, d, 'ritualVisual', 'data-i="new"', 'Add a visual reference') : ''}</div>
    </div>
    <div class="section"><span class="label">Prayers</span>
      ${prayers.length ? `<div class="list">${prayers.map((p) => `<div class="row"><span class="row-text"><span class="body">${esc(p.name)}</span></span><button class="arrow" data-action="detachPrayer" data-id="${esc(p.id)}" aria-label="Detach ${esc(p.name)}">${icon('x')}</button></div>`).join('')}</div>` : ''}
      ${free.length ? `<select class="field" data-change="attachPrayer" aria-label="Attach a prayer"><option value="">Attach a prayer…</option>${free.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select>` : '<span class="caption">Write prayers in Rituals → Prayers to attach them here.</span>'}
    </div>
    ${themes.length ? `<div class="section"><span class="label">Themes</span><div class="chip-row" style="flex-wrap:wrap">${themes.map((t) => `<button class="pill ${(d.themeIds || []).includes(t.id) ? 'on' : ''}" data-action="toggleRitualTheme" data-id="${esc(t.id)}" aria-pressed="${(d.themeIds || []).includes(t.id)}">${esc(t.name)}</button>`).join('')}</div></div>` : ''}
    <div class="row-field" style="align-items:flex-start">
      <div class="section" style="flex:1"><span class="label">Group (optional)</span><input class="field" type="text" data-bind="rf.group" value="${esc(d.group || '')}" placeholder="e.g. Sleep" autocomplete="off"></div>
      <div class="section" style="flex:1"><span class="label">Duration (optional)</span><input class="field" type="text" data-bind="rf.duration" value="${esc(d.duration || '')}" placeholder="e.g. 20 min" autocomplete="off"></div>
    </div>
    ${d._new ? '' : `<button class="btn-secondary danger" data-action="deleteRitual" data-id="${esc(d.id)}">Delete ritual</button>`}
  </div>`;
}

function viewStepEdit(i) {
  const d = state.rf;
  const s = d && (d.steps || [])[i];
  if (!s) return `${navbar('')}<div class="page"></div>`;
  return `${navbar(`Step ${i + 1}`, '<button class="nav-btn strong" data-action="back">Done</button>')}
  <div class="page">
    <div class="section"><span class="label">What happens</span><textarea class="field" data-bind="rf.steps.${i}.text">${esc(s.text || '')}</textarea></div>
    <div class="section"><span class="label">Picture</span><div style="max-width:200px">${imageSlot(s.imageId, d, 'stepImage', `data-i="${i}"`)}</div></div>
    <div class="section"><span class="label">Note</span><textarea class="field" data-bind="rf.steps.${i}.note" placeholder="Anything to remember while doing it">${esc(s.note || '')}</textarea></div>
    <div class="row-field" style="align-items:flex-start">
      <div class="section" style="flex:1"><span class="label">Duration</span><input class="field" type="text" data-bind="rf.steps.${i}.duration" value="${esc(s.duration || '')}" placeholder="e.g. 5 min"></div>
      <div class="section" style="flex:1"><span class="label">Sound or music</span><input class="field" type="text" data-bind="rf.steps.${i}.sound" value="${esc(s.sound || '')}" placeholder="Song or link"></div>
    </div>
    <div class="section"><span class="label">Product</span><select class="field" data-bind="rf.steps.${i}.productId"><option value="">None</option>${(d.products || []).map((p) => `<option value="${esc(p.id)}" ${s.productId === p.id ? 'selected' : ''}>${esc(p.name || 'Product')}</option>`).join('')}</select></div>
    <div class="section"><span class="label">Prayer</span><select class="field" data-bind="rf.steps.${i}.prayerId"><option value="">None</option>${data.prayers.map((p) => `<option value="${esc(p.id)}" ${s.prayerId === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
    <div class="field row-field"><span>Check it off when done</span><label class="toggle"><input type="checkbox" data-bind="rf.steps.${i}.check" ${s.check ? 'checked' : ''}><span></span></label></div>
    <button class="btn-secondary danger" data-action="removeStep" data-i="${i}">Remove step</button>
  </div>`;
}

function viewProductEdit(i) {
  const d = state.rf;
  const p = d && (d.products || [])[i];
  if (!p) return `${navbar('')}<div class="page"></div>`;
  return `${navbar('Product', '<button class="nav-btn strong" data-action="back">Done</button>')}
  <div class="page">
    <div style="max-width:200px">${imageSlot(p.imageId, d, 'productImage', `data-i="${i}"`)}</div>
    <div class="section"><span class="label">Name</span><input class="field" type="text" data-bind="rf.products.${i}.name" value="${esc(p.name || '')}" placeholder="e.g. Lavender candle"></div>
    <div class="section"><span class="label">Link</span><input class="field" type="url" inputmode="url" data-bind="rf.products.${i}.url" value="${esc(p.url || '')}" placeholder="https://"></div>
    <div class="section"><span class="label">Price</span><input class="field" type="text" data-bind="rf.products.${i}.price" value="${esc(p.price || '')}" placeholder="e.g. €24"></div>
    <div class="section"><span class="label">Why I want it</span><textarea class="field" data-bind="rf.products.${i}.notes">${esc(p.notes || '')}</textarea></div>
    <button class="btn-secondary danger" data-action="removeProduct" data-i="${i}">Remove product</button>
  </div>`;
}

const ritualImages = (r) => [r.imageId, ...(r.visualIds || []), ...(r.steps || []).map((s) => s.imageId), ...(r.products || []).map((p) => p.imageId)].filter(Boolean);

async function saveRitual() {
  const d = state.rf;
  if (!d || !registry.validators.ritual()) return;
  const before = ritualById(d.id);
  const { _new, _blobs, ...clean } = d;
  const ritual = {
    ...clean,
    name: d.name.trim(),
    steps: (d.steps || []).filter((s) => (s.text || '').trim() || s.imageId).map((s) => ({ ...s, text: (s.text || '').trim() })),
    objects: d.objects || [],
    products: (d.products || []).map((p) => ({ ...p, url: (p.url || '').trim() })),
  };
  try {
    await commitDraftImages(d, ritualImages(ritual), before ? ritualImages(before) : []);
    await putItem('rituals', ritual);
  } catch (error) {
    return fail(error, 'save this ritual');
  }
  state.rf = null;
  toast(before ? 'Saved' : 'Ritual added');
  back();
  if (!before) push({ name: 'ritual', id: ritual.id });
}

// ------------------------------------------------------------ guided mode

const RUN = { timer: null, end: 0 };
function stopTimer() {
  clearInterval(RUN.timer);
  RUN.timer = null;
  RUN.end = 0;
}
function minutesOf(s) {
  const m = /(\d+(?:[.,]\d+)?)\s*(s|sec|m|min|h|hr)?/i.exec(s || '');
  if (!m) return 0;
  const n = parseFloat(m[1].replace(',', '.'));
  const u = (m[2] || 'min').toLowerCase();
  return u.startsWith('s') ? n / 60 : u.startsWith('h') ? n * 60 : n;
}
function tick() {
  const el = document.querySelector('#run-timer');
  if (!el) return stopTimer();
  const left = Math.max(0, RUN.end - Date.now());
  el.textContent = left ? `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}` : 'Time';
  if (!left) {
    stopTimer();
    if (navigator.vibrate) try { navigator.vibrate([60, 40, 60]); } catch { /* not available */ }
  }
}

function viewRun() {
  const run = state.run;
  const r = run && ritualById(run.id);
  if (!r) return `${navbar('')}<div class="page"></div>`;
  const steps = realSteps(r);
  const n = steps.length;
  const i = run.i;
  const progress = `<div class="progress" aria-hidden="true"><i style="width:${Math.max(0, Math.min(1, (i + 1) / n)) * 100}%"></i></div>`;
  const head = navbar(i < 0 ? '' : i >= n ? 'Complete' : `${i + 1} of ${n}`, '').replace('data-action="back" aria-label="Back">', 'data-action="leaveRun" aria-label="Leave the ritual">');
  if (i < 0) {
    return `${head}<div class="page rrun">${progress}
      <span class="caption">Ritual</span><h1>${esc(r.name)}</h1>
      ${r.intention ? `<p class="rrun-text" style="font-size:18px;font-weight:400">${esc(r.intention)}</p>` : ''}
      ${(r.objects || []).length || (r.products || []).length ? `<span class="label">Have everything?</span>${prepareList(r)}` : ''}
      <button class="btn-primary" data-action="runStep" data-d="1">Begin</button>
    </div>`;
  }
  if (i >= n) {
    return `${head}<div class="page rrun">${progress}
      <span class="caption">${esc(r.name)}</span><h1>Complete.</h1>
      <div class="section"><span class="label">Anything you want to remember?</span><textarea class="field" data-bind="run.note" placeholder="How it felt, what you left behind">${esc(run.note || '')}</textarea></div>
      <button class="btn-primary" data-action="finishRun">Save</button>
      <button class="btn-secondary" data-action="closeRun">Close without saving</button>
    </div>`;
  }
  const s = steps[i];
  const pr = (r.products || []).find((x) => x.id === s.productId);
  const py = prayerById(s.prayerId);
  const mins = minutesOf(s.duration);
  const link = /^https?:\/\//i.test(s.sound || '');
  return `${head}<div class="page rrun">${progress}
    ${s.imageId ? `<div class="photo rhero">${mediaHTML(s.imageId, null, { controls: true })}</div>` : ''}
    <p class="rrun-text">${esc(s.text)}</p>
    ${s.note ? `<p style="margin:0;white-space:pre-wrap;color:var(--text2)">${esc(s.note)}</p>` : ''}
    ${pr ? `<div class="list"><div class="row">${thumb(pr.imageId, 'bag')}<span class="row-text"><span class="body">${esc(pr.name || 'Product')}</span>${pr.notes ? `<span class="caption">${esc(pr.notes)}</span>` : ''}</span></div></div>` : ''}
    ${s.sound ? `<span class="label" style="display:flex;gap:6px;align-items:center">${icon('music')}${link ? `<a href="${esc(s.sound)}" target="_blank" rel="noopener" style="color:var(--text)">${esc(s.sound)}</a>` : esc(s.sound)}</span>` : ''}
    ${s.duration ? `<div class="row-field" style="justify-content:flex-start;gap:8px"><span class="label">${esc(s.duration)}</span>${mins > 0 ? `<button class="nav-btn strong" data-action="runTimer" data-m="${mins}"><span id="run-timer">${RUN.end ? '' : 'Start timer'}</span></button>` : ''}</div>` : ''}
    ${py ? `<button class="btn-secondary" data-action="openPrayer" data-id="${esc(py.id)}">Read “${esc(py.name)}”</button>` : ''}
    <button class="btn-primary" data-action="runStep" data-d="1">${s.check ? 'Done' : i === n - 1 ? 'Finish' : 'Next'}</button>
    ${i > 0 ? '<button class="btn-secondary" data-action="runStep" data-d="-1">Previous step</button>' : ''}
  </div>`;
}

async function recordRitualDone(r, note = '') {
  const now = new Date().toISOString();
  const record = {
    id: uuid(), kind: 'ritual', occurredAt: now, title: r.name, text: note.trim() || null, categoryIds: [], threadIds: [],
    themeIds: r.themeIds || [], tagIds: [], mediaIds: [], linkedRecordIds: [], payload: { ritualId: r.id }, archived: false, createdAt: now, updatedAt: now,
  };
  await DB.write(['records'], (tx) => tx.objectStore('records').put(record));
  data.records.push(record);
  await putItem('rituals', { ...r, lastPerformedAt: now });
}

// ------------------------------------------------------------ prayers

function viewPrayer(id) {
  const p = prayerById(id);
  if (!p) return `${navbar('')}<div class="page"><div class="blank">This prayer no longer exists.</div></div>`;
  const rituals = data.rituals.filter((r) => (r.prayerIds || []).includes(id) || (r.steps || []).some((s) => s.prayerId === id));
  return `${navbar('', `<button class="nav-btn" data-action="toggleFavourite" data-kind="prayer" data-id="${esc(id)}" aria-pressed="${!!p.favourite}" aria-label="${p.favourite ? 'Remove from favourites' : 'Add to favourites'}">${icon('star')}${p.favourite ? 'Favourite' : ''}</button><button class="nav-btn" data-action="editPrayer" data-id="${esc(id)}">Edit</button>`)}
  <div class="page">
    ${p.imageId ? `<div class="photo rhero">${mediaHTML(p.imageId, null, { controls: true })}</div>` : ''}
    <h1>${esc(p.name || 'Prayer')}</h1>
    ${(p.situations || []).length ? `<div class="section"><span class="label">When</span>${pills(p.situations)}</div>` : ''}
    <div class="prayer-text">${esc(p.text || '')}</div>
    <button class="btn-secondary" data-action="keepTonight" data-kind="prayer" data-id="${esc(id)}">${isTonight('prayer', id) ? 'Kept for tonight' : 'Keep for tonight'}</button>
    ${rituals.length ? `<div class="section"><span class="label">Part of</span><div class="list">${rituals.map((r) => `<button class="row" data-action="openRitual" data-id="${esc(r.id)}">${thumb(r.imageId, 'candle')}<span class="row-text"><span class="body">${esc(r.name)}</span></span>${icon('right', 'chev')}</button>`).join('')}</div></div>` : ''}
  </div>`;
}

function viewPrayerEdit() {
  const d = state.prf;
  if (!d) return `${navbar('')}<div class="page"></div>`;
  return `${navbar(d._new ? 'New prayer' : 'Edit prayer', '<button class="nav-btn strong" data-action="savePrayer" data-valid="prayer">Save</button>')}
  <div class="page">
    <div class="section"><span class="label">Name</span><input class="field" type="text" data-bind="prf.name" value="${esc(d.name || '')}" placeholder="e.g. Read this when I feel unwanted" autocomplete="off"></div>
    <div class="section"><span class="label">When</span>${situationPicker('prf', d)}</div>
    <div class="section"><span class="label">Prayer</span><textarea class="field" style="min-height:240px;font-size:17px;line-height:1.5" data-bind="prf.text" placeholder="Your own words">${esc(d.text || '')}</textarea></div>
    <div class="section"><span class="label">Picture</span><div style="max-width:200px">${imageSlot(d.imageId, d, 'prayerImage', '')}</div></div>
    <div class="section"><span class="label">Part of rituals</span><div class="chip-row" style="flex-wrap:wrap">${data.rituals.map((r) => `<button class="pill ${d._rituals.includes(r.id) ? 'on' : ''}" data-action="togglePrayerRitual" data-id="${esc(r.id)}" aria-pressed="${d._rituals.includes(r.id)}">${esc(r.name)}</button>`).join('') || '<span class="caption">No rituals yet.</span>'}</div></div>
    ${d._new ? '' : `<button class="btn-secondary danger" data-action="deletePrayer" data-id="${esc(d.id)}">Delete prayer</button>`}
  </div>`;
}

// ------------------------------------------------------------ registration

function setImage(draft, field, id, index) {
  if (index === undefined) draft[field] = id;
  else {
    const arr = (draft[field] = draft[field] || []);
    if (index === 'new') id && arr.push(id);
    else if (id) arr[Number(index)] = id;
    else arr.splice(Number(index), 1);
  }
}
async function chooseImage(draft, files, apply) {
  try {
    const id = await addDraftImage(draft, files[0]);
    apply(id);
  } catch (error) {
    alert(`Photo problem. ${error.message}`);
  }
  render();
}

register({
  nav: { id: 'rituals', label: 'Rituals', icon: 'candle', order: 2.55 },
  tabs: { rituals: viewRituals },
  kinds: {
    ritual: {
      label: 'Ritual',
      icon: 'candle',
      open: (r) => {
        const ritual = ritualById(r.payload && r.payload.ritualId);
        if (ritual) push({ name: 'ritual', id: ritual.id });
        else push({ name: 'recordView', id: r.id });
      },
    },
  },
  screens: {
    ritual: (v) => viewRitual(v.id),
    product: (v) => viewProduct(v.id, v.pid),
    ritualEdit: () => viewRitualEdit(),
    stepEdit: (v) => viewStepEdit(v.i),
    productEdit: (v) => viewProductEdit(v.i),
    ritualRun: () => viewRun(),
    prayer: (v) => viewPrayer(v.id),
    prayerEdit: () => viewPrayerEdit(),
  },
  validators: {
    ritual: () => !!state.rf && (state.rf.name || '').trim() !== '',
    prayer: () => !!state.prf && ((state.prf.name || '').trim() !== '' || (state.prf.text || '').trim() !== ''),
  },
  actions: {
    ritualsView(el) {
      state.ritualsView = el.dataset.v;
      render();
    },
    ritualFilter(el) {
      state.ritualFilter = el.dataset.f;
      render();
    },
    prayerFilter(el) {
      state.prayerFilter = el.dataset.f;
      render();
    },
    openRitual: (el) => push({ name: 'ritual', id: el.dataset.id }),
    openProduct: (el) => push({ name: 'product', id: el.dataset.id, pid: el.dataset.p }),
    async openPrayer(el) {
      const p = prayerById(el.dataset.id);
      if (!p) return;
      push({ name: 'prayer', id: p.id });
      try { await putItem('prayers', { ...p, lastReadAt: new Date().toISOString() }); } catch { /* reading still works */ }
    },
    newRitual() {
      state.rf = { id: uuid(), _new: true, name: '', intention: '', situations: [], group: '', duration: '', imageId: null, visualIds: [], steps: [newStep(), newStep(), newStep()], objects: [], products: [], prayerIds: [], themeIds: [], tags: '', favourite: false, lastPerformedAt: null };
      push({ name: 'ritualEdit' });
    },
    editRitual(el) {
      const r = ritualById(el.dataset.id);
      if (!r) return;
      state.rf = clone(r);
      if (!state.rf.steps || !state.rf.steps.length) state.rf.steps = [newStep()];
      push({ name: 'ritualEdit' });
    },
    saveRitual: () => saveRitual(),
    async deleteRitual(el) {
      const r = ritualById(el.dataset.id);
      if (!r || !confirm('Delete this ritual? The times you did it stay in your records.')) return;
      try {
        await commitDraftImages({}, [], ritualImages(r));
        await removeItem('rituals', r.id);
        if (isTonight('ritual', r.id)) await saveMeta({ tonight: null });
      } catch (error) {
        return fail(error, 'delete this ritual');
      }
      state.rf = null;
      back();
      back();
    },
    toggleSituation(el) {
      const d = state[el.dataset.form];
      const v = el.dataset.v;
      d.situations = (d.situations || []).includes(v) ? d.situations.filter((s) => s !== v) : [...(d.situations || []), v];
      render();
    },
    addSituation(el) {
      const d = state[el.dataset.form];
      const v = state.rx.situation.trim();
      if (!v) return;
      if (!(d.situations || []).some((s) => lower(s) === lower(v))) d.situations = [...(d.situations || []), v];
      state.rx.situation = '';
      render();
    },
    addStep() {
      state.rf.steps.push(newStep());
      render();
      const fields = document.querySelectorAll('.rstep-edit textarea');
      if (fields.length) fields[fields.length - 1].focus();
    },
    stepDetails: (el) => push({ name: 'stepEdit', i: Number(el.dataset.i) }),
    moveStep(el) {
      const i = Number(el.dataset.i);
      const j = i + Number(el.dataset.d);
      const s = state.rf.steps;
      if (j < 0 || j >= s.length) return;
      [s[i], s[j]] = [s[j], s[i]];
      render();
    },
    removeStep(el) {
      state.rf.steps.splice(Number(el.dataset.i), 1);
      back();
    },
    addObject() {
      const v = state.rx.object.trim();
      if (!v) return;
      state.rf.objects.push({ id: uuid(), name: v, have: false });
      state.rx.object = '';
      render();
    },
    removeObject(el) {
      state.rf.objects.splice(Number(el.dataset.i), 1);
      render();
    },
    addProduct() {
      state.rf.products.push({ id: uuid(), name: '', imageId: null, url: '', price: '', notes: '', have: false });
      push({ name: 'productEdit', i: state.rf.products.length - 1 });
    },
    editProduct: (el) => push({ name: 'productEdit', i: Number(el.dataset.i) }),
    removeProduct(el) {
      const p = state.rf.products.splice(Number(el.dataset.i), 1)[0];
      state.rf.steps.forEach((s) => { if (p && s.productId === p.id) s.productId = null; });
      back();
    },
    detachPrayer(el) {
      state.rf.prayerIds = state.rf.prayerIds.filter((id) => id !== el.dataset.id);
      render();
    },
    toggleRitualTheme(el) {
      const ids = state.rf.themeIds || [];
      state.rf.themeIds = ids.includes(el.dataset.id) ? ids.filter((x) => x !== el.dataset.id) : [...ids, el.dataset.id];
      render();
    },
    ritualImage(el) {
      if (el.dataset.op === 'remove') state.rf.imageId = null;
      render();
    },
    ritualVisual(el) {
      if (el.dataset.op === 'remove') setImage(state.rf, 'visualIds', null, el.dataset.i);
      render();
    },
    stepImage(el) {
      if (el.dataset.op === 'remove') state.rf.steps[Number(el.dataset.i)].imageId = null;
      render();
    },
    productImage(el) {
      if (el.dataset.op === 'remove') state.rf.products[Number(el.dataset.i)].imageId = null;
      render();
    },
    prayerImage(el) {
      if (el.dataset.op === 'remove') state.prf.imageId = null;
      render();
    },
    async toggleHave(el) {
      const r = ritualById(el.dataset.id);
      if (!r) return;
      const list = clone(r[el.dataset.k] || []);
      const x = list[Number(el.dataset.i)];
      if (!x) return;
      x.have = !x.have;
      try { await putItem('rituals', { ...r, [el.dataset.k]: list }); } catch (error) { return fail(error, 'save this'); }
      render();
    },
    async toggleFavourite(el) {
      const store = el.dataset.kind === 'ritual' ? 'rituals' : 'prayers';
      const x = data[store].find((y) => y.id === el.dataset.id);
      if (!x) return;
      try { await putItem(store, { ...x, favourite: !x.favourite }); } catch (error) { return fail(error, 'save this'); }
      render();
    },
    async keepTonight(el) {
      const { kind, id } = el.dataset;
      const off = isTonight(kind, id);
      try { await saveMeta({ tonight: off ? null : { kind, id } }); } catch (error) { return fail(error, 'save this'); }
      toast(off ? 'Removed from tonight' : 'Kept for tonight');
      render();
    },
    async ritualDoneNow(el) {
      const r = ritualById(el.dataset.id);
      if (!r) return;
      try { await recordRitualDone(r); } catch (error) { return fail(error, 'record this'); }
      toast('Recorded');
      render();
    },
    runRitual(el) {
      stopTimer();
      state.run = { id: el.dataset.id, i: -1, note: '' };
      push({ name: 'ritualRun' });
    },
    runStep(el) {
      stopTimer();
      state.run.i += Number(el.dataset.d);
      render();
    },
    runTimer(el) {
      if (RUN.end) {
        stopTimer();
        return render();
      }
      RUN.end = Date.now() + Number(el.dataset.m) * 60000;
      RUN.timer = setInterval(tick, 500);
      tick();
    },
    leaveRun() {
      const r = ritualById(state.run && state.run.id);
      const n = r ? realSteps(r).length : 0;
      if (state.run && state.run.i >= 0 && state.run.i < n && !confirm('Leave this ritual?')) return;
      stopTimer();
      back();
    },
    async finishRun() {
      const r = ritualById(state.run.id);
      if (!r) return back();
      try { await recordRitualDone(r, state.run.note || ''); } catch (error) { return fail(error, 'save this'); }
      stopTimer();
      toast('Saved');
      back();
    },
    closeRun() {
      stopTimer();
      back();
    },
    newPrayer() {
      state.prf = { id: uuid(), _new: true, name: '', text: '', situations: [], imageId: null, tags: '', favourite: false, lastReadAt: null, _rituals: [] };
      push({ name: 'prayerEdit' });
    },
    editPrayer(el) {
      const p = prayerById(el.dataset.id);
      if (!p) return;
      state.prf = { ...clone(p), _rituals: data.rituals.filter((r) => (r.prayerIds || []).includes(p.id)).map((r) => r.id) };
      push({ name: 'prayerEdit' });
    },
    togglePrayerRitual(el) {
      const ids = state.prf._rituals;
      state.prf._rituals = ids.includes(el.dataset.id) ? ids.filter((x) => x !== el.dataset.id) : [...ids, el.dataset.id];
      render();
    },
    async savePrayer() {
      const d = state.prf;
      if (!d || !registry.validators.prayer()) return;
      const before = prayerById(d.id);
      const { _new, _blobs, _rituals, ...clean } = d;
      const prayer = { ...clean, name: (d.name || '').trim() || (d.text || '').trim().split('\n')[0].slice(0, 60), text: d.text || '' };
      const ritualChanges = data.rituals
        .filter((r) => (r.prayerIds || []).includes(prayer.id) !== _rituals.includes(r.id))
        .map((r) => ({ ...r, prayerIds: _rituals.includes(r.id) ? [...(r.prayerIds || []), prayer.id] : (r.prayerIds || []).filter((x) => x !== prayer.id) }));
      try {
        await commitDraftImages(d, [prayer.imageId].filter(Boolean), before && before.imageId ? [before.imageId] : []);
        await putItem('prayers', prayer);
        for (const r of ritualChanges) await putItem('rituals', r);
      } catch (error) {
        return fail(error, 'save this prayer');
      }
      state.prf = null;
      toast(before ? 'Saved' : 'Prayer added');
      back();
      if (!before) push({ name: 'prayer', id: prayer.id });
    },
    async deletePrayer(el) {
      const p = prayerById(el.dataset.id);
      if (!p || !confirm('Delete this prayer? Rituals keep their other steps.')) return;
      const changed = data.rituals
        .filter((r) => (r.prayerIds || []).includes(p.id) || (r.steps || []).some((s) => s.prayerId === p.id))
        .map((r) => ({ ...r, prayerIds: (r.prayerIds || []).filter((x) => x !== p.id), steps: (r.steps || []).map((s) => (s.prayerId === p.id ? { ...s, prayerId: null } : s)) }));
      try {
        for (const r of changed) await putItem('rituals', r);
        await commitDraftImages({}, [], [p.imageId].filter(Boolean));
        await removeItem('prayers', p.id);
        if (isTonight('prayer', p.id)) await saveMeta({ tonight: null });
      } catch (error) {
        return fail(error, 'delete this prayer');
      }
      state.prf = null;
      back();
      back();
    },
    goRituals() {
      openModule('rituals');
      render();
    },
  },
  changeActions: {
    attachPrayer(el) {
      if (el.value && !state.rf.prayerIds.includes(el.value)) state.rf.prayerIds.push(el.value);
      render();
    },
  },
  fileActions: {
    ritualImage: (files) => chooseImage(state.rf, files, (id) => (state.rf.imageId = id)),
    ritualVisual: (files, el) => chooseImage(state.rf, files, (id) => setImage(state.rf, 'visualIds', id, el.dataset.i)),
    stepImage: (files, el) => chooseImage(state.rf, files, (id) => (state.rf.steps[Number(el.dataset.i)].imageId = id)),
    productImage: (files, el) => chooseImage(state.rf, files, (id) => (state.rf.products[Number(el.dataset.i)].imageId = id)),
    prayerImage: (files) => chooseImage(state.prf, files, (id) => (state.prf.imageId = id)),
  },
});

export { tonightItem, ritualById, prayerById, ritualCard, prayerRow, byUse };
