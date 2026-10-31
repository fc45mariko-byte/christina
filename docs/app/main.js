/* Christina — a visual system for seeing life accumulate over time.
 * Boot: register modules, open the on-device database, render. */
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
import './modules/settings/index.js';
import './modules/body-oracle/bo.js';
import { importLegacyBodyOracle } from './modules/body-oracle/legacy.js';
import { toast } from './ui/components.js';

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
  try {
    await DB.open();
    const [records, threads, months, categories] = await Promise.all(
      ['records', 'threads', 'months', 'categories'].map((store) => DB.getAll(store))
    );
    data.records = records;
    data.categories = categories.sort((a, b) => a.order - b.order);
    data.threads = threads;
    data.months = Object.fromEntries(months.map((m) => [m.month, m]));
  } catch (error) {
    $('#main').innerHTML = `<div class="page"><div class="blank">Christina couldn't open its data. ${esc(error && error.message ? error.message : String(error))}</div></div>`;
    return;
  }
  // Where Body Oracle used to run, bring its existing data in once (the old database is left as it was).
  let imported = 0;
  try {
    imported = await importLegacyBodyOracle();
  } catch (error) {
    console.error('Body Oracle import', error);
  }
  render();
  if (imported) toast(`Body Oracle: ${imported} ${imported === 1 ? 'entry' : 'entries'} brought in`);
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

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

boot();
