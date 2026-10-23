import type { SceneSrc } from '../types';
import { SKY_LIB, PROJECT_LIB } from './shared';

/* ------------------------------------------------------------------ */
/* EARTH — an acacia on the savanna at sunset                           */
/* ------------------------------------------------------------------ */
export const EARTH: SceneSrc = {
  seed: 3.3,
  hmap: { half: 1.25, r0: 0.4, r1: 6000 },
  defs: `#define STEPK 0.5
#define NORMK 0.008\n#define SOFTK 6.0`,
  common: /* glsl */ `
const float HMAX = 700.0;
const float TMAX = 6000.0;
const float TMIN = 0.4;
const float LODK = 0.035;
const float FOGK = 0.00031;

vec3 camPos(){ return vec3(0.0, 2.4, 0.0); }
vec3 camTarget(){ return vec3(1.0, 2.4 + 60.0 * 0.03, 60.0); }
float camFocal(){ return 2.0; }
vec3 sunDir(){ return normalize(vec3(-0.40, 0.19, 0.90)); }
`,
  terrain: /* glsl */ `
float terrainH(vec2 p, int oct){
  float h = (fbm(p * 0.012, 4) - 0.5) * 3.2;
  h += (fbm(p * 0.05 + 3.0, 3) - 0.5) * 0.7;
  // low tawny hills, then the far escarpment that rises on the right
  float far = smoothstep(400.0, 2200.0, length(p));
  float hills = pow(fbm(p * 0.0016 + 7.0, 4), 1.6) * 90.0;
  vec2 q = p * 0.00075;
  float rg = pow(ridge(q + vec2(5.0, 1.0), 5), 1.5) * 640.0;
  float mask = smoothstep(-0.2, 0.9, p.x * 0.00032 + 0.35) * smoothstep(1700.0, 3600.0, p.y);
  h += far * (hills + rg * mask);
  if (oct >= 6) h += (vnoise(p * 6.0) - 0.5) * 0.08 + (vnoise(p * 22.0) - 0.5) * 0.03;
  return h;
}
`,
  look:
    SKY_LIB +
    PROJECT_LIB +
    /* glsl */ `
float HM(vec2 p);

vec3 skyGrad(vec3 rd){
  vec3 sd = sunDir();
  float h = max(rd.y, 0.0);
  float s = max(dot(rd, sd), 0.0);
  vec3 hor = vec3(0.60, 0.16, 0.055);
  vec3 mid = vec3(0.42, 0.095, 0.07);
  vec3 up = vec3(0.26, 0.058, 0.066);
  vec3 top = vec3(0.07, 0.03, 0.065);
  vec3 c = mix(hor, mid, smoothstep(0.0, 0.16, h));
  c = mix(c, up, smoothstep(0.08, 0.5, h));
  c = mix(c, top, smoothstep(0.38, 1.0, h));
  c += vec3(1.0, 0.36, 0.16) * pow(s, 4.0) * 0.22 + vec3(1.0, 0.52, 0.30) * pow(s, 36.0) * 0.38;
  return c;
}

vec3 skyColor(vec3 rd){
  vec3 sd = sunDir();
  float s = max(dot(rd, sd), 0.0);
  vec3 c = skyGrad(rd);
  vec2 wind = vec2(2.3, 5.1);
  vec3 lit = mix(vec3(0.40, 0.10, 0.09), vec3(0.85, 0.28, 0.14), pow(s, 0.65));
  vec3 shade = mix(vec3(0.055, 0.03, 0.06), vec3(0.26, 0.07, 0.07), pow(s, 0.5));
  vec4 cl = cloudDeck(rd, sd, 0.85, 0.40, lit, shade, wind);
  // a second, higher and thinner veil
  float ci = cirrus(rd, 1.4, vec2(0.96, 0.28), 0.5);
  c = mix(c, lit * 0.8, ci * 0.3);
  c = mix(c, cl.rgb, cl.a);
  float mu = dot(rd, sd);
  c += vec3(1.0, 0.62, 0.36) * smoothstep(0.99955, 0.99990, mu) * 1.6 * (1.0 - cl.a * 0.97);
  return c;
}

vec3 fogColor(vec3 rd, float t){
  float s = max(dot(rd, sunDir()), 0.0);
  // far haze is bright and golden toward the sun and a cool dusky grey-violet away from it
  vec3 away = vec3(0.085, 0.07, 0.09);
  vec3 toward = vec3(0.56, 0.135, 0.05);
  return mix(away, toward, pow(s, 3.2)) + vec3(1.0, 0.45, 0.2) * pow(s, 14.0) * 0.18;
}

vec3 grassAlbedo(vec3 p, vec3 n, float t){
  float broad = fbm(p.xz * 0.02, 4);
  float mid = fbm(p.xz * 0.35, 3);
  float fine = vnoise(p.xz * 3.2) * 0.6 + vnoise(p.xz * 11.0) * 0.4;
  vec3 dry = vec3(0.26, 0.19, 0.08);
  vec3 straw = vec3(0.38, 0.29, 0.12);
  vec3 green = vec3(0.14, 0.17, 0.06);
  vec3 c = mix(dry, straw, smoothstep(0.3, 0.7, broad));
  c = mix(c, green, smoothstep(0.55, 0.8, fbm(p.xz * 0.008 + 3.0, 3)) * 0.65);
  c *= 0.72 + 0.5 * fine;
  c *= 0.85 + 0.3 * mid;
  // bare red earth underfoot
  float soil = smoothstep(30.0, 6.0, t) * smoothstep(0.30, 0.62, fbm(p.xz * 0.14 + 11.0, 3));
  c = mix(c, vec3(0.22, 0.085, 0.045) * (0.7 + 0.6 * fine), soil);
  return c;
}

vec3 shadeTerrain(vec3 p, vec3 n, vec3 rd, float t, float sh, float ao){
  vec3 alb = grassAlbedo(p, n, t);
  vec3 sd = sunDir();
  float dm = 1.0 / (1.0 + t * 0.02);
  vec2 g = p.xz * 3.0;
  n = normalize(n + vec3(vnoise(g) - 0.5, 0.0, vnoise(g + 7.0) - 0.5) * 0.2 * dm);
  // grass blades stand up: wrap the light around so a grazing sun still reaches them
  float dif = clamp((dot(n, sd) + 0.34) / 1.34, 0.0, 1.0) * mix(0.55, 1.0, sh);
  vec3 sunC = vec3(1.0, 0.64, 0.30) * 0.28;
  vec3 skyC = vec3(0.30, 0.27, 0.24) * 0.085;
  float back = pow(max(dot(rd, sd), 0.0), 3.0);
  vec3 lit = sunC * dif + skyC * (0.5 + 0.5 * n.y) * ao;
  vec3 col = alb * lit;
  // backlit blade tips glow
  col += alb * vec3(1.0, 0.50, 0.22) * back * 0.16 * (0.35 + 0.65 * sh);
  col *= mix(0.45, 1.0, smoothstep(4.0, 80.0, t));
  return col;
}

float treeSDF(vec2 l){
  float d = sdSeg(l, vec2(0.0, 0.0), vec2(-0.28, 1.9), 0.36, 0.27);
  d = min(d, sdSeg(l, vec2(-0.28, 1.9), vec2(0.5, 3.6), 0.27, 0.2));
  d = min(d, sdSeg(l, vec2(0.5, 3.6), vec2(1.3, 5.2), 0.2, 0.12));
  d = min(d, sdSeg(l, vec2(0.5, 3.6), vec2(-1.7, 5.0), 0.16, 0.07));
  d = min(d, sdSeg(l, vec2(1.3, 5.2), vec2(3.8, 6.2), 0.1, 0.05));
  d = min(d, sdSeg(l, vec2(1.0, 4.7), vec2(2.8, 4.3), 0.08, 0.04));
  d = min(d, sdSeg(l, vec2(-1.7, 5.0), vec2(-3.6, 5.9), 0.08, 0.04));
  d = min(d, sdSeg(l, vec2(0.2, 3.0), vec2(-0.2, 5.6), 0.05, 0.03));
  // flat, layered umbrella of leaf clumps
  vec2 q = l * vec2(1.0, 1.9);
  float c1 = length((q - vec2(-3.4, 11.4)) / vec2(2.9, 1.0)) - 1.0;
  float c2 = length((q - vec2(-0.7, 12.4)) / vec2(3.3, 1.1)) - 1.0;
  float c3 = length((q - vec2(2.1, 12.5)) / vec2(3.2, 1.05)) - 1.0;
  float c4 = length((q - vec2(4.3, 11.8)) / vec2(2.5, 0.9)) - 1.0;
  float c5 = length((q - vec2(0.9, 13.5)) / vec2(2.6, 0.8)) - 1.0;
  float c6 = length((q - vec2(-2.0, 13.0)) / vec2(2.2, 0.8)) - 1.0;
  float leaf = smin(smin(smin(c1, c2, 0.5), smin(c3, c4, 0.5), 0.5), smin(c5, c6, 0.5), 0.5);
  leaf = leaf * 0.9 + 0.16 * (vnoise(l * 2.6) - 0.5) + 0.10 * (vnoise(l * 7.5) - 0.5) + 0.05 * (vnoise(l * 19.0) - 0.5);
  return min(d, leaf);
}

vec3 drawTree(vec3 col, vec2 q, vec3 base, float scale, inout float par){
  vec3 pr = projectPoint(base);
  float k = camFocal() / pr.z * scale;
  vec2 l = (q - pr.xy) / k;
  if (l.x < -8.5 || l.x > 8.5 || l.y < -0.5 || l.y > 10.8) return col;
  float px = 1.0 / (uRes.y * 0.5) / k * 0.9;
  float d = treeSDF(l);
  float a = 1.0 - smoothstep(-px, px, d);
  if (a <= 0.0) return col;
  // rim light where the tree faces the low sun
  vec2 toSun = normalize(vec2(-0.45, 0.35));
  float d2 = treeSDF(l + toSun * 0.2);
  float rim = smoothstep(-0.02, 0.2, d2);
  vec3 tc = vec3(0.020, 0.013, 0.016) + vec3(1.0, 0.50, 0.20) * rim * 0.75;
  par = mix(par, 1.0 / (1.0 + pr.z * 0.045), a);
  return mix(col, tc, a);
}

vec3 overlay(vec3 col, vec2 q, vec3 ro, vec3 rd, float t, bool hit, inout float par){
  col = drawTree(col, q, vec3(2.6, HM(vec2(2.6, 27.0)), 27.0), 1.0, par);
  col = drawTree(col, q, vec3(-70.0, HM(vec2(-70.0, 210.0)), 210.0), 0.9, par);
  col = drawTree(col, q, vec3(120.0, HM(vec2(120.0, 330.0)), 330.0), 1.1, par);
  col = drawTree(col, q, vec3(-190.0, HM(vec2(-190.0, 460.0)), 460.0), 1.0, par);
  return col;
}

vec3 grade(vec3 col, vec2 q){
  col *= 0.95;
  float l = luma(col);
  col = mix(vec3(l), col, 1.05);
  col += vec3(0.012, 0.004, 0.012) * (1.0 - smoothstep(0.0, 0.4, l));
  return col;
}
`,
};
