/* Christina — one search across everything recorded: events, journal entries, Body Oracle records, and threads.
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
    p.tags, p.location, body.sensation, body.region,
  ].filter(Boolean).join(' \n '));
}

/** kind: 'all' | 'activity' | 'journal' | 'bodyOracle' (every other kind). */
function search(query, kind = 'all') {
  const words = lower(query).split(/\s+/).filter(Boolean);
  if (!words.length) return { records: [], threads: [] };
  const kindOk = (r) => kind === 'all' || (kind === 'bodyOracle' ? !['activity', 'journal'].includes(r.kind) : r.kind === kind);
  const records = data.records
    .filter((r) => !r.archived && kindOk(r))
    .filter((r) => {
      const text = recordText(r);
      return words.every((w) => text.includes(w));
    })
    .sort(newestFirst);
  const threads = kind === 'all'
    ? data.threads.filter((t) => words.every((w) => lower(`${t.title} ${t.description || ''}`).includes(w)))
    : [];
  return { records, threads };
}

export { search };
