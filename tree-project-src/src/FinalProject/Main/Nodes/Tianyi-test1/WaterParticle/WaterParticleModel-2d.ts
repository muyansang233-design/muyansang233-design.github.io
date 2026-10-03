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
    static ShaderModel: AShaderModel;

    // 供粒子碰撞使用的包围盒
    boundingBox?: WaterBoundingBoxModel;

    static async LoadShaderModel(...args:any[]) {
        await AShaderModel.ShaderSourceLoaded("exampleparticle");
        WaterParticleModel.ShaderModel = await AShaderModel.CreateModel("exampleparticle");
    }

    // 所有粒子
    particles: WaterParticleIndividual[] = [];

    // 还保留 baseHeight / amplitude，之后你想加“波动”可以继续用
    baseHeight: number = 0.1;
    amplitude: number = 0.4;

    // 用来算 dt
    private lastTime: number | null = null;


    // SPH 参数
    smoothingRadius: number = 0.05;      // 影响半径
    targetDensity: number = 5000;        // 希望的"理想密度"（手动设置，与当前 smoothingRadius=0.05 匹配，实际密度约 4000-6000）
    pressureMultiplier: number = 1.0 / 5000;  // 密度误差 -> 压力 的系数
    particleMass: number = 1.0;
    gravity: number = 9.8;
    collisionDamping: number = 0.9;     // 碰撞阻尼系数 (0-1)
    velocityMax: number = 3.0; // 用于速度可视化的最大速度值，增大以降低颜色变化敏感度

    // 粒子数量（直接指定，不再使用密度）
    particleCount: number = 1000; 

    // SPH 参数下面加：
    cellSize: number = this.smoothingRadius;        // 网格大小，≈ smoothingRadius
    spatialGrid: Map<string, number[]> = new Map(); // key -> 粒子索引列表
    cellX: number[] = [];                           // 每个粒子所属格子的坐标
    cellZ: number[] = [];


    // --- 交互相关 ---
    interactionRadius: number = 0.15;      // 可以之后在 UI 里调
    interactionStrength: number = 5.0;
    /** P 键触发时记录一次交互点（世界坐标），在下一次 timeUpdate 里用一次就清空 */
    private interactionPoint: Vec3 | null = null;

    /** 每个粒子的交互力（2D：x,z），逻辑完全照 C# 写 */
    private interactionForces: { x: number; z: number }[] = [];


    /** 从外部调用：在 worldPos 位置触发一次 C# 那种交互力 */
    public triggerInteraction(worldPos: Vec3, radius?: number, strength?: number): void {
        this.interactionPoint = worldPos;
        if (radius !== undefined) {
            this.interactionRadius = radius;
        }
        if (strength !== undefined) {
            this.interactionStrength = strength;
        }
    }

    // 临时数组
    densities: number[] = [];
    pressures: number[] = [];
    pressureForces: {x: number, z: number}[] = [];
    predictedPositions: {x: number, z: number}[] = []; // 预测位置


    constructor() {
        super();

        // // 如果外面传了，就用外面的；没传就先放 0，等外面手动赋值
        // if (targetDensity !== undefined) {
        //     this.targetDensity = targetDensity;
        // }

        // 注意：每个粒子都有自己的 material（在 WaterParticleView 中创建），
        // 所以这里不需要设置 model 的 material
        // this.setMaterial(WaterParticleModel.ShaderModel.CreateMaterial());
        // this.material.setUniform("particleColor", Color.FromRGBA(0.3, 0.6, 1.0, 0.7));
    }

    /** 在当前粒子布局下，初始化全局 targetDensity */
    // 已注释：改为手动设置 targetDensity，与 Fluid-Sim-Physics 一致
    // public initTargetDensityFromCurrentConfiguration(): void {
    //     const avg = this.computeAverageDensity();
    //     this.targetDensity = avg;
    // }

    /**
     * 根据速度计算颜色（类似 Fluid-Sim-Physics）
     * speed: 粒子速度的大小
     * velocityMax: 用于归一化的最大速度
     * 返回: Color 对象
     */
    private speedToColor(speed: number, velocityMax: number): Color {
        // 归一化速度到 [0, 1]
        const speedT = Math.max(0, Math.min(1, speed / velocityMax));
        
        // 简单的颜色映射：从蓝色（慢）到红色（快）
        if (speedT < 0.5) {
            // 蓝色到青色：speedT 从 0 到 0.5
            const t = speedT * 2;  // 映射到 [0, 1]
            return Color.FromRGBA(
                0.3 * t,           // R: 0 -> 0.15
                0.6 + 0.4 * t,     // G: 0.6 -> 1.0
                1.0,               // B: 1.0
                0.7
            );
        } else {
            // 青色到红色：speedT 从 0.5 到 1.0
            const t = (speedT - 0.5) * 2;  // 映射到 [0, 1]
            return Color.FromRGBA(
                0.15 + 0.85 * t,   // R: 0.15 -> 1.0
                1.0 - 0.5 * t,     // G: 1.0 -> 0.5
                1.0 - t,           // B: 1.0 -> 0.0
                0.7
            );
        }
    }

    private cellKey(ix: number, iz: number): string {
        return ix + "_" + iz;
    }

    /** 根据预测位置，重建 uniform grid */
    private rebuildSpatialGrid(): void {
        const n = this.particles.length;
        this.spatialGrid.clear();
        this.cellX = new Array(n);
        this.cellZ = new Array(n);

        this.cellSize = this.smoothingRadius;      // 保持同步
        const invCell = 1.0 / this.cellSize;

        for (let i = 0; i < n; i++) {
            const predPos = this.predictedPositions[i];
            const ix = Math.floor(predPos.x * invCell);
            const iz = Math.floor(predPos.z * invCell);

            this.cellX[i] = ix;
            this.cellZ[i] = iz;

            const key = this.cellKey(ix, iz);
            let bucket = this.spatialGrid.get(key);
            if (!bucket) {
                bucket = [];
                this.spatialGrid.set(key, bucket);
            }
            bucket.push(i);
        }
    }


    /** 计算当前配置下的平均 SPH density */
    public computeAverageDensity(): number {
        const n = this.particles.length;
        if (n === 0) return 0;

        // 先算每个粒子的 density
        this.computeDensities();

        let sum = 0;
        for (let i = 0; i < n; i++) {
            sum += this.densities[i];
        }
        return sum / n;
    }


    public spawnParticlesInBoxWithTarget(numParticles: number): void {
        if (!this.boundingBox) {
            console.warn("WaterParticleModel.spawnParticlesInBoxWithTarget: boundingBox 未设置");
            return;
        }

        this.particles = [];
        this.predictedPositions = [];

        // 先算一下 box 的范围
        const worldMin = this.boundingBox.getWorldMin();
        const worldMax = this.boundingBox.getWorldMax();
        const sizeX = worldMax.x - worldMin.x;
        const sizeZ = worldMax.z - worldMin.z;

        // 简单网格：nx * nz ≈ numParticles
        const nx = Math.ceil(Math.sqrt(numParticles * sizeX / sizeZ));
        const nz = Math.ceil(numParticles / nx);

        let count = 0;
        for (let ix = 0; ix < nx; ix++) {
            for (let iz = 0; iz < nz; iz++) {
                if (count >= numParticles) break;

                const x = worldMin.x + (ix + 0.5) * (sizeX / nx);
                const z = worldMin.z + (iz + 0.5) * (sizeZ / nz);

                const p = new WaterParticleIndividual(
                    // 位置
                    V3(x, 0, z),
                    // 初速度
                    V3(0, 0, 0),
                    // 半径
                    0.005
                );
                this.particles.push(p);
                // 初始化预测位置为当前位置
                this.predictedPositions.push({ x: x, z: z });
                count++;
            }
        }

        // 关键：用当前这个"均匀网格"的配置来初始化 targetDensity
        // 已注释：改为手动设置 targetDensity
        // this.initTargetDensityFromCurrentConfiguration();
    }

    // ?
    /** 在 bounding box 内随机扰动粒子位置，保持大致分布不变、但打乱“棋盘感” */
    public jitterParticlesInBox(amount: number = 0.3): void {
        if (!this.boundingBox) {
            console.warn("jitterParticlesInBox: boundingBox 未设置");
            return;
        }
        const worldMin = this.boundingBox.getWorldMin();
        const worldMax = this.boundingBox.getWorldMax();
        const sizeX = worldMax.x - worldMin.x;
        const sizeZ = worldMax.z - worldMin.z;

        for (const p of this.particles) {
            // 基于 box 尺寸的扰动尺度
            const jitterX = (Math.random() * 2 - 1) * sizeX * amount /  (this.particles.length ** 0.5);
            const jitterZ = (Math.random() * 2 - 1) * sizeZ * amount /  (this.particles.length ** 0.5);

            p.position.x += jitterX;
            p.position.z += jitterZ;

            // 夹回 box 里面
            p.position.x = Math.min(Math.max(p.position.x, worldMin.x), worldMax.x);
            p.position.z = Math.min(Math.max(p.position.z, worldMin.z), worldMax.z);
            p.position.y = 0;

            // 初速度归零
            p.velocity.x = 0;
            p.velocity.y = 0;
            p.velocity.z = 0;
        }

        // 为了避免这一帧 dt 很怪，重置一下 lastTime
        this.lastTime = null;
    }

    // 方便外面设置 bounding box
    setBoundingBox(box: WaterBoundingBoxModel) {
        this.boundingBox = box;
    }

    // /** 在屏幕中心整齐排列成方形 */
    // public spawnParticlesInCenterSquare(numParticles: number): void {
    //     if (!this.boundingBox) {
    //         console.warn("spawnParticlesInCenterSquare: boundingBox 未设置");
    //         return;
    //     }

    //     this.particles = [];
    //     this.predictedPositions = [];

    //     // 获取 bounding box 的中心和尺寸
    //     const worldMin = this.boundingBox.getWorldMin();
    //     const worldMax = this.boundingBox.getWorldMax();
    //     const centerX = 0.5 * (worldMin.x + worldMax.x);
    //     const centerZ = 0.5 * (worldMin.z + worldMax.z);
    //     const boxSizeX = worldMax.x - worldMin.x;
    //     const boxSizeZ = worldMax.z - worldMin.z;

    //     // 计算方形区域的尺寸（使用较小的尺寸，让方形更紧凑）
    //     // 使用 bounding box 的 60% 作为方形区域的尺寸
    //     const squareSize = Math.min(boxSizeX, boxSizeZ) * 0.6;
    //     const halfSize = squareSize * 0.5;

    //     // 计算网格尺寸：尽量接近正方形
    //     const nx = Math.ceil(Math.sqrt(numParticles));
    //     const nz = Math.ceil(numParticles / nx);

    //     // 计算粒子间距
    //     const spacingX = squareSize / nx;
    //     const spacingZ = squareSize / nz;

    //     // 从左上角开始排列
    //     const startX = centerX - halfSize + spacingX * 0.5;
    //     const startZ = centerZ - halfSize + spacingZ * 0.5;

    //     let count = 0;
    //     for (let iz = 0; iz < nz; iz++) {
    //         for (let ix = 0; ix < nx; ix++) {
    //             if (count >= numParticles) break;

    //             const x = startX + ix * spacingX;
    //             const z = startZ + iz * spacingZ;

    //             const p = new WaterParticleIndividual(
    //                 V3(x, 0, z),
    //                 V3(0, 0, 0),
    //                 0.03
    //             );
    //             // 初始化颜色：速度是 0，所以应该是蓝色（慢速）
    //             const initialSpeed = 0;
    //             p.color = this.speedToColor(initialSpeed, this.velocityMax);
    //             this.particles.push(p);
    //             // 初始化预测位置为当前位置
    //             this.predictedPositions.push({ x: x, z: z });
    //             count++;
    //         }
    //     }

    //     // 初始化 targetDensity
    //     // 已注释：改为手动设置 targetDensity
    //     // this.initTargetDensityFromCurrentConfiguration();
        
    //     // 重置 lastTime
    //     this.lastTime = null;
    // }

    // /** 重新生成指定数量的粒子 */
    // public respawnParticles(numParticles: number): void {
    //     if (!this.boundingBox) {
    //         console.warn("respawnParticles: boundingBox 未设置");
    //         return;
    //     }
    //     // 使用新的中心方形排列函数，而不是随机分布
    //     this.spawnParticlesInCenterSquare(numParticles);
    // }

    /**
     * 基于粒子数量生成粒子，并保持初始密度（粒子间距）一致。
     * 通过固定粒子间距，根据 particleCount 自动扩展初始区域，尽量保持区域对称。
     */
    public spawnParticlesWithDensity(): void {
        if (!this.boundingBox) {
            console.warn("spawnParticlesWithDensity: boundingBox 未设置");
            return;
        }

        this.particles = [];
        this.predictedPositions = [];

        // 获取 bounding box 的中心和尺寸
        const worldMin = this.boundingBox.getWorldMin();
        const worldMax = this.boundingBox.getWorldMax();
        const centerX = 0.5 * (worldMin.x + worldMax.x);
        const centerZ = 0.5 * (worldMin.z + worldMax.z);
        const boxSizeX = worldMax.x - worldMin.x;
        const boxSizeZ = worldMax.z - worldMin.z;

        const targetTotal = Math.max(1, Math.floor(this.particleCount));
        const spacingMultiplier = 0.35; // 更紧凑：固定间距 = smoothingRadius 的 45%
        const spacing = Math.max(1e-6, this.smoothingRadius * spacingMultiplier);

        const usableX = boxSizeX * 0.9; // 留 10% 的边距，避免贴边
        const usableZ = boxSizeZ * 0.9;
        const maxColumns = Math.max(1, Math.floor(usableX / spacing) + 1);
        const maxRows = Math.max(1, Math.floor(usableZ / spacing) + 1);

        let nx = Math.min(maxColumns, Math.ceil(Math.sqrt(targetTotal)));
        let nz = Math.min(maxRows, Math.ceil(targetTotal / Math.max(1, nx)));

        // 尽量保持 nx 和 nz 对称，同时保证能容纳 targetTotal
        while (nx * nz < targetTotal) {
            const canGrowX = nx < maxColumns;
            const canGrowZ = nz < maxRows;
            if (!canGrowX && !canGrowZ) {
                console.warn(`Particle count ${targetTotal} exceeds capacity (${nx * nz}) at current density. Spawning with reduced count.`);
                break;
            }

            if ((!canGrowZ && canGrowX) || (canGrowX && nx <= nz)) {
                nx++;
            } else if (canGrowZ) {
                nz++;
            }
        }

        const actualTotal = Math.min(targetTotal, nx * nz);
        const regionSizeX = spacing * Math.max(0, nx - 1);
        const regionSizeZ = spacing * Math.max(0, nz - 1);
        const startX = centerX - 0.5 * regionSizeX;
        const startZ = centerZ - 0.5 * regionSizeZ;

        let count = 0;
        for (let iz = 0; iz < nz; iz++) {
            for (let ix = 0; ix < nx; ix++) {
                if (count >= actualTotal) break;

                const x = startX + ix * spacing;
                const z = startZ + iz * spacing;

                const p = new WaterParticleIndividual(
                    V3(x, 0, z),
                    V3(0, 0, 0),
                    0.03
                );
                const initialSpeed = 0;
                p.color = this.speedToColor(initialSpeed, this.velocityMax);
                this.particles.push(p);
                this.predictedPositions.push({ x: x, z: z });
                count++;
            }
            if (count >= actualTotal) break;
        }

        const area = (regionSizeX || spacing) * (regionSizeZ || spacing);
        console.log(`Spawned ${count} particles (target: ${this.particleCount})`);
        console.log(`Region size: ${regionSizeX.toFixed(2)} x ${regionSizeZ.toFixed(2)}`);
        console.log(`Grid: ${nx} x ${nz}, spacing: ${spacing.toFixed(4)} (${spacingMultiplier.toFixed(2)}x smoothingRadius)`);
        if (count < targetTotal) {
            console.warn(`Only ${count} particles spawned due to bounding box constraints while keeping density constant.`);
        }

        // 重置 lastTime
        this.lastTime = null;
    }

    /**
     * 计算当前粒子布局的平均初始密度
     * 可用于验证粒子数量和 targetDensity 是否匹配
     * @returns 平均 SPH 密度值
     */
    public calculateInitialDensity(): number {
        const n = this.particles.length;
        if (n === 0) {
            console.warn("calculateInitialDensity: 没有粒子");
            return 0;
        }

        // 临时：将当前位置设置为预测位置
        for (let i = 0; i < n; i++) {
            const p = this.particles[i];
            this.predictedPositions[i] = { x: p.position.x, z: p.position.z };
        }

        // 使用现有的 computeDensities 方法
        this.computeDensities();

        // 计算平均密度
        let sum = 0;
        for (let i = 0; i < n; i++) {
            sum += this.densities[i];
        }
        const avgDensity = sum / n;

        console.log(`Initial average density: ${avgDensity.toFixed(2)}`);
        console.log(`Current targetDensity: ${this.targetDensity}`);
        console.log(`Density ratio: ${(avgDensity / this.targetDensity).toFixed(2)}`);

        return avgDensity;
    }

//     // smoothing kernel: W(r, h) = max(0, h^2 - r^2)^3
//     private smoothingKernel(radius: number, dst: number): number {
//         const value = Math.max(0, radius * radius - dst * dst);
//         return value * value * value;
//     }
//
// // 对距离的导数 dW/dr，大概形状就行，不需要太严谨物理
//     private smoothingKernelDerivative(radius: number, dst: number): number {
//         if (dst <= 0 || dst >= radius) return 0;
//         const base = radius * radius - dst * dst;  // >0
//         // W = base^3，dW/ddst = 3 * base^2 * (-2*dst) = -6*dst*base^2
//         return -6 * dst * base * base;
//     }
    // 归一化过的 2D poly6 smoothing kernel
// radius = h, dst = |r|
    // private smoothingKernel(radius: number, dst: number): number {
    //     if (radius <= 0) return 0;

    //     // 对应 C# 里的: float volume = PI * Pow(radius, 8) / 4;
    //     const volume = Math.PI * Math.pow(radius, 8) / 4.0;

    //     const base = Math.max(0, radius * radius - dst * dst);  // = h^2 - r^2
    //     // return value * value * value / volume;
    //     return (base * base * base) / volume;
    // }

    private smoothingKernel(radius: number, dst: number): number {
        if (dst >= radius || radius <= 0) return 0;
        const volume = Math.PI * Math.pow(radius, 4) / 6.0;
        return (radius - dst) * (radius - dst) / volume;
    }

    // dW/dr，用的是同一个核，只是多了 / volume
    // private smoothingKernelDerivative(radius: number, dst: number): number {
    //     if (radius <= 0 || dst <= 0 || dst >= radius) return 0;

    //     const volume = Math.PI * Math.pow(radius, 8) / 4.0;
    //     const base = radius * radius - dst * dst; // > 0
    //     // W = base^3 / volume
    //     // dW/ddst = (1/volume) * 3 * base^2 * (-2*dst) = -6*dst*base^2 / volume
    //     return -6 * dst * base * base / volume;
    // }

    private smoothingKernelDerivative(radius: number, dst: number): number {
        if (dst >= radius || radius <= 0) return 0;
        const scale = 12 / (Math.PI * Math.pow(radius, 4));
        return (dst - radius) *scale;
    }

    // private computeDensities() {
    //     const n = this.particles.length;
    //     this.densities = new Array(n);
    //
    //     for (let i = 0; i < n; i++) {
            // this.densities[i] = this.calculateDensityAt(i);
    //     }
    // }
    private computeDensities() {
        const n = this.particles.length;
        this.densities = new Array(n);

        if (n === 0) return;

        // 先按预测位置重建 spatial grid
        this.rebuildSpatialGrid();

        const h = this.smoothingRadius;
        const h2 = h * h;

        for (let i = 0; i < n; i++) {
            const predPosI = this.predictedPositions[i];
            let rho = 0;

            const ix = this.cellX[i];
            const iz = this.cellZ[i];

            // 自己格子 + 周围 8 个格子
            for (let gx = ix - 1; gx <= ix + 1; gx++) {
                for (let gz = iz - 1; gz <= iz + 1; gz++) {
                    const key = this.cellKey(gx, gz);
                    const bucket = this.spatialGrid.get(key);
                    if (!bucket) continue;

                    for (const j of bucket) {
                        const predPosJ = this.predictedPositions[j];
                        const dx = predPosJ.x - predPosI.x;
                        const dz = predPosJ.z - predPosI.z;
                        const r2 = dx*dx + dz*dz;
                        if (r2 > h2) continue;

                        const r = Math.sqrt(r2);
                        const influence = this.smoothingKernel(h, r);
                        // 移除质量项，与 Fluid-Sim-Physics 一致
                        rho += influence;
                    }
                }
            }
            this.densities[i] = rho;
        }
    }



    private computePressures() {
        const n = this.particles.length;
        this.pressures = new Array(n);
        if (n === 0) return;

        // 使用设置的目标密度（不要重置它！）
        const target = this.targetDensity;

        // 每个粒子的压力 = (局部密度 - 目标密度) * 系数
        for (let i = 0; i < n; i++) {
            const density = this.densities[i];
            const densityError = density - target;   // >0：太挤，<0：太稀

            const pressure = densityError * this.pressureMultiplier;
            this.pressures[i] = pressure;
        }
    }

    // private computePressureForces() {
    //     const n = this.particles.length;
    //     this.pressureForces = new Array(n);
    //     for (let i = 0; i < n; i++) {
    //         this.pressureForces[i] = {x: 0, z: 0};
    //     }
    //     if (n <= 1) return;
    //
    //     // 成对处理 (i, j)，一次算出作用力和反作用力
    //     for (let i = 0; i < n; i++) {
    //         const pi = this.particles[i];
    //
    //         for (let j = i + 1; j < n; j++) {
    //             const pj = this.particles[j];
    //
    //             // offset: i -> j
    //             const dx = pj.position.x - pi.position.x;
    //             const dz = pj.position.z - pi.position.z;
    //             const dstSq = dx * dx + dz * dz;
    //             const dst = Math.sqrt(dstSq);
    //             if (dst <= 0 || dst > this.smoothingRadius) continue;
    //
    //             const dirX = dx / dst;
    //             const dirZ = dz / dst;
    //
    //             // kernel 导数：你原来的函数返回的是负的，这里取相反数变成正的斜率
    //             const rawSlope = this.smoothingKernelDerivative(this.smoothingRadius, dst);
    //             const slope = -rawSlope;  // slope > 0
    //
    //             const densityI = this.densities[i] || 1e-6;
    //             const densityJ = this.densities[j] || 1e-6;
    //
    //             // 用两边的 pressure 做一个 shared pressure（对应你截图里的 CalculateSharedPressure）
    //             const pressureI = this.pressures[i];
    //             const pressureJ = this.pressures[j];
    //             const sharedPressure = 0.5 * (pressureI + pressureJ);
    //
    //             // 用平均密度，避免偏向任意一边
    //             const avgDensity = 0.5 * (densityI + densityJ) || 1e-6;
    //
    //             // SPH 里典型的形式：F ≈ - sharedP * ∇W * m / ρ
    //             // slope > 0，dir 是 i->j，所以加上一个总的负号让高压往外推
    //             const scalar = -sharedPressure * slope * this.particleMass / avgDensity;
    //
    //             const fx = scalar * dirX;
    //             const fz = scalar * dirZ;
    //
    //             // 作用力和反作用力：i 加 F，j 加 -F
    //             this.pressureForces[i].x += fx;
    //             this.pressureForces[i].z += fz;
    //
    //             this.pressureForces[j].x -= fx;
    //             this.pressureForces[j].z -= fz;
    //         }
    //     }
    // }
    private computePressureForces() {
        const n = this.particles.length;
        this.pressureForces = new Array(n);
        for (let i = 0; i < n; i++) {
            this.pressureForces[i] = { x: 0, z: 0 };
        }
        if (n <= 1) return;

        const h = this.smoothingRadius;
        const h2 = h * h;

        for (let i = 0; i < n; i++) {
            const predPosI = this.predictedPositions[i];
            const ix = this.cellX[i];
            const iz = this.cellZ[i];

            for (let gx = ix - 1; gx <= ix + 1; gx++) {
                for (let gz = iz - 1; gz <= iz + 1; gz++) {
                    const key = this.cellKey(gx, gz);
                    const bucket = this.spatialGrid.get(key);
                    if (!bucket) continue;

                    for (const j of bucket) {
                        if (j <= i) continue; // 避免 (i,j) 和 (j,i) 重复

                        const predPosJ = this.predictedPositions[j];
                        const dx = predPosJ.x - predPosI.x;
                        const dz = predPosJ.z - predPosI.z;
                        const r2 = dx*dx + dz*dz;
                        if (r2 <= 0 || r2 > h2) continue;

                        const dst = Math.sqrt(r2);
                        const dirX = dx / dst;
                        const dirZ = dz / dst;

                        const rawSlope = this.smoothingKernelDerivative(h, dst);
                        const slope = -rawSlope; // > 0

                        const densityI = this.densities[i] || 1e-6;
                        const densityJ = this.densities[j] || 1e-6;

                        const pressureI = this.pressures[i];
                        const pressureJ = this.pressures[j];
                        const sharedPressure = 0.5 * (pressureI + pressureJ);

                        // 使用邻居的密度作为分母（匹配 Fluid-Sim-Physics 的实现）
                        // 注意：对于粒子 i，我们使用邻居 j 的密度
                        // const avgDensity = 0.5 * (densityI + densityJ) || 1e-6;
                        const neighbourDensity = densityJ;

                        // const scalar = -sharedPressure * slope * this.particleMass / neighbourDensity;
                        const scalar = -sharedPressure * slope / neighbourDensity;

                        const fx = scalar * dirX;
                        const fz = scalar * dirZ;

                        this.pressureForces[i].x += fx;
                        this.pressureForces[i].z += fz;

                        this.pressureForces[j].x -= fx;
                        this.pressureForces[j].z -= fz;
                    }
                }
            }
        }
    }

    /** 完全仿照你截图里的 C# InteractionForce，只是改成 TypeScript + (x,z) */
    private interactionForceForParticle(
        inputX: number,
        inputZ: number,
        radius: number,
        strength: number,
        particleIndex: number,
    ): { x: number; z: number } {
        let fx = 0;
        let fz = 0;

        const p = this.particles[particleIndex];
        const offsetX = inputX - p.position.x;
        const offsetZ = inputZ - p.position.z;

        const sqrDst = offsetX * offsetX + offsetZ * offsetZ;

        // If particle is inside of input radius, calculate force towards input point
        if (sqrDst < radius * radius) {
            const dst = Math.sqrt(sqrDst);

            // Vector2 dirToInputPoint = dst <= float.Epsilon ? Vector2.zero : offset / dst;
            let dirX = 0;
            let dirZ = 0;
            if (dst > Number.EPSILON) {
                dirX = offsetX / dst;
                dirZ = offsetZ / dst;
            }

            // Value is 1 when particle is exactly at input point; 0 when at edge of input circle
            const centreT = 1 - dst / radius;

            // interactionForce += (dirToInputPoint * strength - velocities[particleIndex]) * centreT;
            fx += (dirX * strength - p.velocity.x) * centreT;
            fz += (dirZ * strength - p.velocity.z) * centreT;
        }

        return { x: fx, z: fz };
    }

    /** 按照 C# 的逻辑，对所有粒子算一遍交互力 */
    private computeInteractionForces(): void {
        const n = this.particles.length;

        // 确保数组长度正确，并先清零
        if (this.interactionForces.length !== n) {
            this.interactionForces = new Array(n).fill(0).map(() => ({ x: 0, z: 0 }));
        }
        for (let i = 0; i < n; i++) {
            this.interactionForces[i].x = 0;
            this.interactionForces[i].z = 0;
        }

        if (!this.interactionPoint) {
            return; // 没有触发事件的话，全是 0
        }

        const inputX = this.interactionPoint.x;
        const inputZ = this.interactionPoint.z;
        const radius = this.interactionRadius;
        const strength = this.interactionStrength;

        for (let i = 0; i < n; i++) {
            const f = this.interactionForceForParticle(inputX, inputZ, radius, strength, i);
            this.interactionForces[i].x = f.x;
            this.interactionForces[i].z = f.z;
        }

        // 只作用一帧，算完就清掉
        this.interactionPoint = null;
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
    private resolveParticleCollisions(): void {
        const n = this.particles.length;
        if (n <= 1) return;

        const restitution = 0.00;

        for (let i = 0; i < n; i++) {
            const p1: WaterParticleIndividual = this.particles[i];
            for (let j = i + 1; j < n; j++) {
                const p2: WaterParticleIndividual = this.particles[j];

                const dx = p2.position.x - p1.position.x;
                const dz = p2.position.z - p1.position.z;
                const distSq = dx*dx + dz*dz;

                const minDist = (p1.radius ?? 0.05) + (p2.radius ?? 0.05);
                const minDistSq = minDist * minDist;

                if (distSq >= minDistSq || distSq === 0) continue;

                const dist = Math.sqrt(distSq);
                const nx = dx / dist;
                const nz = dz / dist;

                const penetration = minDist - dist;
                const half = 0.5 * penetration;

                p1.position.x -= nx * half;
                p1.position.z -= nz * half;
                p2.position.x += nx * half;
                p2.position.z += nz * half;

                p1.position.y = 0;
                p2.position.y = 0;

                const rvx = p2.velocity.x - p1.velocity.x;
                const rvz = p2.velocity.z - p1.velocity.z;
                const vn = rvx * nx + rvz * nz;

                if (vn >= 0) continue;

                const jImpulse = -(1 + restitution) * vn / 2.0;
                const jx = jImpulse * nx;
                const jz = jImpulse * nz;

                p1.velocity.x -= jx;
                p1.velocity.z -= jz;
                p2.velocity.x += jx;
                p2.velocity.z += jz;

                p1.velocity.y = 0;
                p2.velocity.y = 0;
            }
        }
    }
    /**
     * 粒子系统每帧更新（匹配 Fluid-Sim-Physics 的多次迭代机制）
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

        this.signalParticlesUpdated();
    }

    /**
     * 单次物理步骤（从 Fluid-Sim-Physics 的 RunSimulationStep 改编）
     */
    private runPhysicsStep(t: number, dt: number): void {
        const n = this.particles.length;
        if (n === 0) return;

        // 获取 bounding box 边界
        let boundsMin, boundsMax;
        if (this.boundingBox) {
            boundsMin = this.boundingBox.getWorldMin();
            boundsMax = this.boundingBox.getWorldMax();
        }

// --- Step 0: 应用外力（重力）并预测位置 ---
        // 初始化预测位置数组
        if (this.predictedPositions.length !== n) {
            this.predictedPositions = new Array(n);
            for (let i = 0; i < n; i++) {
                this.predictedPositions[i] = { x: 0, z: 0 };
            }
        }

        // 应用重力并预测位置
        const predictionFactor = 1.0 / 120.0; // 与 Fluid-Sim-Physics 保持一致（2D版本使用1/120）
        for (let i = 0; i < n; i++) {
            const p = this.particles[i];
            // 先应用重力
            p.velocity.z -= this.gravity * dt;
            // 预测位置：当前位置 + 速度 * 预测因子
            this.predictedPositions[i].x = p.position.x + p.velocity.x * predictionFactor;
            this.predictedPositions[i].z = p.position.z + p.velocity.z * predictionFactor;
        }

// --- Step 1: 使用预测位置算密度、压力、压力力 ---
        this.computeDensities();        // 填好 this.densities[]（使用预测位置）
        this.computePressures();        // 填好 this.pressures[]
        this.computePressureForces();   // 填好 this.pressureForces[i].x / .z（使用预测位置）

// --- Step 1.5: 如果有鼠标交互，按照 C# 逻辑算 interactionForces ---
        this.computeInteractionForces();

        // --- Step 2: 把压力力 + 交互力 转成加速度，累加到速度上 ---
        for (let i = 0; i < n; i++) {
            const p = this.particles[i];
            const fPress = this.pressureForces[i];

            // a_press = F_press / density
            let ax = fPress.x / this.densities[i];
            let az = fPress.z / this.densities[i];

            // 再加上 C# InteractionForce（在那边就已经是"加速度"量纲了）
            const fInt = this.interactionForces[i];
            ax += fInt.x;
            az += fInt.z;

            p.velocity.x += ax * dt;
            p.velocity.z += az * dt;

            // 更新粒子的颜色基于速度（使用 SphereParticle 的 color 字段）
            const speed = Math.sqrt(p.velocity.x * p.velocity.x + p.velocity.z * p.velocity.z);
            p.color = this.speedToColor(speed, this.velocityMax);
        }

// --- Step 3: 用更新后的 velocity 积分位置 + box 碰撞 ---
        for (let i = 0; i < n; i++) {
            const p = this.particles[i];
            p.timeUpdate(t, dt,  boundsMin, boundsMax, this.collisionDamping);
        }

// --- Step 4: 粒子-粒子碰撞修正（SPH流体不需要）---
        // this.resolveParticleCollisions?.();
    }
}
