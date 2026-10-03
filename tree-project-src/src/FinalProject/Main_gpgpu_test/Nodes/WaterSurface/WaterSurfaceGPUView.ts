import * as THREE from "three";
import { ANodeView, ACamera } from "../../../../anigraph";
import { WaterSurfaceGPUModel } from "./WaterSurfaceGPUModel";
import { FluidSimulator } from "../../FluidSimulator";

// Vertex Shader
const vertexShader = /*glsl*/`
void main() {
    // position 来自全屏四边形，范围是 [-1, 1]
    // 直接作为 NDC 坐标输出，不需要任何矩阵变换
    gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// Volumetric Rendering with Depth-Aware Occlusion
const fragmentShaderTemplate = /*glsl*/`
precision highp float;

uniform vec3 uCameraPosition;
uniform vec3 boundsMin;
uniform vec3 boundsMax;

// ray-marching, inverse of rasterization process
uniform mat4 inverseProjectionMatrix;
uniform mat4 cameraToWorldMatrix;
uniform vec2 screenResolution;

uniform sampler2D sceneDepthTexture;
uniform float cameraNear;
uniform float cameraFar;

// 3d density field represented by 2d atlas
uniform sampler2D densityFieldAtlas;
uniform vec3 volumeResolution;
uniform vec2 atlasResolution;
uniform float slicesPerRow;

// Collision SDF (3D atlas)
uniform sampler2D collisionSDF;
uniform vec3 sdfBoundsMin;
uniform vec3 sdfBoundsMax;
uniform vec3 sdfVolumeResolution;
uniform vec2 sdfAtlasResolution;
uniform float sdfSlicesPerRow;

uniform float densityMultiplier;
uniform float viewMarchStepSize;
uniform float tinyNudge;
uniform int maxViewSteps;
const int MAX_VIEW_STEPS_CAP = 16384;    // compile-time limit

// Rendering parameters (now as uniforms)
uniform vec3 scatteringCoefficients;
uniform float surfaceOpacityThreshold;
uniform float edgeCut;
uniform float maxOpacity;
uniform vec3 shallowColor;
uniform vec3 deepColor;
uniform float depthGradientScale;
uniform float fresnelExponent;
uniform vec3 rimColor;
uniform float fresnelBlend;
uniform vec3 lightDir;
uniform float specularShininess;
uniform vec3 specularColor;
uniform float diffuseWeight;
uniform float specularWeight;
uniform float refractionEta;
uniform float minRefractionThickness; 
uniform float thicknessNormFactor;
uniform float refractionBlend;
uniform float normalEpsilonFactor;
uniform float specularNormalEpsilonFactor; 
uniform bool toonSpecularEnabled;

// Shoreline parameters
uniform bool shorelineEnabled;
uniform vec3 shorelineColor;
uniform float shorelineWidth;
uniform float shorelineIntensity;
uniform float shorelineRippleCount;
uniform float shorelineRippleSpeed;
uniform float uTime;

// 3D Noise function for distortion
vec3 mod289(vec3 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x) {
    return mod289(((x * 34.0) + 1.0) * x);
}

vec4 taylorInvSqrt(vec4 r) {
    return 1.79284291400159 - 0.85373472095314 * r;
}

float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    // First corner
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    // Other corners
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    //   x0 = x0 - 0.0 + 0.0 * C.xxx;
    //   x1 = x0 - i1  + 1.0 * C.xxx;
    //   x2 = x0 - i2  + 2.0 * C.xxx;
    //   x3 = x0 - 1.0 + 3.0 * C.xxx;
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    // Permutations
    i = mod289(i);
    vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    // Gradients: 7x7 points over a square, mapped onto an octahedron.
    // The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
    float n_ = 0.142857142857; // 1.0/7.0
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z); //  mod(p,7*7)

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_); // mod(j,N)

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    // vec4 s0 = vec4(lessThan(b0,0.0))*2.0 - 1.0;
    // vec4 s1 = vec4(lessThan(b1,0.0))*2.0 - 1.0;
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    // Normalise gradients
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    // Mix final noise value
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

vec3 getRayDirection(vec2 uv) {
    vec2 ndc = uv * 2.0 - 1.0;
    vec4 clipPos = vec4(ndc, -1.0, 1.0);
    vec4 viewPos = inverseProjectionMatrix * clipPos;
    viewPos = vec4(viewPos.xyz / viewPos.w, 0.0);
    vec3 worldDir = (cameraToWorldMatrix * viewPos).xyz;
    return normalize(worldDir);
}

float linearizeDepth(float depth) {
    if (depth >= 1.0) return cameraFar * 10.0;
    float z = depth * 2.0 - 1.0; // NDC
    return (2.0 * cameraNear * cameraFar) / (cameraFar + cameraNear - z * (cameraFar - cameraNear));
}


vec2 rayBoxDst(vec3 boxMin, vec3 boxMax, vec3 rayOrigin, vec3 rayDir) {
    vec3 invDir = 1.0 / rayDir;
    vec3 t0 = (boxMin - rayOrigin) * invDir;
    vec3 t1 = (boxMax - rayOrigin) * invDir;
    vec3 tmin = min(t0, t1);
    vec3 tmax = max(t0, t1);
    
    float dstA = max(max(tmin.x, tmin.y), tmin.z);
    float dstB = min(min(tmax.x, tmax.y), tmax.z);
    
    float dstToBox = max(0.0, dstA);
    float dstThroughBox = max(0.0, dstB - dstToBox);
    return vec2(dstToBox, dstThroughBox);
}

float sampleDensityAtlas(vec3 uvw) {
    vec3 voxelCoord = uvw * volumeResolution;
    float z = voxelCoord.z;
    float zFloor = floor(z);
    float zFrac = z - zFloor;
    
    float z0 = zFloor;
    float z1 = min(zFloor + 1.0, volumeResolution.z - 1.0);
    
    float sliceX0 = mod(z0, slicesPerRow);
    float sliceY0 = floor(z0 / slicesPerRow);
    float sliceX1 = mod(z1, slicesPerRow);
    float sliceY1 = floor(z1 / slicesPerRow);
    
    vec2 localUV = voxelCoord.xy / volumeResolution.xy;
    vec2 atlasUV0 = (vec2(sliceX0, sliceY0) + localUV) * volumeResolution.xy / atlasResolution;
    vec2 atlasUV1 = (vec2(sliceX1, sliceY1) + localUV) * volumeResolution.xy / atlasResolution;

    float d0 = texture2D(densityFieldAtlas, atlasUV0).r;
    float d1 = texture2D(densityFieldAtlas, atlasUV1).r;
    
    return mix(d0, d1, zFrac);
}

float sampleDensity(vec3 worldPos) {
    vec3 boundsSize = boundsMax - boundsMin;
    vec3 uvw = (worldPos - boundsMin) / boundsSize;
    
    const float epsilon = 0.0001;
    if (any(lessThanEqual(uvw, vec3(epsilon))) || any(greaterThanEqual(uvw, vec3(1.0 - epsilon)))) {
        return 0.0;
    }
    
    return sampleDensityAtlas(uvw);
}

float sampleCollisionSDF(vec3 worldPos) {
    vec3 sdfSize = sdfBoundsMax - sdfBoundsMin;
    vec3 uvw = (worldPos - sdfBoundsMin) / sdfSize;
    
    if (any(lessThan(uvw, vec3(0.001))) || any(greaterThan(uvw, vec3(0.999)))) {
        return 1.0;
    }
    
    vec3 voxelCoord = uvw * sdfVolumeResolution;
    float z = voxelCoord.z;
    float zFloor = floor(z);
    float zFrac = z - zFloor;
    
    float z0 = zFloor;
    float z1 = min(zFloor + 1.0, sdfVolumeResolution.z - 1.0);
    
    float sliceX0 = mod(z0, sdfSlicesPerRow);
    float sliceY0 = floor(z0 / sdfSlicesPerRow);
    float sliceX1 = mod(z1, sdfSlicesPerRow);
    float sliceY1 = floor(z1 / sdfSlicesPerRow);
    
    vec2 localUV = voxelCoord.xy / sdfVolumeResolution.xy;
    vec2 atlasUV0 = (vec2(sliceX0, sliceY0) + localUV) * sdfVolumeResolution.xy / sdfAtlasResolution;
    vec2 atlasUV1 = (vec2(sliceX1, sliceY1) + localUV) * sdfVolumeResolution.xy / sdfAtlasResolution;
    
    float d0 = texture2D(collisionSDF, atlasUV0).r;
    float d1 = texture2D(collisionSDF, atlasUV1).r;
    
    return mix(d0, d1, zFrac);
}

vec3 computeNormalFromDensity(vec3 worldPos) {
    vec3 boundsSize = boundsMax - boundsMin;
    float minDim = min(min(boundsSize.x, boundsSize.y), boundsSize.z);

    float eps = max(normalEpsilonFactor * minDim, 1e-4);
    vec3 offsetX = vec3(eps, 0.0, 0.0);
    vec3 offsetY = vec3(0.0, eps, 0.0);
    vec3 offsetZ = vec3(0.0, 0.0, eps);

    float dX1 = sampleDensity(worldPos + offsetX);
    float dX0 = sampleDensity(worldPos - offsetX);
    float dY1 = sampleDensity(worldPos + offsetY);
    float dY0 = sampleDensity(worldPos - offsetY);
    float dZ1 = sampleDensity(worldPos + offsetZ);
    float dZ0 = sampleDensity(worldPos - offsetZ);

    vec3 grad = vec3(dX1 - dX0, dY1 - dY0, dZ1 - dZ0);
    float gLen2 = dot(grad, grad);
    if (gLen2 < 1e-8) {
        return vec3(0.0, 0.0, 1.0);
    }
    return normalize(-grad);
}

vec3 computeSpecularNormalFromDensity(vec3 worldPos) {
    vec3 boundsSize = boundsMax - boundsMin;
    float minDim = min(min(boundsSize.x, boundsSize.y), boundsSize.z);

    float eps = max(specularNormalEpsilonFactor * minDim, 1e-4);
    vec3 offsetX = vec3(eps, 0.0, 0.0);
    vec3 offsetY = vec3(0.0, eps, 0.0);
    vec3 offsetZ = vec3(0.0, 0.0, eps);

    float dX1 = sampleDensity(worldPos + offsetX);
    float dX0 = sampleDensity(worldPos - offsetX);
    float dY1 = sampleDensity(worldPos + offsetY);
    float dY0 = sampleDensity(worldPos - offsetY);
    float dZ1 = sampleDensity(worldPos + offsetZ);
    float dZ0 = sampleDensity(worldPos - offsetZ);

    vec3 grad = vec3(dX1 - dX0, dY1 - dY0, dZ1 - dZ0);
    float gLen2 = dot(grad, grad);
    if (gLen2 < 1e-8) {
        return vec3(0.0, 0.0, 1.0);
    }
    return normalize(-grad);
}

vec3 sampleEnvironmentSimple(vec3 origin, vec3 dir) {
    return vec3(0.5, 0.5, 0.5);
}

// main render function
vec4 rayMarchFluid(vec2 uv, float stepSize, float sceneRayLen) {
    vec3 rayDir = getRayDirection(uv);
    vec3 rayPos = uCameraPosition;
    
    vec2 boundsDstInfo = rayBoxDst(boundsMin, boundsMax, rayPos, rayDir);
    float dstToBox = boundsDstInfo.x;
    float dstThroughBox = boundsDstInfo.y;
    
    if (dstThroughBox <= 0.0) {
        return vec4(0.0);
    }
    
    if (dstToBox > sceneRayLen) {
        return vec4(0.0);
    }
    
    vec3 entryPoint = rayPos + rayDir * (dstToBox + tinyNudge);
    
    float densityAlongViewRay = 0.0;
    vec3 totalLight = vec3(0.0);
    
    bool surfaceFound = false;
    vec3 surfacePos = vec3(0.0);
    float surfaceDist = 0.0;
    
    // Beer-Lambert
    float dstTravelled = 0.0;
    float maxDst = min(dstThroughBox - tinyNudge * 2.0, sceneRayLen - dstToBox);
    
    for (int i = 0; i < MAX_VIEW_STEPS_CAP; i++) {
        if (i >= maxViewSteps) break;
        if (dstTravelled >= maxDst) break;
        
        vec3 samplePos = entryPoint + rayDir * dstTravelled;
        
        float rawDensity = sampleDensity(samplePos);
        float densityAtStep = rawDensity * densityMultiplier * stepSize;

        if (densityAtStep > 0.0) {
            densityAlongViewRay += densityAtStep;

            vec3 inScatteredLight = vec3(1.0) * densityAtStep * scatteringCoefficients;

            vec3 viewRayTransmittance = exp(-densityAlongViewRay * scatteringCoefficients);

            totalLight += inScatteredLight * viewRayTransmittance;
        }

        vec3 cumulativeTrans = exp(-densityAlongViewRay * scatteringCoefficients);
        float opacityAccum = 1.0 - clamp((cumulativeTrans.r + cumulativeTrans.g + cumulativeTrans.b) / 3.0, 0.0, 1.0);

        if (!surfaceFound && opacityAccum > surfaceOpacityThreshold) {
            surfaceFound = true;
            surfacePos = samplePos;
            surfaceDist = dstToBox + dstTravelled;
        }

        dstTravelled += stepSize;
    }
    
    vec3 finalTransmittance = exp(-densityAlongViewRay * scatteringCoefficients);
    float transAvg = clamp((finalTransmittance.r + finalTransmittance.g + finalTransmittance.b) / 3.0, 0.0, 1.0);
    float opacity = 1.0 - transAvg;

    // ===== edge hardening [0,1] =====
    if (opacity < edgeCut) {
        return vec4(0.0);
    }
    opacity = (opacity - edgeCut) / (1.0 - edgeCut);

    if (opacity <= 0.001) {
        return vec4(0.0);
    }

    // Cap base water opacity (but NOT final opacity - we'll add highlights later)
    float baseOpacity = min(opacity, maxOpacity);

    // ===== 阶段 2：water color + rim light =====

    vec3 baseColor = totalLight;

    vec3 boundsSize = boundsMax - boundsMin;
    float maxDepth = length(boundsSize) * depthGradientScale;
    float depthT = 0.0;
    if (surfaceFound) {
        depthT = clamp(surfaceDist / maxDepth, 0.0, 1.0);
    }
    vec3 waterTint = mix(shallowColor, deepColor, depthT);

    float baseIntensity = length(baseColor);
    vec3 baseDir = baseIntensity > 1e-6 ? baseColor / baseIntensity : vec3(0.0, 0.0, 1.0);
    vec3 color = waterTint * baseIntensity;

    // Fresnel edge highlights + simple Blinn-Phong highlights + refractive transparency: 
    // The edges and reflections appear brighter when the camera sweeps across the water surface.
    if (surfaceFound) {
        vec3 normal = computeNormalFromDensity(surfacePos);

        float ndotv = max(0.0, dot(normal, -rayDir));
        float fresnel = pow(1.0 - ndotv, fresnelExponent);
        color = mix(color, rimColor, fresnel * fresnelBlend);

        vec3 specularNormal = computeSpecularNormalFromDensity(surfacePos);

        vec3 normalizedLight = normalize(lightDir);
        vec3 viewDir  = normalize(uCameraPosition - surfacePos);
        vec3 halfVec  = normalize(normalizedLight + viewDir);

        float NdotL = max(0.0, dot(specularNormal, normalizedLight));
        float NdotH = max(0.0, dot(specularNormal, halfVec));

        vec3 diffuse  = waterTint * NdotL * diffuseWeight;

        // Specular highlight
        float specTerm = pow(NdotH, specularShininess);
        if (toonSpecularEnabled) {
            // Toon Specular: hard cutoff at 0.5
            specTerm = step(0.5, specTerm);
        }
        vec3 specular = specularColor * specTerm * specularWeight;

        color += diffuse + specular;

        // Increase opacity where highlights are strong (makes highlights fully opaque)
        // When specular is at full strength, opacity should be 1.0
        float highlightContribution = specTerm;  // 0-1 range
        // Mix towards full opacity based on highlight strength
        baseOpacity = max(baseOpacity, highlightContribution);

        // ===== refraction (fake) + reflection ========================
        vec3 refrDir = refract(-rayDir, normal, refractionEta);

        if (dot(refrDir, normal) < 0.0 && dot(refrDir, refrDir) > 0.001) {
            vec3 startInside = surfacePos - normal * tinyNudge;
            vec2 innerInfo = rayBoxDst(boundsMin, boundsMax, startInside, refrDir);
            float thickness = innerInfo.y;

            if (thickness > minRefractionThickness) {
                vec3 exitPos = startInside + refrDir * thickness;

                vec3 refractCol = sampleEnvironmentSimple(exitPos, -rayDir);

                vec3 transmission = exp(-thickness * scatteringCoefficients);
                refractCol *= transmission;

                float thicknessFactor = clamp((thickness - minRefractionThickness) / (maxDepth * thicknessNormFactor), 0.0, 1.0);
                float refractionWeight = refractionBlend * fresnel * thicknessFactor;

                color = mix(color, refractCol, refractionWeight);
            }
        }
    }

    // Shoreline effect using SDF
    if (shorelineEnabled && surfaceFound) {
        // 0. spatial distortion

        vec3 distortionNoise = vec3(
            snoise(surfacePos * 1.5 + vec3(0.0, 0.0, uTime * 0.1)),
            snoise(surfacePos * 1.5 + vec3(4.0, 4.0, uTime * 0.1)),
            0.0
        );
        vec3 distortedPos = surfacePos + distortionNoise * 0.1;

        float sdfDist = sampleCollisionSDF(distortedPos);
        
        float dist = max(0.0, sdfDist);
        
        float effectiveWidth = shorelineWidth;

        // 1. Edge Erosion

        float noiseFreq = max(1.0, shorelineRippleCount);
        float erosionNoise = snoise(surfacePos * noiseFreq + vec3(uTime * shorelineRippleSpeed));
        
        float erosionStrength = shorelineWidth * 0.3;
        
        float edgeMask = step(dist + erosionNoise * erosionStrength, effectiveWidth);
        
        float finalFoam = edgeMask * shorelineIntensity;
        
        color = mix(color, shorelineColor, finalFoam);

        // Shoreline also increases opacity
        baseOpacity = max(baseOpacity, finalFoam);
    }

    return vec4(color, baseOpacity);
}

void main() {
    vec2 screenUV = gl_FragCoord.xy / screenResolution;
    vec3 rayDir = getRayDirection(screenUV);
    
    if (rayBoxDst(boundsMin, boundsMax, uCameraPosition, rayDir).y <= 0.0) {
        discard;
    }

    float depthSample = texture2D(sceneDepthTexture, screenUV).r;
    float sceneRayLen;
    if (depthSample >= 1.0) {
        sceneRayLen = 1e6;
    } else {
        vec4 clipPos = vec4(screenUV * 2.0 - 1.0, depthSample * 2.0 - 1.0, 1.0);
        vec4 viewPos4 = inverseProjectionMatrix * clipPos;
        vec3 viewPos = viewPos4.xyz / max(viewPos4.w, 1e-6);
        sceneRayLen = length(viewPos);
    }

    vec4 color = rayMarchFluid(screenUV, viewMarchStepSize, sceneRayLen);
    if (color.a <= 0.001) discard;
    
    gl_FragColor = color;
}
`;



export class WaterSurfaceGPUView extends ANodeView {
    private material!: THREE.ShaderMaterial;
    private fluidSimulator?: FluidSimulator;
    private fullscreenMesh?: THREE.Mesh;

    private camera: ACamera | null = null;
    private screenSize: { width: number; height: number } | null = null;

    private depthRenderTarget: THREE.WebGLRenderTarget | null = null;
    private cameraNear: number = 0.1;
    private cameraFar: number = 1000;

    get model(): WaterSurfaceGPUModel {
        return this._model as WaterSurfaceGPUModel;
    }

    public setCamera(camera: ACamera) {
        this.camera = camera;
        console.log("WaterSurfaceGPUView: Camera set, position:", camera.position);
    }

    /**
     * 设置实际的渲染分辨率（应该从 renderer.getSize() 获取）
     */
    public setScreenSize(width: number, height: number) {
        this.screenSize = { width, height };
        
        // 更新深度渲染目标大小
        if (this.depthRenderTarget) {
            this.depthRenderTarget.setSize(width, height);
        }
    }
    
    /**
     * 设置深度渲染目标（由 controller 创建并传入）
     */
    public setDepthRenderTarget(target: THREE.WebGLRenderTarget) {
        this.depthRenderTarget = target;
        this.material.uniforms.sceneDepthTexture.value = target.depthTexture;
        console.log("💧 WaterSurface: Depth render target set");
    }
    
    /**
     * 设置相机的近/远平面（用于深度线性化）
     */
    public setCameraNearFar(near: number, far: number) {
        this.cameraNear = near;
        this.cameraFar = far;
    }
    
    /**
     * 获取深度渲染目标（供 controller 访问）
     */
    public getDepthRenderTarget(): THREE.WebGLRenderTarget | null {
        return this.depthRenderTarget;
    }

    init() {
        this.material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader: fragmentShaderTemplate,
            uniforms: {
                boundsMin: { value: new THREE.Vector3() },
                boundsMax: { value: new THREE.Vector3() },

                uCameraPosition: { value: new THREE.Vector3() },

                inverseProjectionMatrix: { value: new THREE.Matrix4() },
                cameraToWorldMatrix: { value: new THREE.Matrix4() },
                screenResolution: { value: new THREE.Vector2(1, 1) },

                sceneDepthTexture: { value: null },
                cameraNear: { value: 0.1 },
                cameraFar: { value: 1000 },

                densityFieldAtlas: { value: null },
                volumeResolution: { value: new THREE.Vector3(32, 32, 32) },
                atlasResolution: { value: new THREE.Vector2(256, 128) },
                slicesPerRow: { value: 8.0 },

                densityMultiplier: { value: this.model.densityMultiplier },
                viewMarchStepSize: { value: this.model.viewMarchStepSize },
                tinyNudge: { value: this.model.tinyNudge },
                maxViewSteps: { value: this.model.maxViewSteps },

                // Rendering parameters (categories 1-8, 10)
                scatteringCoefficients: { value: new THREE.Vector3() },
                surfaceOpacityThreshold: { value: this.model.surfaceOpacityThreshold },
                edgeCut: { value: this.model.edgeCut },
                maxOpacity: { value: this.model.maxOpacity },
                shallowColor: { value: new THREE.Vector3() },
                deepColor: { value: new THREE.Vector3() },
                depthGradientScale: { value: this.model.depthGradientScale },
                fresnelExponent: { value: this.model.fresnelExponent },
                rimColor: { value: new THREE.Vector3() },
                fresnelBlend: { value: this.model.fresnelBlend },
                lightDir: { value: new THREE.Vector3() },
                specularShininess: { value: this.model.specularShininess },
                specularColor: { value: new THREE.Vector3() },
                diffuseWeight: { value: this.model.diffuseWeight },
                specularWeight: { value: this.model.specularWeight },
                refractionEta: { value: this.model.refractionEta },
                minRefractionThickness: { value: this.model.minRefractionThickness },
                thicknessNormFactor: { value: this.model.thicknessNormFactor },
                refractionBlend: { value: this.model.refractionBlend },
                normalEpsilonFactor: { value: this.model.normalEpsilonFactor },
                specularNormalEpsilonFactor: { value: this.model.specularNormalEpsilonFactor },
                toonSpecularEnabled: { value: this.model.toonSpecularEnabled },

                // Collision SDF (3D atlas)
                collisionSDF: { value: null },
                sdfBoundsMin: { value: new THREE.Vector3() },
                sdfBoundsMax: { value: new THREE.Vector3() },
                sdfVolumeResolution: { value: new THREE.Vector3() },
                sdfAtlasResolution: { value: new THREE.Vector2() },
                sdfSlicesPerRow: { value: 1.0 },

                // Shoreline
                shorelineEnabled: { value: this.model.shorelineEnabled },
                shorelineColor: { value: new THREE.Vector3() },
                shorelineWidth: { value: this.model.shorelineWidth },
                shorelineIntensity: { value: this.model.shorelineIntensity },
                shorelineRippleCount: { value: this.model.shorelineRippleCount },
                shorelineRippleSpeed: { value: this.model.shorelineRippleSpeed },
                uTime: { value: 0 },
            },
            transparent: true,
            depthWrite: false,
            depthTest: false,
        });

        const geometry = new THREE.PlaneGeometry(2, 2);
        const mesh = new THREE.Mesh(geometry, this.material);
        this.fullscreenMesh = mesh;

        mesh.frustumCulled = false;

        mesh.renderOrder = 9999;
        this.threejs.renderOrder = 9999;
        
        this.threejs.add(mesh);


        this.subscribe(
            this.model.addUpdateListener((self, eventData?: any) => {
                const t = typeof eventData === "number" ? eventData : performance.now() * 0.001;
                this.update(t);
            })
        );
    }


    setFluidSimulator(simulator: FluidSimulator) {
        this.fluidSimulator = simulator;
        const uniforms = this.material.uniforms;

        // 获取 3D 密度场参数
        const densityParams = simulator.getDensityFieldParams();
        uniforms.densityFieldAtlas.value = simulator.getDensityField3DTexture();
        uniforms.volumeResolution.value.copy(densityParams.volumeResolution);
        uniforms.atlasResolution.value.copy(densityParams.atlasResolution);
        uniforms.slicesPerRow.value = densityParams.slicesPerRow;

        // 获取碰撞 SDF 参数
        const sdfTex = simulator.getCollisionSDFTexture();
        if (sdfTex) {
            uniforms.collisionSDF.value = sdfTex;
            const sdfParams = simulator.getSDFParams();
            uniforms.sdfBoundsMin.value.copy(sdfParams.boundsMin);
            uniforms.sdfBoundsMax.value.copy(sdfParams.boundsMax);
            uniforms.sdfVolumeResolution.value.copy(sdfParams.volumeResolution);
            uniforms.sdfAtlasResolution.value.copy(sdfParams.atlasResolution);
            uniforms.sdfSlicesPerRow.value = sdfParams.slicesPerRow;
        }

    }
   
    update(t: number) {
        if(!this.fluidSimulator) return;

        const isRaymarch = this.model.renderMode === "raymarch";
        if (this.fullscreenMesh) {
            this.fullscreenMesh.visible = isRaymarch;
        }
        if (!isRaymarch) {
            return;
        }

        // 1. fluid boundary
        const minVec = this.model.getBoundsMin();
        const maxVec = this.model.getBoundsMax();

        const minThree = new THREE.Vector3(minVec.x, minVec.y, minVec.z);
        const maxThree = new THREE.Vector3(maxVec.x, maxVec.y, maxVec.z);


        // 2. update Uniforms
        this.material.uniforms.boundsMin.value.copy(minThree);
        this.material.uniforms.boundsMax.value.copy(maxThree);
        this.material.uniforms.densityMultiplier.value = this.model.densityMultiplier;

        // Update rendering parameters
        const sc = this.model.scatteringCoefficients;
        this.material.uniforms.scatteringCoefficients.value.set(sc.x, sc.y, sc.z);
        this.material.uniforms.surfaceOpacityThreshold.value = this.model.surfaceOpacityThreshold;
        this.material.uniforms.edgeCut.value = this.model.edgeCut;
        this.material.uniforms.maxOpacity.value = this.model.maxOpacity;

        const shallow = this.model.shallowColor;
        this.material.uniforms.shallowColor.value.set(shallow.x, shallow.y, shallow.z);
        const deep = this.model.deepColor;
        this.material.uniforms.deepColor.value.set(deep.x, deep.y, deep.z);
        this.material.uniforms.depthGradientScale.value = this.model.depthGradientScale;

        this.material.uniforms.fresnelExponent.value = this.model.fresnelExponent;
        const rim = this.model.rimColor;
        this.material.uniforms.rimColor.value.set(rim.x, rim.y, rim.z);
        this.material.uniforms.fresnelBlend.value = this.model.fresnelBlend;

        const light = this.model.lightDir;
        this.material.uniforms.lightDir.value.set(light.x, light.y, light.z);
        this.material.uniforms.specularShininess.value = this.model.specularShininess;
        const spec = this.model.specularColor;
        this.material.uniforms.specularColor.value.set(spec.x, spec.y, spec.z);
        this.material.uniforms.diffuseWeight.value = this.model.diffuseWeight;
        this.material.uniforms.specularWeight.value = this.model.specularWeight;

        this.material.uniforms.refractionEta.value = this.model.refractionEta;
        this.material.uniforms.minRefractionThickness.value = this.model.minRefractionThickness;
        this.material.uniforms.thicknessNormFactor.value = this.model.thicknessNormFactor;
        this.material.uniforms.refractionBlend.value = this.model.refractionBlend;
        this.material.uniforms.normalEpsilonFactor.value = this.model.normalEpsilonFactor;
        this.material.uniforms.specularNormalEpsilonFactor.value = this.model.specularNormalEpsilonFactor;
        this.material.uniforms.toonSpecularEnabled.value = this.model.toonSpecularEnabled;
        
        // Shoreline
        this.material.uniforms.shorelineEnabled.value = this.model.shorelineEnabled;
        const slColor = this.model.shorelineColor;
        this.material.uniforms.shorelineColor.value.set(slColor.x, slColor.y, slColor.z);
        this.material.uniforms.shorelineWidth.value = this.model.shorelineWidth;
        this.material.uniforms.shorelineIntensity.value = this.model.shorelineIntensity;
        this.material.uniforms.shorelineRippleCount.value = this.model.shorelineRippleCount;
        this.material.uniforms.shorelineRippleSpeed.value = this.model.shorelineRippleSpeed;
        this.material.uniforms.uTime.value = t;

        // ===== adaptive steps =====
        const boundsSize = new THREE.Vector3().subVectors(maxThree, minThree);
        const diagonal = boundsSize.length();
        const baselineDiagonal = 3.46;
        const scaleFactor = diagonal / baselineDiagonal;
        const adaptiveStepSize = this.model.viewMarchStepSize * scaleFactor;
        
        this.material.uniforms.viewMarchStepSize.value = adaptiveStepSize;
        this.material.uniforms.tinyNudge.value = this.model.tinyNudge;
        this.material.uniforms.maxViewSteps.value = this.model.maxViewSteps;

        // 3. 3d field texture
        this.material.uniforms.densityFieldAtlas.value = this.fluidSimulator.getDensityField3DTexture();

        const sdfTex = this.fluidSimulator.getCollisionSDFTexture();
        if (sdfTex && sdfTex !== this.material.uniforms.collisionSDF.value) {
            this.material.uniforms.collisionSDF.value = sdfTex;
        }

        // 4. camera
        if (this.camera) {
            const pos = this.camera.position;
            this.material.uniforms.uCameraPosition.value.set(pos.x, pos.y, pos.z);

            this.camera.getProjectionInverse().assignTo(this.material.uniforms.inverseProjectionMatrix.value);

            this.camera.transform.getMat4().assignTo(this.material.uniforms.cameraToWorldMatrix.value);

            if (this.screenSize) {
                this.material.uniforms.screenResolution.value.set(this.screenSize.width, this.screenSize.height);
            }

            this.material.uniforms.cameraNear.value = this.cameraNear;
            this.material.uniforms.cameraFar.value = this.cameraFar;
        }
    }
}
