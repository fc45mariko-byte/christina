/* Christina — one delegated listener per event type. Elements name what they do with
 * data-action, data-bind, data-change, data-file-input and data-longpress. */
import { state } from './state.js';
import { render } from './render.js';
import { registry } from './registry.js';
import { refreshValidity } from './validation.js';
/** Sets state.<form>.<field>, or a deeper path such as rf.steps.2.text. Missing parents are not created. */
function setPath(path, value) {
  const keys = path.split('.');
  let target = state[keys[0]];
  for (const k of keys.slice(1, -1)) {
    if (target == null) return;
    target = target[k];
  }
  if (target != null) target[keys[keys.length - 1]] = value;
}

let longPressTimer = null;
let suppressClick = false;

function bindEvents() {
  document.addEventListener('click', (event) => {
    if (suppressClick) {
      suppressClick = false;
      event.preventDefault();
      return;
    }
    const el = event.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const action = registry.actions[el.dataset.action];
    if (action) {
      event.preventDefault();
      action(el, event);
    }
  });

  document.addEventListener('input', (event) => {
    const el = event.target;
    if (el.dataset && el.dataset.bind && el.type !== 'checkbox' && el.tagName !== 'SELECT') {
      setPath(el.dataset.bind, el.value);
      refreshValidity();
    }
    if (el.dataset && el.dataset.live && registry.liveInputs[el.dataset.live]) registry.liveInputs[el.dataset.live](el);
  });

  document.addEventListener('change', (event) => {
    const el = event.target;
    if (!el.dataset) return;
    if (el.dataset.bind) {
      setPath(el.dataset.bind, el.type === 'checkbox' ? el.checked : el.value);
      if (el.dataset.rerender) {
        registry.bindHooks.forEach((hook) => hook(el));
        render();
      } else {
        refreshValidity();
      }
    } else if (el.dataset.change && registry.changeActions[el.dataset.change]) {
      registry.changeActions[el.dataset.change](el);
    } else if (el.dataset.fileInput && el.files && el.files.length) {
      const files = [...el.files];
      el.value = '';
      registry.fileActions[el.dataset.fileInput](files, el);
    }
  });

  // Long-press (thread cards → Edit / Delete).
  const cancelLongPress = () => clearTimeout(longPressTimer);
  document.addEventListener('pointerdown', (event) => {
    const el = event.target.closest('[data-longpress]');
    if (!el) return;
    const startX = event.clientX;
    const startY = event.clientY;
    cancelLongPress();
    longPressTimer = setTimeout(() => {
      suppressClick = true;
      if (navigator.vibrate) navigator.vibrate(10);
      registry.actions[el.dataset.longpress](el);
    }, 500);
    const move = (e) => {
      if (Math.abs(e.clientX - startX) > 8 || Math.abs(e.clientY - startY) > 8) cancelLongPress();
    };
    el.addEventListener('pointermove', move, { once: false });
    const end = () => {
      cancelLongPress();
      el.removeEventListener('pointermove', move);
    };
    el.addEventListener('pointerup', end, { once: true });
    el.addEventListener('pointercancel', end, { once: true });
  });
  document.addEventListener('contextmenu', (event) => {
    if (event.target.closest('[data-longpress]')) event.preventDefault();
  });
}
export { bindEvents };
