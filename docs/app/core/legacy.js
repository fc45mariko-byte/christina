/* Christina — how records from the former Body Oracle app fit Christina.
 * Used by the database upgrade (schema.js, v2 → v3) and by importing an old Body Oracle backup
 * (services/oracle-import.js), so both follow the same rules.
 *
 *   note, mind, photo, intention → journal
 *   body                         → journal, with what was noticed written into the text (the body map is gone)
 *   dream, sign, state, ritual   → kept as they are (Dreams & signs live in the Journal; states and rituals have
 *                                  their own places)
 *   threads made in Body Oracle  → themes (Christina's threads are spans of time on the calendar; themes are
 *                                  long-running parts of inner life, a different thing) */

const KEEP = new Set(['activity', 'journal', 'dream', 'sign', 'state', 'ritual']);
const TO_JOURNAL = new Set(['note', 'mind', 'photo', 'intention', 'body']);

/** "Tense · left shoulder · intensity 4 of 5" from a former body-map observation. */
function bodyLine(body) {
  if (!body) return '';
  const one = { Arms: 'arm', Hands: 'hand', Legs: 'leg', Feet: 'foot', Shoulders: 'shoulder' };
  const place = body.region ? (body.side && one[body.region] ? `${body.side} ${one[body.region]}` : String(body.region).toLowerCase()) : '';
  return [body.sensation || 'Noticed', place, body.intensity ? `intensity ${body.intensity} of 5` : ''].filter(Boolean).join(' · ');
}

/** Returns the record in Christina's current shape (a copy), or the same object when nothing changes. */
function modernizeRecord(r, themeIds = new Set()) {
  let next = r;
  const edit = () => (next === r ? (next = { ...r, payload: { ...(r.payload || {}) } }) : next);
  if (TO_JOURNAL.has(r.kind)) {
    edit();
    const from = r.kind;
    next.kind = 'journal';
    next.payload.formerKind = from;
    if (from === 'body') {
      const line = bodyLine(r.payload && r.payload.body);
      next.title = `Body: ${line}`;
      next.text = [line, r.text].filter(Boolean).join('\n\n');
    } else if (from === 'photo' && !(r.text || '').trim()) {
      next.title = 'Photo';
    } else {
      next.title = null; // the list shows the first line of the text
    }
  } else if (!KEEP.has(r.kind)) {
    return r; // an unknown kind: leave it alone
  }
  const moved = (r.threadIds || []).filter((id) => themeIds.has(id));
  if (moved.length) {
    edit();
    next.threadIds = r.threadIds.filter((id) => !themeIds.has(id));
    next.themeIds = [...new Set([...(r.themeIds || []), ...moved])];
  }
  return next;
}

/** A thread made in Body Oracle: it carries an icon and has no dates. Christina's own threads never had icons. */
const isFormerOracleThread = (t) => Object.prototype.hasOwnProperty.call(t, 'icon') && !t.startDate;

function themeFromThread(t, order) {
  return {
    id: t.id,
    name: t.title || t.name || 'Theme',
    description: t.description || '',
    color: String(t.color || 'A9A9A9').replace('#', '').toUpperCase(),
    icon: t.icon && t.icon !== 'threads' ? t.icon : 'leaf',
    coverId: t.coverId || null,
    order: t.order ?? order,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt || t.createdAt,
  };
}

/** Rituals pointed at Body Oracle threads through threadIds / threadId; those become themeIds. */
function modernizeRitual(x, themeIds = new Set()) {
  const ids = [...(x.threadIds || []), ...(x.threadId ? [x.threadId] : [])];
  const themes = ids.filter((id) => themeIds.has(id));
  if (!themes.length && !x.threadId) return x;
  const { threadId, ...rest } = x;
  return { ...rest, threadIds: ids.filter((id) => !themeIds.has(id)), themeIds: [...new Set([...(x.themeIds || []), ...themes])] };
}

export { modernizeRecord, isFormerOracleThread, themeFromThread, modernizeRitual, bodyLine };
