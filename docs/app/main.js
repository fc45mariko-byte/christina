/* Christina — a visual system for seeing life accumulate over time.
 * Boot: register modules, open the on-device database, render. */
import { esc, $ } from './core/util.js';
import { DB, data } from './core/db.js';
import { state, back } from './core/state.js';
import { register } from './core/registry.js';
import { render } from './core/render.js';
import { bindEvents } from './core/events.js';

// Modules register their own tabs, screens and actions.
import './modules/overview/index.js';
import './modules/calendar/index.js';
import './modules/add/index.js';
import './modules/records/index.js';
import './modules/threads/index.js';
import './modules/archive/index.js';
import './modules/settings/index.js';

// Navigation actions shared by every screen.
register({
  actions: {
    tab(el) {
      const tab = el.dataset.tab;
      if (state.tab === tab) state.stacks[tab] = [];
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
    const [events, threads, months] = await Promise.all([DB.getAll('events'), DB.getAll('threads'), DB.getAll('months')]);
    data.events = events;
    data.threads = threads;
    data.months = Object.fromEntries(months.map((m) => [m.month, m]));
  } catch (error) {
    $('#main').innerHTML = `<div class="page"><div class="blank">Christina couldn't open its data. ${esc(error && error.message ? error.message : String(error))}</div></div>`;
    return;
  }
  render();
}

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

boot();
