/* Christina — render loop. Draws the top view of the current tab, then the tab bar. */
import { $ } from './util.js';
import { state, topView } from './state.js';
import { registry } from './registry.js';
import { fileURL } from './db.js';
import { icon } from '../ui/icons.js';
import { refreshValidity } from './validation.js';
function render() {
  const main = $('#main');
  const view = topView();
  const key = `${state.tab}:${view ? JSON.stringify(view) : 'root'}`;
  const sameView = main.dataset.view === key;
  const scroll = main.scrollTop;
  main.innerHTML = view ? renderPushed(view) : renderRoot();
  main.dataset.view = key;
  main.scrollTop = sameView ? scroll : 0;
  renderTabBar();
  hydrateImages(main);
  refreshValidity();
}
function renderRoot() {
  const view = registry.tabs[state.tab];
  return view ? view() : '';
}

function renderPushed(view) {
  const screen = registry.screens[view.name];
  return screen ? screen(view) : '';
}

function renderTabBar() {
  const item = (tab, label, ic) =>
    `<button class="tab ${state.tab === tab ? 'active' : ''}" data-action="tab" data-tab="${tab}" aria-label="${label}">${icon(ic)}<span>${label}</span></button>`;
  $('#tabbar').innerHTML =
    item('home', 'Home', 'home') +
    item('map', 'Map', 'calendar') +
    `<div class="tab-add-wrap"><button class="tab-add" data-action="tab" data-tab="add" aria-label="Add">${icon('plus')}</button></div>` +
    item('threads', 'Threads', 'threads') +
    item('archive', 'Archive', 'archive') +
    item('settings', 'Settings', 'settings');
}

/** Loads <img data-file="key"> sources from IndexedDB. */
function hydrateImages(root) {
  root.querySelectorAll('img[data-file]').forEach((img) => {
    const key = img.dataset.file;
    const holder = img.closest('.sq, .photo');
    if (holder) holder.classList.add('loading');
    fileURL(key)
      .then((url) => {
        if (holder) holder.classList.remove('loading');
        if (url) img.src = url;
      })
      .catch(() => holder && holder.classList.remove('loading'));
  });
}
export { render, hydrateImages };
