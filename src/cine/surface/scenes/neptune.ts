import type { SceneSrc } from '../types';
import { MOON_LIB, SKY_LIB } from './shared';

/* ------------------------------------------------------------------ */
/* NEPTUNE — ultramarine storm decks under streaks of methane cirrus,   */
/* the dark spot on the horizon and Triton a bright crescent above      */
/* ------------------------------------------------------------------ */
export const NEPTUNE: SceneSrc = {
  seed: 8.8,
  hmap: { half: 1.25, r0: 0.5, r1: 9000 },
  defs: `#define STEPK 0.16\n#define SOFTK 6.0`,
  common: /* glsl */ `
const float HMAX = 110.0;
const float TMAX = 9000.0;
const float TMIN = 0.6;
const float LODK = 0.02;
const float FOGK = 0.00030;

vec3 camPos(){ return vec3(0.0, 230.0, 0.0); }
vec3 camTarget(){ return vec3(0.0, 230.0 - 60.0 * 0.115, 60.0); }
float camFocal(){ return 1.9; }
vec3 sunDir(){ return normalize(vec3(0.62, 0.17, 0.77)); }

float bandF(float z){ return sin(z * 0.0036) * 0.5 + sin(z * 0.0088 + 2.1) * 0.3 + sin(z * 0.019 + 0.4) * 0.2; }
const vec2 DARK_SPOT = vec2(-520.0, 1900.0);
`,
  terrain: /* glsl */ `
float terrainH(vec2 p, int oct){
  float b = bandF(p.y);
  vec2 q = vec2(p.x + b * 1500.0, p.y);
  vec2 w = vec2(fbm(q * 0.0026 + vec2(3.0, 1.0), 3), fbm(q * 0.0026 + vec2(8.0, 5.0), 3)) - 0.5;
  q += w * 320.0;
  float n = fbm(vec2(q.x * 0.0036, q.y * 0.011), 4);
  float h = 48.0 * smoothstep(0.26, 0.92, n);
  h += 7.0 * fbm(vec2(q.x * 0.018, q.y * 0.045), 4);
  // the dark storm sits in a depression ringed by lifted clouds
  vec2 c = (p - DARK_SPOT) * vec2(0.7, 1.0);
  float r = length(c) / 520.0;
  h = mix(h, 6.0, 1.0 - smoothstep(0.55, 0.95, r));
  h += 26.0 * exp(-pow((r - 1.02) / 0.16, 2.0));
  return h;
}
`,
  look:
    SKY_LIB +
    MOON_LIB +
    /* glsl */ `
vec3 skyGrad(vec3 rd){
  float h = max(rd.y, 0.0);
  vec3 sd = sunDir();
  float s = max(dot(rd, sd), 0.0);
  vec3 hor = vec3(0.30, 0.52, 0.86);
  vec3 low = vec3(0.10, 0.22, 0.60);
  vec3 mid = vec3(0.03, 0.08, 0.30);
  vec3 top = vec3(0.008, 0.02, 0.10);
  vec3 c = mix(hor, low, smoothstep(0.0, 0.09, h));
  c = mix(c, mid, smoothstep(0.05, 0.38, h));
  c = mix(c, top, smoothstep(0.3, 0.9, h));
  c += vec3(0.7, 0.8, 1.0) * pow(s, 8.0) * 0.12 + vec3(0.9, 0.95, 1.0) * pow(s, 70.0) * 0.4;
  return c;
}

vec3 skyColor(vec3 rd){
  vec3 sd = sunDir();
  vec3 c = skyGrad(rd);
  float h = max(rd.y, 0.0);
  // long streaks of methane ice
  float ci = cirrus(rd, 1.0, vec2(0.99, 0.1), 0.45);
  float ci2 = cirrus(rd + vec3(0.0, 0.03, 0.0), 2.2, vec2(0.98, 0.18), 0.5);
  vec3 ice = mix(vec3(0.62, 0.76, 1.0), vec3(1.0), pow(max(dot(rd, sd), 0.0), 3.0));
  c = mix(c, ice, ci * 0.55 + ci2 * 0.25);
  float st = stars(rd, 220.0, 0.2, 0.17) * smoothstep(0.1, 0.4, h);
  c += vec3(0.9, 0.95, 1.0) * st * 1.3;
  // Triton: a big bright crescent
  vec4 tr = moonDisc(rd, normalize(vec3(-0.34, 0.27, 0.90)), 0.020, sd, vec3(1.0, 0.9, 0.86));
  c = mix(c, tr.rgb, tr.a);
  float mu = dot(rd, sd);
  c += vec3(0.95, 0.98, 1.0) * smoothstep(0.99998, 0.999993, mu) * 12.0;
  return c;
}

vec3 fogColor(vec3 rd, float t){
  float s = max(dot(rd, sunDir()), 0.0);
  return mix(vec3(0.14, 0.28, 0.62), vec3(0.34, 0.56, 0.92), pow(s, 2.0)) * 0.9;
}

vec3 seaAlbedo(vec3 p, vec3 n, float t){
  float b = bandF(p.z);
  vec2 q = vec2(p.x + b * 1500.0, p.z);
  vec2 w = vec2(fbm(q * 0.0026 + vec2(3.0, 1.0), 3), fbm(q * 0.0026 + vec2(8.0, 5.0), 3)) - 0.5;
  q += w * 320.0;
  float tone = 0.5 + 0.5 * b;
  vec3 deep = vec3(0.02, 0.07, 0.30);
  vec3 azure = vec3(0.07, 0.24, 0.72);
  vec3 sky = vec3(0.30, 0.52, 0.92);
  vec3 c = mix(deep, azure, smoothstep(0.0, 0.55, tone));
  c = mix(c, sky, smoothstep(0.5, 1.0, tone) * 0.6);
  float mott = fbm(vec2(q.x * 0.008, q.y * 0.022), 5);
  c = mix(c, c * 0.5, smoothstep(0.55, 0.85, mott) * 0.5);
  // white methane clouds ride the crests
  c = mix(c, vec3(0.88, 0.94, 1.0), smoothstep(0.52, 0.95, p.y / 48.0) * 0.85);
  // the dark spot
  vec2 gc = (p.xz - DARK_SPOT) * vec2(0.7, 1.0);
  float r = length(gc) / 520.0;
  c = mix(c, vec3(0.006, 0.02, 0.10), (1.0 - smoothstep(0.5, 0.95, r)) * 0.95);
  return c;
}

vec3 shadeTerrain(vec3 p, vec3 n, vec3 rd, float t, float sh, float ao){
  vec3 alb = seaAlbedo(p, n, t);
  vec3 sd = sunDir();
  float dm = 1.0 / (1.0 + t * 0.004);
  vec2 g = p.xz * 0.3;
  n = normalize(n + vec3(vnoise(g) - 0.5, 0.0, vnoise(g + 7.0) - 0.5) * 0.2 * dm);
  float dif = max(dot(n, sd), 0.0) * sh;
  vec3 sunC = vec3(0.9, 0.95, 1.0) * 2.0;
  vec3 skyC = vec3(0.30, 0.46, 0.85) * 0.55;
  float depth = clamp(p.y / 48.0, 0.0, 1.0);
  float amb = (0.4 + 0.6 * n.y) * mix(0.4, 1.0, depth) * ao;
  return alb * (sunC * dif + skyC * amb);
}

vec3 overlay(vec3 col, vec2 q, vec3 ro, vec3 rd, float t, bool hit, inout float par){ return col; }

vec3 grade(vec3 col, vec2 q){
  float l = luma(col);
  col = mix(vec3(l), col, 1.15);
  return col * 0.95;
}
`,
};
