#version 300 es
precision highp float;
precision highp int;
// PARAMETERS: populated from source/effective-parameters.json at compile time.
// SCENE: shared browser studio, inserted by renderer.js.
in vec3 vPosition, vNormal, vBasePosition;
in vec2 vUV;
in float vHeight;
out vec4 fragColor;
uniform float uTime, uProgress, uNormalStrength, uFoamStrength;
uniform int uIsolate;
uniform sampler2D uDistortionNormal, uNormalA, uNormalB, uWaterColor, uFoamTexture, uWaterAlpha;
float layer(float index) { return uIsolate > 0 ? 1.0 : clamp(uProgress - index + 1.0, 0.0, 1.0); }
float sat(float value) { return clamp(value, 0.0, 1.0); }
vec3 unpackNormal(vec3 encoded) {
  vec2 xy = encoded.rg * 2.0 - 1.0;
  return vec3(xy, sqrt(max(1.0 - dot(xy, xy), 0.0)));
}
vec3 desaturate(vec3 c, float amount) { return mix(c, vec3(dot(c, vec3(0.212639, 0.71516865, 0.07219232))), amount); }
// UV: shared global UV calculation, inserted by renderer.js.
void main() {
  vec3 vertexN = normalize(vNormal);
  float phi = vUV.x * 6.28318530718;
  vec3 tangent = normalize(vec3(-sin(phi), 0.0, cos(phi)));
  vec3 bitangent = normalize(cross(vertexN, tangent));
  mat3 tangentToWorld = mat3(tangent, bitangent, vertexN);
  vec3 V = normalize(uCamera - vPosition);

  // 02: continuous UV flow; 07: the same global offset used by both WPO inputs.
  vec2 waterSpeed = vec2(P_WaterTexture_U_speed, P_WaterTexture_V_speed);
  vec2 waterTile = vec2(P_WaterTexture_Tile_U, P_WaterTexture_Tile_V);
  vec2 uvFlow = materialUV(vUV, vec2(0.0), waterSpeed, waterTile);
  vec2 offset = globalUVOffset(vUV, vBasePosition, vertexN);
  vec2 uvWater = materialUV(vUV, offset, waterSpeed, waterTile);

  // 03: BlendAngleCorrectedNormals (the actual UE material-function formula).
  vec3 n1 = unpackNormal(texture(uNormalA, uvWater).rgb);
  vec3 n2 = unpackNormal(texture(uNormalB, uvWater).rgb);
  vec3 t = n1 + vec3(0.0, 0.0, 1.0);
  vec3 u = n2 * vec3(-1.0, -1.0, 1.0);
  vec3 blended = normalize(t * dot(t, u) - u * t.z);
  vec3 normalTS = vec3(blended.xy * P_NormalScalar * uNormalStrength, blended.z);
  vec3 N = normalize(tangentToWorld * mix(vec3(0.0, 0.0, 1.0), normalTS, layer(3.0)));
  float grazing = pow(max(1.0 - max(dot(N, V), 0.0), 0.0001), 5.0);
  float fresnel04 = 0.04 + 0.96 * grazing;

  // 04: T_WaterColor -> Desaturation -> Power/Scalar; Fresnel -> tint Lerp.
  vec3 waterTex = texture(uWaterColor, uvWater).rgb;
  vec3 waterColor = pow(max(desaturate(waterTex, P_WaterTexture_preDesaturation), vec3(0.0)), vec3(P_WaterTexture_Power)) * P_WaterTexture_Scalar;
  vec3 absorptionTint = mix(P_Param, vec3(1.0), pow(fresnel04, P_Absorbtion_Fresnel_Power));
  vec3 tintedWater = waterColor * absorptionTint;

  // 05: Cube reflection + manually computed SkyAtmosphere highlight (Unlit).
  vec3 R = reflect(-V, N);
  vec3 environment = desaturate(studioEnvironment(R), P_Env_Desaturation)
                   * mix(P_EnvSpecular_Low, P_EnvSpecular_High, pow(fresnel04, P_Env_Fresnel));
  vec3 lightDirection = normalize(vec3(-0.65, 0.9, 0.6));
  vec3 lightIlluminance = vec3(0.32, 0.36, 0.37);
  float highlight = pow(sat(dot(R, lightDirection) - P_Specular_Range) / max(1.0 - P_Specular_Range, 0.00001), P_Specular_Power) * P_Specular_Scalar;
  vec3 specular = highlight * lightIlluminance;

  // 06: T_Noise_Water.r -> Power -> Scalar -> white-foam Lerp.
  vec2 uvFoam = materialUV(vUV, offset, vec2(P_Foam_U_Speed, P_Foam_V_Speed), vec2(P_FoamTile_U, P_FoamTile_V));
  float foam = pow(max(texture(uFoamTexture, uvFoam).r, 0.0), P_FoamTexture_Power) * P_FoamTexture_Scalar * uFoamStrength;
  float visibleFoam = foam * layer(6.0);
  // Neutral lighting and UV checker reveal the geometry, UV and normal branches before water color.
  float diffuse = max(dot(N, normalize(vec3(-0.5, 0.9, 0.8))), 0.0);
  vec3 neutral = vec3(0.12, 0.17, 0.18) * (0.4 + diffuse * 1.6);
  float checker = mod(floor(uvWater.x * 24.0) + floor(uvWater.y * 12.0), 2.0);
  vec3 uvDiagnostic = mix(vec3(0.035, 0.12, 0.14), vec3(0.17, 0.34, 0.34), checker) * (0.5 + diffuse);
  neutral = mix(neutral, uvDiagnostic, layer(2.0) * (1.0 - layer(3.0)));
  neutral += studioEnvironment(R) * 0.1 * layer(3.0);
  vec3 body = mix(neutral, tintedWater, layer(4.0));
  vec3 emissive = mix(body, vec3(1.0), visibleFoam) + (environment + specular) * layer(5.0);

  // 08: T_SwirlNoise -> alpha; Fresnel absorption; foam; hemisphere mask.
  vec3 alphaTex = texture(uWaterAlpha, uvWater).rgb;
  vec3 textureAlpha = clamp(pow(max(alphaTex, vec3(0.0)), vec3(P_WaterAlpha_Power)) * P_WaterAlpha_Scalar, 0.0, 1.0);
  float fresnel01 = 0.01 + 0.99 * grazing;
  float absorptionAlpha = mix(P_Absorption_opacity, 0.0, pow(fresnel01, P_WaterFresnelAlpha_Power));
  float hemisphere = sat(pow(max(N.y + 1.0, 0.0), P_HemiSphereAlpha_Range));
  float alpha = sat(((textureAlpha.r + absorptionAlpha) * P_Opacity + pow(visibleFoam, P_Foam_Power) * P_Foam_Scalar) * hemisphere);
  // Current uasset output 90: Lerp(1, Lerp(1, IOR, hemisphere), default 0.5).
  float ior = mix(1.0, mix(1.0, P_Refraction, hemisphere), 0.5);
  // Browser adaptation: sample the same analytic scene through a refracted ray.
  // UE uses screen-space scene-color distortion instead of this studio ray lookup.
  vec3 refractedRay = refract(-V, N, 1.0 / ior);
  vec3 transmitted = sceneColor(vPosition - N * 0.03, refractedRay);
  vec3 finalColor = mix(transmitted, emissive, mix(1.0, alpha, layer(8.0)));

  if (uIsolate == 1) finalColor = mix(vec3(0.018, 0.08, 0.11), vec3(0.6, 0.95, 0.79), sat(vHeight / 12.0)) * (0.45 + diffuse);
  if (uIsolate == 2) finalColor = vec3(fract(uvFlow * vec2(4.0, 2.0)), 0.35) * 0.6;
  // Signed distortion XY is encoded as RG around 0.5 for the isolated diagnostic.
  if (uIsolate == 7) finalColor = vec3(clamp(offset / max(P_Distortion_Intensity, 0.00001) * 0.5 + 0.5, 0.0, 1.0), 0.5);
  if (uIsolate == 3) finalColor = normalize(normalTS) * 0.5 + 0.5;
  if (uIsolate == 4) finalColor = tintedWater;
  if (uIsolate == 5) finalColor = environment + specular;
  if (uIsolate == 6) finalColor = vec3(foam);
  if (uIsolate == 8) finalColor = vec3(alpha);
  // Masks and encoded normals are displayed without the artistic tone curve.
  vec3 display = uIsolate == 7 || uIsolate == 3 || uIsolate == 6 || uIsolate == 8 ? clamp(finalColor, 0.0, 1.0) : displayColor(finalColor);
  fragColor = vec4(display, 1.0);
}
