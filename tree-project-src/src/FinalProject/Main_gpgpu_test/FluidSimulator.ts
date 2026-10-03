/**
 * FluidSimulator - GPGPU-based particle simulation using GPUComputationRenderer
 * 
 * This class manages the GPU computation for particle physics.
 * It handles position updates with gravity and boundary collision.
 * 
 * IMPORTANT: Density is computed in a SEPARATE render pass BEFORE velocity/position
 * to avoid the 1-frame delay issue inherent in GPUComputationRenderer.
 */

import * as THREE from "three";
// @ts-ignore
import { GPUComputationRenderer } from "three/examples/jsm/misc/GPUComputationRenderer.js";
import { Vec3 } from "../../anigraph";

// ========== 3D 密度场生成 Shader ==========
// 将 3D 体素密度场渲染到 2D 纹理图集中
// ========== SDF Generation Shader ==========
// Generate signed distance field from mesh triangles stored in atlas format
const fragmentShaderSDFGeneration = /*glsl*/`
#ifndef MAX_SDF_TRIANGLES
#define MAX_SDF_TRIANGLES 16384
#endif

uniform sampler2D textureTriangles;  // Mesh triangles: each pixel = vec4(x, y, z, _)
uniform float triangleCount;          // Number of triangles
uniform vec2 triangleTexResolution;   // Resolution of triangle texture
uniform vec3 boundsMin;
uniform vec3 boundsMax;
uniform vec3 sdfVolumeResolution;     // SDF volume resolution (e.g., 64, 64, 64)
uniform vec2 sdfAtlasResolution;      // SDF atlas resolution
uniform float sdfSlicesPerRow;        // Slices per row in atlas

// Read a vertex from the triangle texture (supports 2D layout)
vec3 readVertex(int vertexIndex) {
    int width = int(triangleTexResolution.x);
    int height = int(triangleTexResolution.y);
    int y = vertexIndex / width;
    int x = vertexIndex - y * width;

    // Check bounds to avoid reading garbage data from padding
    if (y >= height) {
        return vec3(0.0); // Invalid vertex
    }

    vec2 uv = (vec2(float(x) + 0.5, float(y) + 0.5)) / triangleTexResolution;
    return texture2D(textureTriangles, uv).xyz;
}

// Convert atlas UV to voxel coordinate
vec3 atlasUVToVoxelCoord(vec2 atlasUV) {
    vec2 pixelPos = atlasUV * sdfAtlasResolution;
    float sliceX = floor(pixelPos.x / sdfVolumeResolution.x);
    float sliceY = floor(pixelPos.y / sdfVolumeResolution.y);
    float sliceIndex = sliceY * sdfSlicesPerRow + sliceX;
    float localX = mod(pixelPos.x, sdfVolumeResolution.x);
    float localY = mod(pixelPos.y, sdfVolumeResolution.y);
    return vec3(localX, localY, sliceIndex);
}

// Convert voxel coordinate to world position
vec3 voxelToWorld(vec3 voxelCoord) {
    vec3 normalized = (voxelCoord + 0.5) / sdfVolumeResolution;
    return boundsMin + normalized * (boundsMax - boundsMin);
}

// Compute closest point on triangle to point p
vec3 closestPointOnTriangle(vec3 p, vec3 a, vec3 b, vec3 c) {
    vec3 ab = b - a;
    vec3 ac = c - a;
    vec3 ap = p - a;
    
    float d1 = dot(ab, ap);
    float d2 = dot(ac, ap);
    if (d1 <= 0.0 && d2 <= 0.0) return a;
    
    vec3 bp = p - b;
    float d3 = dot(ab, bp);
    float d4 = dot(ac, bp);
    if (d3 >= 0.0 && d4 <= d3) return b;
    
    float vc = d1 * d4 - d3 * d2;
    if (vc <= 0.0 && d1 >= 0.0 && d3 <= 0.0) {
        float v = d1 / (d1 - d3);
        return a + v * ab;
    }
    
    vec3 cp = p - c;
    float d5 = dot(ab, cp);
    float d6 = dot(ac, cp);
    if (d6 >= 0.0 && d5 <= d6) return c;
    
    float vb = d5 * d2 - d1 * d6;
    if (vb <= 0.0 && d2 >= 0.0 && d6 <= 0.0) {
        float w = d2 / (d2 - d6);
        return a + w * ac;
    }
    
    float va = d3 * d6 - d5 * d4;
    if (va <= 0.0 && (d4 - d3) >= 0.0 && (d5 - d6) >= 0.0) {
        float w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
        return b + w * (c - b);
    }
    
    float denom = 1.0 / (va + vb + vc);
    float v = vb * denom;
    float w = vc * denom;
    return a + ab * v + ac * w;
}

// Compute unsigned distance from point to triangle
float distanceToTriangle(vec3 p, vec3 a, vec3 b, vec3 c) {
    vec3 closest = closestPointOnTriangle(p, a, b, c);
    return length(p - closest);
}

// Pseudo-normal for determining inside/outside
// Returns the raw cross product normal (may point inward or outward)
vec3 triangleNormal(vec3 a, vec3 b, vec3 c) {
    return normalize(cross(b - a, c - a));
}

// Check if a triangle normal points outward (for sphere centered at origin)
bool isNormalOutward(vec3 normal, vec3 triangleCentroid) {
    // For sphere at origin, outward means aligned with centroid direction
    return dot(normal, triangleCentroid) > 0.0;
}

// Compute signed distance at a point
// Negative = inside mesh, Positive = outside mesh
float computeSignedDistance(vec3 pos) {
    float minDist = 1e10;
    vec3 closestNormal = vec3(0.0, 1.0, 0.0);
    vec3 closestDir = vec3(0.0, 1.0, 0.0);
    vec3 closestCentroid = vec3(0.0, 0.0, 0.0);

    int triCount = int(triangleCount);
    // Iterate up to MAX_SDF_TRIANGLES (static limit), but stop at triangleCount
    for (int i = 0; i < MAX_SDF_TRIANGLES; i++) {
        if (i >= triCount) break;

        // Each triangle has 3 vertices
        int baseIndex = i * 3;
        vec3 v0 = readVertex(baseIndex);
        vec3 v1 = readVertex(baseIndex + 1);
        vec3 v2 = readVertex(baseIndex + 2);

        // Skip degenerate triangles
        vec3 edge1 = v1 - v0;
        vec3 edge2 = v2 - v0;
        if (length(cross(edge1, edge2)) < 1e-6) continue;

        vec3 closest = closestPointOnTriangle(pos, v0, v1, v2);
        float dist = length(pos - closest);

        if (dist < minDist) {
            minDist = dist;
            closestNormal = triangleNormal(v0, v1, v2);
            closestDir = pos - closest;
            closestCentroid = (v0 + v1 + v2) / 3.0;
        }
    }
    
    // Determine sign based on normal direction
    // For a bowl with normals pointing INWARD:
    // - Inside bowl: closestDir (point to particle) aligns with normal (pointing inward) -> dot > 0 -> positive SDF
    // - Outside bowl: closestDir points away from bowl, opposite to inward normal -> dot < 0 -> negative SDF

    // closestDir = from surface toward test point
    float dotProduct = dot(closestDir, closestNormal);

    // If normals point outward (standard Blender export):
    // Inside: dot < 0 -> we want positive SDF
    // Outside: dot > 0 -> we want negative SDF
    // So we FLIP the sign compared to the bowl case
    float sign = dotProduct > 0.0 ? -1.0 : 1.0;

    return sign * minDist;
}

void main() {
    vec2 atlasUV = gl_FragCoord.xy / sdfAtlasResolution;
    vec3 voxelCoord = atlasUVToVoxelCoord(atlasUV);
    
    // Check if this voxel is within valid range
    if (voxelCoord.z >= sdfVolumeResolution.z) {
        gl_FragColor = vec4(1e10, 0.0, 0.0, 1.0);  // Large positive distance = far outside
        return;
    }
    
    vec3 worldPos = voxelToWorld(voxelCoord);
    float signedDist = computeSignedDistance(worldPos);
    
    // Store signed distance in R channel
    gl_FragColor = vec4(signedDist, 0.0, 0.0, 1.0);
}
`;

// ========== SDF Sampling Functions (for use in other shaders) ==========
export const sdfSamplingFunctions = /*glsl*/`
// SDF sampling uniforms (add these to shaders that need SDF)
// uniform sampler2D textureSDFVolume;
// uniform vec3 sdfBoundsMin;
// uniform vec3 sdfBoundsMax;
// uniform vec3 sdfVolumeResolution;
// uniform vec2 sdfAtlasResolution;
// uniform float sdfSlicesPerRow;

// Convert world position to SDF atlas UV
vec2 worldToSDFAtlasUV(vec3 worldPos, vec3 sdfBoundsMin, vec3 sdfBoundsMax, 
                        vec3 sdfVolumeRes, vec2 sdfAtlasRes, float slicesPerRow) {
    // Normalize world position to [0,1] in SDF volume
    vec3 normalized = (worldPos - sdfBoundsMin) / (sdfBoundsMax - sdfBoundsMin);
    normalized = clamp(normalized, vec3(0.0), vec3(0.999));
    
    // Convert to voxel coordinates
    vec3 voxelCoord = normalized * sdfVolumeRes;
    
    // Find slice index (z coordinate)
    float sliceIndex = floor(voxelCoord.z);
    
    // Calculate position in atlas
    float sliceX = mod(sliceIndex, slicesPerRow);
    float sliceY = floor(sliceIndex / slicesPerRow);
    
    vec2 localUV = voxelCoord.xy;
    vec2 atlasPixel = vec2(sliceX * sdfVolumeRes.x + localUV.x,
                           sliceY * sdfVolumeRes.y + localUV.y);
    
    return atlasPixel / sdfAtlasRes;
}

// Sample SDF at world position with trilinear interpolation
float sampleSDF(vec3 worldPos, sampler2D sdfTexture,
                vec3 sdfBoundsMin, vec3 sdfBoundsMax,
                vec3 sdfVolumeRes, vec2 sdfAtlasRes, float slicesPerRow) {
    // Normalize world position
    vec3 normalized = (worldPos - sdfBoundsMin) / (sdfBoundsMax - sdfBoundsMin);

    // Check if outside bounds.
    // For a CONTAINER (inside = positive), we treat outside as "solid wall" (negative)
    // so particles that step outside still collide and get pushed back.
    // if (any(lessThan(normalized, vec3(0.0))) || any(greaterThan(normalized, vec3(1.0)))) {
    //     return -1.0;  // Outside container → collision zone
    // }

    // Convert to continuous voxel coordinates
    vec3 voxelCoord = normalized * (sdfVolumeRes - vec3(1.0));
    
    // Get the 8 corners for trilinear interpolation
    vec3 voxelFloor = floor(voxelCoord);
    vec3 voxelFrac = fract(voxelCoord);
    
    float d000 = 0.0, d001 = 0.0, d010 = 0.0, d011 = 0.0;
    float d100 = 0.0, d101 = 0.0, d110 = 0.0, d111 = 0.0;
    
    // Sample all 8 corners
    for (int dz = 0; dz <= 1; dz++) {
        for (int dy = 0; dy <= 1; dy++) {
            for (int dx = 0; dx <= 1; dx++) {
                vec3 corner = voxelFloor + vec3(float(dx), float(dy), float(dz));
                corner = clamp(corner, vec3(0.0), sdfVolumeRes - vec3(1.0));
                
                float sliceIndex = corner.z;
                float sliceX = mod(sliceIndex, slicesPerRow);
                float sliceY = floor(sliceIndex / slicesPerRow);
                
                vec2 atlasPixel = vec2(sliceX * sdfVolumeRes.x + corner.x + 0.5,
                                       sliceY * sdfVolumeRes.y + corner.y + 0.5);
                vec2 atlasUV = atlasPixel / sdfAtlasRes;
                
                float sdfVal = texture2D(sdfTexture, atlasUV).r;
                
                if (dx == 0 && dy == 0 && dz == 0) d000 = sdfVal;
                else if (dx == 1 && dy == 0 && dz == 0) d100 = sdfVal;
                else if (dx == 0 && dy == 1 && dz == 0) d010 = sdfVal;
                else if (dx == 1 && dy == 1 && dz == 0) d110 = sdfVal;
                else if (dx == 0 && dy == 0 && dz == 1) d001 = sdfVal;
                else if (dx == 1 && dy == 0 && dz == 1) d101 = sdfVal;
                else if (dx == 0 && dy == 1 && dz == 1) d011 = sdfVal;
                else if (dx == 1 && dy == 1 && dz == 1) d111 = sdfVal;
            }
        }
    }
    
    // Trilinear interpolation
    float d00 = mix(d000, d100, voxelFrac.x);
    float d01 = mix(d001, d101, voxelFrac.x);
    float d10 = mix(d010, d110, voxelFrac.x);
    float d11 = mix(d011, d111, voxelFrac.x);
    float d0 = mix(d00, d10, voxelFrac.y);
    float d1 = mix(d01, d11, voxelFrac.y);
    return mix(d0, d1, voxelFrac.z);
}

// Compute SDF gradient using central differences
vec3 computeSDFGradient(vec3 pos, float epsilon, sampler2D sdfTexture,
                        vec3 sdfBoundsMin, vec3 sdfBoundsMax,
                        vec3 sdfVolumeRes, vec2 sdfAtlasRes, float slicesPerRow) {
    float dx = sampleSDF(pos + vec3(epsilon, 0.0, 0.0), sdfTexture, sdfBoundsMin, sdfBoundsMax, sdfVolumeRes, sdfAtlasRes, slicesPerRow)
             - sampleSDF(pos - vec3(epsilon, 0.0, 0.0), sdfTexture, sdfBoundsMin, sdfBoundsMax, sdfVolumeRes, sdfAtlasRes, slicesPerRow);
    float dy = sampleSDF(pos + vec3(0.0, epsilon, 0.0), sdfTexture, sdfBoundsMin, sdfBoundsMax, sdfVolumeRes, sdfAtlasRes, slicesPerRow)
             - sampleSDF(pos - vec3(0.0, epsilon, 0.0), sdfTexture, sdfBoundsMin, sdfBoundsMax, sdfVolumeRes, sdfAtlasRes, slicesPerRow);
    float dz = sampleSDF(pos + vec3(0.0, 0.0, epsilon), sdfTexture, sdfBoundsMin, sdfBoundsMax, sdfVolumeRes, sdfAtlasRes, slicesPerRow)
             - sampleSDF(pos - vec3(0.0, 0.0, epsilon), sdfTexture, sdfBoundsMin, sdfBoundsMax, sdfVolumeRes, sdfAtlasRes, slicesPerRow);
    
    vec3 grad = vec3(dx, dy, dz) / (2.0 * epsilon);
    float gradLen = length(grad);
    if (gradLen < 1e-6) return vec3(0.0, 0.0, 1.0);  // Default up
    return grad / gradLen;
}
`;

const fragmentShaderDensityField = /*glsl*/`
uniform sampler2D texturePosition;
uniform sampler2D textureSortedCells;
uniform sampler2D textureCellRange;
uniform vec2 resolution;
uniform vec2 sortedResolution;
uniform float sortedTotalElements;
uniform vec2 cellResolution;
uniform float cellCount;
uniform float numParticles;
uniform vec3 boundsMin;
uniform vec3 boundsMax;
uniform vec3 gridMin;
uniform vec3 gridDimensions;
uniform float gridCellSize;
uniform float smoothingRadius;

// 3D density field
uniform vec3 volumeResolution;
uniform vec2 atlasResolution; 
uniform float slicesPerRow;

const int MAX_BINARY_STEPS = 32;
const int MAX_CELL_SAMPLES = 256;

vec2 indexToUV(float index) {
    float x = mod(index, resolution.x);
    float y = floor(index / resolution.x);
    return (vec2(x + 0.5, y + 0.5) / resolution);
}

vec4 readSortedEntry(int rawIndex) {
    int width = int(sortedResolution.x);
    int height = int(sortedResolution.y);
    int maxIndex = width * height - 1;
    int index = clamp(rawIndex, 0, maxIndex);
    int y = index / width;
    int x = index - y * width;
    vec2 uv = (vec2(float(x) + 0.5, float(y) + 0.5) / sortedResolution);
    // return a vec4
    return texture2D(textureSortedCells, uv);
}

vec2 readCellRange(int cellId) {
    if (cellId < 0 || cellId >= int(cellCount)) {
        return vec2(-1.0, -1.0);
    }
    int width = int(cellResolution.x);
    int height = int(cellResolution.y);
    int maxIndex = width * height - 1;
    int index = clamp(cellId, 0, maxIndex);
    int y = index / width;
    int x = index - y * width;
    vec2 uv = (vec2(float(x) + 0.5, float(y) + 0.5) / cellResolution);
    vec4 entry = texture2D(textureCellRange, uv);
    return entry.xy; // (start, endExclusive)
}

ivec3 computeCellCoord(vec3 position) {
    vec3 relative = (position - gridMin) / gridCellSize;
    vec3 floored = floor(relative);
    vec3 clamped = clamp(floored, vec3(0.0), gridDimensions - vec3(1.0));
    return ivec3(clamped);
}

int encodeCell(ivec3 coord) {
    int dimX = int(gridDimensions.x);
    int dimY = int(gridDimensions.y);
    return coord.x + coord.y * dimX + coord.z * dimX * dimY;
}

vec3 atlasUVToVoxelCoord(vec2 atlasUV) {
    // normalized uv to pixel position on atlas
    vec2 pixelPos = atlasUV * atlasResolution;
    float sliceX = floor(pixelPos.x / volumeResolution.x);
    float sliceY = floor(pixelPos.y / volumeResolution.y);
    float sliceIndex = sliceY * slicesPerRow + sliceX;
    float localX = mod(pixelPos.x, volumeResolution.x);
    float localY = mod(pixelPos.y, volumeResolution.y);
    return vec3(localX, localY, sliceIndex);
}

vec3 voxelCoordToWorldPos(vec3 voxelCoord) {
    vec3 normalized = (voxelCoord + 0.5) / volumeResolution;
    return boundsMin + normalized * (boundsMax - boundsMin);
}

float computeDensityAtPoint(vec3 pos) {
    ivec3 cellCoord = computeCellCoord(pos);
    float density = 0.0;
    float h = smoothingRadius;
    float h2 = h * h;

    for (int dz = -1; dz <= 1; ++dz) {
        for (int dy = -1; dy <= 1; ++dy) {
            for (int dx = -1; dx <= 1; ++dx) {
                // 26 cells surrounding
                ivec3 neighbour = cellCoord + ivec3(dx, dy, dz);
                if (neighbour.x < 0 || neighbour.y < 0 || neighbour.z < 0) continue;
                if (neighbour.x >= int(gridDimensions.x) || neighbour.y >= int(gridDimensions.y) || neighbour.z >= int(gridDimensions.z)) continue;

                int cellId = encodeCell(neighbour);

                vec2 range = readCellRange(cellId);
                int start = int(range.x + 0.5);
                int endExclusive = int(range.y + 0.5);
                if (start < 0 || endExclusive <= start) continue;

                for (int iter = 0; iter < MAX_CELL_SAMPLES; ++iter) {
                    int sortedIndex = start + iter;
                    if (sortedIndex >= endExclusive) break;

                    vec4 entry = readSortedEntry(sortedIndex); //(cellID,particleIndex,0,0)
                    int neighbourIndex = int(entry.y + 0.5); 
                    if (neighbourIndex < 0 || neighbourIndex >= int(numParticles)) continue;

                    vec2 uvj = indexToUV(float(neighbourIndex));
                    vec3 pj = texture2D(texturePosition, uvj).xyz;
                    if (pj.x < -9000.0) continue;

                    vec3 diff = pj - pos;
                    float r2 = dot(diff, diff);
                    if (r2 < h2) {
                        float r = sqrt(r2);
                        float volume = 3.14159 * pow(h, 4.0) / 6.0;
                        float d = h - r;
                        density += (d * d) / volume;
                    }
                }
            }
        }
    }
    return density;
}

void main() {
    vec2 atlasUV = gl_FragCoord.xy / atlasResolution;
    vec3 voxelCoord = atlasUVToVoxelCoord(atlasUV);
    if (voxelCoord.z >= volumeResolution.z) {
        gl_FragColor = vec4(0.0);
        return;
    }
    vec3 worldPos = voxelCoordToWorldPos(voxelCoord);
    float density = computeDensityAtPoint(worldPos);
    gl_FragColor = vec4(density, 0.0, 0.0, 1.0);
}
`;

export const gridSearchFunctions = /*glsl*/`
const float PREDICTION_FACTOR = 1.0 / 120.0;
const int MAX_BINARY_STEPS = 32;
const int MAX_CELL_SAMPLES = 256;

// 读取排序后的 (cellId, particleIndex)
vec2 indexToUV(float index) {
    float x = mod(index, resolution.x);
    float y = floor(index / resolution.x);
    return (vec2(x + 0.5, y + 0.5) / resolution);
}

vec4 readSortedEntry(int rawIndex) {
    int width = int(sortedResolution.x);
    int height = int(sortedResolution.y);
    int maxIndex = width * height - 1;
    int index = clamp(rawIndex, 0, maxIndex);
    int y = index / width;
    int x = index - y * width;
    vec2 uv = (vec2(float(x) + 0.5, float(y) + 0.5) / sortedResolution);
    return texture2D(textureSortedCells, uv);
}

// cellRange get [start,end)
// uniform:
//   sampler2D textureCellRange;
//   vec2 cellResolution;
//   float cellCount;
vec2 readCellRange(int cellId) {
    if (cellId < 0 || cellId >= int(cellCount)) {
        return vec2(-1.0, -1.0);
    }
    int width = int(cellResolution.x);
    int height = int(cellResolution.y);
    int maxIndex = width * height - 1;
    int index = clamp(cellId, 0, maxIndex);
    int y = index / width;
    int x = index - y * width;
    vec2 uv = (vec2(float(x) + 0.5, float(y) + 0.5) / cellResolution);
    vec4 entry = texture2D(textureCellRange, uv);
    return entry.xy; // (start, endExclusive)
}

int lowerBoundCell(int cellId) {
    int left = 0;
    int right = int(sortedTotalElements) - 1;
    int result = -1;
    for (int i = 0; i < MAX_BINARY_STEPS; i++) {
        if (left > right) {
            break;
        }
        int mid = (left + right) / 2;
        int midCell = int(readSortedEntry(mid).x + 0.5);
        if (midCell < cellId) {
            left = mid + 1;
        } else {
            right = mid - 1; 
            if (midCell == cellId) {
                result = mid; 
            }
        }
    }
    return result;
}

int upperBoundCell(int cellId) {
    int left = 0;
    int right = int(sortedTotalElements) - 1;
    int result = -1;
    for (int i = 0; i < MAX_BINARY_STEPS; i++) {
        if (left > right) {
            break;
        }
        int mid = (left + right) / 2;
        int midCell = int(readSortedEntry(mid).x + 0.5);
        if (midCell <= cellId) {
            left = mid + 1;
            if (midCell == cellId) {
                result = mid + 1;
            }
        } else {
            right = mid - 1;
        }
    }
    if (result == -1) {
        return left;
    }
    return result;
}

ivec3 computeCellCoord(vec3 position) {
    vec3 relative = (position - gridMin) / gridCellSize;
    vec3 floored = floor(relative);
    vec3 clamped = clamp(floored, vec3(0.0), gridDimensions - vec3(1.0));
    return ivec3(clamped);
}

int encodeCell(ivec3 coord) {
    int dimX = int(gridDimensions.x);
    int dimY = int(gridDimensions.y);
    return coord.x + coord.y * dimX + coord.z * dimX * dimY;
}
`;


// Density Shader - Runs MANUALLY before GPUComputationRenderer using grid-accelerated neighbour search
const fragmentShaderDensities = /*glsl*/`
uniform sampler2D texturePosition;
uniform sampler2D textureVelocity;
uniform vec2 resolution;
uniform float smoothingRadius;
uniform float numParticles;
uniform float gravity;
uniform float delta;

uniform vec3 gridMin;
uniform vec3 gridDimensions;
uniform float gridCellSize;

uniform sampler2D textureSortedCells;
uniform vec2 sortedResolution;
uniform float sortedTotalElements;
uniform sampler2D textureCellRange;
uniform vec2 cellResolution;
uniform float cellCount;

${gridSearchFunctions}

float smoothingKernel(float radius, float dst) {
    if (dst >= radius || radius <= 0.0) return 0.0;
    float volume = 3.14159265 * pow(radius, 4.0) / 6.0;
    float d = radius - dst;
    return (d * d) / volume;
}

float nearDensityKernel(float radius, float dst) {
    if (radius <= 0.0 || dst >= radius) return 0.0;
    float q = 1.0 - dst / radius;
    return q * q * q;
}

void accumulateCell(ivec3 cellCoord, vec3 predictedPos, inout float density, inout float nearDensity) {
    int cellId = encodeCell(cellCoord);
    vec2 range = readCellRange(cellId);
    int start = int(range.x + 0.5);
    int endExclusive = int(range.y + 0.5);
    if (start < 0 || endExclusive <= start) {
        return;
    }
    float h = smoothingRadius;
    float h2 = h * h;

    for (int iter = 0; iter < MAX_CELL_SAMPLES; ++iter) {
        int sortedIndex = start + iter;
        if (sortedIndex >= endExclusive) {
            break;
        }

        vec4 entry = readSortedEntry(sortedIndex);
        int neighbourIndex = int(entry.y + 0.5);
        if (neighbourIndex < 0 || neighbourIndex >= int(numParticles)) {
            continue;
        }

        vec2 uvj = indexToUV(float(neighbourIndex));
        vec3 pj = texture2D(texturePosition, uvj).xyz;
        if (pj.x < -9000.0) {
            continue;
        }

        vec3 vj = texture2D(textureVelocity, uvj).xyz;
        vec3 vjWithGravity = vj + vec3(0.0, 0.0, -gravity) * delta;
        vec3 predictedPj = pj + vjWithGravity * PREDICTION_FACTOR;

        vec3 diff = predictedPj - predictedPos;
        float r2 = dot(diff, diff);
        if (r2 > h2) {
            continue;
        }

        float r = sqrt(max(r2, 1e-6));
        density     += smoothingKernel(h, r);
        nearDensity += nearDensityKernel(h, r);
    }
}

void main() {
    vec2 uv = gl_FragCoord.xy / resolution;

    vec4 posData = texture2D(texturePosition, uv);
    vec3 position = posData.xyz;

    if (position.x < -9000.0) {
        gl_FragColor = vec4(0.0);
        return;
    }

    vec3 velocity = texture2D(textureVelocity, uv).xyz;
    vec3 velWithGravity = velocity + vec3(0.0, 0.0, -gravity) * delta;
    vec3 predictedPos = position + velWithGravity * PREDICTION_FACTOR;

    ivec3 baseCell = computeCellCoord(predictedPos);
    float density = 0.0;
    float nearDensity = 0.0;

    for (int dz = -1; dz <= 1; ++dz) {
        for (int dy = -1; dy <= 1; ++dy) {
            for (int dx = -1; dx <= 1; ++dx) {
                ivec3 neighbour = baseCell + ivec3(dx, dy, dz);
                if (neighbour.x < 0 || neighbour.y < 0 || neighbour.z < 0) continue;
                if (neighbour.x >= int(gridDimensions.x) || neighbour.y >= int(gridDimensions.y) || neighbour.z >= int(gridDimensions.z)) continue;
                accumulateCell(neighbour, predictedPos, density, nearDensity);
            }
        }
    }

    gl_FragColor = vec4(density, nearDensity, 0.0, 1.0);
}
`;


// Velocity update shader - applies gravity, pressure force, VISCOSITY, using grid-accelerated neighbour lookup
const fragmentShaderVelocity = /*glsl*/`
uniform float delta;
uniform float gravity;
uniform vec3 boundsMin;
uniform vec3 boundsMax;
uniform float collisionDamping;
uniform float particleRadius;
uniform float maxSpeed;

uniform float smoothingRadius;
uniform float targetDensity;
uniform float pressureMultiplier;
uniform float nearPressureMultiplier;
uniform float particleMass;
uniform float numParticles;
uniform float viscosityStrength;

// ===== 交互外力（吸力）=====
uniform float externalForceEnabled; 
uniform vec3 externalForceCenter; 
uniform float externalForceRadius; 
uniform float externalForceStrength; 

uniform sampler2D textureDensity;
uniform sampler2D textureSortedCells;
uniform vec2 sortedResolution;
uniform float sortedTotalElements;
uniform sampler2D textureCellRange;
uniform vec2 cellResolution;
uniform float cellCount;
uniform vec3 gridMin;
uniform vec3 gridDimensions;
uniform float gridCellSize;

// SDF collision uniforms
uniform sampler2D textureSDFVolume;
uniform vec3 sdfBoundsMin;
uniform vec3 sdfBoundsMax;
uniform vec3 sdfVolumeResolution;
uniform vec2 sdfAtlasResolution;
uniform float sdfSlicesPerRow;
uniform bool sdfEnabled;

${gridSearchFunctions}

${sdfSamplingFunctions}

float smoothingKernel(float radius, float dst) {
    if (dst >= radius || radius <= 0.0) return 0.0;
    float volume = 3.14159265 * pow(radius, 4.0) / 6.0;
    float d = radius - dst;
    return (d * d) / volume;
}

float smoothingKernelDerivative(float radius, float dst) {
    if (dst >= radius || radius <= 0.0) return 0.0;
    float scale = 12.0 / (3.14159265 * pow(radius, 4.0));
    return (dst - radius) * scale;
}

float nearDensityKernel(float radius, float dst) {
    if (radius <= 0.0 || dst >= radius) return 0.0;
    float q = 1.0 - dst / radius;
    return q * q * q;
}

float nearDensityDerivative(float radius, float dst) {
    if (radius <= 0.0 || dst >= radius) return 0.0;
    float q = 1.0 - dst / radius;
    return -3.0 * q * q / radius;
}

float viscosityKernel(float radius, float dst) {
    if (dst >= radius || radius <= 0.0) return 0.0;
    float r2 = radius * radius;
    float d2 = dst * dst;
    float diff = r2 - d2;
    float scale = 315.0 / (64.0 * 3.14159265 * pow(radius, 9.0));
    return diff * diff * diff * scale;
}

vec3 clampVelocity(vec3 v) {
    if (maxSpeed <= 0.0) return v;
    float speed = length(v);
    if (speed > maxSpeed) {
        v *= maxSpeed / max(speed, 1e-6);
    }
    return v;
}

void accumulateForces(
    ivec3 cellCoord,
    vec3 predictedPos,
    vec3 velocity,
    inout vec3 pressureForce,
    inout vec3 viscosityForce,
    float pressure,
    float nearPressure
) {
    int cellId = encodeCell(cellCoord);
    vec2 range = readCellRange(cellId);
    int start = int(range.x + 0.5);
    int endExclusive = int(range.y + 0.5);
    if (start < 0 || endExclusive <= start) {
        return;
    }
    float h = smoothingRadius;
    float h2 = h * h;

    for (int iter = 0; iter < MAX_CELL_SAMPLES; ++iter) {
        int sortedIndex = start + iter;
        if (sortedIndex >= endExclusive) {
            break;
        }

        vec4 entry = readSortedEntry(sortedIndex);
        int neighbourIndex = int(entry.y + 0.5);
        if (neighbourIndex < 0 || neighbourIndex >= int(numParticles)) {
            continue;
        }

        vec2 uvj = indexToUV(float(neighbourIndex));
        vec3 pj = texture2D(texturePosition, uvj).xyz;
        if (pj.x < -9000.0) {
            continue;
        }

        vec3 vj = texture2D(textureVelocity, uvj).xyz;
        vec3 vjWithGravity = vj + vec3(0.0, 0.0, -gravity) * delta;
        vec3 predictedPj = pj + vjWithGravity * PREDICTION_FACTOR;

        vec3 diff = predictedPj - predictedPos;
        float r2 = dot(diff, diff);
        if (r2 > h2 || r2 == 0.0) continue;

        float r = sqrt(r2);
        vec3 dir = diff / r;

        vec2 neighbourDensityData = texture2D(textureDensity, uvj).xy;
        float neighbourDensity = max(neighbourDensityData.x, 1e-6);
        float neighbourNearDensity = max(neighbourDensityData.y, 1e-6);

        float neighbourDensityError = neighbourDensityData.x - targetDensity;
        float neighbourPressure = neighbourDensityError * pressureMultiplier;
        float neighbourNearPressure = neighbourDensityData.y * nearPressureMultiplier;

        float rawSlope = smoothingKernelDerivative(h, r);
        float slope = -rawSlope;
        float rawNearSlope = nearDensityDerivative(h, r);
        float nearSlope = -rawNearSlope;

        float sharedPressure = 0.5 * (pressure + neighbourPressure);
        float sharedNearPressure = 0.5 * (nearPressure + neighbourNearPressure);

        float scalarLong = -sharedPressure * slope / neighbourDensity;
        float scalarNear = -sharedNearPressure * nearSlope / neighbourNearDensity;
        float scalar = scalarLong + scalarNear;
        pressureForce += scalar * dir;

        float viscWeight = viscosityKernel(h, r);
        viscosityForce += (vj - velocity) * viscWeight;
    }
}

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    vec4 posData = texture2D(texturePosition, uv);
    vec4 velData = texture2D(textureVelocity, uv);

    vec3 position = posData.xyz;
    vec3 velocity = velData.xyz;
    velocity = clampVelocity(velocity);

    if (position.x < -9000.0) {
        gl_FragColor = velData;
        return;
    }

    vec3 velWithGravity = velocity + vec3(0.0, 0.0, -gravity) * delta;
    vec3 predictedPos = position + velWithGravity * PREDICTION_FACTOR;

    vec2 selfDensityData = texture2D(textureDensity, uv).xy;
    float density = selfDensityData.x;
    float nearDensity = selfDensityData.y;
    float selfDensity = max(density, 1e-6);

    float densityError = density - targetDensity;
    float pressure = densityError * pressureMultiplier;
    float nearPressure = nearDensity * nearPressureMultiplier;

    vec3 pressureForce = vec3(0.0);
    vec3 viscosityForce = vec3(0.0);

    ivec3 baseCell = computeCellCoord(predictedPos);
    for (int dz = -1; dz <= 1; ++dz) {
        for (int dy = -1; dy <= 1; ++dy) {
            for (int dx = -1; dx <= 1; ++dx) {
                ivec3 neighbour = baseCell + ivec3(dx, dy, dz);
                if (neighbour.x < 0 || neighbour.y < 0 || neighbour.z < 0) continue;
                if (neighbour.x >= int(gridDimensions.x) || neighbour.y >= int(gridDimensions.y) || neighbour.z >= int(gridDimensions.z)) continue;
                accumulateForces(neighbour, predictedPos, velocity, pressureForce, viscosityForce, pressure, nearPressure);
            }
        }
    }

    vec3 acceleration = vec3(0.0, 0.0, -gravity);
    acceleration += pressureForce / selfDensity;
    acceleration += viscosityForce * viscosityStrength;

    // interactive force
    if (externalForceEnabled > 0.5) {
        vec3 toCenter = externalForceCenter - predictedPos;
        float dist = length(toCenter);
        if (dist > 1e-6 && dist < externalForceRadius) {
            float t = 1.0 - dist / max(externalForceRadius, 1e-6);
            float falloff = t * t; // smoother
            acceleration += (toCenter / dist) * (externalForceStrength * falloff);
        }
    }

    velocity += acceleration * delta;
    velocity = clampVelocity(velocity);

    vec3 nextPos = position + velocity * delta;

    if (sdfEnabled) {
        // SDF-based collision for CONTAINER (box / custom mesh holding particles inside)
        // positve SDF inside。
        float sdf = sampleSDF(nextPos, textureSDFVolume, sdfBoundsMin, sdfBoundsMax, 
                              sdfVolumeResolution, sdfAtlasResolution, sdfSlicesPerRow);
        
        // outside range
        if (sdf < particleRadius) {
            float epsilon = 0.02;
            vec3 grad = computeSDFGradient(nextPos, epsilon, textureSDFVolume,
                                           sdfBoundsMin, sdfBoundsMax,
                                           sdfVolumeResolution, sdfAtlasResolution, sdfSlicesPerRow);
            // grad 指向容器内部（因为我们构造的是“盆”型容器 SDF）
            vec3 normal = grad;
            
            // 只有当速度朝着墙体（指向外部）时才反射
            float velDotNormal = dot(velocity, normal);
            if (velDotNormal < 0.0) {
                velocity = velocity - (1.0 + collisionDamping) * velDotNormal * normal;
            }
        }
    } else {
        // Fallback to AABB collision
        vec3 center = (boundsMin + boundsMax) * 0.5;
        vec3 halfSize = (boundsMax - boundsMin) * 0.5 - vec3(particleRadius);
        vec3 rel = nextPos - center;

        if (abs(rel.x) > halfSize.x) {
            velocity.x *= -collisionDamping;
        }
        if (abs(rel.y) > halfSize.y) {
            velocity.y *= -collisionDamping;
        }
        if (abs(rel.z) > halfSize.z) {
            velocity.z *= -collisionDamping;
        }
    }

    velocity = clampVelocity(velocity);
    gl_FragColor = vec4(velocity, 1.0);
}
`;

// Position update shader
const fragmentShaderPosition = /*glsl*/`
uniform float delta;
uniform vec3 boundsMin;
uniform vec3 boundsMax;
uniform float particleRadius;
uniform float enableLoopWaterfall; // 1 = 开启循环瀑布, 0 = 关闭
uniform vec3 respawnCenter;        // 当 sdf<0 时粒子重生的位置
uniform float respawnEnabled;      // 1 = 启用重生, 0 = 禁用重生
uniform float respawnMaxPerFrame;  // 期望每帧最大重生数量（近似控制）
uniform float numParticles;        // 粒子总数，用于自动缓冲估计

// SDF collision uniforms
uniform sampler2D textureSDFVolume;
uniform vec3 sdfBoundsMin;
uniform vec3 sdfBoundsMax;
uniform vec3 sdfVolumeResolution;
uniform vec2 sdfAtlasResolution;
uniform float sdfSlicesPerRow;
uniform bool sdfEnabled;

${sdfSamplingFunctions}

float hash11(float seed) {
    return fract(sin(seed) * 43758.5453);
}

vec3 random01(float seed) {
    return vec3(
        hash11(seed * 12.9898),
        hash11(seed * 78.233),
        hash11(seed * 45.678)
    );
}

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    vec4 posData = texture2D(texturePosition, uv);
    vec4 velData = texture2D(textureVelocity, uv);

    vec3 position = posData.xyz;
    vec3 velocity = velData.xyz;
    float respawnTimer = posData.w;

    float seedBase = gl_FragCoord.x + gl_FragCoord.y * resolution.x;

    if (respawnTimer > 0.0) {
        respawnTimer = max(respawnTimer - delta, 0.0);
        if (respawnTimer > 0.0) {
            gl_FragColor = vec4(position, respawnTimer);
            return;
        } else {
            vec3 rand01Val = random01(seedBase);
            float spawnRadius = 0.1;
            position = respawnCenter + (rand01Val - 0.5) * spawnRadius;
            gl_FragColor = vec4(position, 0.0);
            return;
        }
    }

    if (position.x < -9000.0) {
        gl_FragColor = vec4(position, 0.0);
        return;
    }

    // Update position
    position += velocity * delta;

    if (sdfEnabled) {
        // SDF-based collision resolution for CONTAINER
        float sdf = sampleSDF(position, textureSDFVolume, sdfBoundsMin, sdfBoundsMax,
                              sdfVolumeResolution, sdfAtlasResolution, sdfSlicesPerRow);
        
        // ===== respawn =================
        if (sdf < 0.0 && respawnEnabled > 0.5) {
            vec3 rand01Val = random01(seedBase);
            float spawnRadius = 0.1;  // 出生区域半径
            // buffer setup
            float delay = float(numParticles) / max(respawnMaxPerFrame * 60.0, 1.0);

            if (delay > 0.0) {
                float timer = rand01Val.x * delay;
                gl_FragColor = vec4(vec3(-9999.0), timer);
                return;
            }

            position = respawnCenter + (rand01Val - 0.5) * spawnRadius;
            velocity = vec3(0.0, 0.0, 0.0);
        }
        else if (sdf < particleRadius) {
            float epsilon = 0.02;
            vec3 grad = computeSDFGradient(position, epsilon, textureSDFVolume,
                                           sdfBoundsMin, sdfBoundsMax,
                                           sdfVolumeResolution, sdfAtlasResolution, sdfSlicesPerRow);
            vec3 normal = grad;  // grad 指向容器内部
            float pushInside = (particleRadius - sdf);
            position += normal * pushInside;
        }

        // AABB
        if (enableLoopWaterfall > 0.5) {
            vec3 center = 0.5 * (sdfBoundsMin + sdfBoundsMax);
            float sizeX = (sdfBoundsMax.x - sdfBoundsMin.x);
            float sizeZ = (sdfBoundsMax.z - sdfBoundsMin.z);

            float marginX = sizeX * 0.1;
            float marginZ = sizeZ * 0.1;

            float leftX   = sdfBoundsMin.x + marginX;
            float rightX  = sdfBoundsMax.x - marginX;
            float topZ    = sdfBoundsMax.z - marginZ;
            float bottomZ = sdfBoundsMin.z + marginZ;

            if (position.x > rightX && position.z < bottomZ) {
                vec3 spawnCenter = vec3(leftX, center.y, topZ);

                float seed = gl_FragCoord.x + gl_FragCoord.y * resolution.x;
                float rx = fract(sin(seed * 12.9898) * 43758.5453);
                float rz = fract(sin((seed + 1.0) * 78.233) * 12345.6789);

                float spanX = sizeX * 0.2; 
                float spanZ = sizeZ * 0.2;

                position.x = spawnCenter.x + (rx - 0.5) * spanX;
                position.y = center.y;
                position.z = spawnCenter.z + (rz - 0.5) * spanZ;

                vec3 flowDir = normalize(vec3(1.0, 0.0, -1.0));
                float baseSpeed = 0.0002;       
                velocity = flowDir * baseSpeed;
            }
        }
    } else {
        // Fallback to AABB collision resolution
        vec3 center = (boundsMin + boundsMax) * 0.5;
        vec3 halfSize = (boundsMax - boundsMin) * 0.5 - vec3(particleRadius);

        vec3 rel = position - center;
        rel.x = clamp(rel.x, -halfSize.x, halfSize.x);
        rel.y = clamp(rel.y, -halfSize.y, halfSize.y);
        rel.z = clamp(rel.z, -halfSize.z, halfSize.z);

        position = center + rel;
    }
    // outside rendering range recycle
    bool outOfBounds = position.x < boundsMin.x || position.x > boundsMax.x ||
                       position.y < boundsMin.y || position.y > boundsMax.y ||
                       position.z < boundsMin.z || position.z > boundsMax.z;
    if (outOfBounds && respawnEnabled > 0.5) {
        vec3 rand01Val = random01(seedBase + 101.0);
        float spawnRadius = 1.8;
        float delay = float(numParticles) / max(respawnMaxPerFrame * 60.0, 1.0);

        if (delay > 0.0) {
            float timer = rand01Val.x * delay;
            gl_FragColor = vec4(vec3(-9999.0), timer);
            return;
        }

        position.x = respawnCenter.x + (rand01Val.x - 0.5) * spawnRadius;
        position.y = respawnCenter.y + (rand01Val.y - 0.5) * spawnRadius;
        position.z = respawnCenter.z + (rand01Val.z - 0.5) * spawnRadius;

        velocity = vec3(0.0, 0.0, 0.0);
    } else if (outOfBounds && respawnEnabled < 0.5) {
        position.x = clamp(position.x, boundsMin.x, boundsMax.x);
        position.y = clamp(position.y, boundsMin.y, boundsMax.y);
        position.z = clamp(position.z, boundsMin.z, boundsMax.z);
    }

    gl_FragColor = vec4(position, 0.0);
}
`;


const fragmentShaderCellId = /*glsl*/`
uniform sampler2D texturePosition;
uniform sampler2D textureVelocity;
uniform vec2 resolution;
uniform float numParticles;
uniform float gravity;
uniform float delta;
uniform vec3 gridMin;
uniform vec3 gridDimensions;
uniform float gridCellSize;
uniform float inactiveCellId;

const float PREDICTION_FACTOR = 1.0 / 120.0;

vec2 indexToUV(float index) {
    float x = mod(index, resolution.x);
    float y = floor(index / resolution.x);
    return (vec2(x + 0.5, y + 0.5) / resolution);
}

void main() {
    vec2 uv = gl_FragCoord.xy / resolution;
    float xIndex = floor(gl_FragCoord.x);
    float yIndex = floor(gl_FragCoord.y);
    float linearIndex = xIndex + yIndex * resolution.x;

    if (linearIndex >= resolution.x * resolution.y || linearIndex >= numParticles) {
        gl_FragColor = vec4(inactiveCellId, -1.0, 0.0, 0.0);
        return;
    }

    vec4 posData = texture2D(texturePosition, uv);
    vec3 position = posData.xyz;
    if (position.x < -9000.0) {
        gl_FragColor = vec4(inactiveCellId, -1.0, 0.0, 0.0);
        return;
    }

    vec3 velocity = texture2D(textureVelocity, uv).xyz;
    vec3 velWithGravity = velocity + vec3(0.0, 0.0, -gravity) * delta;
    vec3 predictedPos = position + velWithGravity * PREDICTION_FACTOR;

    vec3 relative = (predictedPos - gridMin) / gridCellSize;
    vec3 floored = floor(relative);
    vec3 clamped = clamp(floored, vec3(0.0), gridDimensions - vec3(1.0));
    ivec3 cellCoord = ivec3(clamped);
    int dimX = int(gridDimensions.x);
    int dimY = int(gridDimensions.y);
    float cellId = float(cellCoord.x + cellCoord.y * dimX + cellCoord.z * dimX * dimY);

    gl_FragColor = vec4(cellId, linearIndex, 0.0, 0.0);
}
`;

const fragmentShaderBitonic = /*glsl*/`
uniform sampler2D textureData;
uniform vec2 resolution;
uniform float stageSize;
uniform float subStageSize;
uniform float totalSize;

vec4 readData(int rawIndex) {
    int width = int(resolution.x);
    int height = int(resolution.y);
    int maxIndex = width * height - 1;
    int index = clamp(rawIndex, 0, maxIndex);
    int y = index / width;
    int x = index - y * width;
    vec2 uv = (vec2(float(x) + 0.5, float(y) + 0.5) / resolution);
    return texture2D(textureData, uv);
}

// Compare two entries: returns true if a < b (ascending order)
bool isLessThan(vec4 a, vec4 b) {
    if (a.x < b.x) return true;
    if (a.x > b.x) return false;
    return a.y < b.y;  // tie-break by particle index
}

void main() {
    ivec2 fragCoord = ivec2(gl_FragCoord.xy);
    int width = int(resolution.x);
    int idx = fragCoord.x + fragCoord.y * width;

    vec4 self = readData(idx);

    if (float(idx) >= totalSize) {
        gl_FragColor = self;
        return;
    }

    int stage = int(stageSize);
    int subStage = int(subStageSize);
    int partnerIdx = idx ^ subStage;

    vec4 partner = readData(partnerIdx);

    // Determine sort direction for this block
    // ascending = true means this block should be sorted low-to-high
    bool ascending = ((idx & stage) == 0);
    
    // CRITICAL FIX: Determine if we are the LEFT or RIGHT element in the comparison pair
    // If (idx & subStage) == 0, then idx < partnerIdx (we are LEFT)
    // If (idx & subStage) != 0, then idx > partnerIdx (we are RIGHT)
    bool isLeftElement = ((idx & subStage) == 0);
    
    // For the LEFT element in ascending order: we want the SMALLER value
    // For the RIGHT element in ascending order: we want the LARGER value
    // For descending order: reverse the above
    // 
    // Truth table:
    // ascending  isLeft  -> want smaller at my position
    // true       true    -> true  (left in ascending = want min)
    // true       false   -> false (right in ascending = want max)
    // false      true    -> false (left in descending = want max)
    // false      false   -> true  (right in descending = want min)
    // 
    // Result: wantSmaller = (ascending == isLeftElement)
    
    bool wantSmaller = (ascending == isLeftElement);
    
    bool selfIsSmaller = isLessThan(self, partner);
    
    // If we want the smaller value and self is already smaller, keep self
    // If we want the smaller value and partner is smaller, take partner
    // If we want the larger value and self is larger, keep self
    // If we want the larger value and partner is larger, take partner
    bool keepSelf = (wantSmaller == selfIsSmaller);
    
    gl_FragColor = keepSelf ? self : partner;
}
`;

//precompute
const fragmentShaderCellRange = /*glsl*/`
uniform sampler2D textureSortedCells;
uniform vec2 sortedResolution;
uniform float sortedTotalElements;
uniform vec2 cellResolution;
uniform float cellCount;

const int MAX_BINARY_STEPS = 32;

vec4 readSortedEntry(int rawIndex) {
    int width = int(sortedResolution.x);
    int height = int(sortedResolution.y);
    int maxIndex = width * height - 1;
    int index = clamp(rawIndex, 0, maxIndex);
    int y = index / width;
    int x = index - y * width;
    vec2 uv = (vec2(float(x) + 0.5, float(y) + 0.5) / sortedResolution);
    return texture2D(textureSortedCells, uv);
}

int lowerBoundCell(int cellId) {
    int left = 0;
    int right = int(sortedTotalElements) - 1;
    int result = -1;
    for (int i = 0; i < MAX_BINARY_STEPS; i++) {
        if (left > right) break;
        int mid = (left + right) / 2;
        int midCell = int(readSortedEntry(mid).x + 0.5);
        if (midCell < cellId) {
            left = mid + 1;
        } else {
            right = mid - 1;
            if (midCell == cellId) result = mid;
        }
    }
    return result;
}

int upperBoundCell(int cellId) {
    int left = 0;
    int right = int(sortedTotalElements) - 1;
    int result = -1;
    for (int i = 0; i < MAX_BINARY_STEPS; i++) {
        if (left > right) break;
        int mid = (left + right) / 2;
        int midCell = int(readSortedEntry(mid).x + 0.5);
        if (midCell <= cellId) {
            left = mid + 1;
            if (midCell == cellId) result = mid + 1;
        } else {
            right = mid - 1;
        }
    }
    return result == -1 ? left : result;
}

void main() {
    ivec2 fragCoord = ivec2(gl_FragCoord.xy);
    int cellId = fragCoord.x + fragCoord.y * int(cellResolution.x);

    if (cellId >= int(cellCount)) {
        gl_FragColor = vec4(-1.0, -1.0, 0.0, 0.0);
        return;
    }

    int start = lowerBoundCell(cellId);
    if (start < 0) {
        gl_FragColor = vec4(-1.0, -1.0, 0.0, 0.0);
        return;
    }
    int endExclusive = upperBoundCell(cellId);
    gl_FragColor = vec4(float(start), float(endExclusive), 0.0, 0.0);
}
`;

export interface FluidSimulatorParams {
    particleCount: number;
    gravity: number;
    collisionDamping: number;
    particleRadius: number;
    boundsMin: Vec3;
    boundsMax: Vec3;
    smoothingRadius: number;
    targetDensity: number;
    pressureMultiplier: number;
    nearPressureMultiplier: number;
    particleMass: number;
    viscosityStrength: number;
    maxSpeed?: number;

    jitterStrength?: number;
    initialVelocity?: Vec3;
    spawnRegionScale?: number;
    particleSpacing?: number;
    spawnCenter?: Vec3;
    respawnCenter?: Vec3;
    respawnEnabled?: boolean;
    respawnMaxPerFrame?: number;
    enableLoopWaterfall?: boolean;
    sdfResolution?: number;
    volumeResolution?: number;
}

export class FluidSimulator {
    private gpuCompute!: any; // GPUComputationRenderer
    private positionVariable!: any;
    private velocityVariable!: any;
    private positionUniforms!: any;
    private velocityUniforms!: any;
    
    // Manual Density Pass
    private densityRenderTarget!: THREE.WebGLRenderTarget;
    private densityMaterial!: THREE.ShaderMaterial;
    private densityScene!: THREE.Scene;
    private densityCamera!: THREE.Camera;
    private renderer!: THREE.WebGLRenderer;

    // Grid-sorted neighbour resources
    private sortedTargetA!: THREE.WebGLRenderTarget;
    private sortedTargetB!: THREE.WebGLRenderTarget;
    private cellIdMaterial!: THREE.ShaderMaterial;
    private bitonicMaterial!: THREE.ShaderMaterial;
    private fullscreenScene!: THREE.Scene;
    private fullscreenCamera!: THREE.Camera;
    private fullscreenMesh!: THREE.Mesh;
    private sortedTexture!: THREE.Texture;
    private cellRangeTarget!: THREE.WebGLRenderTarget;
    private cellRangeMaterial!: THREE.ShaderMaterial;
    private cellResolutionVec: THREE.Vector2 = new THREE.Vector2(1, 1);
    private cellCountValue: number = 1;

    // 3D density field
    private densityFieldTarget!: THREE.WebGLRenderTarget;
    private densityFieldMaterial!: THREE.ShaderMaterial;
    private volumeResolution: THREE.Vector3 = new THREE.Vector3(32, 32, 32);
    private atlasResolution: THREE.Vector2 = new THREE.Vector2(256, 128);
    private slicesPerRow: number = 8;

    // SDF collision resources
    private sdfTarget!: THREE.WebGLRenderTarget;
    private sdfMaterial!: THREE.ShaderMaterial;
    private sdfVolumeResolution: THREE.Vector3 = new THREE.Vector3(64, 64, 64);
    private sdfAtlasResolution: THREE.Vector2 = new THREE.Vector2(512, 512);
    private sdfSlicesPerRow: number = 8;
    private triangleTexture!: THREE.DataTexture;
    private triangleCount: number = 0;
    private sdfNeedsUpdate: boolean = false;
    private sdfInitialized: boolean = false;
    private sdfBoundsMin: THREE.Vector3 = new THREE.Vector3(-1, -1, -1);
    private sdfBoundsMax: THREE.Vector3 = new THREE.Vector3(1, 1, 1);

    private width: number;
    private particleCount: number;
    private gridDimensionsVec: THREE.Vector3 = new THREE.Vector3(1, 1, 1);
    private gridCellSizeValue: number = 1.0;
    private maxCellIdValue: number = 0;
    private sortedResolutionVec!: THREE.Vector2;
    
    public gravity: number = 0;
    public collisionDamping: number = 0.5;
    public particleRadius: number = 0.065;
    public boundsMin: Vec3;
    public boundsMax: Vec3;
    public smoothingRadius: number = 0.2;
    public targetDensity: number = 1.0;
    public pressureMultiplier: number = 0.0;
    public nearPressureMultiplier: number = 0.0;
    public particleMass: number = 1.0;
    public viscosityStrength: number = 0.0;
    public maxSpeed: number = 10.0;

    // init particle
    public jitterStrength: number = 0.001;
    public initialVelocity: Vec3 = new Vec3(0, 0, 0);
    public spawnRegionScale: number = 0.8;
    public particleSpacing: number = 0;
    public spawnCenter: Vec3 | null = null;
    public respawnCenter: Vec3 = new Vec3(0, 0, -0.2);
    public respawnEnabled: boolean = true;
    public respawnMaxPerFrame: number = 10;
    public loopWaterfallEnabled: boolean = false;
    public sdfResolution: number = 128;
    
    // ===== external force =====================
    public externalForceEnabled: boolean = false;
    public externalForceActive: boolean = false;
    public externalForceCenter: Vec3 = new Vec3(0, 0, 0);
    public externalForceRadius: number = 0.6;
    public externalForceStrength: number = 8.0;

    constructor(renderer: THREE.WebGLRenderer, params: FluidSimulatorParams) {
        this.particleCount = params.particleCount;
        this.gravity = params.gravity;
        this.collisionDamping = params.collisionDamping;
        this.particleRadius = params.particleRadius;
        this.boundsMin = params.boundsMin;
        this.boundsMax = params.boundsMax;
        this.smoothingRadius = params.smoothingRadius;
        this.targetDensity = params.targetDensity;
        this.pressureMultiplier = params.pressureMultiplier;
        this.nearPressureMultiplier = params.nearPressureMultiplier;
        this.particleMass = params.particleMass;
        this.viscosityStrength = params.viscosityStrength;
        this.maxSpeed = params.maxSpeed ?? 5.0;

        this.jitterStrength = params.jitterStrength ?? 0.001;
        this.initialVelocity = params.initialVelocity ?? new Vec3(0, 0, 0);
        this.spawnRegionScale = params.spawnRegionScale ?? 0.8;
        this.particleSpacing = params.particleSpacing ?? 0;
        this.spawnCenter = params.spawnCenter ?? null;
        this.respawnCenter = params.respawnCenter ?? new Vec3(0, 0, -0.2);
        this.respawnEnabled = params.respawnEnabled ?? true;
        this.respawnMaxPerFrame = params.respawnMaxPerFrame ?? 10;
        this.loopWaterfallEnabled = params.enableLoopWaterfall ?? false;
        this.sdfResolution = params.sdfResolution ?? 128;
        const volumeRes = params.volumeResolution ?? 32;
        this.volumeResolution.set(volumeRes, volumeRes, volumeRes);

        // need width to be power of 2 for bitonic sort
        // this.width = 128;
        this.width = Math.ceil(Math.sqrt(this.particleCount));
        this.width = Math.pow(2, Math.ceil(Math.log2(this.width)));
        this.sortedResolutionVec = new THREE.Vector2(this.width, this.width);

        this.updateGridSettings();

        this.renderer = renderer;
        this.initComputeRenderer(renderer);
    }
    
    private initComputeRenderer(renderer: THREE.WebGLRenderer): void {
        this.gpuCompute = new GPUComputationRenderer(this.width, this.width, renderer);
        
        const dtPosition = this.gpuCompute.createTexture();
        const dtVelocity = this.gpuCompute.createTexture();
        
        // initialize as a cube in the center
        this.fillPositionTexture(dtPosition);
        this.fillVelocityTexture(dtVelocity);
        
        // params: variableName, computeFragmentShader, initialValueTexture
        this.velocityVariable = this.gpuCompute.addVariable(
            "textureVelocity",
            fragmentShaderVelocity,
            dtVelocity
        );
        this.positionVariable = this.gpuCompute.addVariable(
            "texturePosition",
            fragmentShaderPosition,
            dtPosition
        );

        // Dependencies: Velocity and Position only depend on each other
        // textureDensity is a MANUAL uniform, not a GPUComputationRenderer variable
        this.gpuCompute.setVariableDependencies(this.velocityVariable, [ this.positionVariable, this.velocityVariable]);
        this.gpuCompute.setVariableDependencies(this.positionVariable, [ this.positionVariable, this.velocityVariable]);
        
        this.positionUniforms = this.positionVariable.material.uniforms;

        this.positionUniforms["delta"] = { value: 0.0 };
        this.positionUniforms["boundsMin"] = { value: new THREE.Vector3(this.boundsMin.x, this.boundsMin.y, this.boundsMin.z) };
        this.positionUniforms["boundsMax"] = { value: new THREE.Vector3(this.boundsMax.x, this.boundsMax.y, this.boundsMax.z) };
        this.positionUniforms["particleRadius"] = { value: this.particleRadius };
        this.positionUniforms["enableLoopWaterfall"] = { value: this.loopWaterfallEnabled ? 1.0 : 0.0 };

        // SDF collision uniforms for position shader
        this.positionUniforms["textureSDFVolume"] = { value: null };
        this.positionUniforms["sdfBoundsMin"] = { value: new THREE.Vector3(-1, -1, -1) };
        this.positionUniforms["sdfBoundsMax"] = { value: new THREE.Vector3(1, 1, 1) };
        this.positionUniforms["sdfVolumeResolution"] = { value: new THREE.Vector3(64, 64, 64) };
        this.positionUniforms["sdfAtlasResolution"] = { value: new THREE.Vector2(512, 512) };
        this.positionUniforms["sdfSlicesPerRow"] = { value: 8 };
        this.positionUniforms["sdfEnabled"] = { value: false };
        this.positionUniforms["respawnCenter"] = { value: new THREE.Vector3(0, 0, -0.2) };
        this.positionUniforms["respawnEnabled"] = { value: 1.0 };
        this.positionUniforms["respawnMaxPerFrame"] = { value: this.respawnMaxPerFrame };
        this.positionUniforms["numParticles"] = { value: this.particleCount };

        this.velocityUniforms = this.velocityVariable.material.uniforms;

        this.velocityUniforms["delta"] = { value: 0.0 };
        this.velocityUniforms["gravity"] = { value: this.gravity };
        this.velocityUniforms["collisionDamping"] = { value: this.collisionDamping };
        this.velocityUniforms["particleRadius"] = { value: this.particleRadius };
        this.velocityUniforms["maxSpeed"] = { value: this.maxSpeed };
        this.velocityUniforms["boundsMin"] = { value: new THREE.Vector3(this.boundsMin.x, this.boundsMin.y, this.boundsMin.z) };
        this.velocityUniforms["boundsMax"] = { value: new THREE.Vector3(this.boundsMax.x, this.boundsMax.y, this.boundsMax.z) };

        this.velocityUniforms["smoothingRadius"] = { value: this.smoothingRadius };
        this.velocityUniforms["targetDensity"] = { value: this.targetDensity };
        this.velocityUniforms["pressureMultiplier"] = { value: this.pressureMultiplier };
        this.velocityUniforms["nearPressureMultiplier"] = { value: this.nearPressureMultiplier };
        this.velocityUniforms["particleMass"] = { value: this.particleMass };
        this.velocityUniforms["numParticles"] = { value: this.particleCount };
        this.velocityUniforms["textureDensity"] = { value: null }; // set in compute()
        this.velocityUniforms["viscosityStrength"] = { value: this.viscosityStrength };
        this.velocityUniforms["gridMin"] = { value: new THREE.Vector3(this.boundsMin.x, this.boundsMin.y, this.boundsMin.z) };
        this.velocityUniforms["gridDimensions"] = { value: this.gridDimensionsVec.clone() };
        this.velocityUniforms["gridCellSize"] = { value: this.gridCellSizeValue };
        this.velocityUniforms["textureSortedCells"] = { value: null };
        this.velocityUniforms["sortedResolution"] = { value: this.sortedResolutionVec.clone() };
        this.velocityUniforms["sortedTotalElements"] = { value: this.width * this.width };
        this.velocityUniforms["textureCellRange"] = { value: null };
        this.velocityUniforms["cellResolution"] = { value: this.cellResolutionVec.clone() };
        this.velocityUniforms["cellCount"] = { value: this.cellCountValue };

        // external force
        this.velocityUniforms["externalForceEnabled"] = { value: 0.0 };
        this.velocityUniforms["externalForceCenter"] = { value: new THREE.Vector3(0, 0, 0) };
        this.velocityUniforms["externalForceRadius"] = { value: this.externalForceRadius };
        this.velocityUniforms["externalForceStrength"] = { value: this.externalForceStrength };

        // SDF collision uniforms for velocity shader
        this.velocityUniforms["textureSDFVolume"] = { value: null };
        this.velocityUniforms["sdfBoundsMin"] = { value: new THREE.Vector3(-1, -1, -1) };
        this.velocityUniforms["sdfBoundsMax"] = { value: new THREE.Vector3(1, 1, 1) };
        this.velocityUniforms["sdfVolumeResolution"] = { value: new THREE.Vector3(64, 64, 64) };
        this.velocityUniforms["sdfAtlasResolution"] = { value: new THREE.Vector2(512, 512) };
        this.velocityUniforms["sdfSlicesPerRow"] = { value: 8 };
        this.velocityUniforms["sdfEnabled"] = { value: false };

        this.velocityVariable.wrapS = THREE.ClampToEdgeWrapping;
        this.velocityVariable.wrapT = THREE.ClampToEdgeWrapping;
        this.positionVariable.wrapS = THREE.ClampToEdgeWrapping;
        this.positionVariable.wrapT = THREE.ClampToEdgeWrapping;
        // Manual density pass
        // a frame buffer object texture
        this.densityRenderTarget = new THREE.WebGLRenderTarget(this.width, this.width, {
            type: THREE.FloatType,
            format: THREE.RGBAFormat,
        });

        this.densityMaterial = new THREE.ShaderMaterial({
            uniforms: {
                texturePosition: { value: null },
                textureVelocity: { value: null },
                resolution: { value: new THREE.Vector2(this.width, this.width) },
                smoothingRadius: { value: this.smoothingRadius },
                numParticles: { value: this.particleCount },
                gravity: { value: this.gravity },
                delta: { value: 0.0 },
                gridMin: { value: new THREE.Vector3(this.boundsMin.x, this.boundsMin.y, this.boundsMin.z) },
                gridDimensions: { value: this.gridDimensionsVec.clone() },
                gridCellSize: { value: this.gridCellSizeValue },
                textureSortedCells: { value: null },
                sortedResolution: { value: this.sortedResolutionVec.clone() },
                sortedTotalElements: { value: this.width * this.width },
                textureCellRange: { value: null },
                cellResolution: { value: this.cellResolutionVec.clone() },
                cellCount: { value: this.cellCountValue },
            },
            vertexShader: `void main() { gl_Position = vec4( position, 1.0 ); }`,
            fragmentShader: fragmentShaderDensities
        });

        this.densityScene = new THREE.Scene();
        this.densityCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);//让画面坐标刚好覆盖 NDC [-1,1] x [-1,1] 的全屏范围
        const densityMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.densityMaterial);//配合正交相机，让这个平面刚好在 GPU 渲染时覆盖全屏
        this.densityScene.add(densityMesh);

        // Grid pass
        const rt = {
            type: THREE.FloatType,
            format: THREE.RGBAFormat,
        };

        this.sortedTargetA = new THREE.WebGLRenderTarget(this.width, this.width, rt);
        this.sortedTargetB = new THREE.WebGLRenderTarget(this.width, this.width, rt);
        this.sortedTexture = this.sortedTargetA.texture;

        this.ensureCellRangeTarget();
        this.cellRangeMaterial = new THREE.ShaderMaterial({
            uniforms: {
                textureSortedCells: { value: null },
                sortedResolution: { value: this.sortedResolutionVec.clone() },
                sortedTotalElements: { value: this.width * this.width },
                cellResolution: { value: this.cellResolutionVec.clone() },
                cellCount: { value: this.cellCountValue },
            },
            vertexShader: `void main() { gl_Position = vec4(position, 1.0); }`,
            fragmentShader: fragmentShaderCellRange,
        });

        this.fullscreenScene = new THREE.Scene();
        this.fullscreenCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.fullscreenMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial());
        this.fullscreenScene.add(this.fullscreenMesh);

        // ============== init 3D density field ======
        const volumeRes = this.volumeResolution.x;
        this.slicesPerRow = Math.ceil(Math.sqrt(volumeRes));
        const slicesPerCol = Math.ceil(this.volumeResolution.z / this.slicesPerRow);
        this.atlasResolution.set(
            this.volumeResolution.x * this.slicesPerRow,
            this.volumeResolution.y * slicesPerCol
        );

        this.densityFieldTarget = new THREE.WebGLRenderTarget(
            this.atlasResolution.x,
            this.atlasResolution.y,
            {
                type: THREE.FloatType,
                format: THREE.RGBAFormat,
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                wrapS: THREE.ClampToEdgeWrapping,
                wrapT: THREE.ClampToEdgeWrapping
            }
        );

        this.densityFieldMaterial = new THREE.ShaderMaterial({
            uniforms: {
                texturePosition: { value: null },
                textureSortedCells: { value: null },
                textureCellRange: { value: null },
                resolution: { value: new THREE.Vector2(this.width, this.width) },
                sortedResolution: { value: this.sortedResolutionVec.clone() },
                sortedTotalElements: { value: this.width * this.width },
                cellResolution: { value: this.cellResolutionVec.clone() },
                cellCount: { value: this.cellCountValue },
                numParticles: { value: this.particleCount },
                boundsMin: { value: new THREE.Vector3(this.boundsMin.x, this.boundsMin.y, this.boundsMin.z) },
                boundsMax: { value: new THREE.Vector3(this.boundsMax.x, this.boundsMax.y, this.boundsMax.z) },
                gridMin: { value: new THREE.Vector3(this.boundsMin.x, this.boundsMin.y, this.boundsMin.z) },
                gridDimensions: { value: this.gridDimensionsVec.clone() },
                gridCellSize: { value: this.gridCellSizeValue },
                smoothingRadius: { value: this.smoothingRadius },
                volumeResolution: { value: this.volumeResolution.clone() },
                atlasResolution: { value: this.atlasResolution.clone() },
                slicesPerRow: { value: this.slicesPerRow },
            },
            vertexShader: `void main() { gl_Position = vec4(position, 1.0); }`,
            fragmentShader: fragmentShaderDensityField
        });
        // --- End 3D 密度场 ---

        // --- Initialize SDF collision resources ---
        this.initSDFResources(this.sdfResolution);
        // --- End SDF collision ---

        this.cellIdMaterial = new THREE.ShaderMaterial({
            uniforms: {
                texturePosition: { value: null },
                textureVelocity: { value: null },
                resolution: { value: this.sortedResolutionVec.clone() },
                numParticles: { value: this.particleCount },
                gravity: { value: this.gravity },
                delta: { value: 0.0 },
                gridMin: { value: new THREE.Vector3(this.boundsMin.x, this.boundsMin.y, this.boundsMin.z) },
                gridDimensions: { value: this.gridDimensionsVec.clone() },
                gridCellSize: { value: this.gridCellSizeValue },
                inactiveCellId: { value: this.maxCellIdValue }
            },
            vertexShader: `void main() { gl_Position = vec4(position, 1.0); }`,
            fragmentShader: fragmentShaderCellId
        });

        this.bitonicMaterial = new THREE.ShaderMaterial({
            uniforms: {
                textureData: { value: null },
                resolution: { value: this.sortedResolutionVec.clone() },
                stageSize: { value: 1.0 },
                subStageSize: { value: 1.0 },
                totalSize: { value: this.width * this.width }
            },
            vertexShader: `void main() { gl_Position = vec4(position, 1.0); }`,
            fragmentShader: fragmentShaderBitonic
        });

        this.syncGridUniforms();

        const error = this.gpuCompute.init();
        if (error !== null) {
            console.error("GPUComputationRenderer init error:", error);
        }
    }
    
    /**
     * 填充粒子位置纹理
     * - 使用固定间距排列成正方体
     * - 装不下的粒子标记为无效
     */
    private fillPositionTexture(texture: THREE.DataTexture): void {
        const data = texture.image.data as unknown as Float32Array;
        
        // 计算生成区域的中心：优先使用 spawnCenter，否则使用 bounds 中心
        let centerX: number, centerY: number, centerZ: number;
        if (this.spawnCenter) {
            centerX = this.spawnCenter.x;
            centerY = this.spawnCenter.y;
            centerZ = this.spawnCenter.z;
            // console.log(`FluidSimulator: Using custom spawnCenter (${centerX}, ${centerY}, ${centerZ})`);
        } else {
            centerX = (this.boundsMin.x + this.boundsMax.x) * 0.5;
            centerY = (this.boundsMin.y + this.boundsMax.y) * 0.5;
            centerZ = (this.boundsMin.z + this.boundsMax.z) * 0.5;
            // console.log(`FluidSimulator: Using bounds center (${centerX.toFixed(2)}, ${centerY.toFixed(2)}, ${centerZ.toFixed(2)})`);
        }
        
        // 生成区域尺寸 = bounds * spawnRegionScale
        const sizeX = (this.boundsMax.x - this.boundsMin.x) * this.spawnRegionScale;
        const sizeY = (this.boundsMax.y - this.boundsMin.y) * this.spawnRegionScale;
        const sizeZ = (this.boundsMax.z - this.boundsMin.z) * this.spawnRegionScale;
        
        let spacing: number;
        let particlesX: number, particlesY: number, particlesZ: number;
        
        if (this.particleSpacing > 0) {
            // 固定间距模式：计算每个方向能放多少粒子，尽量排成正方体
            spacing = this.particleSpacing;
            
            // 计算每个方向能放多少粒子
            const maxX = Math.floor(sizeX / spacing) + 1;
            const maxY = Math.floor(sizeY / spacing) + 1;
            const maxZ = Math.floor(sizeZ / spacing) + 1;
            
            // 尽量排成正方体：取最小边作为基准
            const cubeSize = Math.ceil(Math.cbrt(this.particleCount));
            
            // 限制在可用空间内
            particlesX = Math.min(cubeSize, maxX);
            particlesY = Math.min(cubeSize, maxY);
            particlesZ = Math.min(cubeSize, maxZ);
            
            // console.log(`FluidSimulator: Fixed spacing mode`);
            // console.log(`  - Spacing: ${spacing.toFixed(4)}`);
            // console.log(`  - Max capacity: ${maxX} x ${maxY} x ${maxZ} = ${maxX * maxY * maxZ}`);
            // console.log(`  - Using: ${particlesX} x ${particlesY} x ${particlesZ} = ${particlesX * particlesY * particlesZ}`);
        } else {
            const particlesPerSide = Math.ceil(Math.cbrt(this.particleCount));
            particlesX = particlesY = particlesZ = particlesPerSide;
            
            // 取最小边计算间距
            const minSize = Math.min(sizeX, sizeY, sizeZ);
            spacing = particlesPerSide > 1 ? minSize / (particlesPerSide - 1) : minSize;
            
            // console.log(`FluidSimulator: Auto spacing mode`);
            // console.log(`  - Particles per side: ${particlesPerSide}`);
            // console.log(`  - Computed spacing: ${spacing.toFixed(4)}`);
        }
        
        // console.log(`FluidSimulator: Initializing ${this.particleCount} particles in ${this.width}x${this.width} texture`);
        // console.log(`  - Spawn region: ${sizeX.toFixed(2)} x ${sizeY.toFixed(2)} x ${sizeZ.toFixed(2)}`);
        // console.log(`  - Jitter strength: ${this.jitterStrength}`);
        
        // 计算正方体的起始位置（居中）
        const startX = centerX - (particlesX - 1) * spacing * 0.5;
        const startY = centerY - (particlesY - 1) * spacing * 0.5;
        const startZ = centerZ - (particlesZ - 1) * spacing * 0.5;
        
        let placedCount = 0;
        let textureIdx = 0;
        
        // square
        for (let iz = 0; iz < particlesZ && placedCount < this.particleCount; iz++) {
            for (let iy = 0; iy < particlesY && placedCount < this.particleCount; iy++) {
                for (let ix = 0; ix < particlesX && placedCount < this.particleCount; ix++) {
                    let x = startX + ix * spacing;
                    let y = startY + iy * spacing;
                    let z = startZ + iz * spacing;

                    if (this.jitterStrength > 0) {
                        const jitter = this.randomInsideUnitSphere();
                        x += jitter.x * this.jitterStrength;
                        y += jitter.y * this.jitterStrength;
                        z += jitter.z * this.jitterStrength;
                    }
                    
                    data[textureIdx * 4 + 0] = x;
                    data[textureIdx * 4 + 1] = y;
                    data[textureIdx * 4 + 2] = z;
                    data[textureIdx * 4 + 3] = 0.0;
                    
                    textureIdx++;
                    placedCount++;
                }
            }
        }

        for (let i = textureIdx; i < this.width * this.width; i++) {
            data[i * 4 + 0] = -9999;
            data[i * 4 + 1] = -9999;
            data[i * 4 + 2] = -9999;
            data[i * 4 + 3] = 0.0;
        }
        
        if (placedCount < this.particleCount) {
            console.warn(`⚠️ Only placed ${placedCount}/${this.particleCount} particles (space limit)`);
        } else {
            console.log(`✅ Placed all ${placedCount} particles`);
        }
    }

    private randomInsideUnitSphere(): { x: number; y: number; z: number } {
        let x, y, z;
        do {
            x = Math.random() * 2 - 1;
            y = Math.random() * 2 - 1;
            z = Math.random() * 2 - 1;
        } while (x * x + y * y + z * z > 1);
        return { x, y, z };
    }

    private fillVelocityTexture(texture: THREE.DataTexture): void {
        const data = texture.image.data as unknown as Float32Array;
        
        // 使用配置的初始速度
        const vx = this.initialVelocity.x;
        const vy = this.initialVelocity.y;
        const vz = this.initialVelocity.z;
        
        if (vx !== 0 || vy !== 0 || vz !== 0) {
            console.log(`FluidSimulator: Initial velocity = (${vx}, ${vy}, ${vz})`);
        }
        
        for (let i = 0; i < this.width * this.width; i++) {
            if (i < this.particleCount) {
                data[i * 4 + 0] = vx;
                data[i * 4 + 1] = vy;
                data[i * 4 + 2] = vz;
                data[i * 4 + 3] = 1.0;
            } else {
                // 无效粒子速度为 0
                data[i * 4 + 0] = 0;
                data[i * 4 + 1] = 0;
                data[i * 4 + 2] = 0;
                data[i * 4 + 3] = 0.0;
            }
        }
    }

    private updateGridSettings(): void {
        const min = this.boundsMin;
        const max = this.boundsMax;
        const cellSize = Math.max(this.smoothingRadius, 1e-4);
        this.gridCellSizeValue = cellSize;
        const dimX = Math.max(1, Math.ceil((max.x - min.x) / cellSize));
        const dimY = Math.max(1, Math.ceil((max.y - min.y) / cellSize));
        const dimZ = Math.max(1, Math.ceil((max.z - min.z) / cellSize));
        this.gridDimensionsVec.set(dimX, dimY, dimZ);
        this.maxCellIdValue = dimX * dimY * dimZ + 2;

        this.cellCountValue = dimX * dimY * dimZ;
        const minSide = Math.max(1, Math.ceil(Math.sqrt(this.cellCountValue)));
        const sidePow2 = Math.pow(2, Math.ceil(Math.log2(minSide)));
        this.cellResolutionVec.set(sidePow2, sidePow2);
    }

    private syncGridUniforms(): void {
        const minX = this.boundsMin.x;
        const minY = this.boundsMin.y;
        const minZ = this.boundsMin.z;

        (this.densityMaterial.uniforms["gridMin"].value as THREE.Vector3).set(minX, minY, minZ);
        (this.densityMaterial.uniforms["gridDimensions"].value as THREE.Vector3).copy(this.gridDimensionsVec);
        this.densityMaterial.uniforms["gridCellSize"].value = this.gridCellSizeValue;
        this.densityMaterial.uniforms["sortedTotalElements"].value = this.width * this.width;
        (this.densityMaterial.uniforms["cellResolution"].value as THREE.Vector2).copy(this.cellResolutionVec);
        this.densityMaterial.uniforms["cellCount"].value = this.cellCountValue;

        (this.velocityUniforms["gridMin"].value as THREE.Vector3).set(minX, minY, minZ);
        (this.velocityUniforms["gridDimensions"].value as THREE.Vector3).copy(this.gridDimensionsVec);
        this.velocityUniforms["gridCellSize"].value = this.gridCellSizeValue;
        this.velocityUniforms["sortedTotalElements"].value = this.width * this.width;
        (this.velocityUniforms["cellResolution"].value as THREE.Vector2).copy(this.cellResolutionVec);
        this.velocityUniforms["cellCount"].value = this.cellCountValue;

        (this.cellIdMaterial.uniforms["gridMin"].value as THREE.Vector3).set(minX, minY, minZ);
        (this.cellIdMaterial.uniforms["gridDimensions"].value as THREE.Vector3).copy(this.gridDimensionsVec);
        this.cellIdMaterial.uniforms["gridCellSize"].value = this.gridCellSizeValue;
        this.cellIdMaterial.uniforms["inactiveCellId"].value = this.maxCellIdValue;
        this.cellIdMaterial.uniforms["numParticles"].value = this.particleCount;

        if (this.cellRangeMaterial) {
            this.cellRangeMaterial.uniforms["sortedTotalElements"].value = this.width * this.width;
            (this.cellRangeMaterial.uniforms["cellResolution"].value as THREE.Vector2).copy(this.cellResolutionVec);
            this.cellRangeMaterial.uniforms["cellCount"].value = this.cellCountValue;
        }

        if (this.densityFieldMaterial) {
            (this.densityFieldMaterial.uniforms["cellResolution"].value as THREE.Vector2).copy(this.cellResolutionVec);
            this.densityFieldMaterial.uniforms["cellCount"].value = this.cellCountValue;
            this.densityFieldMaterial.uniforms["sortedTotalElements"].value = this.width * this.width;
        }
    }

    private renderFullscreen(material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget): void {
        const currentRenderTarget = this.renderer.getRenderTarget();

        this.fullscreenMesh.material = material;
        this.renderer.setRenderTarget(target);
        this.renderer.render(this.fullscreenScene, this.fullscreenCamera);

        this.renderer.setRenderTarget(currentRenderTarget);
    }

    private ensureCellRangeTarget(): void {
        const targetWidth = Math.max(1, Math.floor(this.cellResolutionVec.x));
        const targetHeight = Math.max(1, Math.floor(this.cellResolutionVec.y));
        const needsNew =
            !this.cellRangeTarget ||
            this.cellRangeTarget.width !== targetWidth ||
            this.cellRangeTarget.height !== targetHeight;

        if (needsNew) {
            if (this.cellRangeTarget) {
                this.cellRangeTarget.dispose();
            }
            this.cellRangeTarget = new THREE.WebGLRenderTarget(targetWidth, targetHeight, {
                type: THREE.FloatType,
                format: THREE.RGBAFormat,
                minFilter: THREE.NearestFilter,
                magFilter: THREE.NearestFilter,
                wrapS: THREE.ClampToEdgeWrapping,
                wrapT: THREE.ClampToEdgeWrapping,
            });
        }
    }

    private runCellIdPass(positionTexture: THREE.Texture, velocityTexture: THREE.Texture, delta: number): void {
        this.cellIdMaterial.uniforms["texturePosition"].value = positionTexture;
        this.cellIdMaterial.uniforms["textureVelocity"].value = velocityTexture;
        this.cellIdMaterial.uniforms["delta"].value = delta;
        this.cellIdMaterial.uniforms["gravity"].value = this.gravity;

        this.renderFullscreen(this.cellIdMaterial, this.sortedTargetA);
    }

    // 相同 cellId 的粒子会被排列在一起
    private runBitonicSort(): void {
        // ping-pong, gpu纹理不能同时读写同一纹理, 创建2个buffer交替读写
        let source = this.sortedTargetA;
        let target = this.sortedTargetB;
        const totalSize = this.width * this.width;
        this.bitonicMaterial.uniforms["totalSize"].value = totalSize;

        for (let stage = 2; stage <= totalSize; stage <<= 1) {
            this.bitonicMaterial.uniforms["stageSize"].value = stage;
            for (let subStage = stage >> 1; subStage >= 1; subStage >>= 1) {
                this.bitonicMaterial.uniforms["subStageSize"].value = subStage;
                this.bitonicMaterial.uniforms["textureData"].value = source.texture;
                this.renderFullscreen(this.bitonicMaterial, target);
                [source, target] = [target, source];
            }
        }

        this.sortedTexture = source.texture;
    }

    private runCellRangePass(): void {
        this.ensureCellRangeTarget();
        this.cellRangeMaterial.uniforms["textureSortedCells"].value = this.sortedTexture;
        this.cellRangeMaterial.uniforms["sortedTotalElements"].value = this.width * this.width;
        (this.cellRangeMaterial.uniforms["cellResolution"].value as THREE.Vector2).copy(this.cellResolutionVec);
        this.cellRangeMaterial.uniforms["cellCount"].value = this.cellCountValue;
        this.renderFullscreen(this.cellRangeMaterial, this.cellRangeTarget);
    }

    public compute(delta: number): void {
        if (!this.gpuCompute) return;

        const maxTimestepFPS = 30;
        const maxDt = 1 / maxTimestepFPS;
        const clampedDelta = Math.min(delta, maxDt);

        // More iterations = smaller dt = more stable simulation
        // Trade-off: more GPU work per frame
        const iterationsPerFrame = 3;  // Increased from 2 for better stability
        const subDelta = clampedDelta / iterationsPerFrame;

        this.updateGridSettings();
        this.syncGridUniforms();

        this.positionUniforms["particleRadius"].value = this.particleRadius;
        this.positionUniforms["boundsMin"].value.set(this.boundsMin.x, this.boundsMin.y, this.boundsMin.z);
        this.positionUniforms["boundsMax"].value.set(this.boundsMax.x, this.boundsMax.y, this.boundsMax.z);
        this.positionUniforms["enableLoopWaterfall"].value = this.loopWaterfallEnabled ? 1.0 : 0.0;

        this.velocityUniforms["gravity"].value = this.gravity;
        this.velocityUniforms["collisionDamping"].value = this.collisionDamping;
        this.velocityUniforms["particleRadius"].value = this.particleRadius;
        this.velocityUniforms["maxSpeed"].value = this.maxSpeed;
        this.velocityUniforms["boundsMin"].value.set(this.boundsMin.x, this.boundsMin.y, this.boundsMin.z);
        this.velocityUniforms["boundsMax"].value.set(this.boundsMax.x, this.boundsMax.y, this.boundsMax.z);

        this.velocityUniforms["smoothingRadius"].value = this.smoothingRadius;
        this.velocityUniforms["targetDensity"].value = this.targetDensity;
        this.velocityUniforms["pressureMultiplier"].value = this.pressureMultiplier;
        this.velocityUniforms["nearPressureMultiplier"].value = this.nearPressureMultiplier;
        this.velocityUniforms["particleMass"].value = this.particleMass;
        this.velocityUniforms["numParticles"].value = this.particleCount;
        this.velocityUniforms["viscosityStrength"].value = this.viscosityStrength;

        const extOn = this.externalForceEnabled && this.externalForceActive;
        this.velocityUniforms["externalForceEnabled"].value = extOn ? 1.0 : 0.0;
        (this.velocityUniforms["externalForceCenter"].value as THREE.Vector3).set(
            this.externalForceCenter.x,
            this.externalForceCenter.y,
            this.externalForceCenter.z
        );
        this.velocityUniforms["externalForceRadius"].value = this.externalForceRadius;
        this.velocityUniforms["externalForceStrength"].value = this.externalForceStrength;

        this.densityMaterial.uniforms["smoothingRadius"].value = this.smoothingRadius;
        this.densityMaterial.uniforms["numParticles"].value = this.particleCount;
        this.densityMaterial.uniforms["gravity"].value = this.gravity;
        this.cellIdMaterial.uniforms["gravity"].value = this.gravity;

        // Update SDF uniforms
        const sdfEnabled = this.isSDFCollisionEnabled();
        this.positionUniforms["sdfEnabled"].value = sdfEnabled;
        this.velocityUniforms["sdfEnabled"].value = sdfEnabled;
        this.positionUniforms["respawnCenter"].value.set(this.respawnCenter.x, this.respawnCenter.y, this.respawnCenter.z);
        this.positionUniforms["respawnEnabled"].value = this.respawnEnabled ? 1.0 : 0.0;
        this.positionUniforms["respawnMaxPerFrame"].value = this.respawnMaxPerFrame;
        this.positionUniforms["numParticles"].value = this.particleCount;
        
        if (sdfEnabled) {
            this.positionUniforms["textureSDFVolume"].value = this.sdfTarget.texture;
            this.positionUniforms["sdfBoundsMin"].value.copy(this.sdfBoundsMin);
            this.positionUniforms["sdfBoundsMax"].value.copy(this.sdfBoundsMax);
            this.positionUniforms["sdfVolumeResolution"].value.copy(this.sdfVolumeResolution);
            this.positionUniforms["sdfAtlasResolution"].value.copy(this.sdfAtlasResolution);
            this.positionUniforms["sdfSlicesPerRow"].value = this.sdfSlicesPerRow;

            this.velocityUniforms["textureSDFVolume"].value = this.sdfTarget.texture;
            this.velocityUniforms["sdfBoundsMin"].value.copy(this.sdfBoundsMin);
            this.velocityUniforms["sdfBoundsMax"].value.copy(this.sdfBoundsMax);
            this.velocityUniforms["sdfVolumeResolution"].value.copy(this.sdfVolumeResolution);
            this.velocityUniforms["sdfAtlasResolution"].value.copy(this.sdfAtlasResolution);
            this.velocityUniforms["sdfSlicesPerRow"].value = this.sdfSlicesPerRow;
        }

        for (let i = 0; i < iterationsPerFrame; i++) {
            this.positionUniforms["delta"].value = subDelta;
            this.velocityUniforms["delta"].value = subDelta;
            this.densityMaterial.uniforms["delta"].value = subDelta;

            const currentPosTex = this.gpuCompute.getCurrentRenderTarget(this.positionVariable).texture;
            const currentVelTex = this.gpuCompute.getCurrentRenderTarget(this.velocityVariable).texture;

            // --- Step 1: Build grid + sort ---
            this.runCellIdPass(currentPosTex, currentVelTex, subDelta);
            this.runBitonicSort();
            this.runCellRangePass();

            this.densityMaterial.uniforms["textureSortedCells"].value = this.sortedTexture;
            this.densityMaterial.uniforms["textureCellRange"].value = this.cellRangeTarget.texture;
            this.velocityUniforms["textureSortedCells"].value = this.sortedTexture;
            this.velocityUniforms["textureCellRange"].value = this.cellRangeTarget.texture;

            // --- Step 2: Manually Render Density ---
            this.densityMaterial.uniforms.texturePosition.value = currentPosTex;
            this.densityMaterial.uniforms.textureVelocity.value = currentVelTex;
            
            const currentRenderTarget = this.renderer.getRenderTarget();

            this.renderer.setRenderTarget(this.densityRenderTarget);
            this.renderer.render(this.densityScene, this.densityCamera);
            
            this.renderer.setRenderTarget(currentRenderTarget);

            // --- Step 3: Bind Density Result to Velocity Shader ---
            this.velocityUniforms["textureDensity"].value = this.densityRenderTarget.texture;

            // --- Step 4: Compute Velocity & Position ---
            this.gpuCompute.compute();
        }

        // --- Step 5: generate 3d density field
        this.generateDensityField();
    }

    public computeRenderingOnly(): void {
        if (!this.gpuCompute) return;

        this.updateGridSettings();
        this.syncGridUniforms();

        const currentPosTex = this.gpuCompute.getCurrentRenderTarget(this.positionVariable).texture;
        const currentVelTex = this.gpuCompute.getCurrentRenderTarget(this.velocityVariable).texture;

        // --- Step 1: Build grid + sort (needed for density field) ---
        this.runCellIdPass(currentPosTex, currentVelTex, 0);
        this.runBitonicSort();
        this.runCellRangePass();

        // --- Step 2: 生成 3D 密度场（用于 Ray Marching 渲染）---
        this.generateDensityField();
    }
    
    public getPositionTexture(): THREE.Texture {
        return this.gpuCompute.getCurrentRenderTarget(this.positionVariable).texture;
    }
    
    public getVelocityTexture(): THREE.Texture {
        return this.gpuCompute.getCurrentRenderTarget(this.velocityVariable).texture;
    }

    public getDensityTexture(): THREE.Texture {
        return this.densityRenderTarget.texture;
    }

    public getTextureWidth(): number {
        return this.width;
    }
    
    public getParticleCount(): number {
        return this.particleCount;
    }
    
    public setBounds(min: Vec3, max: Vec3): void {
        this.boundsMin = min;
        this.boundsMax = max;
        this.updateGridSettings();
        if (this.densityMaterial) {
            this.syncGridUniforms();
        }
    }

    public getAverageDensity(renderer: THREE.WebGLRenderer): number {
        const renderTarget = this.densityRenderTarget;
        const pixels = new Float32Array(this.width * this.width * 4);

        renderer.readRenderTargetPixels(
            renderTarget,
            0, 0,
            this.width, this.width,
            pixels
        );

        let totalDensity = 0;
        let activeParticles = 0;

        for (let i = 0; i < this.particleCount; i++) {
            const density = pixels[i * 4];

            if (density > 0) {
                totalDensity += density;
                activeParticles++;
            }
        }

        return activeParticles > 0 ? totalDensity / activeParticles : 0;
    }

    public getDensityFieldTexture(): THREE.Texture {
        return this.densityRenderTarget.texture;
    }

    public getSortedTexture(): THREE.Texture {
        return this.sortedTexture || this.sortedTargetA.texture;
    }

    public getGridParameters() {
        return {
            min: this.boundsMin,
            max: this.boundsMax,
            dimensions: this.gridDimensionsVec,
            cellSize: this.gridCellSizeValue
        };
    }

    // ========== 3D 密度场相关方法 ==========
    private generateDensityField(): void {
        if (!this.densityFieldMaterial || !this.densityFieldTarget) return;

        const currentPosTex = this.gpuCompute.getCurrentRenderTarget(this.positionVariable).texture;

        // 更新 uniforms
        this.densityFieldMaterial.uniforms.texturePosition.value = currentPosTex;
        this.densityFieldMaterial.uniforms.textureSortedCells.value = this.sortedTexture;
        this.densityFieldMaterial.uniforms.textureCellRange.value = this.cellRangeTarget.texture;
        this.densityFieldMaterial.uniforms.boundsMin.value.set(this.boundsMin.x, this.boundsMin.y, this.boundsMin.z);
        this.densityFieldMaterial.uniforms.boundsMax.value.set(this.boundsMax.x, this.boundsMax.y, this.boundsMax.z);
        this.densityFieldMaterial.uniforms.gridMin.value.set(this.boundsMin.x, this.boundsMin.y, this.boundsMin.z);
        this.densityFieldMaterial.uniforms.gridDimensions.value.copy(this.gridDimensionsVec);
        this.densityFieldMaterial.uniforms.gridCellSize.value = this.gridCellSizeValue;
        this.densityFieldMaterial.uniforms.smoothingRadius.value = this.smoothingRadius;
        this.densityFieldMaterial.uniforms.sortedTotalElements.value = this.width * this.width;
        this.densityFieldMaterial.uniforms.cellCount.value = this.cellCountValue;
        this.densityFieldMaterial.uniforms.cellResolution.value.copy(this.cellResolutionVec);

        // 渲染密度场
        const currentRenderTarget = this.renderer.getRenderTarget();

        this.fullscreenMesh.material = this.densityFieldMaterial;
        this.renderer.setRenderTarget(this.densityFieldTarget);
        this.renderer.render(this.fullscreenScene, this.fullscreenCamera);

        this.renderer.setRenderTarget(currentRenderTarget);
    }

    /**
     * 获取 3D 密度场纹理（2D 图集格式）
     */
    public getDensityField3DTexture(): THREE.Texture {
        return this.densityFieldTarget.texture;
    }

    /**
     * Get the collision SDF texture (atlas) and its parameters
     */
    public getCollisionSDFTexture(): THREE.Texture | null {
        return this.sdfTarget ? this.sdfTarget.texture : null;
    }

    public getSDFParams(): {
        boundsMin: THREE.Vector3;
        boundsMax: THREE.Vector3;
        volumeResolution: THREE.Vector3;
        atlasResolution: THREE.Vector2;
        slicesPerRow: number;
    } {
        return {
            boundsMin: this.sdfBoundsMin.clone(),
            boundsMax: this.sdfBoundsMax.clone(),
            volumeResolution: this.sdfVolumeResolution.clone(),
            atlasResolution: this.sdfAtlasResolution.clone(),
            slicesPerRow: this.sdfSlicesPerRow,
        };
    }

    /**
     * 获取 3D 密度场参数
     */
    public getDensityFieldParams() {
        return {
            volumeResolution: this.volumeResolution.clone(),
            atlasResolution: this.atlasResolution.clone(),
            slicesPerRow: this.slicesPerRow,
            boundsMin: this.boundsMin,
            boundsMax: this.boundsMax
        };
    }

    // ========== SDF Collision Methods ==========

    /**
     * Initialize SDF resources
     */
    private initSDFResources(sdfRes: number = 128): void {
        // SDF volume resolution - can be adjusted for quality vs performance
        this.sdfVolumeResolution.set(sdfRes, sdfRes, sdfRes);
        this.sdfSlicesPerRow = Math.ceil(Math.sqrt(sdfRes));
        const slicesPerCol = Math.ceil(sdfRes / this.sdfSlicesPerRow);
        this.sdfAtlasResolution.set(
            sdfRes * this.sdfSlicesPerRow,
            sdfRes * slicesPerCol
        );

        // Create SDF render target
        this.sdfTarget = new THREE.WebGLRenderTarget(
            this.sdfAtlasResolution.x,
            this.sdfAtlasResolution.y,
            {
                type: THREE.FloatType,
                format: THREE.RGBAFormat,
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                wrapS: THREE.ClampToEdgeWrapping,
                wrapT: THREE.ClampToEdgeWrapping
            }
        );

        // Create empty triangle texture (will be populated by setCollisionMesh)
        // Start with capacity for a box (12 triangles * 3 vertices = 36 vertices)
        const initialCapacity = 64; // vertices
        this.triangleTexture = new THREE.DataTexture(
            new Float32Array(initialCapacity * 4),
            initialCapacity,
            1,
            THREE.RGBAFormat,
            THREE.FloatType
        );
        this.triangleTexture.needsUpdate = true;

        // Create SDF generation material
        this.sdfMaterial = new THREE.ShaderMaterial({
            uniforms: {
                textureTriangles: { value: this.triangleTexture },
                triangleCount: { value: 0 },
                triangleTexResolution: { value: new THREE.Vector2(initialCapacity, 1) },
                boundsMin: { value: this.sdfBoundsMin.clone() },
                boundsMax: { value: this.sdfBoundsMax.clone() },
                sdfVolumeResolution: { value: this.sdfVolumeResolution.clone() },
                sdfAtlasResolution: { value: this.sdfAtlasResolution.clone() },
                sdfSlicesPerRow: { value: this.sdfSlicesPerRow }
            },
            defines: {
                // Default fallback; will be updated per mesh in setCollisionMesh
                MAX_SDF_TRIANGLES: 512
            },
            vertexShader: `void main() { gl_Position = vec4(position, 1.0); }`,
            fragmentShader: fragmentShaderSDFGeneration
        });

    }

    /**
     * Set collision mesh from geometry and transform
     * Extracts triangles and updates SDF
     */
    public setCollisionMesh(geometry: THREE.BufferGeometry, transform?: THREE.Matrix4): void {
        // Get position attribute
        const positionAttr = geometry.getAttribute('position');
        // console.log("-------setCollisionMesh: ", geometry);

        // Get or generate indices
        let indices: ArrayLike<number>;
        const indexAttr = geometry.getIndex();
        if (indexAttr) {// Best if all go to this branch
            indices = indexAttr.array;
        } 
        else {
            // Non-indexed geometry - every 3 vertices is a triangle
            const numVertices = positionAttr.count;
            const tempIndices = new Uint32Array(numVertices);
            for (let i = 0; i < numVertices; i++) {
                tempIndices[i] = i;
            }
            indices = tempIndices;
        }

        // Count triangles
        this.triangleCount = Math.floor(indices.length / 3);
        const vertexCount = this.triangleCount * 3;

        // console.log(`========== SDF Mesh Debug ==========`);
        // console.log(`setCollisionMesh: ${this.triangleCount} triangles, ${vertexCount} vertices`);
        // console.log(`Geometry has index: ${indexAttr !== null}, positionAttr.count: ${positionAttr.count}`);

        // 下面获取该几何体的aabb盒
        // Calculate bounds from mesh
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

        // Create triangle vertex data
        const triData = new Float32Array(vertexCount * 4);
        const tempVec = new THREE.Vector3();

        // 用于存储所有三角形的信息，用于调试输出
        const triangleDebugInfo: Array<{
            index: number;
            v0: THREE.Vector3;
            v1: THREE.Vector3;
            v2: THREE.Vector3;
            normal: THREE.Vector3;
            centroid: THREE.Vector3;
        }> = [];

        for (let i = 0; i < indices.length; i++) {
            const vertexIndex = indices[i];
            tempVec.set(
                positionAttr.getX(vertexIndex),
                positionAttr.getY(vertexIndex),
                positionAttr.getZ(vertexIndex)
            );

            // 局部vertex转到世界坐标
            if (transform) {
                tempVec.applyMatrix4(transform);
            }

            minX = Math.min(minX, tempVec.x);
            minY = Math.min(minY, tempVec.y);
            minZ = Math.min(minZ, tempVec.z);
            maxX = Math.max(maxX, tempVec.x);
            maxY = Math.max(maxY, tempVec.y);
            maxZ = Math.max(maxZ, tempVec.z);

            // 顶点世界坐标
            triData[i * 4 + 0] = tempVec.x;
            triData[i * 4 + 1] = tempVec.y;
            triData[i * 4 + 2] = tempVec.z;
            triData[i * 4 + 3] = 1.0;
        }

        // 计算每个三角形的法线并输出调试信息
        // console.log(`\n--- Triangle Details (${this.triangleCount} triangles) ---`);
        // for (let t = 0; t < this.triangleCount; t++) {
        //     const baseIdx = t * 3;
        //     const v0 = new THREE.Vector3(triData[baseIdx * 4], triData[baseIdx * 4 + 1], triData[baseIdx * 4 + 2]);
        //     const v1 = new THREE.Vector3(triData[(baseIdx + 1) * 4], triData[(baseIdx + 1) * 4 + 1], triData[(baseIdx + 1) * 4 + 2]);
        //     const v2 = new THREE.Vector3(triData[(baseIdx + 2) * 4], triData[(baseIdx + 2) * 4 + 1], triData[(baseIdx + 2) * 4 + 2]);
        //
        //     const edge1 = new THREE.Vector3().subVectors(v1, v0);
        //     const edge2 = new THREE.Vector3().subVectors(v2, v0);
        //     const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();
        //     const centroid = new THREE.Vector3().addVectors(v0, v1).add(v2).divideScalar(3);
        //
        //     triangleDebugInfo.push({ index: t, v0, v1, v2, normal, centroid });
        //
        //     if (t < 20) {
        //         console.log(`  Triangle ${t}:`);
        //         console.log(`    v0: (${v0.x.toFixed(3)}, ${v0.y.toFixed(3)}, ${v0.z.toFixed(3)})`);
        //         console.log(`    v1: (${v1.x.toFixed(3)}, ${v1.y.toFixed(3)}, ${v1.z.toFixed(3)})`);
        //         console.log(`    v2: (${v2.x.toFixed(3)}, ${v2.y.toFixed(3)}, ${v2.z.toFixed(3)})`);
        //         console.log(`    normal: (${normal.x.toFixed(3)}, ${normal.y.toFixed(3)}, ${normal.z.toFixed(3)})`);
        //         console.log(`    centroid: (${centroid.x.toFixed(3)}, ${centroid.y.toFixed(3)}, ${centroid.z.toFixed(3)})`);
        //     }
        // }
        // if (this.triangleCount > 20) {
        //     console.log(`  ... (${this.triangleCount - 20} more triangles not shown)`);
        // }

        let normalDirCounts = { posX: 0, negX: 0, posY: 0, negY: 0, posZ: 0, negZ: 0 };
        for (const tri of triangleDebugInfo) {
            const n = tri.normal;
            const absX = Math.abs(n.x), absY = Math.abs(n.y), absZ = Math.abs(n.z);
            if (absX > absY && absX > absZ) {
                n.x > 0 ? normalDirCounts.posX++ : normalDirCounts.negX++;
            } else if (absY > absZ) {
                n.y > 0 ? normalDirCounts.posY++ : normalDirCounts.negY++;
            } else {
                n.z > 0 ? normalDirCounts.posZ++ : normalDirCounts.negZ++;
            }
        }
        // console.log(`\n--- Normal Direction Distribution ---`);
        // console.log(`  +X: ${normalDirCounts.posX}, -X: ${normalDirCounts.negX}`);
        // console.log(`  +Y: ${normalDirCounts.posY}, -Y: ${normalDirCounts.negY}`);
        // console.log(`  +Z: ${normalDirCounts.posZ}, -Z: ${normalDirCounts.negZ}`);
        // console.log(`====================================\n`);

        // Expand bounds for SDF margin
        // Small margin for numerical stability
        const margin = 0.1;
        this.sdfBoundsMin.set(minX - margin, minY - margin, minZ - margin);
        this.sdfBoundsMax.set(maxX + margin, maxY + margin, maxZ + margin);

        // console.log(`SDF bounds: (${this.sdfBoundsMin.x.toFixed(2)}, ${this.sdfBoundsMin.y.toFixed(2)}, ${this.sdfBoundsMin.z.toFixed(2)}) to (${this.sdfBoundsMax.x.toFixed(2)}, ${this.sdfBoundsMax.y.toFixed(2)}, ${this.sdfBoundsMax.z.toFixed(2)}), margin=${margin.toFixed(2)}`);

        // Update triangle texture
        // Important: texture width may exceed MAX_TEXTURE_SIZE!
        // Use a 2D layout instead of 1D if needed
        const maxTexSize = this.renderer.capabilities.maxTextureSize;
        let texWidth, texHeight;

        if (vertexCount <= maxTexSize) {
            // 1D layout (single row)
            texWidth = vertexCount;
            texHeight = 1;
        } else {
            // 2D layout (multiple rows)
            texWidth = maxTexSize;
            texHeight = Math.ceil(vertexCount / maxTexSize);
        }

        // console.log(`Triangle texture: ${vertexCount} vertices -> ${texWidth}x${texHeight} (max: ${maxTexSize})`);

        // Pad data to fit texture dimensions if needed
        const texelCount = texWidth * texHeight;
        const paddedData = new Float32Array(texelCount * 4);
        paddedData.set(triData);

        this.triangleTexture.dispose();
        this.triangleTexture = new THREE.DataTexture(
            paddedData,
            texWidth,
            texHeight,
            THREE.RGBAFormat,
            THREE.FloatType
        );
        this.triangleTexture.needsUpdate = true;

        // Update SDF material uniforms
        this.sdfMaterial.uniforms.textureTriangles.value = this.triangleTexture;
        this.sdfMaterial.uniforms.triangleCount.value = this.triangleCount;
        this.sdfMaterial.uniforms.triangleTexResolution.value.set(texWidth, texHeight);
        this.sdfMaterial.uniforms.boundsMin.value.copy(this.sdfBoundsMin);
        this.sdfMaterial.uniforms.boundsMax.value.copy(this.sdfBoundsMax);

        // Set the static loop bound for the shader based on this mesh's triangle count
        const MAX_TRI_LOOP_CAP = 16384; // increase if your GPU/shader budget allows
        const maxIter = Math.min(this.triangleCount, MAX_TRI_LOOP_CAP);
        this.sdfMaterial.defines = this.sdfMaterial.defines || {};
        this.sdfMaterial.defines.MAX_SDF_TRIANGLES = maxIter;
        this.sdfMaterial.needsUpdate = true;
        // if (this.triangleCount > MAX_TRI_LOOP_CAP) {
        //     console.warn(`SDF mesh has ${this.triangleCount} triangles, capped to ${MAX_TRI_LOOP_CAP} for SDF loop. Consider simplifying or raising the cap if safe.`);
        // }

        // Mark SDF for regeneration
        this.sdfNeedsUpdate = true;
        this.sdfInitialized = true;

        // console.log("Collision mesh set:", {
        //     triangles: this.triangleCount,
        //     bounds: {
        //         min: [this.sdfBoundsMin.x, this.sdfBoundsMin.y, this.sdfBoundsMin.z],
        //         max: [this.sdfBoundsMax.x, this.sdfBoundsMax.y, this.sdfBoundsMax.z]
        //     }
        // });

        this.generateSDF();
    }

    /**
     * Generate SDF from current mesh triangles
     */
    private generateSDF(): void {
        if (!this.sdfMaterial || !this.sdfTarget || this.triangleCount === 0) {
            return;
        }

        const currentRenderTarget = this.renderer.getRenderTarget(); //null till this step

        this.fullscreenMesh.material = this.sdfMaterial;
        this.renderer.setRenderTarget(this.sdfTarget);
        this.renderer.render(this.fullscreenScene, this.fullscreenCamera);

        this.renderer.setRenderTarget(currentRenderTarget);

        this.sdfNeedsUpdate = false;

        // Debug: Sample SDF at center and verify sign
        const center = new THREE.Vector3(
            (this.sdfBoundsMin.x + this.sdfBoundsMax.x) * 0.5,
            (this.sdfBoundsMin.y + this.sdfBoundsMax.y) * 0.5,
            (this.sdfBoundsMin.z + this.sdfBoundsMax.z) * 0.5
        );
        const sdfW = this.sdfAtlasResolution.x;
        const sdfH = this.sdfAtlasResolution.y;
        const pixels = new Float32Array(sdfW * sdfH * 4);
        this.renderer.readRenderTargetPixels(this.sdfTarget, 0, 0, sdfW, sdfH, pixels);

        const centerSDF = this.sampleSDFCPU(center, pixels);
        console.log(`SDF generated: center SDF = ${centerSDF.toFixed(3)} (should be positive for container)`);

        // Sample SDF at multiple test points to check if sign is correct
        const testPoints = [
            { name: 'center', pos: center },
            { name: '+y surface', pos: new THREE.Vector3(0, 3.5, 0) },   // Just inside +y surface
            { name: '-y surface', pos: new THREE.Vector3(0, -3.5, 0) },  // Just inside -y surface
            { name: '+y outside', pos: new THREE.Vector3(0, 4.5, 0) },   // Outside +y
            { name: '-y outside', pos: new THREE.Vector3(0, -4.5, 0) },  // Outside -y
        ];

        console.log('SDF test samples:');
        for (const test of testPoints) {
            const sdf = this.sampleSDFCPU(test.pos, pixels);
            console.log(`  ${test.name}: SDF=${sdf.toFixed(3)} at (${test.pos.x.toFixed(1)}, ${test.pos.y.toFixed(1)}, ${test.pos.z.toFixed(1)})`);
        }
    }

    /**
     * Debug: check how many particles are inside the current SDF bounds.
     * NOW ACTUALLY CHECKS SDF VALUES, not just AABB!
     */
    public debugAssertParticlesInsideSDF(tolerance: number = 0.0): void {
        if (!this.sdfTarget || !this.sdfMaterial || this.triangleCount === 0) {
            console.warn("SDF not initialized; cannot check particles.");
            return;
        }
        const posTex = this.getPositionTexture();
        const w = this.width;
        const posPixels = new Float32Array(w * w * 4);
        this.renderer.readRenderTargetPixels(
            this.gpuCompute.getCurrentRenderTarget(this.positionVariable),
            0, 0, w, w, posPixels
        );

        // Also read SDF texture to check actual SDF values
        const sdfW = this.sdfAtlasResolution.x;
        const sdfH = this.sdfAtlasResolution.y;
        const sdfPixels = new Float32Array(sdfW * sdfH * 4);
        this.renderer.readRenderTargetPixels(this.sdfTarget, 0, 0, sdfW, sdfH, sdfPixels);

        let outsideAABB = 0;
        let outsideSDF = 0;
        let activeCount = 0;
        const min = this.sdfBoundsMin;
        const max = this.sdfBoundsMax;

        let minSDF = Infinity;
        let maxSDF = -Infinity;

        for (let i = 0; i < this.particleCount; i++) {
            const x = posPixels[i * 4 + 0];
            const y = posPixels[i * 4 + 1];
            const z = posPixels[i * 4 + 2];
            if (x < -9000.0) continue; // inactive
            activeCount++;

            // Check AABB bounds
            if (x < min.x - tolerance || x > max.x + tolerance ||
                y < min.y - tolerance || y > max.y + tolerance ||
                z < min.z - tolerance || z > max.z + tolerance) {
                outsideAABB++;
            }

            // Sample SDF value at particle position
            const sdfValue = this.sampleSDFCPU(new THREE.Vector3(x, y, z), sdfPixels);
            minSDF = Math.min(minSDF, sdfValue);
            maxSDF = Math.max(maxSDF, sdfValue);

            // Check SDF value - should be positive (inside container)
            // Allow for particle radius
            if (sdfValue < this.particleRadius - tolerance) {
                outsideSDF++;
                if (outsideSDF <= 5) {  // Log first few violations
                    console.warn(`Particle ${i} at (${x.toFixed(3)}, ${y.toFixed(3)}, ${z.toFixed(3)}): SDF=${sdfValue.toFixed(3)}, radius=${this.particleRadius}`);
                }
            }
        }

        console.log(`SDF check: ${activeCount} particles, SDF range [${minSDF.toFixed(3)}, ${maxSDF.toFixed(3)}]`);
        console.log(`  Outside AABB: ${outsideAABB}, Outside SDF surface: ${outsideSDF}`);

        // if (outsideAABB > 0) {
        //     throw new Error(`AABB violation: ${outsideAABB} / ${activeCount} particles outside SDF AABB (tolerance=${tolerance}).`);
        // }
        // if (outsideSDF > activeCount * 0.1) {  // Allow some tolerance
        //     console.warn(`⚠️ Many particles outside SDF: ${outsideSDF} / ${activeCount}`);
        // }
    }

    /**
     * Sample SDF value at a 3D position (CPU-side helper for debugging)
     */
    private sampleSDFCPU(pos: THREE.Vector3, sdfPixels: Float32Array): number {
        const min = this.sdfBoundsMin;
        const max = this.sdfBoundsMax;
        const res = this.sdfVolumeResolution;

        // Normalize position to [0, 1]
        const nx = (pos.x - min.x) / (max.x - min.x);
        const ny = (pos.y - min.y) / (max.y - min.y);
        const nz = (pos.z - min.z) / (max.z - min.z);

        // Convert to voxel coords
        const vx = nx * res.x - 0.5;
        const vy = ny * res.y - 0.5;
        const vz = nz * res.z - 0.5;

        // Clamp and get integer voxel
        const ix = Math.floor(Math.max(0, Math.min(res.x - 1, vx)));
        const iy = Math.floor(Math.max(0, Math.min(res.y - 1, vy)));
        const iz = Math.floor(Math.max(0, Math.min(res.z - 1, vz)));

        // Convert to atlas coordinates
        const sliceX = iz % this.sdfSlicesPerRow;
        const sliceY = Math.floor(iz / this.sdfSlicesPerRow);
        const atlasX = sliceX * res.x + ix;
        const atlasY = sliceY * res.y + iy;

        const pixelIndex = (atlasY * this.sdfAtlasResolution.x + atlasX) * 4;
        return sdfPixels[pixelIndex];  // R channel contains SDF value
    }

    /**
     * Check if SDF collision is enabled
     */
    public isSDFCollisionEnabled(): boolean {
        return this.sdfInitialized && this.triangleCount > 0;
    }
}
