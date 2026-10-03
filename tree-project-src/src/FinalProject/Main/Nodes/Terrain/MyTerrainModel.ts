/**
 * MyTerrainModel.ts - Circular Terrain Plate
 * Generates a circular floating island terrain using procedural noise.
 */

import { TerrainModel } from "../../../StarterCode/CustomNodes/Terrain";
import { ASerializable, SeededRandom } from "../../../../anigraph";
import { ADataTextureFloat4D } from "../../../../anigraph/rendering/image";
import { ATexture } from "../../../../anigraph/rendering/ATexture";
import type { TransformationInterface } from "../../../../anigraph";
import { createPerlinPermutation, fractalNoise2D } from "./NoiseUtils";

@ASerializable("MyTerrainModel")
export class MyTerrainModel extends TerrainModel {

    private heightValues: number[][] = [];
    private pendingMinHeight: number = 0;
    private pendingMaxHeight: number = 0;

    static Create(
        diffuseMap: ATexture,
        width?: number,
        height?: number,
        widthSegments?: number,
        heightSegments?: number,
        transform?: TransformationInterface,
        wrapTextureX?: number,
        wrapTextureY?: number,
        ...args: any[]
    ): MyTerrainModel {
        return super.Create(
            diffuseMap, width, height, widthSegments, heightSegments,
            transform, wrapTextureX, wrapTextureY, ...args
        ) as MyTerrainModel;
    }

    init(diffuseMap: ATexture, useDataTexture?: boolean) {
        super.init(diffuseMap, useDataTexture);
        this.material.setUniform("texCoordScale", 1.0);
        this.material.setUniform("islandRadius", 0.0);
        this.material.setUniform("terrainAspect", 1.0);  // width/height ratio
        if (this.heightValues.length > 0) {
            this.updateColorFromHeight(this.pendingMinHeight, this.pendingMaxHeight);
        }
    }

    /**
     * Set the noise texture for procedural terrain coloring
     * @param noiseTexture - Pre-generated noise texture
     */
    setNoiseTexture(noiseTexture: ATexture) {
        if (this.material) {
            this.material.setTexture('noise', noiseTexture);
        }
    }

    /**
     * Set the terrain aspect ratio for circular boundary correction
     * @param width - Terrain width
     * @param height - Terrain height
     */
    setTerrainAspect(width: number, height: number) {
        if (this.material) {
            this.material.setUniform("terrainAspect", width / height);
        }
    }

    /**
     * Attempt smoothstep interpolation: t * t * (3 - 2 * t)
     */
    private smoothstep(t: number): number {
        const clamped = Math.max(0, Math.min(1, t));
        return clamped * clamped * (3 - 2 * clamped);
    }

    /**
     * Normalize angle to [0, 2π)
     */
    private normalizeAngle(angle: number): number {
        const twoPi = 2 * Math.PI;
        return ((angle % twoPi) + twoPi) % twoPi;
    }

    /**
     * Get the angular position within the arc (0 = start edge, 1 = end edge)
     * Returns -1 if outside the arc
     */
    private getArcPosition(angle: number, startAngle: number, arcAngle: number): number {
        if (arcAngle >= 2 * Math.PI) return 0.5; // Full circle, always in middle
        const normalizedAngle = this.normalizeAngle(angle - startAngle);
        if (normalizedAngle > arcAngle) return -1; // Outside arc
        return normalizedAngle / arcAngle; // 0 at start, 1 at end
    }

    /**
     * Generate circular terrain with procedural noise
     * @param falloffWidth - Width of the smooth transition zone at the edge (0 to islandRadius)
     * @param plateauRadius - Radius of the flat plateau in the center (0 = no plateau)
     * @param plateauHeight - Height of the central plateau
     * @param arcAngle - Angular extent in radians (2π = full circle, π/3 = 1/6, 2π/3 = 1/3)
     * @param arcStartAngle - Starting angle of the arc in radians
     * @param enableMountains - If false, terrain is flat at cutoffHeight
     */
    reRollHeightMap(
        seed?: number,
        frequency: number = 0.02,
        amplitude: number = 0.8,
        octaves: number = 6,
        lacunarity: number = 2.0,
        persistence: number = 0.5,
        slopeAttenuation: number = 1.0,
        useGaussian: boolean = false,
        islandRadius: number = 0.45,
        cutoffHeight: number = 0.0,
        falloffWidth: number = 0.1,
        plateauRadius: number = 0.09,
        plateauFalloffWidth: number = 0.1,  // Plateau blend zone width (separate from island falloff)
        plateauHeight: number = 2.9,
        arcAngle: number = 2 * Math.PI,
        arcStartAngle: number = 0.0,
        enableMountains: boolean = true,
        lakeRadius: number = 0.22,         // Island lake radius
        lakeOffsetY: number = 0.30,        // How far towards camera (-Y direction) - LOCKED
        lakeNoiseFrequency: number = 2.5,  // Lake noise frequency multiplier
        lakeNoiseAmplitude: number = 0.48, // Lake noise depth variation
        lakeBowlDepth: number = 0.3,       // Outer island lake bowl depth multiplier
        plateauLakeRadius: number = 0.04,  // Plateau lake radius (separate from island lake)
        plateauLakeBowlDepth: number = 0.2,  // Plateau lake bowl depth multiplier
        plateauMountainFrequency: number = 0.02,  // Independent frequency for plateau mountains
        plateauMountainAmplitude: number = 1.0,    // Independent amplitude for plateau mountains
        plateauSlopeAttenuation: number = 1.0,    // Independent slope attenuation for plateau mountains
        plateauUseGaussian: boolean = false,       // Independent Gaussian falloff for plateau mountains
        plateauMaskFrequency  = 1.5,  // MUCH higher, more variation on the plateau
        plateauMaskThreshold  = 0.3,  // lower threshold so more area has mask > 0
        plateauMaskSharpness  = 1.0,  // softer edges
        innerArcAngle: number = Math.PI,      // angular extent of inner plateau arc
        innerArcStartAngle: number = 0.0,     // starting angle of inner plateau arc
        innerSparsityFrequency: number = 1.5, // noise frequency controlling sparsity pattern
        innerSparsityThreshold: number = 0.3, // how dense/sparse the inner bumps are
        innerSparsitySharpness: number = 1.0,  // how crisp the sparse mask edges are
        plateauInnerFadeWidth: number = 0.03,  // radial fade band inside plateauRadius
        plateauLakeOuterFadeWidth: number = 0.02  // fade band outside plateau lake for smooth mountain transition
    ) {
        super.reRollHeightMap(seed);
    
        const randomGen = new SeededRandom(seed ?? Date.now());
        const perm = createPerlinPermutation(randomGen);
        this.heightValues = [];
    
        let minHeight = Infinity;
        let maxHeight = -Infinity;
        const width = this.heightMap.width;
        const height = this.heightMap.height;

        // Outer falloff zone starts here
        const outerFalloffStart = Math.max(0, islandRadius - falloffWidth);
        // Plateau blend zone: from plateauRadius to plateauRadius + plateauFalloffWidth
        const plateauBlendEnd = plateauRadius + plateauFalloffWidth;
        
        // Calculate scale factor for plateau lake (lake still scales with plateau size)
        const scaleFactor = plateauRadius > 0 ? plateauRadius / islandRadius : 1.0;
        
        // Independent parameters for plateau mountains (not scaled by plateau size)
        const plateauFrequency = plateauMountainFrequency;  // Use independent frequency
        const plateauAmplitude = plateauMountainAmplitude;   // Use independent amplitude
        const plateauSlopeAtten = plateauSlopeAttenuation;  // Use independent slope attenuation
        const plateauGaussian = plateauUseGaussian;          // Use independent Gaussian falloff
        
        // Plateau lake parameters (separate from island lake)
        const plateauLakeOffsetY = lakeOffsetY * scaleFactor;  // Still scale offset with plateau size
        
        // Shared base height function for plateau - ensures continuity between plateau and blend zone
        const plateauBaseHeight = (nx: number, ny: number): number => {
            const plateauNoise = fractalNoise2D(
                nx * plateauFrequency, ny * plateauFrequency, perm,
                octaves, lacunarity, persistence,
                plateauSlopeAtten, plateauGaussian
            );
            // Map to [0,1] and gently shape, BUT this is just subtle base variation
            let hn = (plateauNoise.value + 1) * 0.5;
            hn = Math.pow(hn, 0.8);
            const baseBump = hn * plateauAmplitude * 0.3; // 0.3 is just to keep base bumps subtle
            return plateauHeight + baseBump;
        };
    
        for (let y = 0; y < height; y++) {
            this.heightValues[y] = [];
            for (let x = 0; x < width; x++) {
                // Normalized position (0 to 1)
                const nx = x / (width - 1);
                const ny = y / (height - 1);
                
                // Distance and angle from center
                const dx = nx - 0.5;
                const dy = ny - 0.5;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx);
                
                let h: number = cutoffHeight; // Initialize to default, will be overwritten in all code paths

                // Check if point is within the outer radius
                const inOuterRadius = dist < islandRadius;
                const arcPos = this.getArcPosition(angle, arcStartAngle, arcAngle);
                const inArc = arcPos >= 0;
                
                // Inner arc for plateau mountains (independent of outer island arc)
                const innerArcPos = this.getArcPosition(angle, innerArcStartAngle, innerArcAngle);
                const inInnerArc = innerArcPos >= 0;
                
                // Plateau is always a full circle, regardless of arc
                const inPlateau = plateauRadius > 0 && dist < plateauRadius;
                const inPlateauBlend = plateauRadius > 0 && dist >= plateauRadius && dist < plateauBlendEnd;
                
                if (inPlateau) {
                    // Inside plateau - generate scaled-down mountains and lake
                    // Plateau-local coordinates: center (0,0), radius ~1 inside plateau
                    const px = dx / plateauRadius;  // -1..1 roughly
                    const py = dy / plateauRadius;  // -1..1
                    
                    // Base plateau surface — same definition used for plateauBlend
                    h = plateauBaseHeight(nx, ny);
                    const hBase = h;
                    
                    // Generate scaled lake inside plateau
                    const plateauLakeCenterY = -plateauLakeOffsetY;  // Offset towards camera (-Y direction)
                    const distToPlateauLake = Math.sqrt(dx * dx + (dy - plateauLakeCenterY) * (dy - plateauLakeCenterY));
                    
                    // Define inner plateau mountain region: inside inner arc and outside lake
                    const inInnerPlateauMountainRegion = inInnerArc && distToPlateauLake > plateauLakeRadius;
                    
                    // Only add mountains in the inner region (behind the lake)
                    if (inInnerPlateauMountainRegion) {
                        // 1) Zero-mean detail noise
                        const detailNoise = fractalNoise2D(
                            nx * plateauFrequency, ny * plateauFrequency, perm,
                            octaves, lacunarity, persistence,
                            plateauSlopeAtten, plateauGaussian
                        );

                        let localMountain = detailNoise.value * plateauAmplitude;

                        // Optional: soften negative dips
                        if (localMountain < 0) {
                            localMountain *= 0.3;
                        }

                        // 2) Sparsity mask (unchanged)
                        const sparseNoise = fractalNoise2D(
                            px * innerSparsityFrequency,
                            py * innerSparsityFrequency,
                            perm,
                            3, lacunarity, 0.5,
                            1.0, false
                        );
                        let sparse = (sparseNoise.value + 1) * 0.5;
                        sparse = Math.max(0, sparse - innerSparsityThreshold) / (1 - innerSparsityThreshold);
                        sparse = Math.pow(sparse, innerSparsitySharpness);
                        const sparseBase = 0.2;
                        sparse = sparseBase + (1.0 - sparseBase) * sparse;

                        // 3) Angular fade inside inner arc:
                        // innerArcPos is in [0,1] across the inner arc; center is ~0.5.
                        const innerCenterDist = Math.abs(innerArcPos - 0.5) * 2.0; // 0 at center, 1 at edges
                        const angularWeight = 1.0 - this.smoothstep(innerCenterDist);

                        // 4) Radial fade as we approach plateauRadius from inside:
                        const fadeStartRadius = plateauRadius - plateauInnerFadeWidth;
                        let radialWeight = 1.0;
                        if (dist > fadeStartRadius) {
                            const t = (dist - fadeStartRadius) / plateauInnerFadeWidth; // 0 at fadeStart, 1 at rim
                            const clampedT = Math.max(0, Math.min(1, t));
                            radialWeight = 1.0 - this.smoothstep(clampedT);
                        }

                        // 5) Lake outer fade: smooth ramp from lake edge to full mountain strength
                        const fadeStart = plateauLakeRadius;
                        const fadeEnd = plateauLakeRadius + plateauLakeOuterFadeWidth;
                        let lakeOuterWeight = 1.0;
                        if (distToPlateauLake < fadeEnd) {
                            const t = (distToPlateauLake - fadeStart) / plateauLakeOuterFadeWidth; // 0 at fadeStart, 1 at fadeEnd
                            const clampedT = Math.max(0, Math.min(1, t));
                            lakeOuterWeight = this.smoothstep(clampedT);
                        }

                        // 6) Combine weights
                        const innerFadeWeight = angularWeight * radialWeight * lakeOuterWeight;

                        // 7) Final contribution
                        const mountainContribution = localMountain * sparse * innerFadeWeight;
                        h = hBase + mountainContribution;
                    }
                    
                    // Lake blend zone for smooth transition
                    const plateauLakeBlendWidth = plateauLakeRadius * 0.3;  // 30% of lake radius for blending
                    const plateauLakeInnerRadius = plateauLakeRadius - plateauLakeBlendWidth;
                    
                    if (distToPlateauLake < plateauLakeRadius && plateauLakeRadius > 0) {
                        // Calculate lake depth with noise
                        const plateauLakeNoise = fractalNoise2D(
                            nx * plateauFrequency * lakeNoiseFrequency,
                            ny * plateauFrequency * lakeNoiseFrequency, perm,
                            3, lacunarity, 0.4, 0.0, false
                        );
                        const noiseDepth = (plateauLakeNoise.value + 1) * 0.5 * lakeNoiseAmplitude;
                        
                        // Create bowl shape for the lake - deeper in center
                        const normalizedDist = distToPlateauLake / plateauLakeRadius;
                        const bowlDepth = plateauLakeBowlDepth * (1 - normalizedDist * normalizedDist);
                        
                        // Lake floor height (relative to plateau terrain)
                        const plateauLakeFloor = h - bowlDepth - noiseDepth;
                        
                        if (distToPlateauLake < plateauLakeInnerRadius) {
                            // Fully inside lake - use lake floor
                            h = plateauLakeFloor;
                        } else {
                            // In blend zone - smooth transition from terrain to lake
                            const blendT = (distToPlateauLake - plateauLakeInnerRadius) / plateauLakeBlendWidth;
                            const blendFactor = this.smoothstep(blendT);  // 0 at inner edge, 1 at outer edge
                            h = plateauLakeFloor * (1 - blendFactor) + h * blendFactor;
                        }
                    }
                } else if (inOuterRadius && enableMountains) {
                    // Handle plateau blend zone and terrain generation
                    if (inPlateauBlend && inArc) {
                        // In the blend zone between plateau and mountains (only where arc exists)
                        // Use the same base height function as inside the plateau
                        const plateauTerrainHeight = plateauBaseHeight(nx, ny);
                        
                        // Calculate outer mountain height
                        const noise = fractalNoise2D(
                            nx * frequency, ny * frequency, perm,
                            octaves, lacunarity, persistence,
                            slopeAttenuation, useGaussian
                        );
                        let hn = (noise.value + 1) * 0.5;
                        hn = Math.pow(hn, 0.8);
                        let mountainHeight = hn * amplitude;

                        // Apply angular falloff to mountain height before blending
                        if (arcAngle < 2 * Math.PI) {
                            const distFromCenter = Math.abs(arcPos - 0.5) * 2;
                            const angularMultiplier = 1 - this.smoothstep(distFromCenter);
                            mountainHeight = cutoffHeight + (mountainHeight - cutoffHeight) * angularMultiplier;
                        }

                        // Smoothly blend from plateau terrain to mountain
                        const blendT = (dist - plateauRadius) / plateauFalloffWidth;
                        const blend = this.smoothstep(blendT);
                        h = plateauTerrainHeight * (1 - blend) + mountainHeight * blend;
                    } else if (inPlateauBlend && !inArc) {
                        // In plateau blend zone but outside arc
                        // Use the same base height function as inside the plateau
                        const plateauTerrainHeight = plateauBaseHeight(nx, ny);
                        
                        // Regular blend zone uses radial distance
                        const blendT = (dist - plateauRadius) / plateauFalloffWidth;
                        const blend = this.smoothstep(blendT);
                        h = plateauTerrainHeight * (1 - blend) + cutoffHeight * blend;
                    } else if (inArc) {
                        // Outside plateau zone, inside arc - normal mountain generation
                        const noise = fractalNoise2D(
                            nx * frequency, ny * frequency, perm,
                            octaves, lacunarity, persistence,
                            slopeAttenuation, useGaussian
                        );
                        
                        let hn = (noise.value + 1) * 0.5;
                        hn = Math.pow(hn, 0.8);
                        h = hn * amplitude;

                        // Apply smooth falloff at outer radial edge
                        if (dist > outerFalloffStart && falloffWidth > 0) {
                            const falloffT = (dist - outerFalloffStart) / falloffWidth;
                            const blend = this.smoothstep(falloffT);
                            h = h * (1 - blend) + cutoffHeight * blend;
                        }

                        // Apply continuous angular falloff across entire arc
                        if (arcAngle < 2 * Math.PI) {
                            const distFromCenter = Math.abs(arcPos - 0.5) * 2;
                            const angularMultiplier = 1 - this.smoothstep(distFromCenter);
                            h = cutoffHeight + (h - cutoffHeight) * angularMultiplier;
                        }
                    } else {
                        // Outside arc, outside plateau blend - cutoff height
                        h = cutoffHeight;
                    }
                } else {
                    // Outside outer radius
                    h = cutoffHeight;
                }
                
                // Lake with smooth blending (only for outer terrain, not inside plateau)
                if (!inPlateau) {
                    const lakeCenterY = -lakeOffsetY;  // Offset towards camera (-Y direction)
                    const distToLake = Math.sqrt(dx * dx + (dy - lakeCenterY) * (dy - lakeCenterY));
                    
                    // Lake blend zone for smooth transition
                    const lakeBlendWidth = lakeRadius * 0.3;  // 30% of lake radius for blending
                    const lakeInnerRadius = lakeRadius - lakeBlendWidth;
                    
                    if (distToLake < lakeRadius && lakeRadius > 0) {
                        // Calculate lake depth with noise
                        const lakeNoise = fractalNoise2D(
                            nx * frequency * lakeNoiseFrequency,
                            ny * frequency * lakeNoiseFrequency, perm,
                            3, lacunarity, 0.4, 0.0, false
                        );
                        const noiseDepth = (lakeNoise.value + 1) * 0.5 * lakeNoiseAmplitude;
                        
                        // Create bowl shape for the lake - deeper in center
                        const normalizedDist = distToLake / lakeRadius;
                        const bowlDepth = lakeBowlDepth * (1 - normalizedDist * normalizedDist);
                        
                        // Lake floor height
                        const lakeFloor = h - bowlDepth - noiseDepth;
                        
                        if (distToLake < lakeInnerRadius) {
                            // Fully inside lake - use lake floor
                            h = lakeFloor;
                        } else {
                            // In blend zone - smooth transition from terrain to lake
                            const blendT = (distToLake - lakeInnerRadius) / lakeBlendWidth;
                            const blendFactor = this.smoothstep(blendT);  // 0 at inner edge, 1 at outer edge
                            h = lakeFloor * (1 - blendFactor) + h * blendFactor;
                        }
                    }
                }
    
                this.heightMap.setPixelNN(x, y, h);
                this.heightValues[y][x] = h;
    
                if (h < minHeight) minHeight = h;
                if (h > maxHeight) maxHeight = h;
            }
        }
    
        this.heightMap.setTextureNeedsUpdate();
        this.pendingMinHeight = minHeight;
        this.pendingMaxHeight = maxHeight;
    
        if (this.material) {
            // Pass islandRadius to shader for fragment discard
            this.material.setUniform("islandRadius", islandRadius);
            this.updateColorFromHeight(minHeight, maxHeight);
        }
    }

    private updateColorFromHeight(minHeight: number, maxHeight: number) {
        const width = this.heightMap.width;
        const height = this.heightMap.height;
        const range = maxHeight - minHeight || 1;
        const colorData = new Float32Array(width * height * 4);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const normalizedHeight = (this.heightValues[y][x] - minHeight) / range;
                const idx = (y * width + x) * 4;
                colorData[idx] = 0.3 + normalizedHeight * 0.5;
                colorData[idx + 1] = 0.15 + normalizedHeight * 0.45;
                colorData[idx + 2] = 0.05 + normalizedHeight * 0.35;
                colorData[idx + 3] = 1.0;
            }
        }

        const colorTexture = ADataTextureFloat4D.Create(width, height, colorData);
        this.material.setTexture('diffuse', colorTexture);
    }
}
