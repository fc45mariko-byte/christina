/* Settings: appearance, calendar, categories, data & export, privacy, about. */
import { RELEASE } from '../../version.js';
import { esc } from '../../core/util.js';
import { prefs, Settings } from '../../core/prefs.js';
import { data } from '../../core/db.js';
import { push } from '../../core/state.js';
import { render } from '../../core/render.js';
import { register } from '../../core/registry.js';
import { navbar, catIcon, settingsRow, toast } from '../../ui/components.js';
import { icon } from '../../ui/icons.js';
import { exportBackup, exportEventsCSV, readBackup, restoreBackup, eraseEverything } from '../../services/backup.js';
import { readOracleBackup, importOracleBackup } from '../../services/oracle-import.js';
import { appearance, setAppearance, resetAppearance, setBackgroundPhoto, removeBackgroundPhoto, backgroundPhoto, ACCENTS } from '../../core/appearance.js';
import './personalize.js';
import './organize.js';
function viewSettings() {
  return `<div class="page"><h1>Settings</h1>
    <div class="settings-list">
      ${settingsRow('Appearance', 'palette', 'openAppearance')}
      ${settingsRow('Tab bar', 'grid', 'openNavigation')}
      ${settingsRow('Sections', 'eye', 'openSections')}
      ${settingsRow('Calendar &amp; Time', 'calendar', 'openCalendarSettings')}
      ${settingsRow('Reminders', 'bell', 'openNotifications')}
    </div>
    <div class="settings-list">
      ${settingsRow('Categories', 'grid', 'openCategories')}
      ${settingsRow('States', 'state', 'openStates')}
      ${settingsRow('Tags', 'flag', 'openTags')}
    </div>
    <div class="settings-list">
      ${settingsRow('Data &amp; Export', 'drive', 'openData')}
      ${settingsRow('Privacy', 'lock', 'openPrivacy')}
      ${settingsRow('About', 'info', 'openAbout')}
    </div></div>`;
}

const choice = (key, options) =>
  `<div class="segmented">${options.map(([v, l]) => `<button class="${appearance[key] === v ? 'on' : ''}" data-action="setAppearance" data-k="${key}" data-v="${v}">${l}</button>`).join('')}</div>`;

function backgroundChoice() {
  const photo = backgroundPhoto();
  const on = appearance.bg === 'photo' && photo;
  const tones = [['plain', 'Plain'], ['paper', 'Paper'], ['mist', 'Mist']]
    .map(([v, l]) => `<button class="${appearance.bg === v ? 'on' : ''}" data-action="setAppearance" data-k="bg" data-v="${v}">${l}</button>`).join('');
  const pick = (label, cls = '') => `<label class="${cls}" style="cursor:pointer">${label}<input type="file" accept="image/*" data-file-input="bgPhoto" hidden></label>`;
  const pictureBtn = photo ? `<button class="${on ? 'on' : ''}" data-action="setAppearance" data-k="bg" data-v="photo">Picture</button>` : pick('Picture', 'seg-label');
  return `<div class="segmented">${tones}${pictureBtn}</div>
    ${on ? `<div class="bg-photo-row"><span class="bg-thumb" style="background-image:url(&quot;${photo}&quot;)"></span>
      <span class="grow">${pick('<span class="w-link">Change picture</span>')}</span>
      <button class="w-link" data-action="removeBgPhoto">Remove</button></div>
      <span class="label">Veil</span>${choice('veil', [['light', 'Light'], ['medium', 'Medium'], ['strong', 'Strong']])}
      <span class="caption">How much of the picture shows through the app. Stronger is easier to read.</span>` : `<span class="caption">Picture: your own image behind the whole app.</span>`}`;
}

function viewAppearance() {
  return `${navbar('Appearance')}<div class="page">
    <div class="section"><span class="label">Theme</span>${choice('theme', [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']])}</div>
    <div class="section"><span class="label">Accent</span>
      <div class="swatches">${ACCENTS.map(([hex, name]) => `<button class="swatch${appearance.accent === hex ? ' on' : ''}" data-action="setAppearance" data-k="accent" data-v="${hex}" aria-label="${name}" aria-pressed="${appearance.accent === hex}"><span style="background:${hex ? `#${hex}` : 'var(--text)'}"></span></button>`).join('')}</div>
      <span class="caption">Buttons, the + button, checks, progress and charts. Ink follows the theme.</span>
    </div>
    <div class="section"><span class="label">Background</span>${backgroundChoice()}</div>
    <div class="section"><span class="label">Font</span>${choice('font', [['system', 'System'], ['serif', 'Serif'], ['rounded', 'Rounded']])}</div>
    <div class="section"><span class="label">Density</span>${choice('density', [['comfortable', 'Comfortable'], ['compact', 'Compact']])}</div>
    <div class="section"><span class="label">Overview widgets</span>${choice('cards', [['filled', 'Filled'], ['outline', 'Outlined']])}</div>
    <div class="settings-list">${settingsRow('Personalized Mode', 'palette', 'openPersonalize')}</div>
    <p class="footnote" style="padding:0">Give each month its own images, colors and title.</p>
    <button class="btn-secondary" data-action="resetAppearance">Back to Christina’s original look</button>
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
    <p class="footnote">Week view shows one week at a time on the Calendar. You can also switch between Day, Week and Month at the top of the Calendar.</p>
  </div>`;
}

function viewReminders() {
  return `${navbar('Reminders')}<div class="page tight">
    <div class="settings-list"><div class="settings-row"><span class="grow">Show due reminders</span><label class="toggle"><input type="checkbox" data-change="setShowReminders" ${prefs.showReminders !== false ? 'checked' : ''}><span></span></label></div></div>
    <p class="footnote">When a plan's reminder time comes, it appears at the top of Overview and as a message when you open Christina, until you dismiss it. Add a reminder when you plan something in the Calendar.</p>
    <p class="footnote">Christina cannot send notifications to your lock screen: on iPhone a web app can only do that through a push server, and Christina keeps everything on your device with no server.</p>
  </div>`;
}

function viewPrivacy() {
  return `${navbar('Privacy')}<div class="page tight">
    <h1>Everything stays on this device.</h1>
    <p>Events, threads, journal entries, dreams, signs, states, rituals, prayers, themes, plans, tasks, projects, habits, photos, videos and settings are stored only in this app's storage on this device. Nothing is synced, uploaded or sent to any server. There is no account, no tracking, no API and no AI.</p>
    <p style="margin:0">Because nothing leaves the device, nothing else holds a copy. Removing the app from the Home Screen or clearing the website's data deletes everything. Export a backup now and then (Settings → Data &amp; Export) and keep the file somewhere safe.</p>
  </div>`;
}

function viewAbout() {
  return `${navbar('About')}<div class="page tight">
    <h1>Christina</h1>
    <span class="label">Version 2.0 · ${RELEASE.replace('christina-v', 'update ')}</span>
    <p style="margin-top:16px">A visual system for seeing life accumulate over time.</p>
    <p style="margin:0">With Journal, Rituals, Themes, Calendar, Tasks, Projects, Habits and Insights.</p>
    <p style="margin:0">What actually happened?</p>
    <p style="margin:0">Evidence over guilt. Temporal continuity over streaks.</p>
  </div>`;
}
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function viewData() {
  const photos = data.records.reduce((n, r) => n + (r.mediaIds || []).length, 0);
  const images = Object.values(data.months).reduce((n, m) => n + ((m.imagePaths || []).length), 0);
  return `${navbar('Data & Export')}<div class="page tight">
    <div class="settings-list">
      <button class="settings-row" data-action="exportBackup">${icon('drive', 'ic')}<span class="grow">Export backup</span><span class="label">JSON</span></button>
      <button class="settings-row" data-action="exportCSV">${icon('share', 'ic')}<span class="grow">Export events</span><span class="label">CSV</span></button>
      <div class="settings-row"><span class="grow">iCloud backup</span><span class="label">Not in this build</span></div>
    </div>
    <div class="settings-list">
      <label class="settings-row file-btn">${icon('share', 'ic')}<span class="grow">Restore from a backup</span><input type="file" accept="application/json,.json" data-file-input="restoreBackup"></label>
      <label class="settings-row file-btn">${icon('prayer', 'ic')}<span class="grow">Import from the Body Oracle app</span><input type="file" accept="application/json,.json" data-file-input="importOracle"></label>
      <button class="settings-row" data-action="eraseEverything">${icon('x', 'ic')}<span class="grow danger">Erase everything</span></button>
    </div>
    <p class="footnote">Restoring replaces everything on this device with the backup. Importing from the Body Oracle app adds its entries, rituals, prayers, states and themes, and changes nothing else. Erasing deletes everything Christina holds on this device. All of them ask first.</p>
    <p class="footnote">The backup holds every event, thread, month, photo and setting (${plural(data.records.length, 'event', 'events')}, ${plural(data.threads.length, 'thread', 'threads')}, ${plural(photos + images, 'photo', 'photos')}). The CSV lists events only, for spreadsheets. Both are saved as files you choose where to keep. All data stays on this device.</p>
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
  fileActions: {
    async bgPhoto(files) {
      try {
        await setBackgroundPhoto(files[0]);
      } catch (error) {
        alert(error.message);
      }
      render();
    },
    async importOracle(files) {
      let read;
      try {
        read = await readOracleBackup(files[0]);
      } catch (error) {
        alert(error.message);
        return;
      }
      if (!confirm(`Bring in ${read.summary} from the Body Oracle app? Nothing already in Christina is removed. Notes, photos and body observations become journal entries; threads become themes.`)) return;
      try {
        await importOracleBackup(read.backup);
      } catch (error) {
        console.error(error);
        alert(`Couldn't import. ${error && error.message ? error.message : error}`);
        return;
      }
      location.reload();
    },
    async restoreBackup(files) {
      let backup;
      try {
        backup = await readBackup(files[0]);
      } catch (error) {
        alert(error.message);
        return;
      }
      if (!confirm(`Replace everything on this device with this backup from ${backup.when}? It holds ${backup.summary}.`)) return;
      try {
        await restoreBackup(backup.data);
      } catch (error) {
        console.error(error);
        alert(`Couldn't restore. ${error && error.message ? error.message : error} Nothing was changed.`);
        return;
      }
      location.reload();
    },
  },
  nav: { id: 'settings', label: 'Settings', icon: 'settings', order: 90 },
  tabs: { settings: viewSettings },
  screens: {
    appearance: () => viewAppearance(),
    calendarSettings: () => viewCalendarSettings(),
    data: () => viewData(),
    notifications: () => viewReminders(),
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
    setAppearance(el) {
      setAppearance(el.dataset.k, el.dataset.v);
      render();
    },
    removeBgPhoto() {
      removeBackgroundPhoto();
      render();
    },
    resetAppearance() {
      resetAppearance();
      render();
    },
    async eraseEverything() {
      if (!confirm('Erase everything Christina holds on this device? Events, journal, rituals, prayers, states, themes, plans, tasks, projects, habits, photos and settings are all deleted. This cannot be undone.')) return;
      if (!confirm('Are you sure? Export a backup first if you might want any of it back.')) return;
      try {
        await eraseEverything();
      } catch (error) {
        console.error(error);
        alert(`Couldn't erase. ${error && error.message ? error.message : error}`);
        return;
      }
      location.reload();
    },
    exportCSV: () => runExport(exportEventsCSV, 'CSV'),
  },
  changeActions: {
  setStartDay(el) {
    prefs.mondayFirst = el.value === 'mon';
    Settings.write('mondayFirst', prefs.mondayFirst);
    render();
  },
  setShowReminders(el) {
    prefs.showReminders = el.checked;
    Settings.write('showReminders', el.checked);
    render();
  },
  setWeekView(el) {
    prefs.weekView = el.checked;
    Settings.write('weekView', prefs.weekView);
    prefs.calendarView = el.checked ? 'week' : 'month'; // the Calendar's Day / Week / Month switch
    Settings.write('calendarView', prefs.calendarView);
    render();
  },
  },
});
