// Browser presentation environment. It replaces the runtime UE CubeRenderTarget,
// SkyAtmosphere light and scene color; it is not a recovered Unreal courtyard.
uniform vec3 uCamera, uForward, uRight, uUp;
uniform vec2 uResolution;
const float TAN_HALF_FOV = 0.3249196962;
vec3 rayDirection(vec2 pixel) {
  vec2 p = pixel / uResolution * 2.0 - 1.0;
  p.x *= uResolution.x / uResolution.y;
  return normalize(uForward + TAN_HALF_FOV * (p.x * uRight + p.y * uUp));
}
vec3 studioEnvironment(vec3 d) {
  vec3 sky = mix(vec3(0.012, 0.025, 0.033), vec3(0.17, 0.24, 0.26), smoothstep(-0.25, 1.0, d.y));
  float key = smoothstep(0.82, 0.87, dot(d, normalize(vec3(-0.65, 0.9, 0.6))));
  float strip = smoothstep(0.987, 0.996, abs(d.x * 0.84 + d.z * 0.54)) * smoothstep(-0.3, 0.1, d.y);
  float rim = pow(max(dot(d, normalize(vec3(0.9, 0.2, -0.5))), 0.0), 28.0);
  return sky + vec3(2.8, 3.1, 3.0) * key + vec3(3.5) * strip + vec3(0.5, 0.9, 1.0) * rim;
}
vec3 sceneColor(vec3 origin, vec3 ray) {
  vec3 color = mix(vec3(0.024, 0.046, 0.059), vec3(0.055, 0.095, 0.109), clamp(0.5 + ray.y, 0.0, 1.0));
  float floorT = (-1.22 - origin.y) / ray.y;
  if (ray.y < -0.0001 && floorT > 0.0) {
    vec3 hit = origin + ray * floorT;
    vec2 cell = hit.xz * 1.3;
    vec2 fw = max(fwidth(cell), vec2(0.001));
    vec2 grid = abs(fract(cell - 0.5) - 0.5) / fw;
    float line = 1.0 - min(min(grid.x, grid.y), 1.0);
    float distanceFade = exp(-length(hit.xz) * 0.08);
    color = mix(vec3(0.041, 0.071, 0.082), vec3(0.075, 0.126, 0.138), exp(-length(hit.xz) * 0.18));
    color += line * distanceFade * vec3(0.025, 0.041, 0.044);
    float shadow = exp(-dot(hit.xz, hit.xz) * 1.15);
    color *= 1.0 - shadow * 0.6;
    color = mix(vec3(0.033, 0.057, 0.068), color, exp(-floorT * 0.016));
  }
  return color;
}
vec3 displayColor(vec3 linearColor) {
  // Browser-only display mapping; material math stays in linear space.
  vec3 mapped = max(linearColor, 0.0) / (max(linearColor, 0.0) + 0.72);
  return pow(mapped, vec3(1.0 / 2.2));
}
