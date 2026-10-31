/* Christina — per-device preferences in localStorage (keys "christina.*"). */
const Settings = {
  read(key, fallback) {
    try {
      const v = localStorage.getItem(`christina.${key}`);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  write(key, value) {
    try {
      localStorage.setItem(`christina.${key}`, JSON.stringify(value));
    } catch {
      /* private mode — keep in memory only */
    }
  },
};
const prefs = {
  mondayFirst: Settings.read('mondayFirst', true),
  weekView: Settings.read('weekView', false),
  hideInstallHint: Settings.read('hideInstallHint', false),
};
const firstWeekday = () => (prefs.mondayFirst ? 1 : 0);
export { Settings, prefs, firstWeekday };
