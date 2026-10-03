precision highp float;
precision highp int;

#if ( NUM_POINT_LIGHTS > 0 )
struct PointLight {
    vec3 color;
    vec3 position; // light position, in camera coordinates
    float distance; // used for attenuation purposes.
    float intensity;
    float decay;
};
uniform PointLight pointLights[NUM_POINT_LIGHTS];
#endif

uniform float ambient;
uniform float diffuse;
uniform float specular;
uniform float specularExp;
uniform float time;
uniform float tscale;
uniform float var1;

uniform sampler2D diffuseMap;
uniform sampler2D normalMap;
uniform bool diffuseMapProvided;
uniform bool normalMapProvided;

varying vec4 vPosition;
varying vec3 vNormal;
varying vec2 vUv;
#ifdef USE_COLOR
varying vec4 vColor;
#endif

#if ( NUM_POINT_LIGHTS > 0 )

vec3 evalDiffuse(vec3 position, vec3 N, int lightIndex){
    vec4 lightPosition = vec4(pointLights[lightIndex].position, 1.0);
    vec3 lightColor = pointLights[lightIndex].color;

    // The distance parameter in ThreeJS point lights is actually their range.
    float lightRange = pointLights[lightIndex].distance;
    // The decay parameter controls how quickly the light decays over the specified range.
    float lightDecay = pointLights[lightIndex].decay;

    vec3 pToL = lightPosition.xyz - vPosition.xyz;
    vec3 L = normalize(pToL);

    // ★ 修正：漫反射强度 clamp 到 [0,1]
    float diffuseStrength = max(dot(N, L), 0.0);

    float dist = length(pToL);
    float falloff = max(0.0, 1.0 - (dist / lightRange));
    falloff = pow(falloff, lightDecay);

    // 原来没有用 falloff，这里为了“尽量不改变原有效果”，先不乘 falloff
    // 你以后想要衰减，可以改成：diffuseStrength *= falloff;
    return diffuseStrength * lightColor;
}

vec3 evalSpecular(vec3 position, vec3 N, int lightIndex){
    vec4 lightPosition = vec4(pointLights[lightIndex].position, 1.0);
    vec3 lightColor = pointLights[lightIndex].color;
    float lightDistance = pointLights[lightIndex].distance;
    float lightDecay = pointLights[lightIndex].decay;
    vec3 pToL = lightPosition.xyz - vPosition.xyz;

    vec3 L = normalize(pToL);
    vec3 vertexToEye = normalize(-position);
    vec3 lightReflect = normalize(reflect(-L, N));
    float specularFactor = max(dot(vertexToEye, lightReflect), 0.0);
    return lightColor * pow(specularFactor, specularExp);
}
#endif


void main() {
    vec3 n = normalize(vNormal);
    vec3 p = vPosition.xyz / vPosition.w;

    #ifdef USE_COLOR
    vec4 surface_color = vColor;
    #else
    vec4 surface_color = vec4(1.0, 1.0, 1.0, 1.0);
    #endif

    // ★ 改动：更精细地处理贴图和 alpha
    if (diffuseMapProvided) {
        vec4 texColor = texture2D(diffuseMap, vUv);

        // 贴图透明区域直接丢弃 fragment
        if (texColor.a < 0.1) {
            discard;
        }

        // 分别乘 rgb / alpha，保留材质颜色和透明度
        surface_color.rgb *= texColor.rgb;
        surface_color.a   *= texColor.a;
    } else {
        // 保持 surface_color 不变
        surface_color = surface_color;
    }

    vec3 specularLighting = vec3(0.0);
    vec3 diffuseLighting  = vec3(0.0);
    vec3 lighting;

    #if ( NUM_POINT_LIGHTS > 0 )
    for (int lightIndex = 0; lightIndex < int(NUM_POINT_LIGHTS); ++lightIndex) {
        specularLighting += evalSpecular(p, n, lightIndex);
        diffuseLighting  += evalDiffuse(p, n, lightIndex) * 0.2;
    }

    // ★ 改动：环境光乘以表面颜色，而不是加灰
    lighting = diffuseLighting * surface_color.rgb * diffuse
        + specularLighting * specular
        + surface_color.rgb * ambient;
    #else
    // 没有灯光时，直接显示表面颜色（更直观 debug）
    // 原来是纯红，这里稍微友好一点；如果你要保留红色警告，可以改回去
    lighting = surface_color.rgb;
    #endif

    // ★ 用 surface_color 的 alpha 输出
    gl_FragColor = vec4(lighting, surface_color.a);
}
