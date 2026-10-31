/* Christina — render loop. Draws the top view of the current tab, then the navigation (shell/nav.js). */
import { $ } from './util.js';
import { state, topView } from './state.js';
import { registry } from './registry.js';
import { fileURL } from './db.js';
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
  registry.chrome.forEach((draw) => draw());
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
