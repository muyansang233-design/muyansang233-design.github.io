import {
    ANodeModel3D,
    AObject,
    ASerializable,
    AShaderModel,
    Color, V3, Vec3,
} from "../../../../../anigraph";
import {WaterParticleIndividual} from "./WaterParticleIndividual";
import {WaterBoundingBoxModel} from "../WaterBoundingBox/WaterBoundingBoxModel"; // 注意路径

enum WaterParticleEvents {
    PARTICLES_UPDATED = "WATER_PARTICLES_UPDATED"
}

@ASerializable("WaterParticleModel")
export class WaterParticleModel extends ANodeModel3D {
    // shader used by all water particles
    static ShaderModel: AShaderModel;

    // 供粒子碰撞使用的包围盒
    boundingBox?: WaterBoundingBoxModel;

    // Array of all particles
    particles: WaterParticleIndividual[] = [];

    // async 表明内部会有异步操作并返回一个 Promise
    static async LoadShaderModel(...args:any[]) {
        await AShaderModel.ShaderSourceLoaded("exampleparticle");
        WaterParticleModel.ShaderModel = await AShaderModel.CreateModel("exampleparticle");
    }

    // 用来算 dt
    private lastTime: number | null = null;

    // SPH parameters
    // Initialization all moved to MainSceneModel.ts for clarity
    smoothingRadius!: number;      // 影响半径
    targetDensity!: number;        // 希望的"理想密度"
    pressureMultiplier!: number;   // 密度误差 -> 压力 的系数
    particleMass!: number;
    gravity!: number;
    collisionDamping!: number;     // 碰撞阻尼系数 (0-1)
    velocityMax!: number;          // 用于速度可视化的最大速度值，增大以降低颜色变化敏感度
    particleCount!: number;        // 粒子数量（直接指定，不再使用密度）
    spacingMultiplier!: number;    // 粒子间距倍数（相对于 smoothingRadius）
    particleRadius!: number;



    // 新增：近密度 & 近压力
    nearDensities: number[] = [];
    nearPressures: number[] = [];
    // 新增一个 nearPressure 系数（先随便给个值，之后慢慢调）
    nearPressureMultiplier!: number;  // 比 pressureMultiplier 稍微大一些

    // 交互相关
    // Initialization all moved to MainSceneController.ts for clarity
    interactionRadius!: number;
    interactionStrength!: number;
    /** P 键触发时记录一次交互点（世界坐标），在下一次 timeUpdate 里用一次就清空 */
    private interactionPoint: Vec3 | null = null;

    /** 每个粒子的交互力 */
    private interactionForces: { x: number; y: number; z: number }[] = [];

    densities: number[] = [];
    pressures: number[] = [];
    pressureForces: {x: number, y: number; z: number}[] = [];
    predictedPositions: {x: number, y: number; z: number}[] = [];

    // Spatial Grid
    public useSpatialGrid: boolean = true;

    // structure: (grid_id, [particle1_id, particle2_id, ...]). Flattened 3D array.
    // this.grid[grid_id] = [particle1_id, particle2_id, ...] the array of particle ids in this cell
    private grid: number[][] = [];
    private gridDimensions = { x: 0, y: 0, z: 0 };
    private gridOrigin = { x: 0, y: 0, z: 0 };
    private gridCellSize: number = 1;

    /**
     * get the index of the grid cell for a given position
     * @param x: x coordinate of the position in world coordinates
     * @param y: same
     * @param z: same
     */
    private getGridCellIndex(x: number, y: number, z: number): number {
        const ix = Math.max(0, Math.min(this.gridDimensions.x - 1, Math.floor((x - this.gridOrigin.x) / this.gridCellSize)));
        const iy = Math.max(0, Math.min(this.gridDimensions.y - 1, Math.floor((y - this.gridOrigin.y) / this.gridCellSize)));
        const iz = Math.max(0, Math.min(this.gridDimensions.z - 1, Math.floor((z - this.gridOrigin.z) / this.gridCellSize)));
        return ix + iy * this.gridDimensions.x + iz * this.gridDimensions.x * this.gridDimensions.y;
    }

    private updateSpatialGrid() {
        if (!this.boundingBox) return;
        const worldMin = this.boundingBox.getWorldMin();
        const worldMax = this.boundingBox.getWorldMax();
        
        // add a small margin to ensure particles exactly on the edge are inside
        // in case the particles are on/slightly outside the bounding box
        // grid slightly larger than the bounding box
        const margin = this.smoothingRadius * 0.1; 
        const minX = worldMin.x - margin;
        const minY = worldMin.y - margin;
        const minZ = worldMin.z - margin;
        const maxX = worldMax.x + margin;
        const maxY = worldMax.y + margin;
        const maxZ = worldMax.z + margin;

        const sizeX = maxX - minX;
        const sizeY = maxY - minY;
        const sizeZ = maxZ - minZ;

        const cellSize = this.smoothingRadius;
        const dimX = Math.ceil(sizeX / cellSize);
        const dimY = Math.ceil(sizeY / cellSize);
        const dimZ = Math.ceil(sizeZ / cellSize);

        const totalCells = dimX * dimY * dimZ;
        // if the grid dimensions or the number of cells have changed, recreate the grid
        // should not run into this because bounding box does not change 
        if (dimX !== this.gridDimensions.x || dimY !== this.gridDimensions.y || dimZ !== this.gridDimensions.z || this.grid.length !== totalCells) {
            this.gridDimensions = { x: dimX, y: dimY, z: dimZ };
            this.gridOrigin = { x: minX, y: minY, z: minZ };
            this.gridCellSize = cellSize;
            this.grid = new Array(totalCells);
            for(let i=0; i<totalCells; i++) this.grid[i] = [];
        } else {
            // just clear existing arrays
            for(let i=0; i<totalCells; i++) {
                this.grid[i].length = 0;
            }
        }

        const n = this.predictedPositions.length;
        for (let i = 0; i < n; i++) {
            const p = this.predictedPositions[i];
            const idx = this.getGridCellIndex(p.x, p.y, p.z);
            this.grid[idx].push(i);
        }
    }


    // All initialization done in MainSceneController.ts/ MainSceneModel.ts
    constructor() {
        super();
    }


    public triggerInteraction(worldPos: Vec3, radius?: number, strength?: number): void {
        this.interactionPoint = worldPos;
        if (radius !== undefined) {
            this.interactionRadius = radius;
        }
        if (strength !== undefined) {
            this.interactionStrength = strength;
        }
    }

    /** For color change - updates existing Color object to avoid GC overhead */
    private speedToColor(speed: number, velocityMax: number, colorToUpdate: Color): void {
        const speedT = Math.max(0, Math.min(1, speed / velocityMax));
        if (speedT < 0.5) {
            const t = speedT * 2;
            colorToUpdate.r = 0.3 * t;           // R: 0 -> 0.15
            colorToUpdate.g = 0.6 + 0.4 * t;     // G: 0.6 -> 1.0
            colorToUpdate.b = 1.0;               // B: 1.0
            colorToUpdate.a = 0.7;
        } else {
            const t = (speedT - 0.5) * 2;
            colorToUpdate.r = 0.15 + 0.85 * t;   // R: 0.15 -> 1.0
            colorToUpdate.g = 1.0 - 0.5 * t;     // G: 1.0 -> 0.5
            colorToUpdate.b = 1.0 - t;           // B: 1.0 -> 0.0
            colorToUpdate.a = 0.7;
        }
    }

    /** Avg SPH density */
    public computeAverageDensity(): number {
        const n = this.particles.length;
        if (n === 0) return 0;

        // density for each particle
        this.computeDensities();

        let sum = 0;
        for (let i = 0; i < n; i++) {
            sum += this.densities[i];
        }
        return sum / n;
    }

    public spawnParticlesWithDensity(): void {
        if (!this.boundingBox) {
            console.warn("spawnParticlesWithDensity: boundingBox 未设置");
            return;
        }

        this.particles = [];
        this.predictedPositions = [];

        const worldMin = this.boundingBox.getWorldMin();
        const worldMax = this.boundingBox.getWorldMax();
        const centerX = 0.5 * (worldMin.x + worldMax.x);
        const centerY = 0.5 * (worldMin.y + worldMax.y);
        const centerZ = 0.5 * (worldMin.z + worldMax.z);
        const boxSizeX = worldMax.x - worldMin.x;
        const boxSizeY = worldMax.y - worldMin.y;
        const boxSizeZ = worldMax.z - worldMin.z;

        const targetTotal = Math.max(1, Math.floor(this.particleCount));

        // spacing between particles
        const spacing = Math.max(1e-6, this.smoothingRadius * this.spacingMultiplier);

        // distance from box
        const usableX = boxSizeX * 0.9;
        const usableY = boxSizeY * 0.9;
        const usableZ = boxSizeZ * 0.9;

        const maxNx = Math.max(1, Math.floor(usableX / spacing) + 1);
        const maxNy = Math.max(1, Math.floor(usableY / spacing) + 1);
        const maxNz = Math.max(1, Math.floor(usableZ / spacing) + 1);

        const totalSize = usableX + usableY + usableZ;
        const ratioX = usableX / totalSize;
        const ratioY = usableY / totalSize;
        const ratioZ = usableZ / totalSize;

        const scale = Math.cbrt(targetTotal / (ratioX * ratioY * ratioZ));
        let nx = Math.max(1, Math.min(maxNx, Math.round(ratioX * scale)));
        let ny = Math.max(1, Math.min(maxNy, Math.round(ratioY * scale)));
        let nz = Math.max(1, Math.min(maxNz, Math.round(ratioZ * scale)));

        while (nx * ny * nz < targetTotal) {
            const canGrowX = nx < maxNx;
            const canGrowY = ny < maxNy;
            const canGrowZ = nz < maxNz;

            if (!canGrowX && !canGrowY && !canGrowZ) {
                console.warn(
                    `Particle count ${targetTotal} exceeds capacity (${nx * ny * nz}) at current density. Spawning with reduced count.`
                );
                break;
            }

            const currentRatioX = nx / (nx + ny + nz);
            const currentRatioY = ny / (nx + ny + nz);
            const currentRatioZ = nz / (nx + ny + nz);

            const deviationX = canGrowX ? (ratioX - currentRatioX) : -Infinity;
            const deviationY = canGrowY ? (ratioY - currentRatioY) : -Infinity;
            const deviationZ = canGrowZ ? (ratioZ - currentRatioZ) : -Infinity;

            if (deviationX >= deviationY && deviationX >= deviationZ) {
                nx++;
            } else if (deviationY >= deviationZ) {
                ny++;
            } else {
                nz++;
            }
        }

        // max possible particle num
        const actualTotal = Math.min(targetTotal, nx * ny * nz);

        const regionSizeX = spacing * Math.max(0, nx - 1);
        const regionSizeY = spacing * Math.max(0, ny - 1);
        const regionSizeZ = spacing * Math.max(0, nz - 1);

        const startX = centerX - 0.5 * regionSizeX;
        const startY = centerY - 0.5 * regionSizeY;
        const startZ = centerZ - 0.5 * regionSizeZ;

        let count = 0;

        for (let iy = 0; iy < ny; iy++) {
            for (let iz = 0; iz < nz; iz++) {
                for (let ix = 0; ix < nx; ix++) {
                    if (count >= actualTotal) break;

                    const x = startX + ix * spacing;
                    const y = startY + iy * spacing;
                    const z = startZ + iz * spacing;

                    const p = new WaterParticleIndividual(
                        V3(x, y, z),        // position
                        V3(0, 0, 0),        // v
                        this.particleRadius // r
                    );

                    this.speedToColor(0, this.velocityMax, p.color);
                    this.particles.push(p);
                    this.predictedPositions.push({ x, y, z });
                    count++;
                }
                if (count >= actualTotal) break;
            }
            if (count >= actualTotal) break;
        }
        // reset lastTime
        this.lastTime = null;
    }

    private smoothingKernel(radius: number, dst: number): number {
        if (dst >= radius || radius <= 0) return 0;
        const volume = Math.PI * Math.pow(radius, 4) / 6.0;
        return (radius - dst) * (radius - dst) / volume;
    }

    private smoothingKernelDerivative(radius: number, dst: number): number {
        if (dst >= radius || radius <= 0) return 0;
        const scale = 12 / (Math.PI * Math.pow(radius, 4));
        return (dst - radius) *scale;
    }

    private nearDensityKernel(radius: number, dst: number): number {
        if (radius <= 0 || dst >= radius) return 0;

        const q = 1 - dst / radius; // [0,1]
        return q * q * q;
    }

    private nearDensityDerivative(radius: number, dst: number): number {
        if (radius <= 0 || dst >= radius) return 0;

        const q = 1 - dst / radius;
        // nearDensity = q^3, q = 1 - r/h
        // d/dr (q^3) = 3 q^2 * d q/dr = 3 q^2 * (-1/h) = -3 q^2 / h
        return -3 * q * q / radius;
    }

  


    // 从 nearDensity 得到 nearPressure
    private nearPressureFromDensity(nearDensity: number): number {
        return nearDensity * this.nearPressureMultiplier;
    }

    private computeDensities() {
        const n = this.particles.length;
        // Overwrite instead of creating new arrays each time
        if (!this.densities || this.densities.length !== n) {
            this.densities = new Array(n);
        }
        if (!this.nearDensities || this.nearDensities.length !== n) {
            this.nearDensities = new Array(n);
        }
        if (n === 0) return;

        const h = this.smoothingRadius;
        const h2 = h * h;

        // Old O(n^2) Implementation
        if (!this.useSpatialGrid) {
            for (let i = 0; i < n; i++) {
                const pi = this.predictedPositions[i];
                let rho = 0;
                let rhoNear = 0;

                for (let j = 0; j < n; j++) {
                    const pj = this.predictedPositions[j];

                    const dx = pj.x - pi.x;
                    const dy = pj.y - pi.y;
                    const dz = pj.z - pi.z;
                    const r2 = dx * dx + dy * dy + dz * dz;
                    if (r2 > h2) continue;

                    const r = Math.sqrt(r2);
                    const influence = this.smoothingKernel(h, r);
                    rho += influence;
                    rhoNear += this.nearDensityKernel(h, r);
                }

                this.densities[i] = rho;
                this.nearDensities[i] = rhoNear;
            }
            return;
        }

        // Spatial Grid Implementation
        // Precompute loop bounds for neighbor search
        // 3x3x3 neighbor search
        const dimX = this.gridDimensions.x;
        const dimY = this.gridDimensions.y;
        const dimXY = dimX * dimY;
        for (let i = 0; i < n; i++) {
            const pi = this.predictedPositions[i];
            let rho = 0;
            let rhoNear = 0;
            // since with grid_id cannot be sure about the cell's neighbors, re-do cellX, cellY, cellZ
            const cellX = Math.floor((pi.x - this.gridOrigin.x) / this.gridCellSize);
            const cellY = Math.floor((pi.y - this.gridOrigin.y) / this.gridCellSize);
            const cellZ = Math.floor((pi.z - this.gridOrigin.z) / this.gridCellSize);

            // second insureance to clamp within the grid
            const cx = Math.max(0, Math.min(dimX - 1, cellX));
            const cy = Math.max(0, Math.min(dimY - 1, cellY));
            const cz = Math.max(0, Math.min(this.gridDimensions.z - 1, cellZ));
            const startX = Math.max(0, cx - 1);
            const endX = Math.min(dimX - 1, cx + 1);
            const startY = Math.max(0, cy - 1);
            const endY = Math.min(dimY - 1, cy + 1);
            const startZ = Math.max(0, cz - 1);
            const endZ = Math.min(this.gridDimensions.z - 1, cz + 1);

            for (let z = startZ; z <= endZ; z++) {
                for (let y = startY; y <= endY; y++) {
                    for (let x = startX; x <= endX; x++) {
                        const cellIndex = x + y * dimX + z * dimXY;
                        const cellParticles = this.grid[cellIndex];
                        if (!cellParticles) continue;

                        for (let k = 0; k < cellParticles.length; k++) {
                            const j = cellParticles[k];
                            const pj = this.predictedPositions[j];
                            const dx = pj.x - pi.x;
                            const dy = pj.y - pi.y;
                            const dz = pj.z - pi.z;
                            const r2 = dx * dx + dy * dy + dz * dz;
                            
                            if (r2 > h2) continue;

                            const r = Math.sqrt(r2);
                            const influence = this.smoothingKernel(h, r);
                            rho += influence;
                            rhoNear += this.nearDensityKernel(h, r);
                        }
                    }
                }
            }

            this.densities[i] = rho;
            this.nearDensities[i] = rhoNear;
        }
    }


    private computePressures() {
        const n = this.particles.length;
        if (!this.pressures || this.pressures.length !== n) {
            this.pressures = new Array(n);
        }
        if (!this.nearPressures || this.nearPressures.length !== n) {
            this.nearPressures = new Array(n);
        }
        if (n === 0) return;

        const target = this.targetDensity;

        // pressure = gradient (density - targetDensity)
        for (let i = 0; i < n; i++) {
            const density = this.densities[i];
            const densityNear = this.nearDensities[i];
            const densityError = density - target;

            const pressure = densityError * this.pressureMultiplier;

            const nearPressure = this.nearPressureFromDensity(densityNear);
            this.pressures[i] = pressure;

            this.nearPressures[i] = nearPressure;
        }
    }

    private computePressureForces() {
        const n = this.particles.length;
        if (!this.pressureForces || this.pressureForces.length !== n) {
            this.pressureForces = new Array(n);
            for (let i = 0; i < n; i++) {
                this.pressureForces[i] = { x: 0, y: 0, z: 0 };
            }
        } else {
            for (let i = 0; i < n; i++) {
                this.pressureForces[i].x = 0;
                this.pressureForces[i].y = 0;
                this.pressureForces[i].z = 0;
            }
        }
        if (n <= 1) return;

        const h = this.smoothingRadius;
        const h2 = h * h;

        // Old O(n^2) Implementation
        if (!this.useSpatialGrid) {
            for (let i = 0; i < n; i++) {
                const pi = this.predictedPositions[i];
                const pressureI = this.pressures[i];
                const nearPressureI = this.nearPressures[i];

                for (let j = i + 1; j < n; j++) {
                    const pj = this.predictedPositions[j];

                    const dx = pj.x - pi.x;
                    const dy = pj.y - pi.y;
                    const dz = pj.z - pi.z;
                    const r2 = dx * dx + dy * dy + dz * dz;
                    if (r2 <= 0 || r2 > h2) continue;

                    const dst = Math.sqrt(r2);
                    const dirX = dx / dst;
                    const dirY = dy / dst;
                    const dirZ = dz / dst;

                    // "普通密度"那一项
                    const rawSlope = this.smoothingKernelDerivative(h, dst);  // 通常是负的
                    const slope = -rawSlope; // 变成正的

                    // "近密度"那一项
                    const rawNearSlope = this.nearDensityDerivative(h, dst);  // 负的
                    const nearSlope = -rawNearSlope;

                    const densityJ = this.densities[j] || 1e-6;
                    const nearDensityJ = this.nearDensities[j] || 1e-6;
                    const pressureJ = this.pressures[j];
                    const nearPressureJ = this.nearPressures[j];

                    const sharedPressure = 0.5 * (pressureI + pressureJ);
                    const sharedNearPressure = 0.5 * (nearPressureI + nearPressureJ);

                    const neighbourDensity = densityJ;
                    const neighbourNearDensity = nearDensityJ;

                    // pressureForce += dir * DensityDerivative * sharedPressure     / densityNeighbour;
                    // pressureForce += dir * NearDensityDerivative * sharedNearPressure / nearDensityNeighbour;
                    const scalarLong = -sharedPressure * slope / neighbourDensity;
                    const scalarNear = -sharedNearPressure * nearSlope / neighbourNearDensity;

                    const scalar = scalarLong + scalarNear;

                    const fx = scalar * dirX;
                    const fy = scalar * dirY;
                    const fz = scalar * dirZ;

                    this.pressureForces[i].x += fx;
                    this.pressureForces[i].y += fy;
                    this.pressureForces[i].z += fz;

                    this.pressureForces[j].x -= fx;
                    this.pressureForces[j].y -= fy;
                    this.pressureForces[j].z -= fz;
                }
            }
            return;
        }

        // Spatial Grid Implementation
        const dimX = this.gridDimensions.x;
        const dimY = this.gridDimensions.y;
        const dimXY = dimX * dimY;

        for (let i = 0; i < n; i++) {
            const pi = this.predictedPositions[i];

            const pressureI = this.pressures[i];
            const nearPressureI = this.nearPressures[i];

            const cellX = Math.floor((pi.x - this.gridOrigin.x) / this.gridCellSize);
            const cellY = Math.floor((pi.y - this.gridOrigin.y) / this.gridCellSize);
            const cellZ = Math.floor((pi.z - this.gridOrigin.z) / this.gridCellSize);
            const cx = Math.max(0, Math.min(dimX - 1, cellX));
            const cy = Math.max(0, Math.min(dimY - 1, cellY));
            const cz = Math.max(0, Math.min(this.gridDimensions.z - 1, cellZ));
            const startX = Math.max(0, cx - 1);
            const endX = Math.min(dimX - 1, cx + 1);
            const startY = Math.max(0, cy - 1);
            const endY = Math.min(dimY - 1, cy + 1);
            const startZ = Math.max(0, cz - 1);
            const endZ = Math.min(this.gridDimensions.z - 1, cz + 1);

            for (let z = startZ; z <= endZ; z++) {
                for (let y = startY; y <= endY; y++) {
                    for (let x = startX; x <= endX; x++) {
                        const cellIndex = x + y * dimX + z * dimXY;
                        const cellParticles = this.grid[cellIndex];
                        if (!cellParticles) continue;

                        for (let k = 0; k < cellParticles.length; k++) {
                            const j = cellParticles[k];
                            // skip self-interaction
                            if (j <= i) continue;

                            const pj = this.predictedPositions[j];

                            const dx = pj.x - pi.x;
                            const dy = pj.y - pi.y;
                            const dz = pj.z - pi.z;
                            const r2 = dx*dx + dy*dy + dz*dz;
                            if (r2 <= 0 || r2 > h2) continue;

                            const dst = Math.sqrt(r2);
                            const dirX = dx / dst;
                            const dirY = dy / dst;
                            const dirZ = dz / dst;

                            // "普通密度"那一项
                            const rawSlope = this.smoothingKernelDerivative(h, dst);  // 通常是负的
                            const slope = -rawSlope; // 变成正的

                            // "近密度"那一项
                            const rawNearSlope = this.nearDensityDerivative(h, dst);  // 负的
                            const nearSlope = -rawNearSlope;

                            const densityJ = this.densities[j] || 1e-6;
                            const nearDensityJ = this.nearDensities[j] || 1e-6;
                            const pressureJ = this.pressures[j];
                            const nearPressureJ = this.nearPressures[j];

                            const sharedPressure = 0.5 * (pressureI + pressureJ);
                            const sharedNearPressure = 0.5 * (nearPressureI + nearPressureJ);

                            const neighbourDensity = densityJ;
                            const neighbourNearDensity = nearDensityJ;

                            // pressureForce += dir * DensityDerivative * sharedPressure     / densityNeighbour;
                            // pressureForce += dir * NearDensityDerivative * sharedNearPressure / nearDensityNeighbour;
                            const scalarLong = -sharedPressure * slope / neighbourDensity;
                            const scalarNear = -sharedNearPressure * nearSlope / neighbourNearDensity;

                            const scalar = scalarLong + scalarNear;

                            const fx = scalar * dirX;
                            const fy = scalar * dirY;
                            const fz = scalar * dirZ;

                            this.pressureForces[i].x += fx;
                            this.pressureForces[i].y += fy;
                            this.pressureForces[i].z += fz;

                            this.pressureForces[j].x -= fx;
                            this.pressureForces[j].y -= fy;
                            this.pressureForces[j].z -= fz;
                        }
                    }
                }
            }
        }
    }


    private interactionForceForParticle(
        inputX: number,
        inputY: number,
        inputZ: number,
        radius: number,
        strength: number,
        particleIndex: number,
    ): { x: number; y: number; z: number } {
        let fx = 0;
        let fy = 0;
        let fz = 0;

        const p = this.particles[particleIndex];

        const offsetX = inputX - p.position.x;
        const offsetY = inputY - p.position.y;
        const offsetZ = inputZ - p.position.z;

        const sqrDst = offsetX * offsetX + offsetY * offsetY + offsetZ * offsetZ;

        // If particle is inside of input radius, calculate force towards input point
        if (sqrDst < radius * radius) {
            const dst = Math.sqrt(sqrDst);

            let dirX = 0;
            let dirY = 0;
            let dirZ = 0;
            if (dst > Number.EPSILON) {
                dirX = offsetX / dst;
                dirY = offsetY / dst;
                dirZ = offsetZ / dst;
            }

            // Value is 1 when particle is exactly at input point; 0 when at edge of input sphere
            const centreT = 1 - dst / radius;

            // interactionForce += (dirToInputPoint * strength - velocities[particleIndex]) * centreT;
            fx += (dirX * strength - p.velocity.x) * centreT;
            fy += (dirY * strength - p.velocity.y) * centreT;
            fz += (dirZ * strength - p.velocity.z) * centreT;
        }

        return { x: fx, y: fy, z: fz };
    }


    private computeInteractionForces(): void {
        const n = this.particles.length;

        if (this.interactionForces.length !== n) {
            this.interactionForces = new Array(n).fill(0).map(() => ({ x: 0, y:0, z: 0 }));
        }
        for (let i = 0; i < n; i++) {
            this.interactionForces[i].x = 0;
            this.interactionForces[i].y = 0;
            this.interactionForces[i].z = 0;
        }

        if (!this.interactionPoint) {
            return;
        }

        const inputX = this.interactionPoint.x;
        const inputY = this.interactionPoint.y;
        const inputZ = this.interactionPoint.z;
        const radius = this.interactionRadius;
        const strength = this.interactionStrength;

        for (let i = 0; i < n; i++) {
            const f = this.interactionForceForParticle(inputX, inputY, inputZ, radius, strength, i);
            this.interactionForces[i].x = f.x;
            this.interactionForces[i].y = f.y;
            this.interactionForces[i].z = f.z;
        }
        // should not clear here as we do multiple physics substeps per frame
        // this.interactionPoint = null;
    }



    addParticle(p: WaterParticleIndividual) {
        this.particles.push(p);
    }

    addParticlesListener(
        callback: (self: AObject) => void,
        handle?: string,
        synchronous: boolean = true,
    ) {
        return this.addEventListener(WaterParticleEvents.PARTICLES_UPDATED, callback, handle);
    }

    protected signalParticlesUpdated(...args:any[]) {
        this.signalEvent(WaterParticleEvents.PARTICLES_UPDATED, ...args);
    }

    /**
     * time update; multiple sub-steps for stability
     */
    timeUpdate(t: number, ...args:any[]) {
        super.timeUpdate(t);

        let dt = 0;
        if (this.lastTime !== null) {
            dt = t - this.lastTime;
        }
        this.lastTime = t;
        if (dt <= 0) return;

        const originalDt = dt;

        // 1. 限制最大时间步（防止帧率过低时数值爆炸）
        const maxTimestepFPS = 30;
        const maxDt = 1 / maxTimestepFPS;
        dt = Math.min(dt, maxDt);

        // 2. 分割成多个子步（提高稳定性和精度）
        const iterationsPerFrame = 2;
        const subDt = dt / iterationsPerFrame;
        
        // 3. 执行多次迭代
        for (let iter = 0; iter < iterationsPerFrame; iter++) {
            this.runPhysicsStep(t, subDt);
        }

        // clear here, after all steps
        this.interactionPoint = null;

        this.signalParticlesUpdated();

    }

    private runPhysicsStep(t: number, dt: number): void {
        const n = this.particles.length;
        if (n === 0) return;

        // 获取 bounding box 边界
        let boundsMin, boundsMax;
        if (this.boundingBox) {
            boundsMin = this.boundingBox.getWorldMin();
            boundsMax = this.boundingBox.getWorldMax();
        }

        // 初始化预测位置数组
        if (this.predictedPositions.length !== n) {
            this.predictedPositions = new Array(n);
            for (let i = 0; i < n; i++) {
                this.predictedPositions[i] = { x: 0, y:0 ,z: 0 };
            }
        }

        // 应用重力并预测位置
        const predictionFactor = 1.0 / 120.0;
        for (let i = 0; i < n; i++) {
            const p = this.particles[i];
            // 先应用重力
            p.velocity.z -= this.gravity * dt;
            // 预测位置：当前位置 + 速度 * 预测因子
            this.predictedPositions[i].x = p.position.x + p.velocity.x * predictionFactor;
            this.predictedPositions[i].y = p.position.y + p.velocity.y * predictionFactor;
            this.predictedPositions[i].z = p.position.z + p.velocity.z * predictionFactor;
        }

        // Fill physics arrays with predicted positions
        // --- Update Grid ---
        if (this.useSpatialGrid) {
            this.updateSpatialGrid();
        }

        this.computeDensities();


        this.computePressures();
        this.computePressureForces();

        // Mouse Interaction
        this.computeInteractionForces();

        // Turn forces into velocity changes
        for (let i = 0; i < n; i++) {
            const p = this.particles[i];
            const fPress = this.pressureForces[i];

            // a_press = F_press / density
            let ax = fPress.x / this.densities[i];
            let ay = fPress.y / this.densities[i];
            let az = fPress.z / this.densities[i];

            const fInt = this.interactionForces[i];
            ax += fInt.x;
            ay += fInt.y;
            az += fInt.z;

            p.velocity.x += ax * dt;
            p.velocity.y += ay * dt;
            p.velocity.z += az * dt;

            // for speed --> color update
            const speed = Math.sqrt(p.velocity.x * p.velocity.x + p.velocity.y * p.velocity.y + p.velocity.z * p.velocity.z);
            this.speedToColor(speed, this.velocityMax, p.color);
        }
        // box collision and position update
        for (let i = 0; i < n; i++) {
            const p = this.particles[i];
            p.timeUpdate(t, dt, boundsMin, boundsMax, this.collisionDamping);
        }
    }
}
