/* Christina — one search across everything recorded (events, journal, dreams, signs, states, rituals done),
 * threads, themes, and the rituals and prayers themselves.
 * Matching is plain text, case-insensitive, every word must appear somewhere in the record. */
import { data } from '../core/db.js';
import { registry } from '../core/registry.js';
import { categoryById, tagById, recordTitle, newestFirst } from '../core/queries.js';

const lower = (s) => String(s || '').toLowerCase();

function recordText(r) {
  const kind = registry.kinds[r.kind];
  const p = r.payload || {};
  const body = p.body || {};
  return lower([
    recordTitle(r, kind ? kind.label : ''),
    r.text,
    kind ? kind.label : r.kind === 'activity' ? 'event' : r.kind,
    ...(r.categoryIds || []).map((id) => categoryById(id).name),
    ...(r.tagIds || []).map((id) => (tagById(id) || {}).name),
    ...(r.threadIds || []).map((id) => (data.threads.find((t) => t.id === id) || {}).title),
    ...(r.themeIds || []).map((id) => ((data.themes || []).find((t) => t.id === id) || {}).name),
    p.tags, p.location, body.sensation, body.region,
  ].filter(Boolean).join(' \n '));
}

/** kind: 'all' | 'activity' | 'journal' (entries, dreams, signs) | 'ritual' (rituals done) | 'state'. */
function search(query, kind = 'all') {
  const words = lower(query).split(/\s+/).filter(Boolean);
  if (!words.length) return { records: [], threads: [] };
  const WRITING = ['journal', 'dream', 'sign'];
  const kindOk = (r) => kind === 'all' || (kind === 'journal' ? WRITING.includes(r.kind) : r.kind === kind);
  const records = data.records
    .filter((r) => !r.archived && kindOk(r))
    .filter((r) => {
      const text = recordText(r);
      return words.every((w) => text.includes(w));
    })
    .sort(newestFirst);
  const has = (text) => words.every((w) => lower(text).includes(w));
  const all = kind === 'all';
  const threads = all ? data.threads.filter((t) => has(`${t.title} ${t.description || ''}`)) : [];
  const themes = all ? (data.themes || []).filter((t) => has(`${t.name} ${t.description || ''}`)) : [];
  const library = all || kind === 'ritual'
    ? [
        ...(data.rituals || []).filter((r) => has(`${r.name} ${r.intention || ''} ${(r.situations || []).join(' ')} ${(r.steps || []).map((s) => s.text).join(' ')}`)).map((r) => ({ kind: 'ritual', item: r })),
        ...(all ? (data.prayers || []).filter((p) => has(`${p.name} ${p.text || ''} ${(p.situations || []).join(' ')}`)).map((p) => ({ kind: 'prayer', item: p })) : []),
      ]
    : [];
  return { records, threads, themes, library };
}

export { search };
