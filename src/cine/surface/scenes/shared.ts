/** GLSL helpers shared by several planet scenes (appended to a scene's `look` where needed). */
export const SKY_LIB = /* glsl */ `
float cdens(vec2 p, float cover, int oct){ return smoothstep(cover, cover + 0.28, fbm(p, oct)); }

/** a planar cloud deck seen from below and lit from the sun's side; rgb + alpha */
vec4 cloudDeck(vec3 rd, vec3 sd, float scale, float cover, vec3 lit, vec3 shade, vec2 wind){
  if (rd.y < 0.003) return vec4(0.0);
  vec2 p = rd.xz / (rd.y + 0.08) * scale + wind;
  float d = cdens(p, cover, 6);
  vec2 sp = normalize(sd.xz + vec2(1e-4)) * 0.07;
  float d2 = cdens(p + sp * 0.5, cover, 5);
  float l = clamp(0.5 + (d - d2) * 5.0 + (d - 0.5) * 0.4, 0.0, 1.0);
  float a = d * smoothstep(0.0, 0.10, rd.y);
  return vec4(mix(shade, lit, l), a);
}

/** thin, streaky high cloud (cirrus): noise stretched along one axis */
float cirrus(vec3 rd, float scale, vec2 stretch, float cover){
  if (rd.y < 0.004) return 0.0;
  vec2 p = rd.xz / (rd.y + 0.12) * scale;
  p = vec2(dot(p, vec2(stretch.x, -stretch.y)), dot(p, vec2(stretch.y, stretch.x)));
  p *= vec2(0.18, 1.0);
  float n = fbm(p, 6);
  return smoothstep(cover, cover + 0.3, n) * smoothstep(0.0, 0.2, rd.y);
}

/** soft disc with glow: cosine of angle to the sun in, rgb out */
vec3 sunGlow(float mu, vec3 core, vec3 halo, float haloPow, float discCos){
  float disc = smoothstep(discCos, discCos + (1.0 - discCos) * 0.35, mu);
  return core * disc + halo * pow(max(mu, 0.0), haloPow);
}

float sdSeg(vec2 p, vec2 a, vec2 b, float ra, float rb){
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - mix(ra, rb, h);
}
`;

/** a moon as a lit sphere: dir = where it hangs, rad = angular radius (radians) */
export const MOON_LIB = /* glsl */ `
vec4 moonDisc(vec3 rd, vec3 mdir, float rad, vec3 sd, vec3 baseCol){
  float c = dot(rd, mdir);
  float ang = acos(clamp(c, -1.0, 1.0));
  if (ang > rad * 1.15) return vec4(0.0);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), mdir));
  vec3 up = cross(mdir, right);
  vec2 o = vec2(dot(rd, right), dot(rd, up)) / sin(rad);
  float r2 = dot(o, o);
  float a = 1.0 - smoothstep(0.96, 1.02, sqrt(r2));
  vec3 n = normalize(right * o.x + up * o.y - mdir * sqrt(max(1.0 - r2, 0.0)));
  float lit = smoothstep(-0.08, 0.35, dot(n, sd));
  float tex = 0.78 + 0.45 * fbm(o * 3.0 + 7.0, 4);
  return vec4(baseCol * tex * (0.06 + 0.94 * lit), a);
}
`;

/** cellular noise: distances to the two nearest feature points (plates, cracks) */
export const WORLEY_LIB = /* glsl */ `
void worley(vec2 p, out float f1, out float f2, out vec2 cid){
  vec2 ip = floor(p);
  vec2 fp = fract(p);
  f1 = 8.0; f2 = 8.0; cid = vec2(0.0);
  for (int j = -1; j <= 1; j++){
    for (int i = -1; i <= 1; i++){
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash22(ip + g + uSeed);
      float d = length(g + o - fp);
      if (d < f1){ f2 = f1; f1 = d; cid = ip + g; }
      else if (d < f2){ f2 = d; }
    }
  }
}
`;

/** camera basis helper for overlays that need to project a world point to the screen */
export const PROJECT_LIB = /* glsl */ `
vec3 camFwd(){ return normalize(camTarget() - camPos()); }
vec3 camRight(){ return normalize(cross(vec3(0.0, 1.0, 0.0), camFwd())); }
vec3 camUp(){ return cross(camFwd(), camRight()); }
/** screen coords (same space as q) and camera-space depth */
vec3 projectPoint(vec3 w){
  vec3 v = w - camPos();
  float z = dot(v, camFwd());
  return vec3(camFocal() * vec2(dot(v, camRight()), dot(v, camUp())) / z, z);
}
`;
