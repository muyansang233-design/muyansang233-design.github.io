/**
 * WaterGPGPUModel - Model for GPGPU-based water particle simulation
 * 
 * This is a thin wrapper that holds simulation parameters.
 * The actual computation happens in FluidSimulator.
 * 
 * This primarily serves to notify the View layer to perform GPU computations,
 * and to hold parameters that can be adjusted from the GUI.
 */

import {
    ANodeModel3D,
    AObject,
    ASerializable,
    Vec3,
    V3,
} from "../../../../anigraph";

// Import the bounding box model from the original location
import { WaterBoundingBoxModel } from "../../../Main/Nodes/Tianyi-test1/WaterBoundingBox/WaterBoundingBoxModel";

enum WaterGPGPUEvents {
    PARTICLES_UPDATED = "WATER_GPGPU_PARTICLES_UPDATED"
}

export type WaterRenderMode = "raymarch" | "geometry";

@ASerializable("WaterGPGPUModel")
export class WaterGPGPUModel extends ANodeModel3D {
    // Reference to bounding box for collision
    boundingBox?: WaterBoundingBoxModel;

    // Rendering mode: geometry (instanced spheres) vs raymarching surface
    renderMode: WaterRenderMode = "raymarch";
    
    // Simulation parameters
    particleCount: number = 1000;
    gravity: number = 0;
    collisionDamping: number = 0.5;
    particleRadius: number = 0.065;


    // SPH parameters
    smoothingRadius: number = 0.2;
    targetDensity: number = 1.0;
    pressureMultiplier: number = 0.0;
    nearPressureMultiplier: number = 0.0;
    particleMass: number = 1.0;

    viscosityStrength: number = 0.0;

    jitterStrength: number = 0.001;
    initialVelocity: Vec3 = V3(0, 0, 0);
    spawnRegionScale: number = 0.8;
    particleSpacing: number = 0.1;
    spawnCenter: Vec3 | null = null;
    respawnCenter: Vec3 = V3(0, 0, -0.2);
    respawnEnabled: boolean = true;
    respawnMaxPerFrame: number = 10;
    loopWaterfallEnabled: boolean = false;
    containerWireframe: boolean = false;
    containerVisible: boolean = true;
    containerSolidDepthWrite: boolean = false;

    externalForceEnabled: boolean = false;
    externalForceActive: boolean = false;
    externalForceCenter: Vec3 = V3(0, 0, 0);
    externalForceRadius: number = 0.6;
    externalForceStrength: number = 800.0;
    sdfResolution: number = 128;
    volumeResolution: number = 32;
    maxSpeed: number = 10.0;

    isPaused: boolean = true;
    // For tracking time
    private lastTime: number | null = null;
    
    constructor() {
        super();
    }
    
    /**
     * Get bounds from bounding box
     */
    getBoundsMin(): Vec3 {
        if (this.boundingBox) {
            return this.boundingBox.getWorldMin();
        }
        return V3(-1, -1, -1);
    }
    
    getBoundsMax(): Vec3 {
        if (this.boundingBox) {
            return this.boundingBox.getWorldMax();
        }
        return V3(1, 1, 1);
    }
    
    /**
     * Add listener for particle updates
     */
    addParticlesListener(
        callback: (self: AObject) => void,
        handle?: string,
    ) {
        return this.addEventListener(WaterGPGPUEvents.PARTICLES_UPDATED, callback, handle);
    }
    
    /**
     * Signal that particles have been updated (called by View after compute)
     */
    signalParticlesUpdated(...args: any[]) {
        this.signalEvent(WaterGPGPUEvents.PARTICLES_UPDATED, ...args);
    }
    
    /**
     * 开始模拟
     */
    startSimulation() {
        if (this.isPaused) {
            this.isPaused = false;
            console.log("🌊 模拟开始！");
        }
    }

    /**
     * 暂停模拟
     */
    pauseSimulation() {
        if (!this.isPaused) {
            this.isPaused = true;
            console.log("⏸️ 模拟暂停");
        }
    }

    /**
     * 切换暂停状态
     */
    toggleSimulation() {
        if (this.isPaused) {
            this.startSimulation();
        } else {
            this.pauseSimulation();
        }
    }

    /**
     * 切换循环瀑布开关
     */
    toggleLoopWaterfall() {
        this.loopWaterfallEnabled = !this.loopWaterfallEnabled;
    }

    /**
     * 切换交互外力模式（F 键）
     */
    toggleExternalForce() {
        this.externalForceEnabled = !this.externalForceEnabled;
        if (!this.externalForceEnabled) {
            this.externalForceActive = false;
        }
    }

    /**
     * Time update - signals the view to run simulation
     */
    timeUpdate(t: number, ...args: any[]) {
        super.timeUpdate(t);
        
        let dt = 0;
        if (this.lastTime !== null) {
            dt = t - this.lastTime;
        }
        this.lastTime = t;

        if (this.isPaused) {
            this.signalParticlesUpdated(0);  // dt=0 表示只渲染，不模拟
            return;
        }
        
        if (dt <= 0) return;
        
        // Signal update (the View will handle the actual computation)
        this.signalParticlesUpdated(dt);
    }
}
