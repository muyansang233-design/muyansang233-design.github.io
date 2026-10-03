/**
 * generateNoiseTexture.ts - Pre-generate tileable noise texture for terrain shading
 * 
 * This module generates a noise texture that can be sampled at different scales
 * in the terrain shader for rock/soil/snow coloring.
 */

import { SeededRandom } from "../../../../anigraph";
import { ADataTextureFloat4D } from "../../../../anigraph/rendering/image";
import { createPerlinPermutation, perlin2D, fractalNoise2D } from "./NoiseUtils";

/**
 * Generate a tileable noise texture for terrain shading
 * @param size - Texture resolution (width and height)
 * @param seed - Random seed for reproducible results
 * @returns ADataTextureFloat4D containing noise values
 */
export function generateNoiseTexture(
    size: number = 512,
    seed: number = 42
): ADataTextureFloat4D {
    const randomGen = new SeededRandom(seed);
    const perm = createPerlinPermutation(randomGen);
    
    const data = new Float32Array(size * size * 4);
    
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            // Normalized coordinates [0, 1]
            const nx = x / size;
            const ny = y / size;
            
            // Generate tileable noise by using periodic coordinates
            // Scale determines the frequency of the noise
            const scale = 8.0;
            const px = nx * scale;
            const py = ny * scale;
            
            // Channel R: Basic Perlin noise (for rock variation)
            const noise1 = perlin2D(px, py, perm);
            const r = (noise1 + 1) * 0.5; // Normalize to [0, 1]
            
            // Channel G: Different frequency noise (for fine detail)
            const noise2 = perlin2D(px * 2.0, py * 2.0, perm);
            const g = (noise2 + 1) * 0.5;
            
            // Channel B: FBM noise (for larger-scale variation)
            const fbmResult = fractalNoise2D(px * 0.5, py * 0.5, perm, 4, 2.0, 0.5, 0.0, false);
            const b = (fbmResult.value + 1) * 0.5;
            
            // Channel A: Higher frequency noise (for fine patchiness)
            const noise4 = perlin2D(px * 4.0, py * 4.0, perm);
            const a = (noise4 + 1) * 0.5;
            
            const idx = (y * size + x) * 4;
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = a;
        }
    }
    
    return ADataTextureFloat4D.Create(size, size, data);
}

/**
 * Generate noise texture with custom parameters
 * @param size - Texture resolution
 * @param seed - Random seed
 * @param baseScale - Base frequency scale
 * @param octaves - Number of FBM octaves for the B channel
 */
export function generateNoiseTextureAdvanced(
    size: number = 512,
    seed: number = 42,
    baseScale: number = 8.0,
    octaves: number = 4
): ADataTextureFloat4D {
    const randomGen = new SeededRandom(seed);
    const perm = createPerlinPermutation(randomGen);
    
    const data = new Float32Array(size * size * 4);
    
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const nx = x / size;
            const ny = y / size;
            
            const px = nx * baseScale;
            const py = ny * baseScale;
            
            // R: Basic noise
            const r = (perlin2D(px, py, perm) + 1) * 0.5;
            
            // G: 2x frequency
            const g = (perlin2D(px * 2.0, py * 2.0, perm) + 1) * 0.5;
            
            // B: FBM for larger variation
            const fbm = fractalNoise2D(px * 0.5, py * 0.5, perm, octaves, 2.0, 0.5, 0.0, false);
            const b = (fbm.value + 1) * 0.5;
            
            // A: 4x frequency for fine detail
            const a = (perlin2D(px * 4.0, py * 4.0, perm) + 1) * 0.5;
            
            const idx = (y * size + x) * 4;
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = a;
        }
    }
    
    return ADataTextureFloat4D.Create(size, size, data);
}
