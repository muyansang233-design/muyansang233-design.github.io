// Shared by the vertex and fragment shaders. Time is never scaled by a stage fade.
vec2 materialUV(vec2 baseUV, vec2 offset, vec2 speed, vec2 tile) {
  return (baseUV + offset + uTime * speed) * tile;
}

vec2 globalUVOffset(vec2 baseUV, vec3 basePosition, vec3 baseNormal) {
  // Earlier diagnostic layers retain their unperturbed inputs.
  float enabled = uIsolate > 0 ? (uIsolate >= 7 ? 1.0 : 0.0) : clamp(uProgress - 6.0, 0.0, 1.0);
  if (enabled <= 0.0) return vec2(0.0);

  // This source generates the offset, so its seed UV must not depend on itself.
  vec2 seedUV = materialUV(baseUV, vec2(0.0),
    vec2(P_Distortion_Speed_U, P_Distortion_Speed_V),
    vec2(P_Distortion_Tile_U, P_Distortion_Tile_V));
  // Explicit LOD keeps vertex and fragment evaluations consistent.
  vec2 displacement = textureLod(uDistortionNormal, seedUV, 0.0).rg * 2.0 - 1.0;
  float phi = baseUV.x * 6.28318530718;
  vec3 tangent = normalize(vec3(-sin(phi), 0.0, cos(phi)));
  vec3 bitangent = normalize(cross(normalize(baseNormal), tangent));
  // Use the undisplaced position to avoid a WPO -> view -> offset -> WPO feedback loop.
  vec3 viewDirection = normalize(uCamera - basePosition);
  vec2 viewXY = vec2(dot(viewDirection, tangent), dot(viewDirection, bitangent));
  return mix(displacement, displacement * viewXY, P_Use_Parallax) * P_Distortion_Intensity * enabled;
}
