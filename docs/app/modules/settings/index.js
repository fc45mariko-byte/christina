/* Settings: appearance, calendar, categories, data & export, privacy, about. */
import { esc } from '../../core/util.js';
import { CATEGORIES } from '../../core/catalog.js';
import { prefs, Settings } from '../../core/prefs.js';
import { data } from '../../core/db.js';
import { push } from '../../core/state.js';
import { render } from '../../core/render.js';
import { register } from '../../core/registry.js';
import { navbar, catIcon, settingsRow, toast } from '../../ui/components.js';
import { icon } from '../../ui/icons.js';
import { exportBackup, exportEventsCSV } from '../../services/backup.js';
import './personalize.js';
function viewSettings() {
  return `<div class="page"><h1>Settings</h1>
    <div class="settings-list">
      ${settingsRow('Appearance', 'palette', 'openAppearance')}
      ${settingsRow('Calendar &amp; Time', 'calendar', 'openCalendarSettings')}
      ${settingsRow('Categories', 'grid', 'openCategories')}
      ${settingsRow('Data &amp; Export', 'drive', 'openData')}
      ${settingsRow('Notifications', 'bell', 'openNotifications')}
      ${settingsRow('Privacy', 'lock', 'openPrivacy')}
      ${settingsRow('About', 'info', 'openAbout')}
    </div></div>`;
}

function viewAppearance() {
  return `${navbar('Appearance')}<div class="page tight">
    <div class="settings-list">${settingsRow('Personalized Mode', 'palette', 'openPersonalize')}</div>
    <p class="footnote">Give each month its own images, colors and title.</p>
  </div>`;
}

function viewCalendarSettings() {
  return `${navbar('Calendar & Time')}<div class="page tight">
    <div class="settings-list">
      <div class="settings-row"><span class="grow">Start day</span>
        <select data-change="setStartDay" style="border:0;background:none;font-size:16px;color:var(--text2)">
          <option value="mon" ${prefs.mondayFirst ? 'selected' : ''}>Monday</option>
          <option value="sun" ${prefs.mondayFirst ? '' : 'selected'}>Sunday</option>
        </select>
      </div>
      <div class="settings-row"><span class="grow">Week view</span>
        <label class="toggle"><input type="checkbox" data-change="setWeekView" ${prefs.weekView ? 'checked' : ''}><span></span></label>
      </div>
    </div>
    <p class="footnote">Week view shows one week at a time on the Map.</p>
  </div>`;
}

function viewCategories() {
  return `${navbar('Categories')}<div class="page tight">
    <div class="settings-list">${CATEGORIES.map(
      (c) => `<div class="settings-row">${catIcon(c.name, 28)}<span class="grow">${c.name}</span><span class="caption">#${c.hex}</span></div>`
    ).join('')}</div>
    <p class="footnote">Preset list. Custom categories are not in this build.</p>
  </div>`;
}

function viewNotInBuild(title, rows, note) {
  return `${navbar(title)}<div class="page tight">
    <div class="settings-list">${rows.map((r) => `<div class="settings-row"><span class="grow">${esc(r)}</span><span class="label">Not in this build</span></div>`).join('')}</div>
    ${note ? `<p class="footnote">${esc(note)}</p>` : ''}
  </div>`;
}

function viewPrivacy() {
  return `${navbar('Privacy')}<div class="page tight">
    <h1>Everything stays on this device.</h1>
    <p>Events, threads, photos and month personalization are stored only in this app's storage on your iPhone. Nothing is synced, uploaded or sent to any server. There is no account and no API.</p>
  </div>`;
}

function viewAbout() {
  return `${navbar('About')}<div class="page tight">
    <h1>Christina</h1>
    <span class="label">Version 1.0</span>
    <p style="margin-top:16px">A visual system for seeing life accumulate over time.</p>
    <p style="margin:0">What actually happened?</p>
    <p style="margin:0">Evidence over guilt. Temporal continuity over streaks.</p>
  </div>`;
}
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function viewData() {
  const photos = data.events.filter((e) => e.photoPath).length;
  const images = Object.values(data.months).reduce((n, m) => n + ((m.imagePaths || []).length), 0);
  return `${navbar('Data & Export')}<div class="page tight">
    <div class="settings-list">
      <button class="settings-row" data-action="exportBackup">${icon('drive', 'ic')}<span class="grow">Export backup</span><span class="label">JSON</span></button>
      <button class="settings-row" data-action="exportCSV">${icon('share', 'ic')}<span class="grow">Export events</span><span class="label">CSV</span></button>
      <div class="settings-row"><span class="grow">iCloud backup</span><span class="label">Not in this build</span></div>
    </div>
    <p class="footnote">The backup holds every event, thread, month, photo and setting (${plural(data.events.length, 'event', 'events')}, ${plural(data.threads.length, 'thread', 'threads')}, ${plural(photos + images, 'photo', 'photos')}). The CSV lists events only, for spreadsheets. Both are saved as files you choose where to keep. All data stays on this device.</p>
  </div>`;
}

async function runExport(work, label) {
  try {
    const result = await work();
    if (result === 'saved') toast(`${label} ready`);
  } catch (error) {
    console.error(error);
    alert(`Couldn't export. ${error && error.message ? error.message : error}`);
  }
}

register({
  tabs: { settings: viewSettings },
  screens: {
    appearance: () => viewAppearance(),
    calendarSettings: () => viewCalendarSettings(),
    categories: () => viewCategories(),
    data: () => viewData(),
    notifications: () => viewNotInBuild('Notifications', ['Notifications'], ''),
    privacy: () => viewPrivacy(),
    about: () => viewAbout(),
  },
  actions: {
  openAppearance: () => push({ name: 'appearance' }),
  openCalendarSettings: () => push({ name: 'calendarSettings' }),
  openCategories: () => push({ name: 'categories' }),
  openData: () => push({ name: 'data' }),
  openNotifications: () => push({ name: 'notifications' }),
  openPrivacy: () => push({ name: 'privacy' }),
  openAbout: () => push({ name: 'about' }),
    exportBackup: () => runExport(exportBackup, 'Backup'),
    exportCSV: () => runExport(exportEventsCSV, 'CSV'),
  },
  changeActions: {
  setStartDay(el) {
    prefs.mondayFirst = el.value === 'mon';
    Settings.write('mondayFirst', prefs.mondayFirst);
    render();
  },
  setWeekView(el) {
    prefs.weekView = el.checked;
    Settings.write('weekView', prefs.weekView);
    render();
  },
  },
});
