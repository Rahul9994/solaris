/**
 * GLSL for the procedural "photographs" each planet page is built on.
 *
 * A scene is a heightfield + sky + shading functions. Baking happens in two GPU passes:
 *   1. HEIGHT — the scene's terrain function is evaluated once per texel of a log-polar height map around the
 *      camera (angle × log-distance, so texel size ≈ screen-pixel size at every range);
 *   2. COLOUR — rays are marched against that cached map (one bilinear fetch per step instead of dozens of
 *      noise lookups), shaded, fogged and tone-mapped. RGB = colour, A = parallax depth.
 *
 * Noise comes from a 256² random texture (value noise via hardware bilinear + quintic remap): several times
 * cheaper than ALU hashing on integrated GPUs.
 */

export const SURFACE_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export const LIB = /* glsl */ `
precision highp float;
precision highp int;
uniform sampler2D tNoise;
uniform vec2 uRes;
uniform float uSeed;
uniform float uDebug;
varying vec2 vUv;

#define PI 3.14159265359
#define TAU 6.28318530718
const mat2 ROT = mat2(0.8, 0.6, -0.6, 0.8);

float sat(float x){ return clamp(x, 0.0, 1.0); }
vec3 sat3(vec3 x){ return clamp(x, 0.0, 1.0); }
float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float remap(float x, float a, float b){ return clamp((x - a) / (b - a), 0.0, 1.0); }

float hash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float hash13(vec3 p3){ p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }

#ifdef PRECISE_NOISE
/* exact interpolation in float precision (the height pass: steep terrain amplifies the ~8-bit weights of hardware filtering) */
ivec2 wrapi(ivec2 p){ return p & 255; }
float vnoise(vec2 x){
  vec2 i = floor(x);
  vec2 f = fract(x);
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  ivec2 ii = ivec2(i);
  float a = texelFetch(tNoise, wrapi(ii), 0).x;
  float b = texelFetch(tNoise, wrapi(ii + ivec2(1, 0)), 0).x;
  float c = texelFetch(tNoise, wrapi(ii + ivec2(0, 1)), 0).x;
  float d = texelFetch(tNoise, wrapi(ii + ivec2(1, 1)), 0).x;
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float vnoise(vec3 x){
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  ivec2 ii = ivec2(i.xy) + ivec2(37, 17) * int(i.z);
  vec2 a = texelFetch(tNoise, wrapi(ii), 0).xy;
  vec2 b = texelFetch(tNoise, wrapi(ii + ivec2(1, 0)), 0).xy;
  vec2 c = texelFetch(tNoise, wrapi(ii + ivec2(0, 1)), 0).xy;
  vec2 d = texelFetch(tNoise, wrapi(ii + ivec2(1, 1)), 0).xy;
  vec2 rg = mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  return mix(rg.x, rg.y, f.z);
}
#else
float vnoise(vec2 x){
  vec2 i = floor(x);
  vec2 f = fract(x);
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return textureLod(tNoise, (i + f + 0.5) * (1.0 / 256.0), 0.0).x;
}
float vnoise(vec3 x){
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  vec2 uv = i.xy + vec2(37.0, 17.0) * i.z + f.xy;
  vec2 rg = textureLod(tNoise, (uv + 0.5) * (1.0 / 256.0), 0.0).xy;
  return mix(rg.x, rg.y, f.z);
}
#endif

/** fractal noise, range ~0..1 with mean 0.5 regardless of octave count */
float fbm(vec2 p, int oct){
  float a = 0.5, s = 0.0, n = 0.0;
  for (int i = 0; i < 9; i++){
    if (i >= oct) break;
    s += a * vnoise(p);
    n += a;
    p = ROT * p * 2.02 + vec2(13.7, 4.1);
    a *= 0.5;
  }
  return s / n;
}
float fbm3(vec3 p, int oct){
  float a = 0.5, s = 0.0, n = 0.0;
  for (int i = 0; i < 7; i++){
    if (i >= oct) break;
    s += a * vnoise(p);
    n += a;
    p = p * 2.03 + vec3(11.3, 3.7, 7.1);
    a *= 0.5;
  }
  return s / n;
}
/** ridged multifractal, 0..1 */
float ridge(vec2 p, int oct){
  float a = 0.5, s = 0.0, n = 0.0;
  for (int i = 0; i < 8; i++){
    if (i >= oct) break;
    float v = 1.0 - abs(2.0 * vnoise(p) - 1.0);
    s += a * v * v;
    n += a;
    p = ROT * p * 2.04 + vec2(7.3, 19.1);
    a *= 0.5;
  }
  return s / n;
}

/** flat steps with short risers: k = steps per unit, s = riser fraction */
float terrace(float x, float k, float s){
  float y = x * k;
  float i = floor(y);
  float f = fract(y);
  return (i + smoothstep(1.0 - s, 1.0, f)) / k;
}

float smax(float a, float b, float k){ float h = max(k - abs(a - b), 0.0) / k; return max(a, b) + h * h * k * 0.25; }
float smin(float a, float b, float k){ float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }

/** sparse round stars on a direction grid; returns brightness */
float stars(vec3 rd, float scale, float density, float size){
  vec3 g = rd * scale;
  vec3 id = floor(g);
  vec3 f = fract(g) - 0.5;
  float r = hash13(id + uSeed);
  if (r > density) return 0.0;
  vec3 j = vec3(hash13(id + 3.1), hash13(id + 7.7), hash13(id + 11.3)) - 0.5;
  float d = length(f - j * 0.6);
  float b = 0.35 + 0.65 * hash13(id + 19.9);
  return smoothstep(size, 0.0, d) * b;
}

vec3 filmic(vec3 x){
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

int octAt(float r, float lodk){ return int(clamp(8.6 - log2(1.0 + r * lodk), 3.0, 8.0)); }
`;

/** Pass 1: bake terrainH into the log-polar height map. Scene provides terrainH and LODK. */
export const HEIGHT_MAIN = /* glsl */ `
uniform vec2 uPole;
uniform vec4 uHMap; // x heading, y half-angle, z log r0, w log r1
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float a = (uv.x - 0.5) * 2.0 * uHMap.y;
  float r = exp(mix(uHMap.z, uHMap.w, uv.y));
  float ang = uHMap.x + a;
  vec2 p = uPole + r * vec2(sin(ang), cos(ang));
  gl_FragColor = vec4(terrainH(p, octAt(r, LODK)), 0.0, 0.0, 1.0);
}
`;

/**
 * Pass 2 engine: expects the scene to provide
 *   vec3 camPos(); vec3 camTarget(); float camFocal(); vec3 sunDir();  const float HMAX, TMAX, TMIN, FOGK;
 *   vec3 skyColor(vec3 rd);  vec3 fogColor(vec3 rd, float t);
 *   vec3 shadeTerrain(vec3 p, vec3 n, vec3 rd, float t, float sh, float ao);
 *   vec3 overlay(vec3 col, vec2 q, vec3 ro, vec3 rd, float t, bool hit, inout float par);
 *   vec3 grade(vec3 col, vec2 q);
 */
export const ENGINE = /* glsl */ `
uniform sampler2D tHeight;
uniform vec2 uPole;
uniform vec4 uHMap;
uniform vec2 uHMSize;

/** cached terrain height at world xz; far outside the baked wedge there is "nothing" */
float HM(vec2 p){
  vec2 d = p - uPole;
  float r = length(d);
  float a = atan(d.x, d.y) - uHMap.x;
  a -= TAU * floor((a + PI) / TAU);
  float u = a / (2.0 * uHMap.y) + 0.5;
  float v = (log(max(r, 1e-3)) - uHMap.z) / (uHMap.w - uHMap.z);
  if (u < 0.0 || u > 1.0 || v > 1.0) return -200.0;
  return textureLod(tHeight, vec2(u, max(v, 0.0)), 0.0).x;
}

/** smooth (C1) height lookup for normals: cubic B-spline from four bilinear taps */
float HMs(vec2 p){
  vec2 d = p - uPole;
  float r = length(d);
  float a = atan(d.x, d.y) - uHMap.x;
  a -= TAU * floor((a + PI) / TAU);
  float u = a / (2.0 * uHMap.y) + 0.5;
  float v = (log(max(r, 1e-3)) - uHMap.z) / (uHMap.w - uHMap.z);
  if (u < 0.0 || u > 1.0 || v > 1.0) return -200.0;
  vec2 st = vec2(u, max(v, 0.0)) * uHMSize - 0.5;
  vec2 i = floor(st);
  vec2 f = st - i;
  vec2 w0 = (1.0 - f) * (1.0 - f) * (1.0 - f) / 6.0;
  vec2 w1 = (3.0 * f * f * f - 6.0 * f * f + 4.0) / 6.0;
  vec2 w2 = (-3.0 * f * f * f + 3.0 * f * f + 3.0 * f + 1.0) / 6.0;
  vec2 w3 = f * f * f / 6.0;
  vec2 g0 = w0 + w1;
  vec2 g1 = w2 + w3;
  vec2 h0 = (i - 1.0 + w1 / g0 + 0.5) / uHMSize;
  vec2 h1 = (i + 1.0 + w3 / g1 + 0.5) / uHMSize;
  float a00 = textureLod(tHeight, vec2(h0.x, h0.y), 0.0).x;
  float a10 = textureLod(tHeight, vec2(h1.x, h0.y), 0.0).x;
  float a01 = textureLod(tHeight, vec2(h0.x, h1.y), 0.0).x;
  float a11 = textureLod(tHeight, vec2(h1.x, h1.y), 0.0).x;
  return g0.y * (g0.x * a00 + g1.x * a10) + g1.y * (g0.x * a01 + g1.x * a11);
}

float march(vec3 ro, vec3 rd, out bool hit){
  float t = TMIN;
  float tp = t;
  hit = false;
  for (int i = 0; i < 300; i++){
    vec3 p = ro + rd * t;
    if (p.y > HMAX && rd.y >= 0.0) break;
    if (t > TMAX) break;
    float d = p.y - HM(p.xz);
    if (d < 0.0){ hit = true; break; }
    tp = t;
    t += max(d * STEPK, 0.006 * t + 0.02);
  }
  if (hit){
    float a = tp, b = t;
    for (int k = 0; k < 6; k++){
      float m = 0.5 * (a + b);
      vec3 p = ro + rd * m;
      if (p.y - HM(p.xz) < 0.0) b = m; else a = m;
    }
    t = 0.5 * (a + b);
  }
  return t;
}

vec3 terrainN(vec3 p, float t){
  float e = max(NORMK * t, NORMK * 8.0);
  float hx = HMs(p.xz + vec2(e, 0.0)) - HMs(p.xz - vec2(e, 0.0));
  float hz = HMs(p.xz + vec2(0.0, e)) - HMs(p.xz - vec2(0.0, e));
  return normalize(vec3(-hx, 2.0 * e, -hz));
}

float terrainShadow(vec3 p, vec3 ld, float t){
  float res = 1.0;
  float s = 0.1 + 0.002 * t;
  for (int i = 0; i < 40; i++){
    vec3 q = p + ld * s;
    if (q.y > HMAX) break;
    float h = q.y - HM(q.xz);
    res = min(res, SOFTK * h / s);
    if (res < 0.004) break;
    s += clamp(h * 0.9, 0.06 + 0.012 * s, 9.0 + s * 0.06);
  }
  res = clamp(res, 0.0, 1.0);
  return res * res * (3.0 - 2.0 * res);
}

float terrainAO(vec3 p, float t){
  float r1 = 0.25 + 0.004 * t;
  float r2 = r1 * 4.0;
  float h0 = p.y;
  float a1 = 0.25 * (HM(p.xz + vec2(r1, 0.0)) + HM(p.xz - vec2(r1, 0.0)) + HM(p.xz + vec2(0.0, r1)) + HM(p.xz - vec2(0.0, r1)));
  float a2 = 0.25 * (HM(p.xz + vec2(r2, 0.0)) + HM(p.xz - vec2(r2, 0.0)) + HM(p.xz + vec2(0.0, r2)) + HM(p.xz - vec2(0.0, r2)));
  float o = clamp((a1 - h0) / r1, 0.0, 1.0) * 0.55 + clamp((a2 - h0) / r2, 0.0, 1.0) * 0.45;
  return clamp(1.0 - o * 0.85, 0.0, 1.0);
}

vec3 renderScene(vec3 ro, vec3 rd, vec2 q, out float par){
  bool hit;
  float t = march(ro, rd, hit);
  vec3 col;
  if (hit){
    vec3 p = ro + rd * t;
    vec3 n = terrainN(p, t);
    float sh = terrainShadow(p + n * 0.03 + vec3(0.0, 0.02, 0.0), sunDir(), t);
    float ao = terrainAO(p, t);
    if (uDebug > 0.5){
      par = 0.5;
      if (uDebug < 1.5) return vec3(sh);
      if (uDebug < 2.5) return vec3(ao);
      if (uDebug < 3.5) return n * 0.5 + 0.5;
      if (uDebug < 4.5) return pow(shadeTerrain(p, n, rd, t, 1.0, 1.0), vec3(0.45));
      if (uDebug < 5.5) return vec3(fract(t / 100.0));
      return vec3(fract(p.y * 1.5));
    }
    col = shadeTerrain(p, n, rd, t, sh, ao);
    col = mix(col, fogColor(rd, t), 1.0 - exp(-t * FOGK));
    par = 1.0 / (1.0 + t * 0.045);
  } else {
    col = skyColor(rd);
    par = 0.0;
  }
  col = overlay(col, q, ro, rd, t, hit, par);
  return col;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 q = (uv * 2.0 - 1.0) * vec2(uRes.x / uRes.y, 1.0);
  vec3 ro = camPos();
  vec3 ww = normalize(camTarget() - ro);
  vec3 uu = normalize(cross(vec3(0.0, 1.0, 0.0), ww));
  vec3 vv = cross(ww, uu);
  vec3 rd = normalize(q.x * uu + q.y * vv + camFocal() * ww);
  float par;
  vec3 col = renderScene(ro, rd, q, par);
  col = grade(col, q);
  col = filmic(col);
  col = pow(col, vec3(1.0 / 2.2));
  col += (hash12(gl_FragCoord.xy + uSeed) - 0.5) / 255.0 * 1.6;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), clamp(par, 0.0, 1.0));
}
`;

const DEFAULT_DEFS = /* glsl */ `
#ifndef STEPK
#define STEPK 0.5
#endif
#ifndef SOFTK
#define SOFTK 10.0
#endif
#ifndef NORMK
#define NORMK 0.0128
#endif
`;

export interface SceneParts {
  /** scene-specific #defines (STEPK, SOFTK): placed first so they win over the defaults */
  defs?: string;
  /** constants + camera + sun: shared by both passes */
  common: string;
  /** terrainH() and everything it needs: height pass only */
  terrain: string;
  /** sky / shading / grading: colour pass only */
  look: string;
}

export function heightFragment(s: SceneParts): string {
  return `#define PRECISE_NOISE\n${s.defs ?? ''}\n${DEFAULT_DEFS}\n${LIB}\n${s.common}\n${s.terrain}\n${HEIGHT_MAIN}`;
}

export function colorFragment(s: SceneParts): string {
  return `${s.defs ?? ''}\n${DEFAULT_DEFS}\n${LIB}\n${s.common}\n${s.look}\n${ENGINE}`;
}
