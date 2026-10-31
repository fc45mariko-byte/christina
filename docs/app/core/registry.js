/* Christina — modules register their screens, actions and validators here.
 * The core never imports a module directly; it only reads this registry. */

const registry = {
  tabs: {}, // tab id -> () => html
  screens: {}, // pushed view name -> (view) => html
  actions: {}, // data-action -> (el, event)
  changeActions: {}, // data-change -> (el)
  fileActions: {}, // data-file-input -> (files, el)
  validators: {}, // data-valid -> () => boolean
  bindHooks: [], // (el) => void, run before a data-rerender re-render
  nav: [], // { id, label, icon, order } — a module's place in the tab bar / sidebar / More
  chrome: [], // () => void, redraws navigation after every render
  tabKeys: {}, // tab id -> () => string: identifies the module's own inner screen, so scroll resets on change
  kinds: {}, // record kind -> { label, icon, open(record) }: how other screens show and open a module's records
  liveInputs: {}, // data-live -> (el): runs on every keystroke (search fields)
};

function register(manifest) {
  for (const key of ['tabs', 'screens', 'actions', 'changeActions', 'fileActions', 'validators']) {
    Object.assign(registry[key], manifest[key] || {});
  }
  if (manifest.bindHook) registry.bindHooks.push(manifest.bindHook);
  if (manifest.nav) registry.nav.push(manifest.nav);
  if (manifest.chrome) registry.chrome.push(manifest.chrome);
  Object.assign(registry.tabKeys, manifest.tabKeys || {});
  Object.assign(registry.kinds, manifest.kinds || {});
  Object.assign(registry.liveInputs, manifest.liveInputs || {});
}

export { registry, register };
