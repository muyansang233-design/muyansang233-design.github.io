/**
 * NoiseUtils.ts - Perlin Noise Implementation
 */
import { SeededRandom } from "../../../../anigraph";

export function createPerlinPermutation(random: SeededRandom): number[] {
    const p: number[] = [];
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
        const j = Math.floor(random.rand() * (i + 1));
        [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 256; i++) p[256 + i] = p[i];
    return p;
}

export function fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
}

export function fadeDeriv(t: number): number {
    return 30 * t * t * (t * (t - 2) + 1);
}

export function lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
}

export function grad2D(hash: number, x: number, y: number): number {
    const h = hash & 3;
    switch (h) {
        case 0: return x + y;
        case 1: return -x + y;
        case 2: return x - y;
        case 3: return -x - y;
        default: return 0;
    }
}

export function grad2DWithDerivatives(hash: number, x: number, y: number) {
    const h = hash & 3;
    switch (h) {
        case 0: return { value: x + y, dx: 1, dy: 1 };
        case 1: return { value: -x + y, dx: -1, dy: 1 };
        case 2: return { value: x - y, dx: 1, dy: -1 };
        case 3: return { value: -x - y, dx: -1, dy: -1 };
        default: return { value: 0, dx: 0, dy: 0 };
    }
}

export function perlin2D(x: number, y: number, perm: number[]): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);
    const aa = perm[perm[X] + Y];
    const ab = perm[perm[X] + Y + 1];
    const ba = perm[perm[X + 1] + Y];
    const bb = perm[perm[X + 1] + Y + 1];
    const g00 = grad2D(aa, xf, yf);
    const g10 = grad2D(ba, xf - 1, yf);
    const g01 = grad2D(ab, xf, yf - 1);
    const g11 = grad2D(bb, xf - 1, yf - 1);
    return lerp(lerp(g00, g10, u), lerp(g01, g11, u), v);
}

export function perlin2DWithDerivatives(x: number, y: number, perm: number[]) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);
    const du = fadeDeriv(xf);
    const dv = fadeDeriv(yf);
    const aa = perm[perm[X] + Y];
    const ab = perm[perm[X] + Y + 1];
    const ba = perm[perm[X + 1] + Y];
    const bb = perm[perm[X + 1] + Y + 1];
    const c00 = grad2DWithDerivatives(aa, xf, yf);
    const c10 = grad2DWithDerivatives(ba, xf - 1, yf);
    const c01 = grad2DWithDerivatives(ab, xf, yf - 1);
    const c11 = grad2DWithDerivatives(bb, xf - 1, yf - 1);
    const x0 = lerp(c00.value, c10.value, u);
    const x1 = lerp(c01.value, c11.value, u);
    const value = lerp(x0, x1, v);
    const dx0_dx = c00.dx + du * (c10.value - c00.value) + u * (c10.dx - c00.dx);
    const dx1_dx = c01.dx + du * (c11.value - c01.value) + u * (c11.dx - c01.dx);
    const dnoise_dx = dx0_dx + v * (dx1_dx - dx0_dx);
    const dx0_dy = c00.dy + u * (c10.dy - c00.dy);
    const dx1_dy = c01.dy + u * (c11.dy - c01.dy);
    const dnoise_dy = dx0_dy + dv * (x1 - x0) + v * (dx1_dy - dx0_dy);
    return { value, dx: dnoise_dx, dy: dnoise_dy };
}

export function fractalNoise2D(
    x: number, y: number, perm: number[],
    octaves: number = 6, lacunarity: number = 2.0,
    persistence: number = 0.5, slopeAttenuation: number = 1.0,
    useGaussian: boolean = false
) {
    let totalValue = 0, totalDx = 0, totalDy = 0;
    let gradientSumX = 0, gradientSumY = 0;
    let frequency = 1.0, amplitude = 1.0, amplitudeSum = 0;
    
    for (let i = 0; i < octaves; i++) {
        const noise = perlin2DWithDerivatives(x * frequency, y * frequency, perm);
        const scaledDx = noise.dx * frequency;
        const scaledDy = noise.dy * frequency;
        const gx = gradientSumX + scaledDx * amplitude;
        const gy = gradientSumY + scaledDy * amplitude;
        const gradMagSq = gx * gx + gy * gy;
        const weight = useGaussian 
            ? Math.exp(-slopeAttenuation * gradMagSq)
            : 1.0 / (1.0 + slopeAttenuation * gradMagSq);
        const wAmp = amplitude * weight;
        totalValue += noise.value * wAmp;
        totalDx += scaledDx * wAmp;
        totalDy += scaledDy * wAmp;
        gradientSumX = gx;
        gradientSumY = gy;
        amplitudeSum += amplitude;
        frequency *= lacunarity;
        amplitude *= persistence;
    }
    
    if (amplitudeSum > 0) {
        totalValue /= amplitudeSum;
        totalDx /= amplitudeSum;
        totalDy /= amplitudeSum;
    }
    return { value: totalValue, dx: totalDx, dy: totalDy };
}

// ============================================================================
// 8D Perlin Noise Implementation
// ============================================================================

/**
 * 8D gradient - uses hash bits to select +1 or -1 for each dimension
 * Returns dot product of gradient with offset vector
 */
export function grad8D(hash: number, x: number[]): number {
    let dot = 0;
    for (let i = 0; i < 8; i++) {
        const sign = (hash >> i) & 1 ? 1 : -1;
        dot += sign * x[i];
    }
    return dot;
}

/**
 * Hash function for 8D coordinates using permutation table
 */
function hash8D(perm: number[], coords: number[]): number {
    let h = 0;
    for (let i = 0; i < 8; i++) {
        h = perm[(h + coords[i]) & 255];
    }
    return h;
}

/**
 * 8D Perlin noise function
 * @param coords - Array of 8 coordinate values [x, y, z, w, u, v, s, t]
 * @param perm - Permutation table
 * @returns Noise value in range [-1, 1]
 */
export function perlin8D(coords: number[], perm: number[]): number {
    // Find unit hypercube containing point
    const c0: number[] = [];  // Integer coords
    const cf: number[] = [];  // Fractional coords
    const u: number[] = [];   // Fade values
    
    for (let i = 0; i < 8; i++) {
        c0[i] = Math.floor(coords[i]) & 255;
        cf[i] = coords[i] - Math.floor(coords[i]);
        u[i] = fade(cf[i]);
    }
    
    // Interpolate over all 256 corners of the 8D hypercube
    // Using recursive interpolation
    let n = 0;
    
    // We need to compute 2^8 = 256 corner contributions
    // Each corner is identified by 8 bits indicating +0 or +1 offset
    const corners: number[] = new Array(256);
    
    for (let corner = 0; corner < 256; corner++) {
        // Build corner coordinate and offset vector
        const cornerCoord: number[] = [];
        const offset: number[] = [];
        
        for (let i = 0; i < 8; i++) {
            const bit = (corner >> i) & 1;
            cornerCoord[i] = (c0[i] + bit) & 255;
            offset[i] = cf[i] - bit;
        }
        
        // Hash the corner and compute gradient dot product
        const h = hash8D(perm, cornerCoord);
        corners[corner] = grad8D(h, offset);
    }
    
    // Interpolate through all 8 dimensions
    // Dimension 0: 256 -> 128 values
    // Dimension 1: 128 -> 64 values
    // ... and so on until we have 1 value
    
    let values = corners;
    for (let dim = 0; dim < 8; dim++) {
        const newLen = values.length / 2;
        const newValues: number[] = new Array(newLen);
        for (let i = 0; i < newLen; i++) {
            newValues[i] = lerp(values[i * 2], values[i * 2 + 1], u[dim]);
        }
        values = newValues;
    }
    
    return values[0];
}

/**
 * Fractal 8D noise - multiple octaves of 8D Perlin noise
 * @param coords - Array of 8 coordinate values
 * @param perm - Permutation table
 * @param octaves - Number of noise layers
 * @param lacunarity - Frequency multiplier per octave
 * @param persistence - Amplitude multiplier per octave
 */
export function fractalNoise8D(
    coords: number[],
    perm: number[],
    octaves: number = 4,
    lacunarity: number = 2.0,
    persistence: number = 0.5
): number {
    let total = 0;
    let frequency = 1.0;
    let amplitude = 1.0;
    let maxValue = 0;
    
    for (let i = 0; i < octaves; i++) {
        const scaledCoords = coords.map(c => c * frequency);
        total += perlin8D(scaledCoords, perm) * amplitude;
        maxValue += amplitude;
        frequency *= lacunarity;
        amplitude *= persistence;
    }
    
    return total / maxValue;
}
