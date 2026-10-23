import type { SceneSrc } from '../types';
import { WORLEY_LIB } from './shared';

/* ------------------------------------------------------------------ */
/* VENUS — sulfur haze, basalt plates, lava glowing through the cracks  */
/* ------------------------------------------------------------------ */
export const VENUS: SceneSrc = {
  seed: 2.9,
  hmap: { half: 1.25, r0: 0.4, r1: 2000 },
  defs: `#define STEPK 0.5
#define NORMK 0.006\n#define SOFTK 5.0`,
  common:
    /* glsl */ `
const float HMAX = 140.0;
const float TMAX = 2000.0;
const float TMIN = 0.5;
const float LODK = 0.06;
const float FOGK = 0.0030;

vec3 camPos(){ return vec3(0.0, 5.2, 0.0); }
vec3 camTarget(){ return vec3(2.0, 5.2 - 60.0 * 0.1, 60.0); }
float camFocal(){ return 2.0; }
vec3 sunDir(){ return normalize(vec3(-0.45, 0.38, 0.8)); }
` + WORLEY_LIB,
  terrain: /* glsl */ `
float volcano(vec2 p, vec2 c, float r, float h){
  float d = length(p - c) / r;
  float cone = h * (1.0 - smoothstep(0.0, 1.0, d));
  float caldera = smoothstep(0.16, 0.0, d) * h * 0.22;
  return cone - caldera;
}

float terrainH(vec2 p, int oct){
  vec2 w = vec2(vnoise(p * 0.02), vnoise(p * 0.02 + 4.4)) - 0.5;
  vec2 q = p + w * 24.0;
  float h = (fbm(q * 0.008, 4) - 0.5) * 7.0;
  // wrinkle ridges
  h += pow(ridge(q * 0.022 + 3.0, 4), 2.0) * 3.2;
  // cooled lava plates: grooves along their seams, slightly domed middles
  float f1, f2; vec2 id;
  worley(q * 0.055, f1, f2, id);
  float seam = f2 - f1;
  h -= smoothstep(0.16, 0.0, seam) * 0.9;
  h += (hash12(id + 5.0) - 0.5) * 0.9 + (0.35 - f1) * 0.5;
  // broad shield volcanoes sinking into the haze
  h += volcano(p, vec2(230.0, 640.0), 520.0, 78.0);
  h += volcano(p, vec2(-420.0, 980.0), 640.0, 60.0);
  h += volcano(p, vec2(-60.0, 1500.0), 800.0, 90.0);
  if (oct >= 5) h += (fbm(p * 0.9, oct - 2) - 0.5) * 0.7;
  if (oct >= 6) h += (vnoise(p * 6.0) - 0.5) * 0.16;
  return h;
}
`,
  look: /* glsl */ `
vec3 skyColor(vec3 rd){
  vec3 sd = sunDir();
  float h = max(rd.y, 0.0);
  float s = max(dot(rd, sd), 0.0);
  vec3 hor = vec3(1.0, 0.58, 0.17);
  vec3 mid = vec3(0.78, 0.40, 0.11);
  vec3 top = vec3(0.34, 0.17, 0.06);
  vec3 c = mix(hor, mid, smoothstep(0.0, 0.2, h));
  c = mix(c, top, smoothstep(0.12, 0.55, h));
  // drifting cloud bands in the haze
  vec2 cp = rd.xz / (rd.y + 0.25);
  float bands = fbm(vec2(cp.x * 0.7, cp.y * 2.6), 5);
  c *= 0.82 + 0.4 * bands;
  // the sun is only a diffuse bright patch behind the deck
  c += vec3(1.0, 0.62, 0.22) * pow(s, 3.0) * 0.55 + vec3(1.0, 0.78, 0.45) * pow(s, 18.0) * 0.5;
  return c;
}

vec3 fogColor(vec3 rd, float t){
  vec3 d = normalize(vec3(rd.x, 0.012, rd.z));
  return skyColor(d) * 0.92;
}

vec3 shadeTerrain(vec3 p, vec3 n, vec3 rd, float t, float sh, float ao){
  float f1, f2; vec2 id;
  vec2 q = p.xz + (vec2(vnoise(p.xz * 0.02), vnoise(p.xz * 0.02 + 4.4)) - 0.5) * 24.0;
  worley(q * 0.055, f1, f2, id);
  float seam = f2 - f1;
  float broad = fbm(p.xz * 0.02, 4);
  float mid = fbm(p.xz * 0.18, 4);
  float fine = vnoise(p.xz * 2.4) * 0.6 + vnoise(p.xz * 8.0) * 0.4;
  vec3 basalt = vec3(0.075, 0.05, 0.042);
  vec3 weathered = vec3(0.20, 0.115, 0.07);
  vec3 alb = mix(basalt, weathered, smoothstep(0.35, 0.75, broad) * (0.4 + 0.6 * hash12(id)));
  alb *= 0.7 + 0.55 * fine;
  alb *= 0.85 + 0.3 * mid;
  vec2 g = p.xz * 3.0;
  float dm = 1.0 / (1.0 + t * 0.03);
  n = normalize(n + vec3(vnoise(g) - 0.5, 0.0, vnoise(g + 6.0) - 0.5) * 0.4 * dm);
  vec3 sd = sunDir();
  float dif = max(dot(n, sd), 0.0) * (0.35 + 0.65 * sh);
  vec3 sunC = vec3(1.0, 0.6, 0.25) * 0.9;
  vec3 skyC = vec3(0.95, 0.52, 0.2) * 0.62;
  vec3 col = alb * (sunC * dif + skyC * (0.55 + 0.45 * n.y) * ao);
  // lava still glows in the seams
  float crack = smoothstep(0.075, 0.0, seam + (vnoise(p.xz * 5.0) - 0.5) * 0.04);
  float pulse = 0.8 + 0.2 * vnoise(p.xz * 0.3);
  vec3 lava = mix(vec3(1.0, 0.18, 0.02), vec3(1.0, 0.62, 0.12), crack);
  col += lava * crack * pulse * 2.6 * smoothstep(0.1, 0.4, broad + 0.25);
  return col;
}

vec3 overlay(vec3 col, vec2 q, vec3 ro, vec3 rd, float t, bool hit, inout float par){ return col; }

vec3 grade(vec3 col, vec2 q){
  float l = luma(col);
  col = mix(vec3(l), col, 1.1);
  return col * 0.88;
}
`,
};
