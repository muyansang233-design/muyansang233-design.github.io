import { ANodeModel3D, ASerializable, V3, Vec3, AObject } from "../../../../anigraph"; // 确保引入 AObject
import { WaterBoundingBoxModel } from "../../../Main/Nodes/Tianyi-test1/WaterBoundingBox/WaterBoundingBoxModel";
import { WaterRenderMode } from "../WaterGPGPU/WaterGPGPUModel";

// 定义一个事件名称
export enum WaterSurfaceEvents {
    UPDATE = "WATER_SURFACE_UPDATE"
}

@ASerializable("WaterSurfaceGPUModel")
export class WaterSurfaceGPUModel extends ANodeModel3D {
    boundingBox?: WaterBoundingBoxModel;
    renderMode: WaterRenderMode = "raymarch";
    densityMultiplier: number = 0.1;
    viewMarchStepSize: number = 0.01;
    maxViewSteps: number = 8192;
    tinyNudge: number = 0.001;

    // Rendering parameters (categories 1-8, 10 from shader survey)

    // 1. Volume scattering - RGB absorption coefficients
    scatteringCoefficients: Vec3 = V3(0.2, 0.5, 0.9);

    // 2. Surface detection thresholds
    surfaceOpacityThreshold: number = 0.3;  // Cumulative opacity for surface

    // 3. Edge hardening - opacity cutoff (higher = sharper edges)
    edgeCut: number = 0.35;
    maxOpacity: number = 0.95;

    // 4. Water color gradient
    shallowColor: Vec3 = V3(0.3, 0.9, 0.9);
    deepColor: Vec3 = V3(0.0, 0.2, 0.6);
    depthGradientScale: number = 1.0;

    // 5. Fresnel/rim lighting
    fresnelExponent: number = 3.0;
    rimColor: Vec3 = V3(0.8, 0.95, 1.0);
    fresnelBlend: number = 0.6;

    // 6. Lighting parameters
    lightDir: Vec3 = V3(0.3, 0.6, 0.7);
    specularShininess: number = 64.0;
    specularColor: Vec3 = V3(1.0, 1.0, 1.0);
    diffuseWeight: number = 0.15;
    specularWeight: number = 0.18;

    // 7. Refraction parameters
    refractionEta: number = 1.0 / 1.33;
    minRefractionThickness: number = 0.05;

    // 8. Refraction weighting
    thicknessNormFactor: number = 0.4;
    refractionBlend: number = 0.6;

    // 10. Normal computation
    normalEpsilonFactor: number = 0.02;
    specularNormalEpsilonFactor: number = 0.02;

    // 11. Shoreline effect (SDF-based)
    shorelineEnabled: boolean = true;
    shorelineColor: Vec3 = V3(1.0, 1.0, 1.0);  // White foam
    shorelineWidth: number = 0.5;
    shorelineIntensity: number = 0.8;
    shorelineRippleCount: number = 3.0;
    shorelineRippleSpeed: number = 2.0;

    // 12. Toon specular effect
    toonSpecularEnabled: boolean = true;

    getBoundsMin(): Vec3 {
        if (this.boundingBox) return this.boundingBox.getWorldMin();
        return V3(-1, -1, -1);
    }

    getBoundsMax(): Vec3 {
        if (this.boundingBox) return this.boundingBox.getWorldMax();
        return V3(1, 1, 1);
    }


    timeUpdate(t: number, ...args: any[]) {
        super.timeUpdate(t);
        this.signalEvent(WaterSurfaceEvents.UPDATE, t);
    }

    addUpdateListener(callback: (self: AObject) => void) {
        return this.addEventListener(WaterSurfaceEvents.UPDATE, callback);
    }
}