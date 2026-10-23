import type { SceneSrc } from '../types';
import { MOON_LIB, SKY_LIB } from './shared';

/* ------------------------------------------------------------------ */
/* URANUS — a hush of pale cyan: a featureless methane haze, a distant  */
/* sun skimming the horizon and the thin dark rings drawn across it     */
/* ------------------------------------------------------------------ */
export const URANUS: SceneSrc = {
  seed: 7.7,
  hmap: { half: 1.25, r0: 0.5, r1: 9000 },
  defs: `#define STEPK 0.2\n#define SOFTK 4.0`,
  common: /* glsl */ `
const float HMAX = 60.0;
const float TMAX = 9000.0;
const float TMIN = 0.6;
const float LODK = 0.02;
const float FOGK = 0.00046;

vec3 camPos(){ return vec3(0.0, 120.0, 0.0); }
vec3 camTarget(){ return vec3(0.0, 120.0 - 60.0 * 0.075, 60.0); }
float camFocal(){ return 1.8; }
// the sun skims the horizon (Uranus rolls on its side): small, low and far away
vec3 sunDir(){ return normalize(vec3(-0.50, 0.045, 0.86)); }
`,
  terrain: /* glsl */ `
float terrainH(vec2 p, int oct){
  // slow, soft swells in an almost featureless deck
  vec2 w = vec2(fbm(p * 0.0014 + vec2(1.0, 2.0), 3), fbm(p * 0.0014 + vec2(7.0, 4.0), 3)) - 0.5;
  vec2 q = p + w * 500.0;
  float h = 20.0 * pow(smoothstep(0.30, 0.85, fbm(vec2(q.x * 0.0012, q.y * 0.0034), 4)), 1.4);
  h += 3.0 * fbm(vec2(q.x * 0.004, q.y * 0.011), 3);
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
  vec3 hor = vec3(0.72, 0.92, 0.92);
  vec3 low = vec3(0.34, 0.66, 0.76);
  vec3 mid = vec3(0.10, 0.34, 0.50);
  vec3 top = vec3(0.025, 0.11, 0.24);
  vec3 c = mix(hor, low, smoothstep(0.0, 0.1, h));
  c = mix(c, mid, smoothstep(0.05, 0.4, h));
  c = mix(c, top, smoothstep(0.3, 0.9, h));
  c += vec3(0.95, 1.0, 0.95) * pow(s, 6.0) * 0.18 * (1.0 - smoothstep(0.0, 0.4, h)) + vec3(1.0, 1.0, 0.92) * pow(s, 60.0) * 0.45;
  return c;
}

vec3 skyColor(vec3 rd){
  vec3 sd = sunDir();
  vec3 c = skyGrad(rd);
  float h = max(rd.y, 0.0);
  // wisps of high methane ice
  float ci = cirrus(rd, 1.2, vec2(0.99, 0.12), 0.52);
  c = mix(c, vec3(0.78, 0.95, 0.95), ci * 0.3);
  float st = stars(rd, 230.0, 0.16, 0.17) * smoothstep(0.1, 0.4, h);
  c += vec3(0.9, 1.0, 1.0) * st * 1.2;
  // the narrow rings: two thin arcs standing nearly on end
  float ang = atan(rd.x, rd.z);
  float arcCenter = 0.34 + 0.1 * (rd.y - 0.2);
  float ringD = abs(rd.x - 0.55 * rd.y - 0.12);
  float ring = smoothstep(0.010, 0.0, ringD - 0.003) * smoothstep(0.02, 0.3, rd.y) * 0.30;
  ring += smoothstep(0.005, 0.0, abs(rd.x - 0.55 * rd.y - 0.19)) * smoothstep(0.02, 0.3, rd.y) * 0.16;
  c = mix(c, vec3(0.30, 0.52, 0.60) * 0.6, ring);
  vec4 ti = moonDisc(rd, normalize(vec3(0.36, 0.30, 0.88)), 0.0046, sd, vec3(0.78, 0.78, 0.76));
  c = mix(c, ti.rgb, ti.a);
  vec4 mi = moonDisc(rd, normalize(vec3(-0.20, 0.50, 0.84)), 0.0028, sd, vec3(0.85, 0.88, 0.9));
  c = mix(c, mi.rgb, mi.a);
  float mu = dot(rd, sd);
  c += vec3(1.0, 1.0, 0.94) * smoothstep(0.999985, 0.99999, mu) * 9.0;
  return c;
}

vec3 fogColor(vec3 rd, float t){
  float s = max(dot(rd, sunDir()), 0.0);
  return mix(vec3(0.42, 0.74, 0.78), vec3(0.78, 0.96, 0.94), pow(s, 2.0)) * 0.95;
}

vec3 shadeTerrain(vec3 p, vec3 n, vec3 rd, float t, float sh, float ao){
  float broad = fbm(p.xz * 0.0016, 3);
  float mott = fbm(p.xz * vec2(0.003, 0.009), 4);
  vec3 a = vec3(0.60, 0.84, 0.86);
  vec3 b = vec3(0.42, 0.72, 0.78);
  vec3 alb = mix(a, b, smoothstep(0.35, 0.7, broad));
  alb = mix(alb, vec3(0.85, 0.97, 0.95), smoothstep(0.4, 0.85, mott) * 0.35);
  vec3 sd = sunDir();
  float dm = 1.0 / (1.0 + t * 0.004);
  vec2 g = p.xz * vec2(0.1, 0.3);
  n = normalize(n + vec3(vnoise(g) - 0.5, 0.0, vnoise(g + 7.0) - 0.5) * 0.12 * dm);
  float dif = max(dot(n, sd), 0.0) * (0.4 + 0.6 * sh);
  vec3 sunC = vec3(0.98, 1.0, 0.94) * 1.5;
  vec3 skyC = vec3(0.45, 0.74, 0.82) * 0.66;
  float depth = clamp(p.y / 20.0, 0.0, 1.0);
  float amb = (0.45 + 0.55 * n.y) * mix(0.55, 1.0, depth) * ao;
  return alb * (sunC * dif + skyC * amb);
}

vec3 overlay(vec3 col, vec2 q, vec3 ro, vec3 rd, float t, bool hit, inout float par){ return col; }

vec3 grade(vec3 col, vec2 q){
  float l = luma(col);
  col = mix(vec3(l), col, 1.05);
  return col * vec3(0.96, 1.0, 1.0) * 0.96;
}
`,
};
