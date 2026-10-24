export const COMP_VERT = /* glsl */ `
void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

/**
 * The only thing drawn to the screen. Layers, bottom to top:
 *   1. the current planet's baked "photograph" (depth parallax), cross-fading to the next one on arrival
 *   2. the squircle portal card (a rounded-box SDF) showing the live orbit view; the same card morphs to
 *      full-screen and dives through the cloud deck
 *   3. cloud haze, bottom shade, vignette, film grain, reveal fade (dust motes are point sprites, see motes.ts)
 */
export const COMP_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tA;
uniform sampler2D tB;
uniform sampler2D tOrbit;
uniform sampler2D tCloud;   // the cloud deck, drawn at half resolution (CLOUD_FRAG)
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uPar;
uniform float uMix;
uniform vec2 uZoom;       // x: surface A, y: surface B
uniform float uBlurB;
uniform float uHasA;
uniform float uHasB;
uniform vec4 uCard;       // centre.xy, half-size.xy (px, GL origin)
uniform float uCardR;
uniform float uOpen;      // 0 resting card … 1 full-screen (eased)
uniform float uCardAlpha;
uniform float uHover;
uniform float uDive;
uniform float uFog;
uniform vec3 uHaze;
uniform float uHazeAmt;
uniform vec2 uFocus;
uniform float uShade;
uniform float uReveal;
uniform float uGrain;
uniform float uExplore;
uniform vec3 uTint;

#define PI 3.14159265359
const float IMG_ASPECT = 1.7777778;

float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
/** viewport uv -> baked-image uv, cover-fit with an extra zoom about the centre */
vec2 coverUV(vec2 uv, float zoom, vec2 about){
  float va = uRes.x / uRes.y;
  vec2 s = va > IMG_ASPECT ? vec2(1.0, IMG_ASPECT / va) : vec2(va / IMG_ASPECT, 1.0);
  return (uv - about) * s / zoom + about;
}

vec3 tapParallax(sampler2D t, vec2 uv, float zoom, vec2 about){
  vec2 iu = coverUV(uv, zoom, about);
  vec2 off = uPar * vec2(0.014, 0.010);
  // one depth tap steers the colour tap (a second refinement is below what the eye can see at this offset)
  float d0 = textureLod(t, iu, 0.0).a;
  vec2 u1 = iu - off * (d0 - 0.18);
  return textureLod(t, clamp(u1, 0.001, 0.999), 0.0).rgb;
}

vec3 tapRadial(sampler2D t, vec2 uv, float zoom, float blur){
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 6; i++){
    float s = float(i) / 5.0;
    vec2 q = uFocus + (uv - uFocus) * (1.0 - blur * s);
    acc += textureLod(t, clamp(coverUV(q, zoom, uFocus), 0.001, 0.999), 0.0).rgb;
  }
  return acc / 6.0;
}

float sdSquircle(vec2 p, vec2 b, float r){
  vec2 q = abs(p) - b + r;
  vec2 m = max(q, 0.0);
  float corner = pow(m.x * m.x * m.x + m.y * m.y * m.y, 1.0 / 3.0);
  return min(max(q.x, q.y), 0.0) + corner - r;
}

/** same distance, plus the outward unit normal of the outline (analytic, no extra evaluations) */
float sdSquircleN(vec2 p, vec2 b, float r, out vec2 n){
  vec2 q = abs(p) - b + r;
  vec2 m = max(q, 0.0);
  float c3 = m.x * m.x * m.x + m.y * m.y * m.y;
  float corner = pow(c3, 1.0 / 3.0);
  vec2 g = c3 > 1e-6 ? vec2(m.x * m.x, m.y * m.y) / max(corner * corner, 1e-4) : (q.x > q.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0));
  n = normalize(g + 1e-5) * sign(p + 1e-5);
  return min(max(q.x, q.y), 0.0) + corner - r;
}

vec3 hazeOver(vec3 base, vec2 uv, float amount){
  if (amount <= 0.001) return base;
  float cf = texture2D(tCloud, uv).r;
  float a = clamp(amount * (0.25 + 1.9 * (cf - 0.25)) * uHazeAmt + amount * (1.0 - uHazeAmt) * 0.6, 0.0, 1.0);
  a = mix(a, 1.0, smoothstep(0.82, 1.0, amount));
  vec3 hz = uHaze * (0.62 + 0.55 * cf);
  return mix(base, hz, a);
}

void main(){
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / uRes;
  vec3 col = vec3(0.0);

  // 1. backdrop
  if (uHasA > 0.5) col = tapParallax(tA, uv, uZoom.x, vec2(0.5));
  if (uMix > 0.001 && uHasB > 0.5){
    vec3 b = uBlurB > 0.002 ? tapRadial(tB, uv, uZoom.y, uBlurB) : tapParallax(tB, uv, uZoom.y, vec2(0.5));
    col = mix(col, b, uMix);
  }
  col *= uTint;

  // 2. portal card: a drop of liquid glass over the photograph
  vec2 cp = frag - uCard.xy;
  // beyond ~5 shadow lengths from the card nothing of it is visible: skip the SDF (and its pow/exp) there
  vec2 outer = abs(cp) - uCard.zw;
  float reach = 5.0 * (26.0 + uCard.w * 0.08) + 14.0;
  float d = 1e4;
  float inside = 0.0;
  vec2 nrm = vec2(0.0, 1.0);
  float near = max(outer.x, outer.y);
  if (near < reach) {
    if (near < 14.0) {
      d = sdSquircleN(cp, uCard.zw, uCardR, nrm);
      // the outline is alive: a slow ripple at rest, and it swells toward the pointer on hover
      float alive = (1.0 - uOpen) * (1.0 - uExplore);
      vec2 u0 = cp / (length(cp) + 1.0);
      float wob = (0.7 + 2.2 * uHover) * (sin(u0.x * 4.0 + uTime * 1.15) * sin(u0.y * 3.0 - uTime * 0.85) + 0.5 * sin(u0.x * 7.0 - u0.y * 5.0 + uTime * 1.7));
      vec2 pw = uRes * (0.5 + 0.5 * uPar);
      vec2 pd = (frag - pw) / max(uCard.z * 0.7, 1.0);
      float swell = uHover * 7.0 * exp(-dot(pd, pd));
      d += (wob * 0.9 - swell) * alive;
    } else {
      d = sdSquircle(cp, uCard.zw, uCardR);
    }
    inside = 1.0 - smoothstep(-0.75, 0.75, d);
    float shadow = exp(-max(d, 0.0) / (26.0 + uCard.w * 0.08)) * 0.42 * (1.0 - inside);
    col *= 1.0 - shadow * uCardAlpha;
  }
  if (inside > 0.001 && uCardAlpha > 0.001){
    float s = max(uCard.z * 2.0 / uRes.x, uCard.w * 2.0 / uRes.y);
    float hz = 1.0 + 0.07 * uHover;
    // glass bezel: toward the outline the view bends (and splits into colour fringes), like a thick lens
    float bez = max(min(uCard.z, uCard.w) * 0.2, 8.0);
    float depth = clamp(-d / bez, 0.0, 1.0);
    float bend = pow(1.0 - depth, 3.0) * (1.0 - uOpen);
    vec2 shift = -nrm * bend * bez * 0.4;
    vec2 base = cp + vec2(uPar.x * -6.0 * (1.0 - uExplore), uPar.y * -4.0 * (1.0 - uExplore));
    vec3 o;
    if (uDive > 0.002){
      vec2 ouv = 0.5 + base / (uRes * s * hz);
      float z = 1.0 + 3.2 * uDive * uDive * uDive;
      vec2 q = uFocus + (ouv - uFocus) / z;
      float blur = smoothstep(0.1, 1.0, uDive) * 0.42;
      vec3 acc = vec3(0.0);
      for (int i = 0; i < 7; i++){
        float k = float(i) / 6.0;
        acc += textureLod(tOrbit, clamp(uFocus + (q - uFocus) * (1.0 - blur * k), 0.001, 0.999), 0.0).rgb;
      }
      o = acc / 7.0;
    } else if (bend > 0.01) {
      vec2 ouv = 0.5 + (base + shift) / (uRes * s * hz);
      vec2 ca = nrm * bend * bez * 0.035 / (uRes * s * hz);
      o = vec3(textureLod(tOrbit, clamp(ouv + ca, 0.001, 0.999), 0.0).r,
               textureLod(tOrbit, clamp(ouv, 0.001, 0.999), 0.0).g,
               textureLod(tOrbit, clamp(ouv - ca, 0.001, 0.999), 0.0).b);
    } else {
      vec2 ouv = 0.5 + base / (uRes * s * hz);
      o = textureLod(tOrbit, clamp(ouv, 0.001, 0.999), 0.0).rgb;
    }
    if (uOpen < 0.97) {
      float glass = (1.0 - uOpen) * (1.0 - uExplore);
      // light from the upper left drifts a little with the pointer; the rim catches it, the far rim catches a hint
      vec2 L = normalize(vec2(-0.6 + 0.4 * uPar.x + 0.12 * sin(uTime * 0.35), 0.8 + 0.3 * uPar.y));
      float facing = max(dot(nrm, L), 0.0);
      float back = max(dot(nrm, -L), 0.0);
      float edge = smoothstep(3.2, 0.0, abs(d + 1.4));
      float fres = (1.0 - depth);
      fres *= fres;
      float spec = fres * (pow(facing, 2.5) * 0.55 + pow(back, 3.0) * 0.18);
      float rim = edge * (0.16 + 0.7 * facing + 0.2 * back);
      // faint diagonal sheen across the face
      float sheen = smoothstep(0.55, 0.0, abs(cp.x / uCard.z * 0.62 + cp.y / uCard.w * 0.78 - 0.5 + 0.12 * sin(uTime * 0.3))) * 0.06;
      o *= 1.0 - 0.18 * smoothstep(-60.0, 0.0, d) * (1.0 - fres);
      o += (vec3(0.80, 0.90, 1.0) * (spec + sheen + fres * 0.05) + vec3(1.0, 0.97, 0.94) * rim) * glass;
    }
    col = mix(col, o, inside * uCardAlpha);
  }

  // 3. fog through clouds (dive + arrival), shade, vignette, grain
  col = hazeOver(col, uv, uFog);

  float shade = smoothstep(0.62, 1.0, 1.0 - uv.y) * 0.62 + smoothstep(0.22, 0.0, uv.y) * 0.0;
  col *= 1.0 - shade * uShade * (1.0 - uExplore);
  float vig = smoothstep(1.25, 0.35, length((uv - 0.5) * vec2(1.0, 0.85) * 1.5));
  col *= mix(0.78, 1.0, vig);

  float gr = hash12(frag + fract(uTime) * 91.7) - 0.5;
  col += gr * uGrain;

  col *= uReveal;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

/**
 * The cloud deck on its own, at half resolution. The soft haze doesn't need full-resolution noise, and four
 * layers of three-octave noise per pixel were the most expensive thing in the dive: now a quarter of the
 * pixels pay for it, and the compositor only reads the result.
 */
export const CLOUD_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tNoise;
uniform vec2 uRes;        // full canvas size (for the aspect)
uniform vec2 uSize;       // this target's size
uniform float uFogT;
uniform vec2 uFocus;

#define PI 3.14159265359

float vnoise(vec2 x){
  vec2 i = floor(x);
  vec2 f = fract(x);
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return textureLod(tNoise, (i + f + 0.5) * (1.0 / 256.0), 0.0).x;
}

/** endless fall through a cloud deck: four noise layers zooming outward from the focus */
float cloudField(vec2 p, float t){
  float acc = 0.0, ws = 0.0;
  for (int k = 0; k < 4; k++){
    float ph = fract(t * 0.42 + float(k) * 0.25);
    float sc = exp2(ph * 3.6);
    float w = sin(ph * PI);
    vec2 q = p * sc * 2.2 + float(k) * 17.3;
    float n = 0.55 * vnoise(q) + 0.3 * vnoise(q * 2.1 + 3.0) + 0.15 * vnoise(q * 4.4 + 9.0);
    acc += n * w;
    ws += w;
  }
  return acc / max(ws, 1e-3);
}


void main(){
  vec2 uv = gl_FragCoord.xy / uSize;
  vec2 p = (uv - uFocus) * vec2(uRes.x / uRes.y, 1.0);
  gl_FragColor = vec4(cloudField(p, uFogT), 0.0, 0.0, 1.0);
}
`;
