/* Christina — UI state: current tab, a navigation stack per tab, form drafts. */
import { currentMonth, ymd, localInputValue } from './util.js';
import { THREAD_COLORS } from './catalog.js';
import { render } from './render.js';
const TABS = ['home', 'map', 'add', 'threads', 'archive', 'settings', 'more'];
const state = {
  tab: 'home',
  stacks: Object.fromEntries(TABS.map((t) => [t, []])),
  mapMonth: currentMonth(),
  weekAnchor: ymd(new Date()),
  addMode: 'did',
  threadSort: 'relevance',
  ef: null, // event form (Mode A)
  tf: null, // thread form (Mode B)
  te: null, // thread edit
  pm: null, // personalized mode
};

function newEventForm() {
  return { date: localInputValue(new Date()), title: '', categoryId: null, duration: '', threadId: '', notes: '', photo: null, photoURL: null, processing: false };
}
function newThreadForm() {
  const today = ymd(new Date());
  return { start: today, end: today, ongoing: false, title: '', categoryId: null, tieTo: '', color: THREAD_COLORS[0] };
}
state.ef = newEventForm();
state.tf = newThreadForm();

const stack = () => (state.stacks[state.tab] ||= []);
const topView = () => stack()[stack().length - 1];
function push(view) {
  stack().push(view);
  render();
}
function back() {
  stack().pop();
  render();
}
export { TABS, state, newEventForm, newThreadForm, stack, topView, push, back };
