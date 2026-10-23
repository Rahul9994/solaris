export const COMP_VERT = /* glsl */ `
void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

/**
 * The only thing drawn to the screen. Layers, bottom to top:
 *   1. the current planet's baked "photograph" (depth parallax), cross-fading to the next one on arrival
 *   2. the squircle portal card (a rounded-box SDF) showing the live orbit view; the same card morphs to
 *      full-screen and dives through the cloud deck
 *   3. cloud haze, dust motes, bottom shade, vignette, film grain, reveal fade
 */
export const COMP_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tA;
uniform sampler2D tB;
uniform sampler2D tOrbit;
uniform sampler2D tNoise;
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
uniform float uCardAlpha;
uniform float uHover;
uniform float uDive;
uniform float uFog;
uniform float uFogT;
uniform vec3 uHaze;
uniform float uHazeAmt;
uniform vec2 uFocus;
uniform float uShade;
uniform float uReveal;
uniform float uGrain;
uniform vec4 uMotes;      // rgb colour, amount
uniform float uExplore;
uniform vec3 uTint;

#define PI 3.14159265359
const float IMG_ASPECT = 1.7777778;

float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 x){
  vec2 i = floor(x);
  vec2 f = fract(x);
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return textureLod(tNoise, (i + f + 0.5) * (1.0 / 256.0), 0.0).x;
}

/** viewport uv -> baked-image uv, cover-fit with an extra zoom about the centre */
vec2 coverUV(vec2 uv, float zoom, vec2 about){
  float va = uRes.x / uRes.y;
  vec2 s = va > IMG_ASPECT ? vec2(1.0, IMG_ASPECT / va) : vec2(va / IMG_ASPECT, 1.0);
  return (uv - about) * s / zoom + about;
}

vec3 tapParallax(sampler2D t, vec2 uv, float zoom, vec2 about){
  vec2 iu = coverUV(uv, zoom, about);
  vec2 off = uPar * vec2(0.014, 0.010);
  float d0 = textureLod(t, iu, 0.0).a;
  vec2 u1 = iu - off * (d0 - 0.18);
  float d1 = textureLod(t, u1, 0.0).a;
  vec2 u2 = iu - off * (d1 - 0.18);
  return textureLod(t, clamp(u2, 0.001, 0.999), 0.0).rgb;
}

vec3 tapRadial(sampler2D t, vec2 uv, float zoom, float blur){
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 9; i++){
    float s = float(i) / 8.0;
    vec2 q = uFocus + (uv - uFocus) * (1.0 - blur * s);
    acc += textureLod(t, clamp(coverUV(q, zoom, uFocus), 0.001, 0.999), 0.0).rgb;
  }
  return acc / 9.0;
}

float sdSquircle(vec2 p, vec2 b, float r){
  vec2 q = abs(p) - b + r;
  vec2 m = max(q, 0.0);
  float corner = pow(pow(m.x, 3.0) + pow(m.y, 3.0), 1.0 / 3.0);
  return min(max(q.x, q.y), 0.0) + corner - r;
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

vec3 hazeOver(vec3 base, vec2 uv, float amount){
  if (amount <= 0.001) return base;
  vec2 p = (uv - uFocus) * vec2(uRes.x / uRes.y, 1.0);
  float cf = cloudField(p, uFogT);
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

  // 2. portal card
  vec2 cp = frag - uCard.xy;
  float d = sdSquircle(cp, uCard.zw, uCardR);
  float inside = 1.0 - smoothstep(-0.75, 0.75, d);
  float shadow = exp(-max(d, 0.0) / (26.0 + uCard.w * 0.08)) * 0.38 * (1.0 - inside);
  col *= 1.0 - shadow * uCardAlpha;
  if (inside > 0.001 && uCardAlpha > 0.001){
    float s = max(uCard.z * 2.0 / uRes.x, uCard.w * 2.0 / uRes.y);
    float hz = 1.0 + 0.07 * uHover;
    vec2 ouv = 0.5 + (cp + vec2(uPar.x * -6.0 * (1.0 - uExplore), uPar.y * -4.0 * (1.0 - uExplore))) / (uRes * s * hz);
    vec3 o;
    if (uDive > 0.002){
      float z = 1.0 + 3.2 * uDive * uDive * uDive;
      vec2 q = uFocus + (ouv - uFocus) / z;
      float blur = smoothstep(0.1, 1.0, uDive) * 0.42;
      vec3 acc = vec3(0.0);
      for (int i = 0; i < 10; i++){
        float k = float(i) / 9.0;
        acc += textureLod(tOrbit, clamp(uFocus + (q - uFocus) * (1.0 - blur * k), 0.001, 0.999), 0.0).rgb;
      }
      o = acc / 10.0;
    } else {
      o = textureLod(tOrbit, clamp(ouv, 0.001, 0.999), 0.0).rgb;
    }
    // soft inner falloff + hairline highlight so the card reads as glass over the photograph
    float rim = smoothstep(2.2, 0.0, abs(d + 1.0)) * 0.22 * (1.0 - uExplore);
    o *= 1.0 - 0.28 * smoothstep(-70.0, 0.0, d) * (1.0 - uExplore);
    o += rim;
    col = mix(col, o, inside * uCardAlpha);
  }

  // 3. fog through clouds (dive + arrival), dust motes, shade, vignette, grain
  col = hazeOver(col, uv, uFog);

  if (uMotes.w > 0.001){
    float m = 0.0;
    for (int L = 0; L < 3; L++){
      float fl = float(L);
      float sc = 26.0 + fl * 22.0;
      vec2 g = uv * vec2(uRes.x / uRes.y, 1.0) * sc;
      g += vec2(uTime * (0.05 + fl * 0.03), uTime * (0.02 + fl * 0.015)) * sc * 0.08 + uPar * (0.4 + fl * 0.3);
      vec2 id = floor(g);
      vec2 f = fract(g) - 0.5;
      float h = hash12(id + fl * 31.0);
      if (h > 0.62){
        vec2 j = vec2(hash12(id + 3.1), hash12(id + 8.7)) - 0.5;
        vec2 w = 0.18 * vec2(sin(uTime * (0.3 + h) + h * 40.0), cos(uTime * (0.25 + h) + h * 25.0));
        float dd = length(f - j * 0.6 - w);
        m += smoothstep(0.05 + 0.02 * fl, 0.0, dd) * (0.35 + 0.65 * hash12(id + 5.5)) * (1.0 - 0.25 * fl);
      }
    }
    col += uMotes.rgb * m * uMotes.w * (1.0 - uExplore);
  }

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
