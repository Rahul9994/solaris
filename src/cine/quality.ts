export type Quality = 'low' | 'balanced' | 'high';

export interface QualityPreset {
  label: string;
  hint: string;
  /** width of each baked surface photograph */
  surface: number;
  /** equirect width of baked planet textures for the orbit view */
  planet: number;
  /** device-pixel-ratio ceiling for the canvas */
  dpr: number;
  /** orbit render-target scale relative to the canvas */
  orbit: number;
}

export const QUALITY: Record<Quality, QualityPreset> = {
  low: { label: 'Low', hint: 'Fastest. Smaller surfaces and a lighter canvas for older devices.', surface: 1280, planet: 1024, dpr: 1, orbit: 0.6 },
  balanced: { label: 'Balanced', hint: 'Sharp photographs and smooth transitions on most machines.', surface: 1792, planet: 2048, dpr: 1.25, orbit: 0.8 },
  high: { label: 'High', hint: 'Largest surfaces and a full-resolution canvas. For strong GPUs.', surface: 2560, planet: 4096, dpr: 2, orbit: 1 },
};

export function defaultQuality(): Quality {
  try {
    const saved = localStorage.getItem('solaris.quality') as Quality | null;
    if (saved && saved in QUALITY) return saved;
  } catch {
    /* storage can be unavailable */
  }
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency || 4;
  return mobile || cores <= 4 ? 'low' : 'balanced';
}
