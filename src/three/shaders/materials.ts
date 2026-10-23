import { NOISE, SPHERE } from './noise';

const OUT = /* glsl */ `
#include <tonemapping_fragment>
#include <colorspace_fragment>
`;

export const PLANET_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vObjN;
varying vec3 vWorldPos;
varying vec3 vWorldN;
void main(){
  vUv = uv;
  vObjN = normalize(position);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vWorldN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const PLANET_FRAG = /* glsl */ `
uniform mat4 modelMatrix;
uniform sampler2D uMap;
uniform sampler2D uExtra;
uniform sampler2D uRing;
uniform vec3 uSunPos;
uniform vec3 uSunColor;
uniform float uTime;
uniform vec2 uTexel;
uniform float uBump;
uniform vec3 uAtmo;
uniform float uRim;
uniform float uAmbient;
uniform float uSpec;
uniform float uNight;
uniform float uFlow;
uniform float uGas;
uniform float uCloudShift;
uniform float uHasExtra;
uniform float uRingOn;
uniform vec3 uRingNormal;
uniform vec3 uCenter;
uniform vec2 uRingRange;
uniform float uRadius;
uniform float uHighlight;
uniform vec3 uHighlightColor;
varying vec2 vUv;
varying vec3 vObjN;
varying vec3 vWorldPos;
varying vec3 vWorldN;

vec3 dec(vec3 c){ return pow(c, vec3(2.2)); }

void main(){
  vec2 uv = vUv;
  if (uFlow > 0.0) {
    float band = sin(uv.y * 3.14159 * 9.0) * 0.6 + sin(uv.y * 3.14159 * 23.0 + 1.0) * 0.4;
    uv.x += uFlow * band * 0.012 * sin(uTime * 0.05 + uv.y * 4.0);
  }
  vec4 tex = texture2D(uMap, uv);
  vec3 albedo = dec(tex.rgb);

  vec3 n = normalize(vObjN);
  vec3 T = normalize(vec3(n.z, 0.0, -n.x) + vec3(1e-5, 0.0, 0.0));
  vec3 B = cross(n, T);
  float sinT = max(length(n.xz), 0.08);
  float hL = texture2D(uMap, uv - vec2(uTexel.x, 0.0)).a;
  float hR = texture2D(uMap, uv + vec2(uTexel.x, 0.0)).a;
  float hD = texture2D(uMap, uv - vec2(0.0, uTexel.y)).a;
  float hU = texture2D(uMap, uv + vec2(0.0, uTexel.y)).a;
  float dhdu = (hR - hL) / (2.0 * uTexel.x);
  float dhdv = (hU - hD) / (2.0 * uTexel.y);
  vec3 grad = T * dhdu / (6.2832 * sinT) + B * dhdv / 3.14159;
  vec3 nObj = normalize(n - uBump * grad);

  vec3 N = normalize(mat3(modelMatrix) * nObj);
  vec3 Ng = normalize(vWorldN);
  vec3 L = normalize(uSunPos - vWorldPos);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float ndlG = dot(Ng, L);
  float ndl = dot(N, L);

  float diff = max(ndl, 0.0);
  diff = mix(diff, smoothstep(-0.12, 1.0, ndlG), uGas * 0.55);
  diff *= smoothstep(-0.06, 0.12, ndlG);

  vec4 ex = vec4(0.0, 0.0, 0.0, 0.0);
  float cloud = 0.0;
  if (uHasExtra > 0.5) {
    ex = texture2D(uExtra, vUv);
    cloud = texture2D(uExtra, vec2(vUv.x + uCloudShift + 0.0015, vUv.y)).r;
    diff *= 1.0 - cloud * 0.5;
  }

  if (uRingOn > 0.5) {
    float denom = dot(L, uRingNormal);
    if (abs(denom) > 1e-4) {
      float t = dot(uCenter - vWorldPos, uRingNormal) / denom;
      if (t > 0.0) {
        vec3 hp = vWorldPos + L * t;
        float r = length(hp - uCenter) / uRadius;
        float k = (r - uRingRange.x) / (uRingRange.y - uRingRange.x);
        if (k > 0.0 && k < 1.0) diff *= 1.0 - texture2D(uRing, vec2(k, 0.5)).a * 0.82;
      }
    }
  }

  float limb = pow(max(dot(Ng, V), 0.0), 0.35);
  albedo *= mix(1.0, limb, uGas * 0.55);

  vec3 col = albedo * (diff * uSunColor + uAmbient);

  if (uSpec > 0.0) {
    vec3 H = normalize(L + V);
    float ocean = ex.b * (1.0 - cloud);
    float sp = pow(max(dot(Ng, H), 0.0), 70.0) * 0.9 + pow(max(dot(Ng, H), 0.0), 12.0) * 0.08;
    col += uSunColor * sp * ocean * uSpec * smoothstep(0.0, 0.2, ndlG) * vec3(1.0, 0.92, 0.8);
  }
  if (uNight > 0.0) {
    float night = 1.0 - smoothstep(-0.12, 0.1, ndlG);
    vec3 city = vec3(1.0, 0.72, 0.38) * pow(ex.g, 1.6) * 1.7;
    col += city * night * uNight * (1.0 - cloud * 0.75);
  }

  float fres = pow(1.0 - max(dot(Ng, V), 0.0), 3.0);
  float litR = smoothstep(-0.25, 0.55, ndlG);
  col = mix(col, uAtmo * max(diff, 0.0), fres * 0.35 * uRim);
  col += uAtmo * fres * litR * uRim * 0.55;

  col += uHighlightColor * pow(1.0 - max(dot(Ng, V), 0.0), 6.0) * uHighlight * 0.45;

  gl_FragColor = vec4(col, 1.0);
  ${OUT}
}
`;

export const CLOUD_FRAG = /* glsl */ `
uniform sampler2D uExtra;
uniform vec3 uSunPos;
uniform vec3 uSunColor;
uniform float uCloudShift;
uniform float uAmbient;
varying vec2 vUv;
varying vec3 vObjN;
varying vec3 vWorldPos;
varying vec3 vWorldN;
void main(){
  float cl = texture2D(uExtra, vec2(vUv.x + uCloudShift, vUv.y)).r;
  vec3 Ng = normalize(vWorldN);
  vec3 L = normalize(uSunPos - vWorldPos);
  float ndl = dot(Ng, L);
  float lit = smoothstep(-0.12, 0.35, ndl);
  float dusk = smoothstep(-0.15, 0.05, ndl) * (1.0 - smoothstep(0.05, 0.3, ndl));
  vec3 col = mix(vec3(1.0), vec3(1.0, 0.62, 0.38), dusk * 0.8) * (lit * 0.95 + uAmbient) * uSunColor;
  float a = cl * mix(0.12, 0.96, lit);
  gl_FragColor = vec4(col, a);
  ${OUT}
}
`;

export const ATMO_VERT = /* glsl */ `
varying vec3 vWorldPos;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const ATMO_FRAG = /* glsl */ `
uniform vec3 uCenter;
uniform float uR;
uniform float uRa;
uniform vec3 uSunPos;
uniform vec3 uColor;
uniform vec3 uSunset;
uniform float uStr;
uniform float uFalloff;
varying vec3 vWorldPos;
vec3 dec(vec3 c){ return pow(c, vec3(2.2)); }
void main(){
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWorldPos - ro);
  float t = dot(uCenter - ro, rd);
  vec3 P = ro + rd * max(t, 0.0);
  float d = length(P - uCenter);
  float h = clamp((d - uR) / (uRa - uR), 0.0, 1.0);
  float dens = exp(-h * uFalloff) * (1.0 - h);
  vec3 up = normalize(P - uCenter);
  vec3 L = normalize(uSunPos - uCenter);
  float s = dot(up, L);
  float lit = smoothstep(-0.28, 0.5, s);
  float mu = dot(rd, L);
  float mie = pow(max(mu, 0.0), 10.0);
  float band = smoothstep(-0.3, 0.0, s) * (1.0 - smoothstep(0.0, 0.35, s));
  vec3 col = mix(uColor, uSunset, band * 0.75) * lit + uSunset * mie * smoothstep(-0.45, 0.1, s) * 1.6;
  gl_FragColor = vec4(col * uStr, dens);
  ${OUT}
}
`;

export const RING_VERT = /* glsl */ `
varying vec3 vLocal;
varying vec3 vWorldPos;
void main(){
  vLocal = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const RING_FRAG = /* glsl */ `
uniform sampler2D uRing;
uniform vec2 uRange;
uniform vec3 uSunPos;
uniform vec3 uCenter;
uniform float uRadius;
uniform vec3 uNormal;
uniform vec3 uSunColor;
uniform float uOpacity;
varying vec3 vLocal;
varying vec3 vWorldPos;
vec3 dec(vec3 c){ return pow(c, vec3(2.2)); }
void main(){
  float r = length(vLocal.xy);
  float k = (r - uRange.x) / (uRange.y - uRange.x);
  if (k < 0.0 || k > 1.0) discard;
  vec4 rs = texture2D(uRing, vec2(k, 0.5));
  vec3 L = normalize(uSunPos - vWorldPos);
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 oc = vWorldPos - uCenter;
  float b = dot(oc, L);
  float closest = sqrt(max(dot(oc, oc) - b * b, 0.0));
  float sh = b < 0.0 ? smoothstep(uRadius * 0.97, uRadius * 1.03, closest) : 1.0;
  float sunSide = dot(uNormal, L);
  float viewSide = dot(uNormal, V);
  float same = step(0.0, sunSide * viewSide);
  float litFront = 0.35 + 0.85 * sqrt(abs(sunSide));
  float trans = (1.0 - rs.a);
  float lightBack = (0.12 + trans * 0.9) * 0.7;
  float light = mix(lightBack, litFront, same);
  float fwd = pow(max(dot(-V, L), 0.0), 5.0) * (1.0 - same) * 1.4;
  vec3 col = dec(rs.rgb) * uSunColor * ((light + fwd) * sh + 0.015);
  float edge = smoothstep(0.0, 0.01, k) * (1.0 - smoothstep(0.99, 1.0, k));
  gl_FragColor = vec4(col, rs.a * edge * uOpacity);
  ${OUT}
}
`;

export const SUN_FRAG = (octaves: number) => /* glsl */ `
uniform float uTime;
uniform vec3 uTint;
uniform float uIntensity;
varying vec2 vUv;
varying vec3 vObjN;
varying vec3 vWorldPos;
varying vec3 vWorldN;
${NOISE}
void main(){
  vec3 p = vObjN;
  float t = uTime * 0.025;
  vec3 q = p * 4.0 + vec3(t, -t * 0.6, t * 0.4);
  vec3 w = vec3(snoise(q * 0.8), snoise(q * 0.8 + 7.0), snoise(q * 0.8 + 13.0));
  float g = fbm(p * 7.0 + w * 0.6 + t, ${octaves});
  float cells = 1.0 - abs(snoise(p * 34.0 + w * 0.3 + t * 3.0));
  float spots = smoothstep(0.58, 0.72, fbm(p * 2.4 + 11.0 + t * 0.2, 3)) * smoothstep(0.75, 0.2, abs(p.y));
  vec3 V = normalize(cameraPosition - vWorldPos);
  float mu = max(dot(normalize(vWorldN), V), 0.0);
  float limb = pow(mu, 0.5);
  vec3 hot = vec3(1.0, 0.72, 0.32);
  vec3 cool = vec3(0.78, 0.15, 0.01);
  float heat = clamp(0.38 + g * 0.9 + cells * 0.42, 0.0, 1.25);
  vec3 col = mix(cool, hot, heat * heat) * (0.62 + 0.55 * heat);
  col *= mix(1.0, 0.12, spots);
  col *= (0.22 + 0.78 * limb);
  col += vec3(1.0, 0.45, 0.1) * pow(1.0 - mu, 4.0) * 0.5;
  col *= uIntensity * uTint;
  gl_FragColor = vec4(col, 1.0);
  ${OUT}
}
`;

/** Camera-facing billboard (size via uScale in world units) */
export const BILLBOARD_VERT = /* glsl */ `
uniform float uScale;
varying vec2 vUv;
void main(){
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * uScale;
  gl_Position = projectionMatrix * mv;
}
`;

export const CORONA_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uTint;
uniform float uIntensity;
uniform float uInner;
varying vec2 vUv;
${NOISE}
void main(){
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float a = atan(p.y, p.x);
  float rr = max(r - uInner, 0.0);
  float glow = exp(-rr * 9.0) * 0.85 + exp(-rr * 3.6) * 0.16;
  float streams = snoise(vec3(cos(a) * 2.2, sin(a) * 2.2, uTime * 0.04 + r * 0.6)) * 0.5 + 0.5;
  float streams2 = snoise(vec3(cos(a) * 6.0, sin(a) * 6.0, uTime * 0.07 - r)) * 0.5 + 0.5;
  float corona = pow(streams, 3.0) * exp(-rr * 4.2) * 1.2 + pow(streams2, 4.0) * exp(-rr * 6.5) * 0.7;
  float inside = smoothstep(uInner * 0.96, uInner * 1.01, r);
  vec3 col = vec3(1.0, 0.78, 0.5) * glow + vec3(1.0, 0.86, 0.66) * corona;
  col *= inside * uIntensity * uTint;
  float fade = 1.0 - smoothstep(0.82, 1.0, r);
  gl_FragColor = vec4(col * fade, 1.0);
  ${OUT}
}
`;

export const SPHERE_GLSL = SPHERE;
