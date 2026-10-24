/**
 * Title typefaces. The reference uses a very tall, heavy condensed grotesque, so that is the default; the
 * others stay selectable from the menu (the original Syncopate is still there as an opt-in, not a default).
 * The families are self-hosted (src/styles/fonts.css), so there are no requests to font servers. UI text is always
 * the neutral grotesque.
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
}

export const TITLE_FONTS: TitleFont[] = [
  { id: 'anton', name: 'Anton', note: 'Tall, heavy and tight — the default', family: "'Anton'", weight: 400, scale: 1, sx: 0.76, track: -0.005, upper: true },
  { id: 'league', name: 'League Gothic', note: 'Slim, elegant poster condensed', family: "'League Gothic'", weight: 400, scale: 1.16, sx: 0.9, track: 0.005, upper: true },
  { id: 'bebas', name: 'Bebas Neue', note: 'Classic cinematic caps', family: "'Bebas Neue'", weight: 400, scale: 1.23, sx: 0.78, track: 0.01, upper: true },
  { id: 'oswald', name: 'Oswald', note: 'Sturdy newsroom condensed', family: "'Oswald'", weight: 700, scale: 1.06, sx: 0.64, track: 0, upper: true },
  { id: 'shoulders', name: 'Big Shoulders', note: 'Industrial and broad-chested', family: "'Big Shoulders Display'", weight: 900, scale: 1.075, sx: 0.7, track: 0, upper: true },
  { id: 'grotesk', name: 'Space Grotesk', note: 'Technical grotesque', family: "'Space Grotesk'", weight: 700, scale: 1.23, sx: 0.62, track: -0.03, upper: true },
  { id: 'syncopate', name: 'Syncopate', note: 'Ultra-wide (the original SOLARIS face)', family: "'Syncopate'", weight: 700, scale: 0.5, sx: 1, track: 0.02, upper: true },
];

export const TITLE_FONT_MAP: Record<string, TitleFont> = Object.fromEntries(TITLE_FONTS.map((f) => [f.id, f]));

/** Applies a title font as CSS custom properties on <html>. */
export function applyTitleFont(id: string) {
  const f = TITLE_FONT_MAP[id] ?? TITLE_FONTS[0];
  const root = document.documentElement;
  root.dataset.font = f.id;
  root.style.setProperty('--font-hero', `${f.family}, 'Anton', Impact, sans-serif`);
  root.style.setProperty('--hero-weight', String(f.weight));
  root.style.setProperty('--hero-scale', String(f.scale));
  root.style.setProperty('--hero-sx', String(f.sx));
  root.style.setProperty('--hero-track', `${f.track}em`);
  root.style.setProperty('--hero-case', f.upper ? 'uppercase' : 'none');
}
