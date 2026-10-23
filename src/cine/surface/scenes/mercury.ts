import type { SceneSrc } from '../types';

/* ------------------------------------------------------------------ */
/* MERCURY — airless, black sky, a huge low sun and long hard shadows   */
/* ------------------------------------------------------------------ */
export const MERCURY: SceneSrc = {
  seed: 1.7,
  hmap: { half: 1.25, r0: 0.4, r1: 5000 },
  defs: `#define STEPK 0.5
#define NORMK 0.0045\n#define SOFTK 18.0`,
  common: /* glsl */ `
const float HMAX = 420.0;
const float TMAX = 5000.0;
const float TMIN = 0.5;
const float LODK = 0.04;
const float FOGK = 0.0000035;

vec3 camPos(){ return vec3(0.0, 3.6, 0.0); }
vec3 camTarget(){ return vec3(-3.0, 3.6 - 60.0 * 0.085, 60.0); }
float camFocal(){ return 2.0; }
vec3 sunDir(){ return normalize(vec3(0.52, 0.17, 0.84)); }
`,
  terrain: /* glsl */ `
/** one octave of craters on a jittered grid: bowl + raised rim + ejecta apron */
float craters(vec2 p, float cs, float seed, float dens, float depthK){
  vec2 g = p / cs;
  vec2 id = floor(g);
  vec2 f = fract(g);
  float h = 0.0;
  for (int j = -1; j <= 1; j++){
    for (int i = -1; i <= 1; i++){
      vec2 o = vec2(float(i), float(j));
      vec2 cid = id + o;
      if (hash12(cid + seed) > dens) continue;
      vec2 c = o + 0.15 + 0.7 * hash22(cid * 1.37 + seed * 1.7) - f;
      float rad = mix(0.14, 0.5, pow(hash12(cid * 1.3 + seed + 5.0), 1.6));
      float d = length(c) / rad;
      float bowl = d < 1.0 ? -(1.0 - d * d) : 0.0;
      float rim = exp(-pow((d - 1.0) / 0.17, 2.0)) * 0.55;
      float ej = d >= 1.0 ? exp(-(d - 1.0) * 2.6) * 0.1 : 0.0;
      h += (bowl * 0.95 + rim + ej) * rad * cs * depthK;
    }
  }
  return h;
}

float terrainH(vec2 p, int oct){
  float h = (fbm(p * 0.004, 4) - 0.5) * 6.0;
  h += craters(p + 31.0, 1300.0, 1.0, 0.8, 0.2);
  h += craters(p + 7.0, 380.0, 2.0, 0.85, 0.2);
  h += craters(p + 13.0, 96.0, 3.0, 0.85, 0.18);
  h += craters(p + 3.0, 26.0, 4.0, 0.8, 0.16);
  if (oct >= 6) h += craters(p + 5.0, 7.0, 5.0, 0.75, 0.15);
  if (oct >= 7) h += craters(p + 9.0, 2.1, 6.0, 0.7, 0.14);
  if (oct >= 8) h += craters(p + 2.0, 0.62, 7.0, 0.7, 0.13);
  // a great rim crossing the left foreground
  vec2 c = p - vec2(-70.0, 38.0);
  float d = length(c) / 46.0;
  h += (d < 1.0 ? -(1.0 - d * d) * 6.0 : 0.0) + exp(-pow((d - 1.0) / 0.22, 2.0)) * 13.0;
  h += (fbm(p * 0.5, oct - 2) - 0.5) * 0.8;
  return h;
}
`,
  look: /* glsl */ `
vec3 skyColor(vec3 rd){
  vec3 sd = sunDir();
  float s = max(dot(rd, sd), 0.0);
  vec3 c = vec3(0.0);
  float st = stars(rd, 300.0, 0.34, 0.2) * 1.2 + stars(rd, 140.0, 0.2, 0.18) * 1.0 + stars(rd, 620.0, 0.4, 0.2) * 0.8 + stars(rd, 70.0, 0.1, 0.2) * 1.4;
  c += vec3(0.9, 0.92, 1.0) * st * 1.6;
  // a faint zodiacal glow hugging the horizon toward the sun, then the sun itself
  c += vec3(1.0, 0.72, 0.45) * pow(s, 14.0) * 0.18 * exp(-max(rd.y, 0.0) * 6.0);
  c += vec3(1.0, 0.82, 0.6) * pow(s, 90.0) * 1.1;
  c += vec3(1.0, 0.95, 0.85) * smoothstep(0.99984, 0.99992, s) * 30.0;
  // diffraction spikes
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), sd));
  vec3 up = cross(sd, right);
  vec2 sp = vec2(dot(rd, right), dot(rd, up));
  float ang = atan(sp.y, sp.x);
  float spike = pow(abs(cos(ang * 3.0)), 90.0);
  c += vec3(1.0, 0.85, 0.65) * spike * pow(s, 30.0) * 0.16;
  return c;
}

vec3 fogColor(vec3 rd, float t){ return vec3(0.0); }

vec3 shadeTerrain(vec3 p, vec3 n, vec3 rd, float t, float sh, float ao){
  float broad = fbm(p.xz * 0.01, 4);
  float mid = fbm(p.xz * 0.15, 4);
  float fine = vnoise(p.xz * 2.8) * 0.6 + vnoise(p.xz * 9.0) * 0.4;
  vec3 pale = vec3(0.34, 0.31, 0.275);
  vec3 dark = vec3(0.13, 0.12, 0.115);
  vec3 alb = mix(dark, pale, smoothstep(0.3, 0.7, broad));
  alb = mix(alb, vec3(0.42, 0.36, 0.29), smoothstep(0.6, 0.8, fbm(p.xz * 0.03 + 4.0, 3)) * 0.4);
  alb *= 0.7 + 0.5 * fine;
  alb *= 0.85 + 0.3 * mid;
  float dm = 1.0 / (1.0 + t * 0.01);
  vec2 g = p.xz * 3.4;
  n = normalize(n + vec3(vnoise(g) - vnoise(g + vec2(5.1, 2.3)), 0.0, vnoise(g + vec2(1.3, 8.2)) - vnoise(g + vec2(9.4, 3.7))) * 0.45 * dm);
  vec3 sd = sunDir();
  float dif = max(dot(n, sd), 0.0) * sh;
  vec3 sunC = vec3(1.0, 0.93, 0.82) * 5.2;
  vec3 fill = vec3(0.55, 0.52, 0.5) * 0.085 * (0.55 + 0.45 * n.y) * ao;
  // regolith brightens when you look along the sun's rays
  float opp = pow(max(dot(rd, sd), 0.0), 6.0) * 0.35;
  return alb * (sunC * dif * (1.0 + opp) + fill);
}

vec3 overlay(vec3 col, vec2 q, vec3 ro, vec3 rd, float t, bool hit, inout float par){ return col; }

vec3 grade(vec3 col, vec2 q){
  float l = luma(col);
  col = mix(vec3(l), col, 0.9);
  col *= vec3(1.0, 0.985, 0.96);
  return col * 0.92;
}
`,
};
