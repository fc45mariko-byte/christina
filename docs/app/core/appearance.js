/* Christina — appearance settings, applied as attributes on <html> (styles in ui/tokens.css and components.css).
 * Saved per device as `christina.appearance`. The defaults are Christina's original look. */
import { Settings } from './prefs.js';
import { brightness } from './util.js';

const DEFAULTS = { theme: 'system', accent: '', bg: 'plain', font: 'system', density: 'comfortable', cards: 'filled' };
const ACCENTS = [
  ['', 'Ink'], ['4A90E2', 'Blue'], ['7B68EE', 'Violet'], ['C2577A', 'Rose'], ['3F8F5E', 'Green'], ['B8860B', 'Gold'],
];
const appearance = { ...DEFAULTS, ...Settings.read('appearance', {}) };

function applyAppearance() {
  const root = document.documentElement;
  const set = (name, value, plain) => (value && value !== plain ? root.setAttribute(name, value) : root.removeAttribute(name));
  set('data-theme', appearance.theme, 'system');
  set('data-bg', appearance.bg, 'plain');
  set('data-font', appearance.font, 'system');
  set('data-density', appearance.density, 'comfortable');
  set('data-cards', appearance.cards, 'filled');
  if (appearance.accent) {
    root.style.setProperty('--ui-accent', `#${appearance.accent}`);
    root.style.setProperty('--ui-accent-ink', brightness(appearance.accent) > 0.6 ? '#000' : '#fff');
  } else {
    root.style.removeProperty('--ui-accent');
    root.style.removeProperty('--ui-accent-ink');
  }
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', bg || '#ffffff'));
}

function setAppearance(key, value) {
  appearance[key] = value;
  Settings.write('appearance', appearance);
  applyAppearance();
}
function resetAppearance() {
  Object.assign(appearance, DEFAULTS);
  Settings.write('appearance', appearance);
  applyAppearance();
}

export { appearance, applyAppearance, setAppearance, resetAppearance, ACCENTS };
