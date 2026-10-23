import type { SceneSrc } from '../types';
import { MOON_LIB } from './shared';

/* ------------------------------------------------------------------ */
/* JUPITER — an airship above the ammonia clouds, the Great Red Spot    */
/* boiling on the horizon and Io and Europa hanging in the sky          */
/* ------------------------------------------------------------------ */
export const JUPITER: SceneSrc = {
  seed: 5.1,
  hmap: { half: 1.25, r0: 0.5, r1: 9000 },
  defs: `#define STEPK 0.16\n#define SOFTK 7.0`,
  common: /* glsl */ `
const float HMAX = 130.0;
const float TMAX = 9000.0;
const float TMIN = 0.6;
const float LODK = 0.02;
const float FOGK = 0.00022;

vec3 camPos(){ return vec3(0.0, 290.0, 0.0); }
vec3 camTarget(){ return vec3(0.0, 290.0 - 60.0 * 0.12, 60.0); }
float camFocal(){ return 2.0; }
vec3 sunDir(){ return normalize(vec3(-0.78, 0.20, 0.60)); }

float bandF(float z){ return sin(z * 0.0041) * 0.5 + sin(z * 0.0097 + 1.3) * 0.3 + sin(z * 0.021 + 4.1) * 0.2; }
const vec2 GRS = vec2(-420.0, 1450.0);
`,
  terrain: /* glsl */ `
float terrainH(vec2 p, int oct){
  float b = bandF(p.y);
  // neighbouring belts slide past each other: shear plus turbulence along the seams
  vec2 q = vec2(p.x + b * 1300.0, p.y);
  vec2 w = vec2(fbm(q * 0.0028 + vec2(1.0, 0.0), 3), fbm(q * 0.0028 + vec2(5.0, 3.0), 3)) - 0.5;
  q += w * 340.0;
  float n = fbm(vec2(q.x * 0.0042, q.y * 0.013), 4);
  float h = 58.0 * smoothstep(0.24, 0.9, n);
  h += 9.0 * fbm(vec2(q.x * 0.02, q.y * 0.05), 4);
  // the storm: a counter-clockwise spiral with a raised eye wall
  vec2 c = (p - GRS) * vec2(0.62, 1.0);
  float r = length(c) / 560.0;
  float storm = 1.0 - smoothstep(0.75, 1.2, r);
  float ang = 3.2 * (1.0 - smoothstep(0.0, 1.3, r));
  float ca = cos(ang), sa = sin(ang);
  vec2 sq = mat2(ca, sa, -sa, ca) * c;
  float sn = fbm(sq * 0.011 + 9.0, 5);
  float sh = 30.0 * smoothstep(0.25, 0.8, sn) + 14.0;
  h = mix(h, sh, storm);
  h += 34.0 * exp(-pow((r - 0.98) / 0.14, 2.0));
  if (oct >= 6) h += (fbm(p * 0.05, 3) - 0.5) * 3.0;
  return h;
}
`,
  look:
    MOON_LIB +
    /* glsl */ `
vec3 skyGrad(vec3 rd){
  float h = max(rd.y, 0.0);
  vec3 sd = sunDir();
  float s = max(dot(rd, sd), 0.0);
  vec3 hor = vec3(0.92, 0.68, 0.48);
  vec3 low = vec3(0.50, 0.36, 0.34);
  vec3 mid = vec3(0.14, 0.16, 0.30);
  vec3 top = vec3(0.025, 0.035, 0.09);
  vec3 c = mix(hor, low, smoothstep(0.0, 0.07, h));
  c = mix(c, mid, smoothstep(0.04, 0.26, h));
  c = mix(c, top, smoothstep(0.18, 0.5, h));
  c += vec3(1.0, 0.72, 0.5) * pow(s, 3.0) * 0.22 * (1.0 - smoothstep(0.0, 0.5, h)) + vec3(1.0, 0.86, 0.66) * pow(s, 30.0) * 0.6;
  return c;
}

vec3 skyColor(vec3 rd){
  vec3 sd = sunDir();
  vec3 c = skyGrad(rd);
  float h = max(rd.y, 0.0);
  float st = stars(rd, 220.0, 0.2, 0.17) * smoothstep(0.1, 0.3, h);
  c += vec3(0.9, 0.9, 1.0) * st * 1.3;
  vec4 io = moonDisc(rd, normalize(vec3(0.34, 0.30, 0.89)), 0.0105, sd, vec3(1.0, 0.82, 0.38));
  c = mix(c, io.rgb, io.a);
  vec4 eu = moonDisc(rd, normalize(vec3(-0.12, 0.42, 0.90)), 0.0072, sd, vec3(0.86, 0.84, 0.8));
  c = mix(c, eu.rgb, eu.a);
  float mu = dot(rd, sd);
  c += vec3(1.0, 0.9, 0.7) * smoothstep(0.99996, 0.99999, mu) * 14.0;
  return c;
}

vec3 fogColor(vec3 rd, float t){
  vec3 d = normalize(vec3(rd.x, 0.01, rd.z));
  float s = max(dot(rd, sunDir()), 0.0);
  return vec3(0.86, 0.62, 0.46) * mix(0.82, 1.0, pow(s, 2.0)) * 0.9;
}

float HM(vec2 p);

vec3 cloudAlbedo(vec3 p, vec3 n, float t){
  float b = bandF(p.z);
  vec2 q = vec2(p.x + b * 1300.0, p.z);
  vec2 w = vec2(fbm(q * 0.0028 + vec2(1.0, 0.0), 3), fbm(q * 0.0028 + vec2(5.0, 3.0), 3)) - 0.5;
  q += w * 340.0;
  float tone = 0.5 + 0.5 * b;
  vec3 brown = vec3(0.42, 0.22, 0.13);
  vec3 rust = vec3(0.66, 0.36, 0.21);
  vec3 tanc = vec3(0.80, 0.60, 0.40);
  vec3 cream = vec3(0.94, 0.86, 0.72);
  vec3 c = mix(brown, rust, smoothstep(0.0, 0.25, tone));
  c = mix(c, tanc, smoothstep(0.2, 0.5, tone));
  c = mix(c, cream, smoothstep(0.45, 0.85, tone));
  float mott = fbm(vec2(q.x * 0.008, q.y * 0.024), 5);
  c = mix(c, c * vec3(0.78, 0.62, 0.55), smoothstep(0.45, 0.8, mott) * 0.7);
  c = mix(c, vec3(0.97, 0.94, 0.9), smoothstep(0.6, 1.0, p.y / 58.0) * 0.4);
  // the Great Red Spot
  vec2 gc = (p.xz - GRS) * vec2(0.62, 1.0);
  float r = length(gc) / 560.0;
  float storm = 1.0 - smoothstep(0.78, 1.22, r);
  float ang = 3.2 * (1.0 - smoothstep(0.0, 1.3, r));
  float ca = cos(ang), sa = sin(ang);
  vec2 sq = mat2(ca, sa, -sa, ca) * gc;
  float sn = fbm(sq * 0.011 + 9.0, 5);
  vec3 red = mix(vec3(0.60, 0.22, 0.12), vec3(0.82, 0.42, 0.26), smoothstep(0.3, 0.8, sn));
  c = mix(c, red, storm * 0.92);
  return c;
}

vec3 shadeTerrain(vec3 p, vec3 n, vec3 rd, float t, float sh, float ao){
  vec3 alb = cloudAlbedo(p, n, t);
  vec3 sd = sunDir();
  float dm = 1.0 / (1.0 + t * 0.004);
  vec2 g = p.xz * 0.3;
  n = normalize(n + vec3(vnoise(g) - 0.5, 0.0, vnoise(g + 7.0) - 0.5) * 0.25 * dm);
  float dif = max(dot(n, sd), 0.0) * sh;
  vec3 sunC = vec3(1.0, 0.84, 0.64) * 2.2;
  vec3 skyC = vec3(0.50, 0.50, 0.62) * 0.5;
  // troughs between billows sit in their own shade
  float depth = clamp(p.y / 58.0, 0.0, 1.0);
  float amb = (0.35 + 0.65 * n.y) * mix(0.35, 1.0, depth) * ao;
  return alb * (sunC * dif + skyC * amb);
}

vec3 overlay(vec3 col, vec2 q, vec3 ro, vec3 rd, float t, bool hit, inout float par){ return col; }

vec3 grade(vec3 col, vec2 q){
  float l = luma(col);
  col = mix(vec3(l), col, 1.08);
  return col * 0.94;
}
`,
};
