/* Christina — a visual system for seeing life accumulate over time.
 * Boot: register modules, open the on-device database, render. */
import { RELEASE } from './version.js';
import { esc, $ } from './core/util.js';
import { DB, data } from './core/db.js';
import { state, back } from './core/state.js';
import { register, registry } from './core/registry.js';
import { render } from './core/render.js';
import { bindEvents } from './core/events.js';
import { renderNav, WIDE } from './shell/nav.js';
import './shell/more.js';

// Modules register their own tabs, screens and actions.
import './modules/overview/index.js';
import './modules/calendar/index.js';
import './modules/add/index.js';
import './modules/records/index.js';
import './modules/threads/index.js';
import './modules/archive/index.js';
import './modules/journal/index.js';
import './modules/tasks/index.js';
import './modules/projects/index.js';
import './modules/habits/index.js';
import './modules/insights/index.js';
import './modules/rituals/index.js';
import './modules/themes/index.js';
import './modules/states/index.js';
import './modules/settings/index.js';
import { importOldOracleDatabase } from './services/oracle-import.js';
import { toast } from './ui/components.js';
import { applyAppearance } from './core/appearance.js';
import { prefs } from './core/prefs.js';
import { dueReminders, whenText } from './modules/calendar/plans.js';

applyAppearance();

// Navigation shared by every screen.
register({
  chrome: renderNav,
  actions: {
    tab(el) {
      const tab = el.dataset.tab;
      if (state.tab === tab) {
        state.stacks[tab] = [];
        const item = registry.nav.find((n) => n.id === tab);
        if (item && item.reset) item.reset(); // back to the section's own start
      }
      state.tab = tab;
      render();
    },
    back() {
      back();
    },
  },
});

async function boot() {
  bindEvents();
  let imported = 0;
  try {
    await DB.open();
    // Where the former Body Oracle app ran on this device, bring its data in once (its database is only read).
    try {
      imported = await importOldOracleDatabase();
    } catch (error) {
      console.error('Import from the old app', error);
    }
    const stores = ['records', 'threads', 'months', 'categories', 'tags', 'schedule', 'tasks', 'projects', 'habits', 'habitLogs', 'states', 'rituals', 'prayers', 'themes'];
    const [records, threads, months, categories, tags, schedule, tasks, projects, habits, habitLogs, states, rituals, prayers, themes] = await Promise.all(stores.map((store) => DB.getAll(store)));
    Object.assign(data, { tags, schedule, tasks, projects, habits, habitLogs, states, rituals, prayers, themes });
    data.ritualsMeta = (await DB.get('meta', 'rituals')) || {};
    const fileKeys = await DB.getAllKeys('files');
    data.videoIds = new Set(fileKeys.filter((k) => String(k).endsWith('~v')).map((k) => String(k).slice('media/'.length, -2)));
    data.records = records;
    data.categories = categories.sort((a, b) => a.order - b.order);
    data.threads = threads;
    data.months = Object.fromEntries(months.map((m) => [m.month, m]));
  } catch (error) {
    $('#main').innerHTML = `<div class="page"><div class="blank">Christina couldn't open its data. ${esc(error && error.message ? error.message : String(error))}</div></div>`;
    return;
  }
  render();
  if (imported) toast(`${imported} ${imported === 1 ? 'record' : 'records'} brought in from the old app`);
  else if (prefs.showReminders !== false) {
    const due = dueReminders();
    if (due.length) toast(due.length === 1 ? `Reminder: ${due[0].title}, ${whenText(due[0])}` : `${due.length} reminders on Overview`);
  }
  WIDE.addEventListener('change', () => {
    // Widening while a section is open inside More: show it as its own sidebar section.
    const first = state.stacks.more[0];
    if (WIDE.matches && state.tab === 'more' && first && first.name === 'module') {
      state.tab = first.id;
      state.stacks[first.id] = state.stacks.more.slice(1);
      state.stacks.more = [];
    }
    render();
  });
}

/** If the server has a newer version than the one running, drop the stored app files and reload.
 *  Only the app's own files are dropped; everything you saved (IndexedDB, settings) stays. Once per version. */
async function checkVersion() {
  try {
    const res = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const { release } = await res.json();
    if (!release || release === RELEASE || sessionStorage.getItem('christina.updatedTo') === release) return;
    sessionStorage.setItem('christina.updatedTo', release);
    if (navigator.serviceWorker) await Promise.all((await navigator.serviceWorker.getRegistrations()).map((r) => r.unregister()));
    if (window.caches) await Promise.all((await caches.keys()).filter((k) => k.startsWith('christina-v')).map((k) => caches.delete(k)));
    location.reload();
  } catch {
    /* offline: keep the version we have */
  }
}

// Offline support on the live site (https), and on localhost for testing.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () =>
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
      // A Home Screen app can stay open for days: look for a new version each time it comes back to the front.
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && reg.update().catch(() => {}));
    }).catch(() => {})
  );
}
window.addEventListener('load', checkVersion);
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && checkVersion());

boot();
