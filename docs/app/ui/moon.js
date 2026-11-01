/* Christina — the moon's phase for a date, as a name and a small drawing (kept from the former Body Oracle app). */
const SYNODIC = 29.530588853;
const REF = Date.UTC(2000, 0, 6, 18, 14); // a new moon
function moonPhase(d = new Date()) {
  return (((((d - REF) / 864e5) % SYNODIC) + SYNODIC) % SYNODIC) / SYNODIC;
}
const NAMES = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
const moonName = (d = new Date()) => NAMES[Math.floor(moonPhase(d) * 8 + 0.5) % 8];
function moonSVG(d = new Date(), size = 16) {
  const p = moonPhase(d);
  const r = 7, cx = 8, cy = 8;
  const k = Math.cos(p * 2 * Math.PI);
  const wax = p < 0.5;
  const rx = (Math.abs(k) * r).toFixed(2);
  const outer = `M${cx} ${cy - r} A${r} ${r} 0 0 ${wax ? 1 : 0} ${cx} ${cy + r}`;
  const inner = wax ? (k > 0 ? 0 : 1) : k > 0 ? 1 : 0;
  return `<svg width="${size}" height="${size}" viewBox="0 0 16 16" role="img" aria-label="${moonName(d)}"><title>${moonName(d)}</title><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width=".8" opacity=".5"/><path d="${outer} A${rx} ${r} 0 0 ${inner} ${cx} ${cy - r}Z" fill="currentColor"/></svg>`;
}
export { moonPhase, moonName, moonSVG };
