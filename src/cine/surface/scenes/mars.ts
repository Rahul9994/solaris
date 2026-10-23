import type { SceneSrc } from '../types';

export const MARS: SceneSrc = {
  seed: 4.2,
  hmap: { half: 1.25, r0: 0.4, r1: 3200 },
  defs: `#define STEPK 0.45
#define NORMK 0.0045\n#define SOFTK 9.0`,
  common: /* glsl */ `
const float HMAX = 80.0;
const float TMAX = 3200.0;
const float TMIN = 0.5;
const float LODK = 0.05;
const float FOGK = 0.00062;

vec3 camPos(){ return vec3(0.0, 6.5, 0.0); }
vec3 camTarget(){ return vec3(2.0, -1.0, 60.0); }
float camFocal(){ return 2.05; }
vec3 sunDir(){ return normalize(vec3(-0.80, 0.17, 0.57)); }
`,
  terrain: /* glsl */ `
float rocks(vec2 p){
  float h = 0.0;
  for (int k = 0; k < 3; k++){
    float sc = k == 0 ? 0.085 : (k == 1 ? 0.27 : 0.8);
    vec2 g = p * sc;
    vec2 id = floor(g);
    vec2 f = fract(g);
    float thr = k == 0 ? 0.80 : (k == 1 ? 0.64 : 0.52);
    float present = step(thr, hash12(id + float(k) * 17.0 + 3.0));
    vec2 r = hash22(id + float(k) * 31.0 + uSeed);
    vec2 dd = f - (0.3 + 0.4 * r);
    float ang = hash12(id + 1.7) * TAU;
    dd = mat2(cos(ang), sin(ang), -sin(ang), cos(ang)) * dd;
    dd.y *= 1.0 + 0.7 * hash12(id + 5.5);
    float rad = 0.15 + 0.17 * hash12(id + 3.3);
    float d = pow(pow(abs(dd.x), 3.0) + pow(abs(dd.y), 3.0), 0.3333) / rad;
    d += 0.16 * vnoise(p * (k == 0 ? 1.3 : (k == 1 ? 3.0 : 8.0)));
    float dome = pow(max(1.0 - d * d, 0.0), 0.5);
    float tilt = 1.0 + dot(dd, vec2(0.6, 0.25)) / rad * 0.35;
    h += present * dome * tilt * rad / sc * (0.45 + 0.8 * hash12(id + 9.1));
  }
  return h;
}

float butte(vec2 p, vec2 c, float r, float h, float sd){
  vec2 d = p - c;
  float a = atan(d.y, d.x);
  vec2 ca = vec2(cos(a), sin(a));
  // lumpy outline plus fine vertical fluting from gullies
  float rr = r * (0.72 + 0.55 * vnoise(ca * 1.6 + sd * 7.0)) * (0.92 + 0.16 * vnoise(vec2(a * 3.0, sd)));
  rr *= 1.0 + 0.07 * (vnoise(ca * 5.0 + sd) - 0.5) + 0.025 * (vnoise(ca * 12.0 + sd * 3.0) - 0.5);
  float dist = length(d) / rr;
  float wall = 1.0 - smoothstep(0.78, 1.0, dist);
  // ledges: the wall climbs in a few stepped benches instead of one smooth ramp
  float ledged = mix(wall, terrace(wall, 4.0, 0.7), 0.7);
  // talus apron spreading out from the foot
  float apron = pow(1.0 - smoothstep(0.55, 1.7, dist), 1.6) * 0.20;
  float top = 0.88 + 0.24 * vnoise(p * 0.05 + sd) + 0.08 * vnoise(p * 0.21 + sd * 2.0);
  return h * (ledged * top + apron);
}

float terrainH(vec2 p, int oct){
  vec2 w = vec2(vnoise(p * 0.011), vnoise(p * 0.011 + 5.2)) - 0.5;
  vec2 q = p + w * 45.0;
  float h = (fbm(q * 0.005, 3) - 0.5) * 7.0;
  // shallow dry channels
  float ch = fbm(q * 0.0042 + vec2(9.0, 2.0), 3);
  h -= smoothstep(0.045, 0.0, abs(ch - 0.5)) * 1.6;
  // distant mesa field
  float far = smoothstep(260.0, 700.0, length(p));
  float reg = fbm(q * 0.0026 + vec2(3.1, 8.4), 3);
  float mask = smoothstep(0.505, 0.522, reg) * far;
  float top = 14.0 + 26.0 * fbm(q * 0.008 + 2.0, 3);
  float band = 0.78 + 0.22 * terrace(fbm(q * 0.02 + 1.0, 3), 4.0, 0.2);
  h += mask * top * band;
  // hero buttes: framing cliffs and the big mesa on the right
  h += butte(p, vec2(210.0, 250.0), 90.0, 58.0, 1.0);
  h += butte(p, vec2(-17.0, 21.0), 9.5, 15.0, 2.0);
  h += butte(p, vec2(-150.0, 200.0), 50.0, 30.0, 3.0);
  h += butte(p, vec2(30.0, 520.0), 80.0, 36.0, 4.0);
  h += butte(p, vec2(-260.0, 520.0), 70.0, 26.0, 5.0);
  // wind-rippled dust
  h += 0.30 * (vnoise(vec2(p.x * 0.35 + p.y * 0.08, p.y * 0.9)) - 0.5);
  if (oct >= 5) h += rocks(p) * mix(0.55, 1.0, smoothstep(30.0, 9.0, length(p)));
  h += (fbm(p * 0.45, oct - 2) - 0.5) * 0.9;
  return h;
}
`,
  look: /* glsl */ `
vec3 skyColor(vec3 rd){
  float h = max(rd.y, 0.0);
  vec3 sd = sunDir();
  vec3 horizon = vec3(1.00, 0.58, 0.36);
  vec3 low = vec3(0.66, 0.29, 0.21);
  vec3 mid = vec3(0.24, 0.115, 0.10);
  vec3 top = vec3(0.075, 0.05, 0.05);
  vec3 c = mix(horizon, low, smoothstep(0.0, 0.06, h));
  c = mix(c, mid, smoothstep(0.03, 0.17, h));
  c = mix(c, top, smoothstep(0.09, 0.30, h));
  float s = max(dot(rd, sd), 0.0);
  // the sky dims away from the low sun
  c *= mix(1.0, mix(0.55, 1.0, smoothstep(0.1, 0.85, s)), 1.0 - exp(-h * 40.0));
  c += vec3(1.0, 0.50, 0.28) * pow(s, 3.0) * 0.34 * (1.0 - smoothstep(0.0, 0.4, h));
  c += vec3(1.0, 0.62, 0.38) * pow(s, 20.0) * 0.5;
  c += vec3(1.0, 0.85, 0.6) * pow(s, 260.0) * 4.0;
  c = mix(c, vec3(0.92, 0.48, 0.30) * 0.8, exp(-h * 30.0) * 0.4);
  float st = stars(rd, 210.0, 0.16, 0.17) * smoothstep(0.1, 0.3, h);
  c += vec3(0.9, 0.85, 0.8) * st * 1.4;
  return c;
}

vec3 fogColor(vec3 rd, float t){
  vec3 d = normalize(vec3(rd.x, 0.012 + rd.y * 0.1, rd.z));
  vec3 c = skyColor(d) * 0.9;
  float s = max(dot(rd, sunDir()), 0.0);
  return c + vec3(1.0, 0.5, 0.3) * pow(s, 6.0) * 0.2;
}

vec3 marsAlbedo(vec3 p, vec3 n, float t){
  float broad = fbm(p.xz * 0.012, 4);
  float mid = fbm(p.xz * 0.11, 4);
  float fine = vnoise(p.xz * 2.1) * 0.6 + vnoise(p.xz * 7.3) * 0.4;
  vec3 dust = vec3(0.44, 0.185, 0.13);
  vec3 sand = vec3(0.58, 0.265, 0.19);
  vec3 dark = vec3(0.11, 0.065, 0.065);
  vec3 rock = vec3(0.24, 0.12, 0.095);
  vec3 c = mix(dust, sand, smoothstep(0.35, 0.7, broad));
  c = mix(c, dark, smoothstep(0.56, 0.78, fbm(p.xz * 0.02 + 5.0, 3)) * 0.6);
  float tr = fbm(p.xz * 0.006 + vec2(2.0, 9.0), 3);
  float track = smoothstep(0.02, 0.0, abs(tr - 0.5));
  c = mix(c, vec3(0.80, 0.42, 0.24), track * 0.5);
  float slope = 1.0 - n.y;
  float strata = 0.7 + 0.5 * vnoise(vec2(p.y * 1.7, 3.0)) + 0.25 * vnoise(vec2(p.y * 6.0, 11.0));
  vec3 rk = rock * strata * (0.8 + 0.6 * mid);
  float rockMask = smoothstep(0.14, 0.40, slope + (mid - 0.5) * 0.15);
  c = mix(c, rk, rockMask);
  c *= 0.78 + 0.44 * fine;
  c *= 0.85 + 0.3 * mid;
  return c;
}

vec3 shadeTerrain(vec3 p, vec3 n, vec3 rd, float t, float sh, float ao){
  vec3 alb = marsAlbedo(p, n, t);
  // fine-grain relief the height map is too coarse to carry
  float dm = 1.0 / (1.0 + t * 0.012);
  vec2 g = p.xz * 2.6;
  vec3 dn = vec3(vnoise(g) - vnoise(g + vec2(7.3, 1.1)), 0.0, vnoise(g + vec2(3.1, 9.2)) - vnoise(g + vec2(1.3, 4.4)));
  vec2 g2 = p.xz * 9.0;
  dn += 0.45 * vec3(vnoise(g2) - 0.5, 0.0, vnoise(g2 + 5.0) - 0.5);
  n = normalize(n + dn * 0.55 * dm);
  vec3 sd = sunDir();
  float dif = max(dot(n, sd), 0.0) * sh;
  vec3 sunC = vec3(1.0, 0.60, 0.42) * 2.7;
  vec3 skyC = vec3(0.55, 0.33, 0.30) * 0.85;
  float sky = 0.45 + 0.55 * n.y;
  vec3 bounce = vec3(0.45, 0.2, 0.11) * 0.34 * (0.55 - 0.45 * n.y);
  vec3 lit = sunC * dif + (skyC * sky + bounce) * ao;
  float back = pow(max(dot(rd, sd), 0.0), 3.0) * 0.22;
  return alb * lit + alb * vec3(1.0, 0.45, 0.22) * back * ao;
}

vec3 overlay(vec3 col, vec2 q, vec3 ro, vec3 rd, float t, bool hit, inout float par){ return col; }

vec3 grade(vec3 col, vec2 q){
  col *= 0.92;
  float l = luma(col);
  col = mix(vec3(l), col, 1.0);
  // a veil of fine pink dust in everything
  col = mix(col, vec3(0.30, 0.17, 0.155), 0.12);
  col += vec3(0.018, 0.006, 0.012) * (1.0 - smoothstep(0.0, 0.5, l));
  return col;
}
`,
};

