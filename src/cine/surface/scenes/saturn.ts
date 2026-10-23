import type { SceneSrc } from '../types';
import { MOON_LIB } from './shared';

/* ------------------------------------------------------------------ */
/* SATURN — a pale golden cloud deck under a bridge of ice: the real    */
/* ring-plane geometry for an observer at 42° north, looking south      */
/* ------------------------------------------------------------------ */
export const SATURN: SceneSrc = {
  seed: 6.4,
  hmap: { half: 1.25, r0: 0.5, r1: 9000 },
  defs: `#define STEPK 0.2\n#define SOFTK 6.0`,
  common: /* glsl */ `
const float HMAX = 70.0;
const float TMAX = 9000.0;
const float TMIN = 0.6;
const float LODK = 0.02;
const float FOGK = 0.00030;

vec3 camPos(){ return vec3(0.0, 150.0, 0.0); }
vec3 camTarget(){ return vec3(0.0, 150.0 - 60.0 * 0.095, 60.0); }
float camFocal(){ return 1.5; }
// the sun hangs behind and left of us, a little above the deck, on the same side of the rings we can see
vec3 sunDir(){ return normalize(vec3(-0.66, 0.30, -0.35)); }

float bandF(float z){ return sin(z * 0.0012) * 0.5 + sin(z * 0.0039 + 0.7) * 0.3 + sin(z * 0.0091 + 2.4) * 0.2; }
const float LAT = 0.733;
`,
  terrain: /* glsl */ `
float terrainH(vec2 p, int oct){
  float b = bandF(p.y);
  vec2 q = vec2(p.x + b * 900.0, p.y);
  vec2 w = vec2(fbm(q * 0.0022 + vec2(2.0, 0.0), 3), fbm(q * 0.0022 + vec2(6.0, 3.0), 3)) - 0.5;
  q += w * 240.0;
  float n = fbm(vec2(q.x * 0.0036, q.y * 0.011), 4);
  float h = 26.0 * smoothstep(0.26, 0.9, n);
  h += 4.0 * fbm(vec2(q.x * 0.015, q.y * 0.04), 4);
  if (oct >= 6) h += (fbm(p * 0.3, oct - 3) - 0.5) * 0.9;
  return h;
}
`,
  look:
    MOON_LIB +
    /* glsl */ `
vec3 ringAxis(){ return vec3(0.0, sin(LAT), -cos(LAT)); }

/** radial opacity of Saturn's rings, r in planet radii */
float ringDensity(float r){
  float c = smoothstep(1.235, 1.30, r) * (1.0 - smoothstep(1.50, 1.54, r)) * 0.20;
  float bring = smoothstep(1.52, 1.58, r) * (1.0 - smoothstep(1.94, 1.96, r)) * (0.72 + 0.26 * vnoise(vec2(r * 55.0, 3.0)));
  float cass = smoothstep(1.95, 1.99, r) * (1.0 - smoothstep(2.02, 2.04, r)) * 0.06;
  float a = smoothstep(2.03, 2.05, r) * (1.0 - smoothstep(2.265, 2.28, r)) * (0.58 + 0.2 * vnoise(vec2(r * 80.0, 9.0)));
  a *= 1.0 - smoothstep(0.012, 0.0, abs(r - 2.215)) * 0.9;
  float fine = 0.82 + 0.18 * vnoise(vec2(r * 520.0, 1.0));
  return clamp(max(max(c, bring), max(cass, a)) * fine, 0.0, 1.0);
}

/** the ring system as seen from the cloud tops: intersect the view ray with the ring plane (R = 1) */
vec4 ringSky(vec3 rd){
  vec3 a = ringAxis();
  float da = dot(rd, a);
  if (da > -0.002) return vec4(0.0);
  vec3 O = vec3(0.0, 1.0, 0.0);
  float t = -dot(O, a) / da;
  vec3 P = O + rd * t;
  float r = length(P);
  if (r < 1.23 || r > 2.29) return vec4(0.0);
  float d = ringDensity(r);
  float k = (r - 1.24) / 1.03;
  vec3 colB = vec3(0.92, 0.80, 0.62);
  vec3 colA = vec3(0.78, 0.70, 0.60);
  vec3 colC = vec3(0.50, 0.44, 0.38);
  vec3 col = mix(colC, mix(colB, colA, smoothstep(0.62, 0.8, k)), smoothstep(0.2, 0.3, k));
  col *= 0.55 + 0.6 * vnoise(vec2(r * 140.0, 5.0));
  // lit face towards us; Saturn's own shadow darkens the nearest stretch of the arch
  float lit = 0.85;
  vec3 sd = sunDir();
  vec3 toSun = normalize(sd);
  float shadow = 1.0;
  float b = dot(P, toSun);
  float closest = sqrt(max(dot(P, P) - b * b, 0.0));
  if (b < 0.0) shadow = smoothstep(0.96, 1.04, closest);
  return vec4(col * lit * (0.2 + 0.8 * shadow) * 1.15, d * 0.9 * smoothstep(0.0, 0.03, rd.y + 0.02));
}

vec3 skyGrad(vec3 rd){
  float h = max(rd.y, 0.0);
  vec3 sd = sunDir();
  float s = max(dot(rd, sd), 0.0);
  vec3 hor = vec3(0.94, 0.78, 0.55);
  vec3 low = vec3(0.60, 0.50, 0.42);
  vec3 mid = vec3(0.20, 0.22, 0.32);
  vec3 top = vec3(0.04, 0.05, 0.11);
  vec3 c = mix(hor, low, smoothstep(0.0, 0.08, h));
  c = mix(c, mid, smoothstep(0.05, 0.34, h));
  c = mix(c, top, smoothstep(0.25, 0.8, h));
  c += vec3(1.0, 0.8, 0.55) * pow(s, 4.0) * 0.12;
  return c;
}

vec3 skyColor(vec3 rd){
  vec3 sd = sunDir();
  vec3 c = skyGrad(rd);
  float h = max(rd.y, 0.0);
  float st = stars(rd, 200.0, 0.18, 0.17) * smoothstep(0.12, 0.4, h);
  c += vec3(0.9, 0.9, 1.0) * st * 1.2;
  vec4 ring = ringSky(rd);
  c = mix(c, ring.rgb, ring.a);
  vec4 ti = moonDisc(rd, normalize(vec3(0.42, 0.35, 0.84)), 0.0052, sd, vec3(0.95, 0.62, 0.28));
  c = mix(c, ti.rgb, ti.a);
  vec4 en = moonDisc(rd, normalize(vec3(-0.38, 0.52, 0.76)), 0.0026, sd, vec3(0.95, 0.96, 1.0));
  c = mix(c, en.rgb, en.a);
  return c;
}

vec3 fogColor(vec3 rd, float t){
  float s = max(dot(rd, sunDir()), 0.0);
  return vec3(0.90, 0.74, 0.52) * mix(0.62, 0.95, pow(s, 1.5));
}

vec3 shadeTerrain(vec3 p, vec3 n, vec3 rd, float t, float sh, float ao){
  float b = bandF(p.z);
  vec2 q = vec2(p.x + b * 900.0, p.z);
  vec2 w = vec2(fbm(q * 0.0022 + vec2(2.0, 0.0), 3), fbm(q * 0.0022 + vec2(6.0, 3.0), 3)) - 0.5;
  q += w * 240.0;
  float tone = 0.5 + 0.5 * b;
  vec3 deep = vec3(0.42, 0.26, 0.13);
  vec3 gold = vec3(0.78, 0.58, 0.30);
  vec3 pale = vec3(0.93, 0.82, 0.60);
  vec3 alb = mix(deep, gold, smoothstep(0.0, 0.5, tone));
  alb = mix(alb, pale, smoothstep(0.45, 0.9, tone));
  float mott = fbm(vec2(q.x * 0.008, q.y * 0.026), 5);
  alb = mix(alb, alb * vec3(0.82, 0.72, 0.62), smoothstep(0.5, 0.8, mott) * 0.6);
  alb = mix(alb, vec3(0.98, 0.95, 0.88), smoothstep(0.6, 1.0, p.y / 26.0) * 0.4);
  vec3 sd = sunDir();
  float dm = 1.0 / (1.0 + t * 0.004);
  vec2 g = p.xz * 0.3;
  n = normalize(n + vec3(vnoise(g) - 0.5, 0.0, vnoise(g + 7.0) - 0.5) * 0.2 * dm);
  float dif = max(dot(n, sd), 0.0) * (0.45 + 0.55 * sh);
  vec3 sunC = vec3(1.0, 0.82, 0.6) * 1.9;
  vec3 skyC = vec3(0.62, 0.55, 0.52) * 0.5;
  float depth = clamp(p.y / 26.0, 0.0, 1.0);
  float amb = (0.4 + 0.6 * n.y) * mix(0.45, 1.0, depth) * ao;
  return alb * (sunC * dif + skyC * amb);
}

vec3 overlay(vec3 col, vec2 q, vec3 ro, vec3 rd, float t, bool hit, inout float par){ return col; }

vec3 grade(vec3 col, vec2 q){
  float l = luma(col);
  col = mix(vec3(l), col, 1.06);
  return col * 0.95;
}
`,
};
