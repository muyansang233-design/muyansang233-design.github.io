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

uniform vec4 modelColor;
uniform mat4 modelViewMatrix;
uniform float ambient;
uniform float diffuse;
uniform float specular;
uniform float specularExp;
uniform float texCoordScale;
uniform float textureTransition;
uniform float islandRadius;
uniform float terrainAspect;  // width/height ratio for circular correction

uniform sampler2D diffuseMap;
uniform bool diffuseMapProvided;

// Adding an extra texture that we can sample from
uniform sampler2D tex2Map;
uniform bool tex2MapProvided;

uniform sampler2D normalMap;
uniform bool normalMapProvided;

uniform sampler2D heightMap;
uniform bool heightMapProvided;

// Noise texture for procedural terrain coloring
uniform sampler2D noiseMap;
uniform bool noiseMapProvided;

varying vec4 vPosition;
varying vec4 vWorldPosition;  // World-space position for stable normals
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

    // The falloff is computed like so...
    vec3 pToL = lightPosition.xyz-vPosition.xyz;
    vec3 L = normalize(pToL);

    float diffuseStrength = dot(N,L);

    float dist = length(pToL);
    float falloff = max(0.0, 1.0-(dist/lightRange));
    falloff = pow(falloff, lightDecay);
    return lightColor;
}


vec3 evalSpecular(vec3 position, vec3 N, int lightIndex){
    vec4 lightPosition = vec4(pointLights[lightIndex].position, 1.0);
    vec3 lightColor = pointLights[lightIndex].color;
    float lightDistance = pointLights[lightIndex].distance;
    float lightDecay = pointLights[lightIndex].decay;
    vec3 pToL = lightPosition.xyz-vPosition.xyz;

    vec3 L = normalize(pToL);
    vec3 vertexToEye = normalize(-position);
    vec3 lightReflect = normalize(reflect(-L, N));
    float specularFactor = max(dot(vertexToEye, lightReflect), 0.0);
    return lightColor*pow(specularFactor, specularExp);;
}

#endif

void main()	{
    // Discard fragments outside the circular island boundary
    // Account for aspect ratio to ensure circle isn't stretched
    vec2 center = vec2(0.5, 0.5);
    vec2 uvCorrected = vUv - center;
    uvCorrected.x *= terrainAspect;  // Correct for aspect ratio
    float dist = length(uvCorrected);
    if (islandRadius > 0.0 && dist >= islandRadius) {
        discard;
    }

    // Compute view-space normal for lighting
    vec3 N = normalize( cross( dFdx( vPosition.xyz ), dFdy( vPosition.xyz ) ) );
    vec3 position = vPosition.xyz/vPosition.w;
    
    // Compute WORLD-space normal for slope-based coloring (stable when rotating)
    vec3 worldNormal = normalize( cross( dFdx( vWorldPosition.xyz ), dFdy( vWorldPosition.xyz ) ) );
    
    vec3 pos = vWorldPosition.xyz;  // World position for noise sampling
    vec3 nor = worldNormal;         // World-space normal for slope coloring
    
    // =========================================================================
    // PROCEDURAL TERRAIN COLORING
    // =========================================================================
    vec3 col;
    
    if (noiseMapProvided) {
        // Scale factor for noise sampling
        float SC = 1.0;
        
        // --- Step 1: Base rock color from noise ---
        float r = texture(noiseMap, (7.0/SC) * pos.xz / 256.0).x;
        
        col = (r * 0.25 + 0.75) * 0.9 *
              mix(vec3(0.08, 0.05, 0.03),
                  vec3(0.10, 0.09, 0.08),
                  texture(noiseMap, 0.00007 * vec2(pos.x, pos.y * 48.0) / SC).x);
        
        // --- Step 2: Add soil/grass on flatter areas ---
        // nor.z indicates flatness (confirmed: flat = blue = high nor.z)
        float flatness = abs(nor.z);
        
        // Soil on medium slopes - BRIGHTER colors
        col = mix(col,
                  vec3(0.35, 0.25, 0.15) * (0.50 + 0.50 * r),  // Earthy brown
                  smoothstep(0.3, 0.6, flatness));
        
        // Green grass/moss on flat surfaces - with more variation
        // Sample additional noise for grass color variety
        float grassNoise1 = texture(noiseMap, pos.xy * 0.1).x;   // Fine detail
        float grassNoise2 = texture(noiseMap, pos.xy * 0.02).y;  // Broader patches
        
        // Mix between different grass shades based on noise
        vec3 grassDark = vec3(0.08, 0.25, 0.05);    // Dark forest green
        vec3 grassMid = vec3(0.15, 0.35, 0.10);     // Medium green
        vec3 grassLight = vec3(0.25, 0.45, 0.12);   // Lighter, yellowish green
        vec3 grassBrown = vec3(0.20, 0.28, 0.08);   // Brownish dry grass
        
        // Create varied grass color
        vec3 grassColor = mix(grassDark, grassMid, grassNoise1);
        grassColor = mix(grassColor, grassLight, grassNoise2 * 0.6);
        grassColor = mix(grassColor, grassBrown, smoothstep(0.6, 0.8, grassNoise1 * grassNoise2));
        grassColor *= (0.60 + 0.40 * r);  // Add brightness variation
        
        col = mix(col, grassColor, smoothstep(0.6, 0.85, flatness));
        
        // --- Step 3: Fine-scale patchiness ---
        // Sample noise at two different scales and multiply to create mottled mask
        // This breaks up smooth gradients and adds natural-looking variation
        float fbm1 = texture(noiseMap, pos.xz * 0.04).z;  // B channel has FBM
        float fbm2 = texture(noiseMap, pos.xz * 0.005).z;
        float patchiness = 0.1 + 1.8 * sqrt(fbm1 * fbm2);
        col *= patchiness;
        
        // --- Step 4: Snow mask ---
        // Snow appears on high, relatively flat, favorably-oriented surfaces
        
        // Height factor: snow starts appearing above certain altitude
        // pos.z is height in this coordinate system
        // Add noise to make snowline irregular
        float snowNoise = texture(noiseMap, pos.xy * 0.01).z;
        float h = smoothstep(2.0, 3.0, pos.z + 1.5 * snowNoise);  // Adjust these for your terrain height
        
        // Slope factor: flatter surfaces accumulate more snow
        // The threshold loosens at higher altitudes (snow sticks to steeper faces up high)
        float e = smoothstep(1.0 - 0.5 * h, 1.0 - 0.1 * h, flatness);
        
        // Orientation factor: bias toward certain directions (simulates wind/sun exposure)
        // nor.x gives east-west facing, combined with height
        float o = 0.3 + 0.7 * smoothstep(0.0, 0.1, nor.x + h * h);
        
        // Combined snow mask
        float s = h * e * o;
        
        // Mix in snow color (slightly blue-grey, not pure white)
        col = mix(col, 
                  vec3(0.85, 0.87, 0.92),  // Snow color
                  smoothstep(0.1, 0.9, s));
        
    } else {
        // Fallback: use diffuse map if no noise texture
        col = texture(diffuseMap, vUv * texCoordScale).xyz;
    }
    
    vec4 surface_color = vec4(col, 1.0);
    float alpha = 1.0;

    vec3 specularLighting = vec3(0.0,0.0,0.0);
    vec3 diffuseLighting = vec3(0.0,0.0,0.0);
    vec3 outColor = vec3(0.0,0.0,0.0);

    #if ( NUM_POINT_LIGHTS > 0 )
    for (int lightIndex=0;lightIndex<int(NUM_POINT_LIGHTS);++lightIndex){
        specularLighting = specularLighting+evalSpecular(position,N,lightIndex);
        diffuseLighting = diffuseLighting+evalDiffuse(position,N,lightIndex);
    }
    outColor = diffuseLighting*surface_color.xyz*diffuse+specularLighting*specular + vec3(ambient, ambient,ambient);
    #else
    // If all red that means you probably didn't add any point lights
    outColor = vec3(1.0,0.0,0.0);
    #endif

    gl_FragColor = vec4(outColor, alpha);
}
