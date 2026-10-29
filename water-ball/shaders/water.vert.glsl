#version 300 es
precision highp float;
precision highp int;
// PARAMETERS: populated from source/effective-parameters.json at compile time.
layout(location=0) in vec3 aPosition;
layout(location=1) in vec2 aUV;
uniform mat4 uViewProjection;
uniform vec3 uCamera;
uniform float uTime, uProgress, uDisplacement;
uniform int uIsolate;
uniform sampler2D uGradation, uVertexNoise, uDistortionNormal;
out vec3 vPosition, vNormal, vBasePosition;
out vec2 vUV;
out float vHeight;
// UV: shared global UV calculation, inserted by renderer.js.
void main() {
  vec3 n = normalize(aPosition);
  vec2 offset = globalUVOffset(aUV, aPosition, n);
  // Global-UV demo extension: both WPO inputs now share the surface offset.
  vec2 uvA = materialUV(aUV + vec2(1.0), offset,
    vec2(P_WaterVertex_Speed_U, P_WaterVertex_Speed_V), vec2(P_VertexTexture_U, P_VertexTexture_V));
  vec2 uvB = materialUV(aUV, offset,
    vec2(P_WaterVertexNoise_U_Speed, P_WaterVertexNoise_V_Speed), vec2(P_WaterVertexNoise_U, P_WaterVertexNoise_V));
  vec3 h = pow(textureLod(uGradation, uvA, 0.0).rgb, vec3(P_Vertex_Power)) * P_Vertex_Scalar
         + pow(textureLod(uVertexNoise, uvB, 0.0).rgb, vec3(P_WaterVertexNoise_Power)) * P_WaterTextureNoise_Scalar - 1.0;
  float poleMask = 1.0 - smoothstep(P_VertexMaskRange, 1.0, n.y)
                       - smoothstep(P_VertexMaskRange, 1.0, -n.y);
  // 01: establish the displaced silhouette before adding the surface branches.
  float enabled = uIsolate > 0 ? 1.0 : clamp(uProgress, 0.0, 1.0);
  // UE sphere radius 50 cm is normalized to 1 web unit; up-axis Z -> Y.
  vec3 displaced = aPosition + n * h * poleMask * 0.02 * uDisplacement * enabled;
  vPosition = displaced;
  vBasePosition = aPosition;
  vNormal = n;
  vUV = aUV;
  vHeight = dot(h, vec3(0.333333)) * poleMask;
  gl_Position = uViewProjection * vec4(displaced, 1.0);
}
