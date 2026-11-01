/* Christina — appearance settings, applied as attributes on <html> (styles in ui/tokens.css and components.css).
 * Saved per device as `christina.appearance`. The defaults are Christina's original look.
 * Background "Picture": your own image behind the whole app, seen through a veil (light / medium / strong).
 * The picture is kept downsized as `christina.bgPhoto` (a data URL), so it is in backups and shows before first paint. */
import { Settings } from './prefs.js';
import { brightness } from './util.js';

const DEFAULTS = { theme: 'system', accent: '', bg: 'plain', font: 'system', density: 'comfortable', cards: 'filled', veil: 'medium' };
const ACCENTS = [
  ['', 'Ink'], ['4A90E2', 'Blue'], ['7B68EE', 'Violet'], ['C2577A', 'Rose'], ['3F8F5E', 'Green'], ['B8860B', 'Gold'],
];
const appearance = { ...DEFAULTS, ...Settings.read('appearance', {}) };

function applyAppearance() {
  const root = document.documentElement;
  const set = (name, value, plain) => (value && value !== plain ? root.setAttribute(name, value) : root.removeAttribute(name));
  set('data-theme', appearance.theme, 'system');
  set('data-font', appearance.font, 'system');
  set('data-density', appearance.density, 'comfortable');
  set('data-cards', appearance.cards, 'filled');
  const photo = appearance.bg === 'photo' ? Settings.read('bgPhoto', '') : '';
  set('data-bg', photo ? 'photo' : appearance.bg === 'photo' ? '' : appearance.bg, 'plain');
  set('data-veil', photo ? appearance.veil : '', 'medium');
  if (photo) root.style.setProperty('--bg-photo', `url("${photo}")`);
  else root.style.removeProperty('--bg-photo');
  if (appearance.accent) {
    root.style.setProperty('--ui-accent', `#${appearance.accent}`);
    root.style.setProperty('--ui-accent-ink', brightness(appearance.accent) > 0.6 ? '#000' : '#fff');
  } else {
    root.style.removeProperty('--ui-accent');
    root.style.removeProperty('--ui-accent-ink');
  }
  const bg = getComputedStyle(root).getPropertyValue(photo ? '--bg-base' : '--bg').trim();
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', bg || '#ffffff'));
}

function setAppearance(key, value) {
  appearance[key] = value;
  Settings.write('appearance', appearance);
  applyAppearance();
}
/** Downsizes a picture (longest side 1600 px, JPEG) and makes it the background. */
async function setBackgroundPhoto(file) {
  if (!file || !/^image\//.test(file.type)) throw new Error('Choose a picture.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  let url = canvas.toDataURL('image/jpeg', 0.82);
  if (url.length > 1.5e6) url = canvas.toDataURL('image/jpeg', 0.6);
  try {
    localStorage.setItem('christina.bgPhoto', JSON.stringify(url));
  } catch {
    throw new Error('This picture is too large to keep. Try a smaller one.');
  }
  setAppearance('bg', 'photo');
}
function removeBackgroundPhoto() {
  localStorage.removeItem('christina.bgPhoto');
  setAppearance('bg', 'plain');
}
const backgroundPhoto = () => Settings.read('bgPhoto', '');

function resetAppearance() {
  Object.assign(appearance, DEFAULTS);
  Settings.write('appearance', appearance);
  applyAppearance();
}

export { appearance, applyAppearance, setAppearance, resetAppearance, setBackgroundPhoto, removeBackgroundPhoto, backgroundPhoto, ACCENTS };
