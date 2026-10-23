/**
 * Title typefaces. The reference uses a very tall, heavy condensed grotesque, so that is the default; the
 * others stay selectable from the menu (the original Syncopate is still there as an opt-in, not a default).
 * Families load on demand from Google Fonts. UI text is always the neutral grotesque.
 */
export interface TitleFont {
  id: string;
  name: string;
  note: string;
  family: string;
  weight: number;
  /** font-size multiplier so cap-height lands the same across faces */
  scale: number;
  /** horizontal condense (1 = as designed); the reference is far narrower than most free faces */
  sx: number;
  /** letter-spacing in em */
  track: number;
  upper: boolean;
  /** css2 family param */
  google: string;
}

export const TITLE_FONTS: TitleFont[] = [
  { id: 'anton', name: 'Anton', note: 'Tall, heavy and tight — the default', family: "'Anton'", weight: 400, scale: 1, sx: 0.76, track: -0.005, upper: true, google: 'Anton' },
  { id: 'league', name: 'League Gothic', note: 'Slim, elegant poster condensed', family: "'League Gothic'", weight: 400, scale: 1.16, sx: 0.9, track: 0.005, upper: true, google: 'League+Gothic' },
  { id: 'bebas', name: 'Bebas Neue', note: 'Classic cinematic caps', family: "'Bebas Neue'", weight: 400, scale: 1.23, sx: 0.78, track: 0.01, upper: true, google: 'Bebas+Neue' },
  { id: 'oswald', name: 'Oswald', note: 'Sturdy newsroom condensed', family: "'Oswald'", weight: 700, scale: 1.06, sx: 0.64, track: 0, upper: true, google: 'Oswald:wght@700' },
  { id: 'shoulders', name: 'Big Shoulders', note: 'Industrial and broad-chested', family: "'Big Shoulders Display'", weight: 900, scale: 1.075, sx: 0.7, track: 0, upper: true, google: 'Big+Shoulders+Display:wght@900' },
  { id: 'grotesk', name: 'Space Grotesk', note: 'Technical grotesque', family: "'Space Grotesk'", weight: 700, scale: 1.23, sx: 0.62, track: -0.03, upper: true, google: 'Space+Grotesk:wght@700' },
  { id: 'syncopate', name: 'Syncopate', note: 'Ultra-wide (the original SOLARIS face)', family: "'Syncopate'", weight: 700, scale: 0.5, sx: 1, track: 0.02, upper: true, google: 'Syncopate:wght@700' },
];

export const TITLE_FONT_MAP: Record<string, TitleFont> = Object.fromEntries(TITLE_FONTS.map((f) => [f.id, f]));

const loaded = new Set<string>();
function addLink(id: string, href: string) {
  if (loaded.has(id)) return;
  loaded.add(id);
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = href;
  document.head.appendChild(l);
}

/** Applies a title font as CSS custom properties on <html>. */
export function applyTitleFont(id: string) {
  const f = TITLE_FONT_MAP[id] ?? TITLE_FONTS[0];
  addLink(`title-${f.id}`, `https://fonts.googleapis.com/css2?family=${f.google}&display=swap`);
  const root = document.documentElement;
  root.dataset.font = f.id;
  root.style.setProperty('--font-hero', `${f.family}, 'Anton', Impact, sans-serif`);
  root.style.setProperty('--hero-weight', String(f.weight));
  root.style.setProperty('--hero-scale', String(f.scale));
  root.style.setProperty('--hero-sx', String(f.sx));
  root.style.setProperty('--hero-track', `${f.track}em`);
  root.style.setProperty('--hero-case', f.upper ? 'uppercase' : 'none');
}

/** Loads a tiny glyph subset of every title face so the selector can preview them. */
export function loadFontPreviews() {
  const fams = TITLE_FONTS.map((f) => f.google).join('&family=');
  addLink('previews', `https://fonts.googleapis.com/css2?family=${fams}&text=${encodeURIComponent('SOLARISMarsEarth')}&display=swap`);
}
