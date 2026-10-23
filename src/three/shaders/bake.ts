import { NOISE, SPHERE } from './noise';

/** '#rrggbb' -> GLSL vec3 literal (sRGB values; the bake stores sRGB, decoded at sample time) */
const c = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `vec3(${(((n >> 16) & 255) / 255).toFixed(3)},${(((n >> 8) & 255) / 255).toFixed(3)},${((n & 255) / 255).toFixed(3)})`;
};

export const BAKE_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const HEADER = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uSeed;
uniform sampler2D uMapA;
uniform sampler2D uMapB;
uniform vec3 uColA;
uniform vec3 uColB;
uniform float uStyle;
${NOISE}
${SPHERE}

float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }

float craterField(vec3 p, float freq, float density, float depth, out float fresh){
  vec3 q = p * freq;
  q += 0.22 * vec3(snoise(q * 0.7), snoise(q * 0.7 + 11.0), snoise(q * 0.7 + 23.0));
  vec3 ip = floor(q);
  vec3 fp = fract(q);
  float h = 0.0;
  fresh = 0.0;
  for (int x = -1; x <= 1; x++)
  for (int y = -1; y <= 1; y++)
  for (int z = -1; z <= 1; z++){
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 r = hash33(ip + g + uSeed * 17.0);
    if (r.z > density) continue;
    vec3 cc = g + 0.15 + 0.7 * r;
    float rad = mix(0.16, 0.5, r.x * r.x);
    float d = length(fp - cc) / rad;
    if (d > 1.7) continue;
    float bowl = d < 1.0 ? max(d * d - 1.0, -0.7) : 0.0;
    float rim = exp(-pow((d - 1.0) / 0.2, 2.0)) * 0.42;
    float ej = d > 1.0 ? exp(-(d - 1.0) * 3.5) * 0.07 : 0.0;
    h += (bowl + rim + ej) * depth * rad;
    fresh = max(fresh, (1.0 - smoothstep(0.7, 1.6, d)) * step(0.82, r.y));
  }
  return h;
}

vec3 tangentFrame(vec3 cdir, vec3 d, out float ang){
  vec3 e1 = normalize(cross(vec3(0.0, 1.0, 0.0), cdir) + vec3(1e-5));
  vec3 e2 = cross(cdir, e1);
  vec3 t = d - cdir * dot(d, cdir);
  ang = atan(dot(t, e2), dot(t, e1));
  // the tangent-plane projection is symmetric through the centre: reject the far hemisphere
  if (dot(d, cdir) < 0.0) return vec3(1e3, 1e3, 0.0);
  return vec3(dot(t, e1), dot(t, e2), 0.0);
}

float rays(vec3 d, vec3 cdir, float reach, float k){
  float ang;
  vec3 t = tangentFrame(cdir, d, ang);
  float ad = angDist(d, cdir);
  float r = pow(0.5 + 0.5 * snoise(vec3(cos(ang) * k, sin(ang) * k, 3.1)), 7.0);
  return r * exp(-ad / reach) * smoothstep(0.015, 0.05, ad);
}

float earthLand(vec3 d, vec2 uv, out float landv){
  vec4 A = texture2D(uMapA, uv);
  float n1 = fbm(d * 5.0, 6);
  float n2 = fbm(d * 19.0, 4);
  landv = A.r - 0.5 + n1 * 0.2 + n2 * 0.07;
  return smoothstep(-0.012, 0.012, landv);
}
`;

const RECIPES: Record<string, string> = {
  mercury: /* glsl */ `
    float f1, f2, f3, f4;
    float h = 0.5 + fbm(d * 3.0, 5) * 0.1;
    h += craterField(d, 3.2, 0.5, 0.34, f1);
    h += craterField(d, 7.5, 0.6, 0.26, f2);
    h += craterField(d, 17.0, 0.7, 0.18, f3);
    h += craterField(d, 38.0, 0.75, 0.11, f4);
    vec3 cb = llDir(31.5, 162.7);
    float a = angDist(d, cb) / 0.33;
    h += (a < 1.0 ? -0.07 * (1.0 - a * a) : 0.0) + exp(-pow((a - 1.0) / 0.07, 2.0)) * 0.06 + exp(-pow((a - 1.4) / 0.06, 2.0)) * 0.025;
    float plains = smoothstep(0.05, 0.45, fbm(d * 1.6 + 5.0, 4));
    vec3 col = mix(${c('#6d6863')}, ${c('#a7a097')}, smoothstep(-0.45, 0.6, fbm(d * 5.0 + 2.0, 5)));
    col = mix(col, ${c('#8c8174')}, plains * 0.45);
    col = mix(col, ${c('#b0a38e')}, (1.0 - smoothstep(0.85, 1.0, a)) * 0.6);
    col *= 0.8 + 0.4 * clamp((h - 0.35) * 1.6, 0.0, 1.0);
    float fr = max(max(f1, f2), max(f3, f4));
    col += vec3(0.16) * fr + vec3(0.18) * rays(d, llDir(-35.0, 60.0), 0.35, 5.0);
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), clamp(h, 0.0, 1.0));
  `,

  moon: /* glsl */ `
    float mare = 0.0;
    vec4 M[16];
    M[0] = vec4(33.0, -16.0, 0.30, 1.0); M[1] = vec4(28.0, 17.5, 0.17, 1.0); M[2] = vec4(8.5, 31.4, 0.2, 1.0);
    M[3] = vec4(17.0, 59.0, 0.11, 1.0); M[4] = vec4(-7.8, 51.3, 0.14, 1.0); M[5] = vec4(-15.0, 35.0, 0.08, 1.0);
    M[6] = vec4(-21.0, -16.6, 0.14, 0.9); M[7] = vec4(-24.4, -38.6, 0.08, 1.0); M[8] = vec4(56.0, -15.0, 0.08, 0.9);
    M[9] = vec4(56.0, 15.0, 0.07, 0.9); M[10] = vec4(18.0, -57.0, 0.3, 1.0); M[11] = vec4(0.0, -50.0, 0.22, 1.0);
    M[12] = vec4(32.0, -48.0, 0.18, 1.0); M[13] = vec4(-5.0, -30.0, 0.13, 0.9); M[14] = vec4(13.0, 4.0, 0.06, 0.8);
    M[15] = vec4(-10.0, -23.0, 0.1, 0.9);
    float edge = 0.3 * snoise(d * 5.0) + 0.14 * snoise(d * 13.0) + 0.06 * snoise(d * 31.0);
    for (int i = 0; i < 16; i++){
      float a = angDist(d, llDir(M[i].x, M[i].y)) / M[i].z + edge;
      mare = max(mare, (1.0 - smoothstep(0.55, 1.15, a)) * M[i].w);
    }
    float f1, f2, f3, f4;
    float dens = mix(0.75, 0.25, mare);
    float h = 0.55 - mare * 0.08 + fbm(d * 4.0, 5) * 0.06;
    h += craterField(d, 4.0, dens * 0.7, 0.3, f1);
    h += craterField(d, 9.0, dens, 0.24, f2);
    h += craterField(d, 21.0, dens, 0.16, f3);
    h += craterField(d, 46.0, dens, 0.1, f4);
    vec3 high = mix(${c('#9d9991')}, ${c('#cbc7bf')}, smoothstep(-0.5, 0.6, fbm(d * 6.0 + 3.0, 5)));
    vec3 mareC = mix(${c('#5a5751')}, ${c('#7d786f')}, smoothstep(-0.5, 0.6, fbm(d * 8.0 + 9.0, 4)));
    vec3 col = mix(high, mareC, mare);
    col *= 0.85 + 0.35 * clamp((h - 0.4) * 1.5, 0.0, 1.0);
    col += vec3(0.12) * max(max(f1, f2), max(f3, f4)) * (1.0 - mare * 0.5);
    col += vec3(0.3) * rays(d, llDir(-43.3, -11.2), 0.55, 6.0);
    col += vec3(0.18) * rays(d, llDir(9.6, -20.0), 0.22, 5.0);
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), clamp(h, 0.0, 1.0));
  `,

  venus: /* glsl */ `
    vec3 p = d + 0.35 * vec3(fbm(d * 2.0, 4), fbm(d * 2.0 + 7.0, 4), fbm(d * 2.0 + 13.0, 4));
    float band = fbm(vec3(p.x * 1.3, p.y * 6.5, p.z * 1.3), 6);
    float chevron = sin((p.y + 0.35 * abs(p.x + p.z * 0.4)) * 9.0 + fbm(p * 3.0, 3) * 2.0);
    vec3 col = mix(${c('#f5e3b6')}, ${c('#d6a65d')}, smoothstep(-0.5, 0.55, band));
    col = mix(col, ${c('#a8732f')}, smoothstep(0.35, 0.95, chevron) * 0.35);
    col = mix(col, ${c('#fbf0d2')}, smoothstep(0.7, 0.95, abs(d.y)) * 0.45);
    col *= 0.95 + 0.07 * snoise(vec3(p.x * 5.0, p.y * 30.0, p.z * 5.0));
    col = mix(col, ${c('#ead6a4')}, 0.38);
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), luma(col));
  `,

  earth: /* glsl */ `
    float landv;
    float land = earthLand(d, uv, landv);
    vec4 A = texture2D(uMapA, uv);
    vec4 B = texture2D(uMapB, uv);
    float n1 = fbm(d * 5.0, 6);
    float latd = asin(d.y) * 57.2958;
    float mount = A.b * (0.5 + 0.5 * ridged(d * 15.0, 5));
    float elev = clamp(landv * 1.6, 0.0, 1.0) * 0.35 + mount * 0.65;
    float depth = clamp(-landv * 3.0, 0.0, 1.0);
    vec3 ocean = mix(${c('#2f8fb8')}, ${c('#0f4a86')}, smoothstep(0.0, 0.22, depth));
    ocean = mix(ocean, ${c('#08306a')}, smoothstep(0.25, 1.0, depth));
    float moist = fbm(d * 3.0 + 7.0, 4);
    vec3 lc = mix(${c('#8a9650')}, ${c('#3f6a2c')}, clamp(B.g * 1.1, 0.0, 1.0));
    lc = mix(lc, ${c('#556b2f')}, smoothstep(0.1, 0.6, moist) * (1.0 - B.g) * 0.5);
    lc = mix(lc, ${c('#34462a')}, smoothstep(45.0, 62.0, abs(latd)) * 0.55);
    lc = mix(lc, ${c('#7c7862')}, smoothstep(60.0, 72.0, abs(latd)) * 0.7);
    vec3 desertC = mix(${c('#ebcb92')}, ${c('#c8905a')}, fbm(d * 9.0, 4) * 0.5 + 0.5);
    lc = mix(lc, desertC, clamp(B.r * 1.15, 0.0, 1.0));
    lc = mix(lc, ${c('#6f655a')}, smoothstep(0.25, 0.7, mount) * 0.75);
    float snow = smoothstep(0.66, 0.88, mount + max(abs(latd) - 45.0, 0.0) / 55.0);
    lc = mix(lc, ${c('#f3f6f9')}, snow);
    float ice = max(B.b, smoothstep(77.0, 83.0, abs(latd) + n1 * 6.0));
    lc = mix(lc, ${c('#eef3f9')}, ice);
    lc *= 0.9 + 0.2 * fbm(d * 40.0, 3);
    vec3 col = mix(ocean, lc, land);
    col = mix(col, ${c('#e6edf4')}, (1.0 - land) * smoothstep(74.0, 84.0, latd + n1 * 6.0));
    float h = land * (0.22 + elev * 0.78);
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), clamp(h, 0.0, 1.0));
  `,

  earthExtra: /* glsl */ `
    float landv;
    float land = earthLand(d, uv, landv);
    vec4 A = texture2D(uMapA, uv);
    vec4 B = texture2D(uMapB, uv);
    float latd = asin(d.y) * 57.2958;
    vec3 p = d;
    p = rotateAxis(p, llDir(42.0, -40.0), 2.2 * exp(-pow(angDist(d, llDir(42.0, -40.0)) / 0.14, 2.0)));
    p = rotateAxis(p, llDir(-48.0, 120.0), -2.4 * exp(-pow(angDist(d, llDir(-48.0, 120.0)) / 0.15, 2.0)));
    p = rotateAxis(p, llDir(18.0, 135.0), 3.0 * exp(-pow(angDist(d, llDir(18.0, 135.0)) / 0.06, 2.0)));
    p = rotateAxis(p, llDir(55.0, 160.0), 2.0 * exp(-pow(angDist(d, llDir(55.0, 160.0)) / 0.15, 2.0)));
    p = rotateAxis(p, llDir(-55.0, -10.0), -2.0 * exp(-pow(angDist(d, llDir(-55.0, -10.0)) / 0.16, 2.0)));
    vec3 q = p * 2.0;
    vec3 w = vec3(fbm(q + 1.0, 4), fbm(q + 5.2, 4), fbm(q + 9.7, 4));
    float c1 = fbm(vec3(q.x, q.y * 1.6, q.z) * 1.5 + w * 1.7, 7);
    float latMod = 0.2 * exp(-pow((latd - 6.0) / 7.0, 2.0)) - 0.24 * exp(-pow((abs(latd) - 23.0) / 9.0, 2.0)) + 0.18 * exp(-pow((abs(latd) - 56.0) / 12.0, 2.0));
    latMod -= 0.12 * B.r;
    float cloud = smoothstep(0.10, 0.56, c1 + latMod + 0.0);
    cloud *= 0.7 + 0.3 * (fbm(d * 28.0, 3) * 0.5 + 0.5);
    float pop = A.g;
    float ln = snoise(d * 150.0) * 0.5 + 0.5;
    float ln2 = snoise(d * 420.0) * 0.5 + 0.5;
    float urban = smoothstep(0.08, 0.7, pop);
    float speck = smoothstep(0.52, 0.8, ln * 0.45 + ln2 * 0.55);
    float lights = land * (urban * speck + pow(urban, 3.0) * 0.35 * smoothstep(0.4, 0.7, ln2));
    lights += land * (1.0 - B.b) * (1.0 - B.r) * 0.06 * smoothstep(0.62, 0.92, ln2) * (1.0 - smoothstep(58.0, 68.0, abs(latd)));
    lights *= (1.0 - B.b);
    gl_FragColor = vec4(clamp(cloud, 0.0, 1.0), clamp(lights, 0.0, 1.0), 1.0 - land, 1.0);
  `,

  mars: /* glsl */ `
    float latd = asin(d.y) * 57.2958;
    float lond = uv.x * 360.0 - 180.0;
    float south = smoothstep(-0.15, 0.25, -d.y + 0.25 + 0.18 * snoise(d * 2.5));
    float f1, f2, f3;
    float h = 0.5 + fbm(d * 2.5, 6) * 0.1 - (1.0 - south) * 0.06;
    h += craterField(d, 6.0, 0.55, 0.26, f1) * (0.35 + 0.65 * south);
    h += craterField(d, 14.0, 0.65, 0.17, f2) * (0.35 + 0.65 * south);
    h += craterField(d, 32.0, 0.6, 0.1, f3) * (0.5 + 0.5 * south);
    vec4 V[6];
    V[0] = vec4(18.65, -133.8, 0.11, 0.38); V[1] = vec4(-8.3, -120.7, 0.05, 0.18); V[2] = vec4(1.5, -112.9, 0.05, 0.18);
    V[3] = vec4(11.8, -104.5, 0.05, 0.18); V[4] = vec4(25.0, 147.0, 0.05, 0.12); V[5] = vec4(0.0, -110.0, 0.55, 0.14);
    for (int i = 0; i < 6; i++){
      float a = angDist(d, llDir(V[i].x, V[i].y)) / V[i].z;
      h += V[i].w * exp(-a * a * 1.6) - (i < 4 ? V[i].w * 0.3 * exp(-pow(a / 0.13, 2.0)) : 0.0);
    }
    float latc = -6.0 - (lond + 95.0) / 55.0 * 6.0;
    float cd = abs(latd - latc + 1.6 * snoise(vec3(lond * 0.08, 0.0, 1.0)) + 0.7 * snoise(vec3(lond * 0.4, latd * 0.3, 2.0)));
    float inRange = smoothstep(-100.0, -92.0, lond) * (1.0 - smoothstep(-42.0, -34.0, lond));
    float canyon = exp(-pow(cd / max(0.5, 1.4 + 0.9 * snoise(vec3(lond * 0.07, 5.0, 0.0)) + 0.4 * snoise(d * 40.0)), 2.0)) * inRange;
    h -= canyon * 0.28;
    float hel = angDist(d, llDir(-42.4, 70.5)) / 0.36;
    h -= 0.16 * (1.0 - smoothstep(0.6, 1.1, hel));
    float arg = angDist(d, llDir(-49.7, -43.4)) / 0.15;
    h -= 0.08 * (1.0 - smoothstep(0.6, 1.1, arg));
    vec4 D[8];
    D[0] = vec4(8.4, 69.5, 0.2, 1.0); D[1] = vec4(46.7, -22.0, 0.22, 0.8); D[2] = vec4(-25.0, -40.0, 0.25, 0.8);
    D[3] = vec4(-2.0, 0.0, 0.16, 0.8); D[4] = vec4(-20.0, 105.0, 0.25, 0.75); D[5] = vec4(-20.0, 145.0, 0.25, 0.7);
    D[6] = vec4(45.0, 110.0, 0.2, 0.45); D[7] = vec4(-26.0, -87.0, 0.08, 0.7);
    float dark = 0.0;
    float edge = 0.25 * fbm(d * 6.0, 4);
    for (int i = 0; i < 8; i++){
      float a = angDist(d, llDir(D[i].x, D[i].y)) / D[i].z + edge;
      dark = max(dark, (1.0 - smoothstep(0.5, 1.2, a)) * D[i].w);
    }
    dark *= 0.7 + 0.5 * fbm(d * 9.0 + 3.0, 4);
    vec3 col = mix(${c('#d98a58')}, ${c('#b35a30')}, smoothstep(-0.4, 0.5, fbm(d * 4.0 + 1.0, 5)));
    col = mix(col, ${c('#a9532e')}, south * 0.35);
    col = mix(col, ${c('#5a2b1b')}, clamp(dark, 0.0, 1.0) * 0.85);
    col = mix(col, ${c('#e2a77c')}, (1.0 - smoothstep(0.5, 1.0, hel)) * 0.5);
    col = mix(col, ${c('#6b3020')}, canyon * 0.6);
    col *= 0.86 + 0.3 * clamp((h - 0.4) * 1.4, 0.0, 1.0);
    float pang = atan(d.z, d.x);
    float spiral = 0.5 + 0.5 * sin(pang * 3.0 + acos(clamp(d.y, -1.0, 1.0)) * 60.0);
    float ncap = smoothstep(79.0, 82.0, latd + 3.0 * snoise(d * 8.0));
    float scap = smoothstep(83.0, 86.0, -latd + 2.5 * snoise(d * 9.0 + 4.0));
    float cap = max(ncap, scap);
    col = mix(col, mix(${c('#f4efe9')}, ${c('#c9b3a3')}, spiral * 0.35), cap);
    h += cap * 0.05;
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), clamp(h, 0.0, 1.0));
  `,

  jupiter: /* glsl */ `
    vec3 p = d;
    vec3 grs = llDir(-22.0, 0.0);
    float ga; vec3 gt = tangentFrame(grs, d, ga);
    float e = length(vec2(gt.x / 0.17, gt.y / 0.095));
    p = rotateAxis(p, grs, (1.0 - smoothstep(0.0, 1.3, e)) * 4.5);
    vec3 ba = llDir(-33.0, 70.0);
    float bb; vec3 bt = tangentFrame(ba, d, bb);
    float e2 = length(vec2(bt.x / 0.06, bt.y / 0.042));
    p = rotateAxis(p, ba, (1.0 - smoothstep(0.0, 1.3, e2)) * 3.5);
    p += 0.022 * vec3(snoise(p * 10.0), snoise(p * 10.0 + 5.0), snoise(p * 10.0 + 9.0));
    p += vec3(0.07, 0.022, 0.07) * vec3(fbm(p * 3.2, 4), fbm(p * 3.2 + 3.0, 4), fbm(p * 3.2 + 8.0, 4));
    float lat = p.y;
    float bands = sin(lat * 21.0 + 1.3 * sin(lat * 7.0)) * 0.5 + sin(lat * 43.0 + 0.4) * 0.22 + sin(lat * 9.0 + 0.5) * 0.35;
    float zone = smoothstep(-0.28, 0.32, bands);
    vec3 belt = mix(${c('#8f5636')}, ${c('#bf8355')}, fbm(p * 4.0, 3) * 0.5 + 0.5);
    vec3 zoneC = mix(${c('#f0e4cf')}, ${c('#dcc19a')}, fbm(p * 5.0 + 4.0, 3) * 0.5 + 0.5);
    vec3 col = mix(belt, zoneC, zone);
    float streak = snoise(vec3(p.x * 2.0, p.y * 90.0, p.z * 2.0)) * 0.5 + snoise(vec3(p.x * 7.0, p.y * 170.0, p.z * 7.0)) * 0.25;
    col *= 0.9 + 0.13 * streak;
    col = mix(col, ${c('#dba673')}, exp(-pow(lat / 0.08, 2.0)) * 0.4);
    float festoon = smoothstep(0.55, 0.85, snoise(vec3(p.x * 6.0, p.y * 14.0, p.z * 6.0))) * exp(-pow((lat - 0.1) / 0.04, 2.0));
    col = mix(col, ${c('#5a6f86')}, festoon * 0.5);
    float polar = smoothstep(0.62, 0.92, abs(d.y));
    col = mix(col, mix(${c('#7f7a74')}, ${c('#8e8a83')}, fbm(d * 12.0, 3) * 0.5 + 0.5), polar * 0.75);
    float gm = 1.0 - smoothstep(0.5, 1.0, e);
    col = mix(col, mix(${c('#b0442a')}, ${c('#df7a4c')}, smoothstep(0.0, 0.8, e) * (0.6 + 0.4 * snoise(p * 30.0))), gm * 0.92);
    col = mix(col, ${c('#f3e8d6')}, exp(-pow((e - 1.08) / 0.16, 2.0)) * 0.55);
    float bm = 1.0 - smoothstep(0.55, 1.0, e2);
    col = mix(col, ${c('#d6845d')}, bm * 0.7);
    col = mix(col, ${c('#f7efe2')}, exp(-pow((e2 - 1.1) / 0.18, 2.0)) * 0.5);
    for (int i = 0; i < 6; i++){
      vec3 oc = llDir(-41.0, -150.0 + float(i) * 52.0);
      col = mix(col, ${c('#f6efe4')}, (1.0 - smoothstep(0.02, 0.035, angDist(d, oc))) * 0.75);
    }
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), luma(col));
  `,

  saturn: /* glsl */ `
    vec3 p = d;
    p += vec3(0.05, 0.012, 0.05) * vec3(fbm(p * 3.0, 4), fbm(p * 3.0 + 3.0, 4), fbm(p * 3.0 + 8.0, 4));
    p += 0.01 * vec3(snoise(p * 12.0), snoise(p * 12.0 + 3.0), snoise(p * 12.0 + 6.0));
    float lat = p.y;
    float bands = sin(lat * 29.0 + 1.2 * sin(lat * 11.0)) * 0.4 + sin(lat * 71.0) * 0.15 + fbm(vec3(p.x, p.y * 18.0, p.z), 4) * 0.25;
    vec3 col = mix(${c('#c7a266')}, ${c('#efdfb2')}, smoothstep(-0.35, 0.35, bands));
    col = mix(col, ${c('#f3e7c4')}, exp(-pow(lat / 0.12, 2.0)) * 0.45);
    col *= 0.94 + 0.08 * snoise(vec3(p.x * 3.0, p.y * 120.0, p.z * 3.0));
    float colat = acos(clamp(d.y, -1.0, 1.0));
    float th = atan(d.z, d.x) + 0.3;
    float R = 0.2 / cos(mod(th, PI / 3.0) - PI / 6.0);
    float inside = 1.0 - smoothstep(R - 0.01, R + 0.01, colat);
    col = mix(col, mix(${c('#7f969c')}, ${c('#a9b2a5')}, colat / 0.2), inside * 0.65);
    col = mix(col, ${c('#a68a5a')}, exp(-pow((colat - R) / 0.012, 2.0)) * 0.6);
    col = mix(col, ${c('#9c9c8a')}, smoothstep(0.85, 0.98, -d.y) * 0.4);
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), luma(col));
  `,

  uranus: /* glsl */ `
    vec3 p = d + 0.04 * vec3(fbm(d * 3.0, 3), fbm(d * 3.0 + 4.0, 3), fbm(d * 3.0 + 9.0, 3));
    float lat = p.y;
    vec3 col = mix(${c('#8fd0db')}, ${c('#c5eef1')}, smoothstep(-0.9, 0.9, lat) * 0.6 + 0.2);
    col *= 1.0 + 0.035 * sin(lat * 24.0 + fbm(p * 4.0, 3)) + 0.02 * snoise(vec3(p.x * 2.0, p.y * 50.0, p.z * 2.0));
    col = mix(col, ${c('#e3fbfb')}, smoothstep(0.55, 0.88, lat) * 0.5);
    float clouds = smoothstep(0.72, 0.9, snoise(vec3(p.x * 6.0, p.y * 22.0, p.z * 6.0))) * exp(-pow((abs(lat) - 0.45) / 0.12, 2.0));
    col = mix(col, vec3(0.96, 1.0, 1.0), clouds * 0.5);
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), luma(col));
  `,

  neptune: /* glsl */ `
    vec3 p = d;
    vec3 gds = llDir(-20.0, 0.0);
    float ga; vec3 gt = tangentFrame(gds, d, ga);
    float e = length(vec2(gt.x / 0.15, gt.y / 0.085));
    p = rotateAxis(p, gds, (1.0 - smoothstep(0.0, 1.3, e)) * 3.0);
    p += vec3(0.06, 0.02, 0.06) * vec3(fbm(p * 3.0, 4), fbm(p * 3.0 + 3.0, 4), fbm(p * 3.0 + 8.0, 4));
    float lat = p.y;
    vec3 col = mix(${c('#2b4fc0')}, ${c('#4a7ae8')}, smoothstep(-0.4, 0.4, sin(lat * 14.0 + fbm(p * 3.0, 3) * 1.5)));
    col = mix(col, ${c('#1d3a99')}, smoothstep(0.75, 0.95, -lat) * 0.6);
    col = mix(col, ${c('#2a4fb8')}, exp(-pow((lat + 0.85) / 0.06, 2.0)) * 0.5);
    col *= 0.94 + 0.08 * snoise(vec3(p.x * 2.0, p.y * 60.0, p.z * 2.0));
    float cirrus = smoothstep(0.5, 0.82, snoise(vec3(p.x * 2.5, p.y * 38.0, p.z * 2.5))) *
                   (exp(-pow((lat - 0.42) / 0.12, 2.0)) + exp(-pow((lat + 0.5) / 0.08, 2.0)) * 0.8);
    col = mix(col, vec3(0.92, 0.95, 1.0), cirrus * 0.75);
    float gm = 1.0 - smoothstep(0.55, 1.0, e);
    col = mix(col, ${c('#14225f')}, gm * 0.85);
    vec3 comp = llDir(-26.0, 4.0);
    col = mix(col, vec3(0.95, 0.97, 1.0), (1.0 - smoothstep(0.015, 0.04, angDist(d, comp))) * 0.8);
    col = mix(col, vec3(0.95, 0.97, 1.0), (1.0 - smoothstep(0.012, 0.03, angDist(d, llDir(-42.0, 70.0)))) * 0.85);
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), luma(col));
  `,

  pluto: /* glsl */ `
    float latd = asin(d.y) * 57.2958;
    vec3 hc = llDir(22.0, 178.0);
    float ha; vec3 ht = tangentFrame(hc, d, ha);
    vec2 hp = vec2(ht.x, ht.y + 0.05) / 0.36;
    hp.y += 0.2;
    float q = pow(hp.x * hp.x + hp.y * hp.y - 1.0, 3.0) - hp.x * hp.x * hp.y * hp.y * hp.y;
    float heart = 1.0 - smoothstep(-0.03, 0.08, q + 0.06 * snoise(d * 9.0));
    heart *= step(0.0, dot(d, hc));
    float sputnik = heart * smoothstep(0.02, -0.08, hp.x + 0.1 * snoise(d * 6.0));
    float lond = uv.x * 360.0 - 180.0;
    float belt = 1.0 - smoothstep(6.0, 18.0, abs(latd + 8.0 + 7.0 * fbm(d * 3.0, 4)));
    float cthLon = smoothstep(10.0, 35.0, lond) * (1.0 - smoothstep(150.0, 168.0, lond));
    float patches = smoothstep(0.05, 0.45, fbm(d * 5.0 + 3.0, 4));
    float cth = belt * mix(patches * 0.45, 0.95, cthLon) * (0.75 + 0.25 * fbm(d * 9.0, 3));
    float f1, f2;
    float h = 0.5 + fbm(d * 4.0, 5) * 0.12;
    h += craterField(d, 8.0, 0.4, 0.22, f1) * (1.0 - heart);
    h += craterField(d, 20.0, 0.45, 0.12, f2) * (1.0 - sputnik);
    h = mix(h, 0.42 + 0.02 * snoise(d * 30.0), sputnik);
    h += exp(-pow(q / 0.12, 2.0)) * 0.08 * heart;
    vec3 col = mix(${c('#c69e7a')}, ${c('#e2c8a8')}, smoothstep(-0.4, 0.6, fbm(d * 5.0 + 2.0, 5)));
    col = mix(col, ${c('#4a2a1c')}, clamp(cth, 0.0, 1.0) * 0.85);
    col = mix(col, ${c('#efe4d4')}, heart * 0.85);
    float cells = abs(snoise(d * 26.0));
    col = mix(col, ${c('#f6efe6')}, sputnik * (0.6 + 0.4 * smoothstep(0.05, 0.25, cells)));
    col = mix(col, ${c('#f0e6dc')}, smoothstep(55.0, 80.0, latd) * 0.35);
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), clamp(h, 0.0, 1.0));
  `,

  moonlet: /* glsl */ `
    float f1, f2, f3;
    float n = fbm(d * 4.0 + uSeed, 5);
    float h = 0.5 + n * 0.1;
    vec3 col = mix(uColB, uColA, smoothstep(-0.5, 0.5, n));
    if (uStyle < 0.5) {
      h += craterField(d, 5.0, 0.6, 0.3, f1) + craterField(d, 12.0, 0.7, 0.2, f2) + craterField(d, 28.0, 0.7, 0.12, f3);
      col *= 0.8 + 0.4 * clamp((h - 0.4) * 1.5, 0.0, 1.0);
      col += vec3(0.18) * max(max(f1, f2), f3);
    } else if (uStyle < 1.5) {
      float sulfur = fbm(d * 6.0 + 2.0, 5);
      col = mix(uColA, ${c('#f2ead0')}, smoothstep(0.2, 0.6, sulfur) * 0.6);
      col = mix(col, uColB, smoothstep(-0.2, -0.6, sulfur) * 0.7);
      vec3 cell = d * 9.0;
      vec3 ip = floor(cell); vec3 fp = fract(cell);
      for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++){
        vec3 g = vec3(float(x), float(y), float(z));
        vec3 r = hash33(ip + g);
        float dd = length(fp - g - r);
        if (r.z < 0.35) {
          col = mix(col, ${c('#2a1a10')}, (1.0 - smoothstep(0.05, 0.1, dd)));
          col = mix(col, ${c('#c0482a')}, exp(-pow((dd - 0.14) / 0.05, 2.0)) * 0.6);
        }
      }
    } else if (uStyle < 2.5) {
      float l1 = pow(1.0 - abs(snoise(d * 3.5)), 18.0);
      float l2 = pow(1.0 - abs(snoise(d * 7.0 + 3.0)), 22.0);
      float l3 = pow(1.0 - abs(snoise(d * 14.0 + 7.0)), 26.0);
      col = mix(uColA, ${c('#d8c4a6')}, smoothstep(-0.3, 0.6, fbm(d * 3.0, 4)) * 0.4);
      col = mix(col, uColB, clamp(l1 + l2 * 0.8 + l3 * 0.6, 0.0, 1.0) * 0.8);
      h += (l1 + l2) * 0.05;
    } else if (uStyle < 3.5) {
      col = mix(uColA, uColB, smoothstep(-0.2, 0.5, fbm(d * 2.5, 4)) * 0.5);
    } else if (uStyle < 4.5) {
      col = mix(uColA, uColB, smoothstep(0.2, 0.7, fbm(d * 6.0, 4)) * 0.4);
      float lat = asin(d.y);
      float stripes = 0.0;
      for (int i = 0; i < 4; i++){
        float off = float(i) * 0.09 - 0.13;
        stripes = max(stripes, exp(-pow((dot(d, normalize(vec3(1.0, 0.0, 0.6))) - off) / 0.012, 2.0)));
      }
      col = mix(col, ${c('#6d8fb0')}, stripes * smoothstep(-0.95, -1.2, lat - 0.25) * 0.0 + stripes * smoothstep(-0.55, -0.85, d.y) * 0.8);
      h += craterField(d, 9.0, 0.4, 0.16, f1) * smoothstep(0.0, 0.5, d.y);
    } else {
      vec3 cell = d * 14.0;
      float cc = abs(snoise(cell)) + abs(snoise(cell * 2.1)) * 0.5;
      col = mix(uColB, uColA, smoothstep(0.15, 0.6, cc));
      col = mix(col, ${c('#efd9cf')}, smoothstep(-0.2, -0.5, d.y) * 0.6);
      float streak = smoothstep(0.6, 0.9, snoise(vec3(d.x * 30.0, d.y * 4.0, d.z * 30.0))) * smoothstep(-0.2, -0.5, d.y);
      col = mix(col, ${c('#3b2e2a')}, streak * 0.6);
      h += cc * 0.06;
    }
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), clamp(h, 0.0, 1.0));
  `,

  ringSaturn: /* glsl */ `
    float r = mix(1.11, 2.34, uv.x);
    float dens = 0.0;
    dens += smoothstep(1.11, 1.13, r) * (1.0 - smoothstep(1.23, 1.24, r)) * 0.05;
    float Cr = smoothstep(1.235, 1.245, r) * (1.0 - smoothstep(1.52, 1.53, r));
    dens += Cr * (0.2 + 0.08 * sin(r * 160.0));
    float Br = smoothstep(1.525, 1.535, r) * (1.0 - smoothstep(1.945, 1.952, r));
    dens += Br * (0.72 + 0.26 * smoothstep(1.55, 1.78, r));
    float Cas = smoothstep(1.952, 1.96, r) * (1.0 - smoothstep(2.02, 2.027, r));
    dens += Cas * 0.05;
    float Ar = smoothstep(2.025, 2.032, r) * (1.0 - smoothstep(2.265, 2.27, r));
    dens += Ar * 0.62;
    dens *= 1.0 - (1.0 - smoothstep(0.0, 0.0035, abs(r - 2.214))) * Ar;
    dens *= 1.0 - (1.0 - smoothstep(0.0, 0.0012, abs(r - 2.2646))) * Ar;
    dens += exp(-pow((r - 2.326) / 0.0028, 2.0)) * 0.55;
    float fine = snoise(vec3(r * 230.0, 0.0, 0.0)) * 0.5 + 0.5;
    float fine2 = snoise(vec3(r * 950.0, 3.0, 0.0)) * 0.5 + 0.5;
    dens *= 0.7 + 0.22 * fine + 0.14 * fine2;
    vec3 col = ${c('#8a7f6f')} * Cr + mix(${c('#e9d7ae')}, ${c('#d2bb8e')}, smoothstep(1.6, 1.94, r)) * Br + ${c('#c6b593')} * Ar + ${c('#7a7163')} * Cas;
    col += ${c('#d8d0c0')} * exp(-pow((r - 2.326) / 0.006, 2.0)) + ${c('#7d7466')} * (1.0 - Cr - Br - Ar - Cas) * step(r, 1.24);
    col *= 0.9 + 0.2 * fine;
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), clamp(dens, 0.0, 1.0));
  `,

  ringUranus: /* glsl */ `
    float r = mix(1.6, 2.06, uv.x);
    float dens = 0.0;
    float rr[8];
    rr[0] = 1.637; rr[1] = 1.652; rr[2] = 1.666; rr[3] = 1.75; rr[4] = 1.786; rr[5] = 1.834; rr[6] = 1.863; rr[7] = 1.912;
    for (int i = 0; i < 8; i++) dens += exp(-pow((r - rr[i]) / 0.0022, 2.0)) * 0.55;
    dens += exp(-pow((r - 2.0) / 0.006, 2.0)) * 0.95;
    dens += smoothstep(1.62, 1.7, r) * (1.0 - smoothstep(1.95, 2.02, r)) * 0.03;
    vec3 col = ${c('#9c9890')};
    gl_FragColor = vec4(col, clamp(dens, 0.0, 1.0));
  `,
};

export function bakeFragment(recipe: string): string {
  const body = RECIPES[recipe];
  if (!body) throw new Error(`Unknown bake recipe: ${recipe}`);
  return `${HEADER}\nvoid main(){\n vec2 uv = vUv;\n vec3 d = uvToDir(uv);\n ${body}\n}`;
}
