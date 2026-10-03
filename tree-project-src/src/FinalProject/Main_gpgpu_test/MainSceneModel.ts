/**
 * @file Main scene model for GPGPU test
 * @description Main model for GPGPU-based water simulation
 */

import {
    AppState,
    GetAppState,
    NodeTransform3D,
    V3,
    Vec3,
    Quaternion,
    Color
} from "../../anigraph";
import { ABasicSceneModel } from "../../anigraph/starter";
import { AssetManager } from "../../anigraph/fileio/AAssetManager";

// Import bounding box from original location
import { WaterBoundingBoxModel } from "../Main/Nodes/Tianyi-test1/WaterBoundingBox/WaterBoundingBoxModel";

// Import GPGPU water model
import { WaterGPGPUModel } from "./Nodes/WaterGPGPU";
import { WaterRenderMode } from "./Nodes/WaterGPGPU/WaterGPGPUModel";
import { WaterSurfaceGPUModel } from "./Nodes/WaterSurface/WaterSurfaceGPUModel";

import {
    TreeNode,
    TreeModel,
} from "./Nodes/Jacky-test1/Tree";

import {WindFieldModel} from "./Nodes/Jacky-test1/Tree/WindFieldModel";
import {LeafParticleSystemModel} from "./Nodes/Jacky-test1/Tree/LeafParticleSystemModel";
import {AmbientLightModel} from "./Nodes/Jacky-test1/AmbientLightModel";
import {Vector3} from "three";
import {colors} from "@mui/material";
import { TerrainRenderModel } from "./Nodes/TerrainRender";

/**
 * Main Model class for GPGPU water simulation test
 */
export class MainSceneModel extends ABasicSceneModel {
    waterParticles?: WaterGPGPUModel;
    waterBox?: WaterBoundingBoxModel;
    isPaused: boolean = false;

    waterSurface?: WaterSurfaceGPUModel;
    terrainRender?: TerrainRenderModel;
    // “水颜色”滑条使用：保存未色相偏移的基准颜色，避免反复拖动造成颜色累积漂移
    private baseShallowColor = V3(0.3, 0.9, 0.9);
    private baseDeepColor = V3(0.0, 0.2, 0.6);
    private baseRimColor = V3(0.8, 0.95, 1.0);
    private baseSpecularColor = V3(1.0, 1.0, 1.0);
    // 预设颜色/物理方案
    private waterPresets: Record<string, any> = {};
    private waterPresetOptions: string[] = ["default", "Tree Scene", "magma", "purebox", "pureboxMini", "pureboxZeroGravity", "pureboxHighViscosity", "terrain", "terrain_only"];
    // private waterPresetOptions: string[] = ["default", "Tree Scene", "green", "box4", "magma", "purebox","pureboxZeroGravity","pureboxHighViscosity","terrain"];
    private selectedWaterPreset: string = "default";
    private currentGlbModel: string = "./models/gltf/box_ripple_test3.glb";
    private availableModels: string[] = [];
    private selectedModel: string = "";
    // Raymarching Blinn-Phong lighting defaults（统一从这里注入 shader）
    private defaultLightDir = V3(0.3, 0.6, 0.7).times(0.01);
    private defaultSpecularColor = V3(1.0, 1.0, 1.0);
    private readonly presetStorageKey: string = "WaterPresetSelection";


    // FPS tracking
    currentFPS: number = 0;
    private frameCount: number = 0;
    private lastFPSUpdate: number = 0;
    private fpsUpdateInterval: number = 0.5;

    // Density tracking
    private lastDensityPrint: number = 0;
    private densityPrintInterval: number = 2.0; // Print every 2 seconds

    // JACKY: TREE
    treeModel!: TreeModel;
    windField!: WindFieldModel;
    leafParticles!: LeafParticleSystemModel;
    ambient!: AmbientLightModel;

    // 默认背景色：黑色（所有 box/water presets 默认都为黑）
    backgroundColor = new Color(0.0, 0.0, 0.0);
    
    async PreloadAssets(): Promise<void> {
        await super.PreloadAssets();
        
        // Load basic shaders
        await AssetManager.loadShaderMaterialModel(AssetManager.DEFAULT_MATERIALS.BLINNPHONG);

        // 读取水体颜色/物理预设
        try {
            const resp = await fetch("/config/water_presets.json");
            if (resp.ok) {
                this.waterPresets = await resp.json();
                this.waterPresetOptions = Object.keys(this.waterPresets);
                // 若存在一次性缓存（上一轮切换 glb 时存的），优先使用并清除；否则用第一个
                const oncePreset = sessionStorage.getItem(this.presetStorageKey);
                if (oncePreset && this.waterPresets[oncePreset]) {
                    this.selectedWaterPreset = oncePreset;
                    sessionStorage.removeItem(this.presetStorageKey);
                } else if (this.waterPresetOptions.length > 0) {
                    this.selectedWaterPreset = this.waterPresetOptions[0];
                }
                console.log("Loaded water presets:", this.waterPresetOptions);
                
                // Extract unique models from all presets
                const modelSet = new Set<string>();
                for (const presetName in this.waterPresets) {
                    const preset = this.waterPresets[presetName];
                    if (preset.glbModel) {
                        modelSet.add(preset.glbModel);
                    }
                }
                // Add default fallback model if not already present
                modelSet.add("./models/gltf/box_ripple_test3.glb");
                this.availableModels = Array.from(modelSet).sort();
                
                // Set initial selected model from current preset
                const presetGlb = (this.waterPresets[this.selectedWaterPreset] && this.waterPresets[this.selectedWaterPreset].glbModel)
                    ? this.waterPresets[this.selectedWaterPreset].glbModel
                    : "./models/gltf/box_ripple_test3.glb";
                this.selectedModel = presetGlb;
                this.currentGlbModel = presetGlb;
            } else {
                console.warn("Failed to load water presets json:", resp.status);
                // Fallback models if presets fail to load
                this.availableModels = ["./models/gltf/box_ripple_test3.glb"];
                this.selectedModel = "./models/gltf/box_ripple_test3.glb";
                this.currentGlbModel = "./models/gltf/box_ripple_test3.glb";
            }
        } catch (e) {
            console.warn("Error loading water presets:", e);
            // Fallback models if presets fail to load
            this.availableModels = ["./models/gltf/box_ripple_test3.glb"];
            this.selectedModel = "./models/gltf/box_ripple_test3.glb";
            this.currentGlbModel = "./models/gltf/box_ripple_test3.glb";
        }

        // 预加载 Blender 导出的瀑布容器模型，方便在场景中可视化和后续做 SDF
        // 路径相对于 public/ 目录，支持从预设中读取 glbModel
        const presetGlb = this.selectedModel;
        this.currentGlbModel = presetGlb;

        await AssetManager.load3DModel(
            presetGlb,
            "WaterfallTestContainer"
        );
        
        // Also load as TerrainContainer for terrain render/collision split
        await AssetManager.load3DModel(
            presetGlb,
            "TerrainContainer"
        );

        // 保留 glb 自带的旋转/缩放，并补偿坐标系差异：
        // 项目坐标物体沿 X 轴逆时针旋转 90° 即可对齐 Blender 坐标
        const glbWrapper = AssetManager.get3DModel("WaterfallTestContainer");
        if (glbWrapper) {
            const obj = glbWrapper.object as any;
            obj.updateMatrixWorld?.(true);
            const originalTransform = NodeTransform3D.FromThreeJSObject(obj);
            
            // 绕 X 轴逆时针旋转 90°（+π/2）补偿 Blender → 项目坐标系
            const coordFixRotation = Quaternion.RotationX(Math.PI / 2);
            originalTransform.rotation = coordFixRotation.times(originalTransform.rotation);
            
            glbWrapper.sourceTransform = originalTransform;
        }
        
        // Apply same transform to TerrainContainer
        const terrainWrapper = AssetManager.get3DModel("TerrainContainer");
        if (terrainWrapper) {
            const obj = terrainWrapper.object as any;
            obj.updateMatrixWorld?.(true);
            const originalTransform = NodeTransform3D.FromThreeJSObject(obj);
            
            const coordFixRotation = Quaternion.RotationX(Math.PI / 2);
            originalTransform.rotation = coordFixRotation.times(originalTransform.rotation);
            
            terrainWrapper.sourceTransform = originalTransform;
        }

        // Load visual-only model (not used for collision)
        // Replace "./models/gltf/your_visual_model.glb" with your actual model path
        // await AssetManager.load3DModel(
        //     "./models/gltf/your_visual_model.glb",
        //     "VisualOnlyModel"
        // );
    }
    
    /**
     * Initialize app state with control panel variables
     */
    initAppState(appState: AppState) {
        // Add React GUI for FPS display
        const { UpdateGUIWithFPS } = require("./MainSceneReactGUI");
        appState.setReactGUIBottomContentFunction(UpdateGUIWithFPS);
        // 默认背景色：黑色（可在 GUI 手动调整）
        appState.addColorControl("Background Color", new Color(0.0, 0.0, 0.0));
        
        // Simulation parameters (particle count and radius are fixed at init)
        // appState.addSliderIfMissing("WaterGravity", 5, 0, 30, 0.5);
        // appState.addSliderIfMissing("WaterCollisionDamping", 0.5, 0, 1, 0.01);
        // appState.addSliderIfMissing("PressureMultiplier", 70, 0, 1000, 1);
        // appState.addSliderIfMissing("NearPressureMultiplier", 200, 0, 2000, 10);
        // appState.addSliderIfMissing("SmoothingRadius", 0.2, 0.001, 1, 0.01);
        // appState.addSliderIfMissing("TargetDensity", 300, 10, 1500, 1);
        // appState.addSliderIfMissing("ViscosityStrength", 0.005, 0, 0.1, 0.0001); 

        // appState.addSliderIfMissing("WaterGravity", 8, -5, 30, 0.5);
        // appState.addSliderIfMissing("WaterCollisionDamping", 0.55, 0, 1, 0.01);
        // appState.addSliderIfMissing("PressureMultiplier", 300, 0, 1000, 1);
        // appState.addSliderIfMissing("NearPressureMultiplier", 3, 0, 100, 0.01);
        // appState.addSliderIfMissing("SmoothingRadius", 0.2, 0.001, 1, 0.01);
        // appState.addSliderIfMissing("TargetDensity", 320, 10, 1500, 1);
        // appState.addSliderIfMissing("ViscosityStrength", 0.001, 0, 0.1, 0.0001);

        appState.addSliderIfMissing("WaterGravity", 5, -5, 30, 0.5);
        appState.addSliderIfMissing("WaterCollisionDamping", 0.5, 0, 1, 0.01);
        appState.addSliderIfMissing("PressureMultiplier", 288, 0, 1000, 1);
        appState.addSliderIfMissing("NearPressureMultiplier", 50, 0, 1000, 0.1);
        appState.addSliderIfMissing("SmoothingRadius", 0.15, 0.001, 1, 0.01);
        appState.addSliderIfMissing("TargetDensity", 380, 10, 1500, 1);
        appState.addSliderIfMissing("ViscosityStrength", 0.001, 0, 0.5, 0.0001);

        appState.addSliderIfMissing("WaterDensityMultiplier", 0.2, 0.0001, 2.0, 0.0001);
        appState.addSliderIfMissing("WaterViewMarchStepSize", 0.01, 0.001, 0.1, 0.001);
        appState.addSliderIfMissing("WaterMaxViewSteps", 4096, 1, 4096, 1);
        appState.addSliderIfMissing("WaterTinyNudge", 0.01, 0.0001, 0.1, 0.0001);
        const presetOptions = this.waterPresetOptions && this.waterPresetOptions.length > 0
            ? this.waterPresetOptions
            : ["default", "magma", "Tree Scene"];

        appState.setState("WaterPreset", this.selectedWaterPreset);
        appState.setSelectionControl("WaterPreset", this.selectedWaterPreset, presetOptions);

        appState.addButton("ToggleLoopWaterfall", () => {
            if (this.waterParticles) {
                this.waterParticles.loopWaterfallEnabled = !this.waterParticles.loopWaterfallEnabled;
            }
        });

        appState.setSelectionControl("WaterRenderMode", "RayMarching", ["RayMarching", "Geometry"]);

        appState.addCheckboxControl("ShorelineEnabled", true);
        appState.addSliderIfMissing("ShorelineWidth", 0.07, 0.0, 1.0, 0.01);
        appState.addSliderIfMissing("ShorelineRippleSpeed", 0.8, 0.0, 2.0, 0.01);
        appState.addSliderIfMissing("ShorelineRippleCount", 3.0, 1.0, 20.0, 0.1); // Now controls noise frequency
        appState.addSliderIfMissing("ShorelineIntensity", 0.9, 0.0, 2.0, 0.01);

        // Toon Specular Toggle
        appState.addCheckboxControl("ToonSpecularEnabled", true);

        // Water rendering parameters (categories 1-8, 10)
        // 2. Surface detection - cumulative opacity threshold
        appState.addSliderIfMissing("SurfaceOpacityThreshold", 0.3, 0.0, 1.0, 0.01);

        // 3. Edge hardening - opacity cutoff and max opacity
        appState.addSliderIfMissing("EdgeCut", 0.35, 0.0, 1.0, 0.01);
        appState.addSliderIfMissing("MaxOpacity", 0.45, 0.0, 1.0, 0.01);

        // 4. Water color gradient scale
        appState.addSliderIfMissing("DepthGradientScale", 0.75, 0.1, 5.0, 0.01);

        // 5. Fresnel/rim lighting
        appState.addSliderIfMissing("FresnelExponent", 5.0, 0.1, 10.0, 0.1);
        appState.addSliderIfMissing("FresnelBlend", 0.6, 0.0, 1.0, 0.01);

        // 6. Lighting parameters
        appState.addSliderIfMissing("SpecularShininess", 300.0, 1.0, 1500.0, 1.0);
        appState.addSliderIfMissing("DiffuseWeight", 0.5, 0.0, 2.0, 0.01);
        appState.addSliderIfMissing("SpecularWeight", 0.8, 0.0, 2.0, 0.01);

        // 7. Refraction parameters (excluding refractionEta)
        appState.addSliderIfMissing("MinRefractionThickness", 0.0, 0.0, 1.0, 0.01);
        appState.addSliderIfMissing("ThicknessNormFactor", 0.0, 0.0, 2.0, 0.01);
        appState.addSliderIfMissing("RefractionBlend", 0.0, 0.0, 1.0, 0.01);

        // 10. Normal computation
        appState.addSliderIfMissing("NormalEpsilonFactor", 0.14, 0.001, 0.5, 0.001);
        appState.addSliderIfMissing("SpecularNormalEpsilonFactor", 0.02, 0.001, 0.5, 0.001);

        appState.addCheckboxControl("WindVisible", false);
        appState.addSliderIfMissing("Wind X", 1.0, -1.0, 1.0, 0.01);
        appState.addSliderIfMissing("Wind Y", 1.0, -1.0, 1.0, 0.01);
        appState.addSliderIfMissing("Wind Z", 0.0, -1.0, 1.0, 0.01);
        appState.addSliderIfMissing("Wind Strength", 0.5, 0.25, 4, 0.05);

        // ===== Water container button=====
        // 容器调试模型显示开关（绿色线框/浅灰实体的 WaterContainerDebug）
        appState.addCheckboxControl("WaterContainerVisible", true);
        // 白色 bounding box 线框显示开关（WaterBoundingBoxView）
        appState.addCheckboxControl("WaterBoundsVisible", true);
        // 容器纯色实体显示：不贴图/非线框，depthWrite=true（用于排查深度/遮挡问题）
        appState.addCheckboxControl("WaterContainerSolidDepthWrite", false);
        // 交互外力（V 键）强度滑条：影响 GPU 中 externalForceStrength（加速度量级）
        appState.addSliderIfMissing("ExternalForceStrength", 800.0, 0.0, 3000.0, 10.0);
        // 水的颜色（单滑条）：色相偏移（0 = 不改变 preset 颜色）
        appState.addSliderIfMissing("WaterHueShift", 0.0, -180.0, 180.0, 1.0);
    }

    
    initCamera(...args: any[]) {
        this.initPerspectiveCameraFOV(Math.PI / 2, 1.0);

        // 如果当前预设定义了 camera，则用预设的相机，否则用默认
        const cam =
            this.waterPresets &&
            this.waterPresets[this.selectedWaterPreset] &&
            this.waterPresets[this.selectedWaterPreset].camera;

        if (cam && cam.position && cam.target && cam.up) {
            const p = cam.position;
            const t = cam.target;
            const u = cam.up;
            this.camera.setPose(NodeTransform3D.LookAt(V3(p[0], p[1], p[2]), V3(t[0], t[1], t[2]), V3(u[0], u[1], u[2])));
        } else {
            this.camera.setPose(NodeTransform3D.LookAt(V3(-3, -4, 1), V3(0, 0, -1), V3(0, 0, 1)));
        }
    }

    /**
     * Check if it's time to print density (called by controller)
     */
    shouldPrintDensity(t: number): boolean {
        if (this.lastDensityPrint === 0) {
            this.lastDensityPrint = t;
            return false;
        }
        const densityElapsed = t - this.lastDensityPrint;
        if (densityElapsed >= this.densityPrintInterval) {
            this.lastDensityPrint = t;
            return true;
        }
        return false;
    }
    
    /**
     * Initialize scene content
     */
    initScene() {
        const appState = GetAppState();
        this.addViewLight();

        // 读取预设中的渲染/模拟包围盒参数
        const preset = this.waterPresets[this.selectedWaterPreset] ?? {};

        // 关键：GUI（AppState）是许多参数的 source-of-truth。
        // 如果不先把 preset 写回 AppState，那么 initScene 后面大量 appState.getState(...)
        // 会继续读取“GUI里原来的值/持久化值”，导致看起来 preset 怎么切都不生效。
        this.syncPresetToAppState(preset, appState);

        // Check if water should be disabled
        const waterEnabled = preset?.waterEnabled !== false; // Default to true if not specified
        
        if (!waterEnabled) {
            // Show terrain only; do NOT create wp/ws at all
            // Create terrain render model for visualization
            const terrainRender = new TerrainRenderModel();
            this.terrainRender = terrainRender;
            this.addNode(terrainRender);
            return;
        }

        const boxCenterArr = Array.isArray(preset.boxCenter) && preset.boxCenter.length === 3 ? preset.boxCenter : [0, 0, -1];
        const boxSizeArr = Array.isArray(preset.boxSize) && preset.boxSize.length === 3 ? preset.boxSize : [6, 6, 4];

        // Create bounding box
        const box = new WaterBoundingBoxModel();
        box.setFromCenterSize(V3(boxCenterArr[0], boxCenterArr[1], boxCenterArr[2]),
                              boxSizeArr[0], boxSizeArr[1], boxSizeArr[2]);
        // white frame botton
        if (typeof preset?.boundsVisible === "boolean") {
            box.visible = preset.boundsVisible;
        } else {
            box.visible = appState.getState("WaterBoundsVisible") ?? true;
        }
        this.waterBox = box;
        this.addNode(box);
        
        // Create GPGPU water particles (particle count and radius are fixed)
        const wp = new WaterGPGPUModel();
        wp.boundingBox = box;
        wp.renderMode = this.getRenderModeFromState(appState.getState("WaterRenderMode"));
        if (preset && typeof preset.particleCount === "number") {
            wp.particleCount = preset.particleCount;
        } else {
            wp.particleCount = 30000; // 默认
        }
        if (preset && typeof preset.gravity === "number") {
            wp.gravity = preset.gravity;
        } else {
            wp.gravity = appState.getState("WaterGravity") ?? 5;
        }
        wp.particleRadius = 0.02; // Fixed at init
        wp.collisionDamping = appState.getState("WaterCollisionDamping") ?? 0.5;
        wp.pressureMultiplier = appState.getState("PressureMultiplier") ?? 125;
        wp.nearPressureMultiplier = appState.getState("NearPressureMultiplier") ?? 650;
        wp.smoothingRadius = appState.getState("SmoothingRadius") ?? 0.25;
        wp.targetDensity = appState.getState("TargetDensity") ?? 200;
        if (preset && typeof preset.viscosity === "number") {
            wp.viscosityStrength = preset.viscosity;
        } else {
            wp.viscosityStrength = appState.getState("ViscosityStrength") ?? 0.5;
        }

        wp.jitterStrength = 0.001;
        wp.initialVelocity = V3(0, 0, -0.5);
        wp.spawnRegionScale = 0.95;        // 生成区域占 bounds 的比例
        wp.particleSpacing = 0.07;
        if (preset && Array.isArray(preset.spawnCenter) && preset.spawnCenter.length === 3) {
            wp.spawnCenter = V3(preset.spawnCenter[0], preset.spawnCenter[1], preset.spawnCenter[2]);
        } else {
            wp.spawnCenter = V3(0, 0, 0);     // 默认粒子生成中心
        }
        if (preset && Array.isArray(preset.respawnCenter) && preset.respawnCenter.length === 3) {
            wp.respawnCenter = V3(preset.respawnCenter[0], preset.respawnCenter[1], preset.respawnCenter[2]);
        } else {
            wp.respawnCenter = V3(0, 0, -0.2); // 默认重生中心
        }
        // respawn
        if (typeof preset?.respawnEnabled === "boolean") {
            wp.respawnEnabled = preset.respawnEnabled;
        } else {
            wp.respawnEnabled = true;
        }
        // respawn max
        if (typeof preset?.respawnMaxPerFrame === "number") {
            wp.respawnMaxPerFrame = preset.respawnMaxPerFrame;
        } else {
            wp.respawnMaxPerFrame = 50;
        }

        if (typeof preset?.containerWireframe === "boolean") {
            wp.containerWireframe = preset.containerWireframe;
        } else {
            wp.containerWireframe = false;
        }

        if (typeof preset?.containerVisible === "boolean") {
            wp.containerVisible = preset.containerVisible;
        } else {
            wp.containerVisible = appState.getState("WaterContainerVisible") ?? true;
        }

        if (typeof preset?.containerSolidDepthWrite === "boolean") {
            wp.containerSolidDepthWrite = preset.containerSolidDepthWrite;
        } else {
            wp.containerSolidDepthWrite = appState.getState("WaterContainerSolidDepthWrite") ?? false;
        }

        wp.externalForceStrength = appState.getState("ExternalForceStrength") ?? wp.externalForceStrength;
        wp.maxSpeed = 15.0;
        wp.sdfResolution = 256;
        wp.volumeResolution = 64;

        this.waterParticles = wp;
        this.addNode(wp);
        const ws = new WaterSurfaceGPUModel();
        ws.boundingBox = this.waterBox;
        ws.renderMode = this.getRenderModeFromState(appState.getState("WaterRenderMode"));
        ws.densityMultiplier = appState.getState("WaterDensityMultiplier") ?? ws.densityMultiplier;
        ws.viewMarchStepSize = appState.getState("WaterViewMarchStepSize") ?? ws.viewMarchStepSize;
        ws.maxViewSteps = appState.getState("WaterMaxViewSteps") ?? ws.maxViewSteps;
        ws.tinyNudge = 0.01;

        // Rendering parameters (categories 1-8, 10)
        // 1. Volume scattering - RGB absorption coefficients (hardcoded)
        ws.scatteringCoefficients = V3(0.2, 0.5, 0.9).times(0.3);

        // 2. Surface detection - cumulative opacity threshold
        ws.surfaceOpacityThreshold = appState.getState("SurfaceOpacityThreshold") ?? 0.3;

        // 3. Edge hardening - opacity cutoff (higher = sharper)
        ws.edgeCut = appState.getState("EdgeCut") ?? 0.35;
        ws.maxOpacity = appState.getState("MaxOpacity") ?? 0.5;

        // 4. Water color gradient (shallow cyan → deep blue) - hardcoded (excluded from sliders)
        ws.shallowColor = V3(0.3, 0.9, 0.9);
        ws.deepColor = V3(0.0, 0.2, 0.6);
        ws.depthGradientScale = appState.getState("DepthGradientScale") ?? 1.0;

        // 5. Fresnel/rim lighting
        ws.fresnelExponent = appState.getState("FresnelExponent") ?? 3.0;
        ws.rimColor = V3(0.8, 0.95, 1.0);  // Hardcoded
        ws.fresnelBlend = appState.getState("FresnelBlend") ?? 0.6;

        // 6. Lighting (fake sun + Blinn-Phong)  MainSceneModel
        const presetLightDir = Array.isArray(preset.lightDir) && preset.lightDir.length === 3
            ? V3(preset.lightDir[0], preset.lightDir[1], preset.lightDir[2])
            : this.defaultLightDir;
        ws.lightDir = presetLightDir;
        ws.specularShininess = appState.getState("SpecularShininess") ?? 164.0;
        const presetSpecularColor = Array.isArray(preset.specularColor) && preset.specularColor.length === 3
            ? V3(preset.specularColor[0], preset.specularColor[1], preset.specularColor[2])
            : this.defaultSpecularColor;
        ws.specularColor = presetSpecularColor;
        ws.diffuseWeight = appState.getState("DiffuseWeight") ?? 0.50;
        ws.specularWeight = appState.getState("SpecularWeight") ?? 0.6;

        // 7. Refraction parameters
        ws.refractionEta = 1.0 / 1.33;  // Hardcoded (excluded from sliders)
        ws.minRefractionThickness = appState.getState("MinRefractionThickness") ?? 0.05;

        // 8. Refraction weighting
        ws.thicknessNormFactor = appState.getState("ThicknessNormFactor") ?? 0.9;
        ws.refractionBlend = appState.getState("RefractionBlend") ?? 0.1;

        // 10. Normal computation - gradient epsilon
        ws.normalEpsilonFactor = appState.getState("NormalEpsilonFactor") ?? 0.1;
        ws.specularNormalEpsilonFactor = appState.getState("SpecularNormalEpsilonFactor") ?? 0.02;

        // Shoreline parameters
        ws.shorelineEnabled = appState.getState("ShorelineEnabled") ?? true;
        ws.shorelineWidth = appState.getState("ShorelineWidth") ?? 0.1;
        ws.shorelineIntensity = appState.getState("ShorelineIntensity") ?? 0.8;
        ws.shorelineRippleCount = appState.getState("ShorelineRippleCount") ?? 5.0;
        ws.shorelineRippleSpeed = appState.getState("ShorelineRippleSpeed") ?? 0.2;

        
        // 确保 AppState 与当前的 selectedWaterPreset 同步
        if (this.selectedWaterPreset) {
             appState.setState("WaterPreset", this.selectedWaterPreset);
             if (this.waterPresetOptions && this.waterPresetOptions.length > 0) {
                appState.setSelectionControl("WaterPreset", this.selectedWaterPreset, this.waterPresetOptions);
             }

        }

        this.applyWaterPreset(this.selectedWaterPreset, ws, wp);

        this.waterSurface = ws;
        this.addNode(ws);

        if (this.selectedWaterPreset === "Tree Scene") {
            const terrainRender = new TerrainRenderModel();
            this.terrainRender = terrainRender;
            this.addNode(terrainRender);

            let size = 10
            this.windField = new WindFieldModel(size, size, size);
            this.windField.globalWindStrength = 0.5;
            this.windField.globalWindDirection = new Vec3(0,0, 0);
            this.windField.transform.setPosition(new Vec3(-size/2, -size/2,0))
            this.addNode(this.windField);

            let scale = 0.4;
            // 注意：这里调用的是你下面的 helper function
            this.addTree(new Vec3(-0.85, 0, -0.1), new Vec3(0,0,-1), scale);
            this.addTree(new Vec3(2, -1.1, -0.3), new Vec3(0,0,-1), scale);
        }

        // Subscribe to parameter changes
        const self = this;
        
        this.subscribeToAppState("WaterGravity", (value: number) => {
            if (self.waterParticles) {
                self.waterParticles.gravity = value;
            }
        }, "WaterGravitySubscription");
        
        this.subscribeToAppState("WaterCollisionDamping", (value: number) => {
            if (self.waterParticles) {
                self.waterParticles.collisionDamping = value;
            }
        }, "WaterCollisionDampingSubscription");

        this.subscribeToAppState("PressureMultiplier", (value: number) => {
            if (self.waterParticles) {
                self.waterParticles.pressureMultiplier = value;
            }
        }, "PressureMultiplier");

        this.subscribeToAppState("NearPressureMultiplier", (value: number) => {
            if (self.waterParticles) {
                self.waterParticles.nearPressureMultiplier = value;
            }
        }, "NearPressureMultiplier");

        this.subscribeToAppState("SmoothingRadius", (value: number) => {
            if (self.waterParticles) {
                self.waterParticles.smoothingRadius = value;
            }
        }, "SmoothingRadius");

        this.subscribeToAppState("TargetDensity", (value: number) => {
            if (self.waterParticles) {
                self.waterParticles.targetDensity = value;
            }
        }, "TargetDensity");

        this.subscribeToAppState("ViscosityStrength", (value: number) => {
            if (self.waterParticles) {
                self.waterParticles.viscosityStrength = value;
            }
        }, "ViscosityStrength");

        // 交互外力（V 键）强度滑条
        this.subscribeToAppState("ExternalForceStrength", (value: number) => {
            if (self.waterParticles && typeof value === "number") {
                self.waterParticles.externalForceStrength = value;
            }
        }, "ExternalForceStrength");

        this.subscribeToAppState("WaterDensityMultiplier", (value: number) => {
            if (self.waterSurface) {
                self.waterSurface.densityMultiplier = value;
            }
        }, "WaterDensityMultiplier");

        this.subscribeToAppState("WaterViewMarchStepSize", (value: number) => {
            if (self.waterSurface) {
                self.waterSurface.viewMarchStepSize = value;
            }
        }, "WaterViewMarchStepSize");

        this.subscribeToAppState("WaterMaxViewSteps", (value: number) => {
            if (self.waterSurface) {
                self.waterSurface.maxViewSteps = value;
            }
        }, "WaterMaxViewSteps");

        this.subscribeToAppState("WaterRenderMode", (value: string) => {
            const mode = self.getRenderModeFromState(value);
            if (self.waterParticles) {
                self.waterParticles.renderMode = mode;
            }
            if (self.waterSurface) {
                self.waterSurface.renderMode = mode;
            }
        }, "WaterRenderMode");

        this.subscribeToAppState("ShorelineEnabled", (value: boolean) => {
            if (self.waterSurface) {
                self.waterSurface.shorelineEnabled = value;
            }
        }, "ShorelineEnabled");

        this.subscribeToAppState("ShorelineWidth", (value: number) => {
            if (self.waterSurface) {
                self.waterSurface.shorelineWidth = value;
            }
        }, "ShorelineWidth");

        this.subscribeToAppState("ShorelineRippleSpeed", (value: number) => {
            if (self.waterSurface) {
                self.waterSurface.shorelineRippleSpeed = value;
            }
        }, "ShorelineRippleSpeed");

        this.subscribeToAppState("ShorelineRippleCount", (value: number) => {
            if (self.waterSurface) {
                self.waterSurface.shorelineRippleCount = value;
            }
        }, "ShorelineRippleCount");

        this.subscribeToAppState("ShorelineIntensity", (value: number) => {
            if (self.waterSurface) {
                self.waterSurface.shorelineIntensity = value;
            }
        }, "ShorelineIntensity");

        this.subscribeToAppState("ToonSpecularEnabled", (value: boolean) => {
            if (self.waterSurface) {
                self.waterSurface.toonSpecularEnabled = value;
            }
        }, "ToonSpecularEnabled");

        // Water rendering parameter subscriptions
        // 2. Surface opacity threshold
        this.subscribeToAppState("SurfaceOpacityThreshold", (value: number) => {
            if (self.waterSurface) {
                self.waterSurface.surfaceOpacityThreshold = value;
            }
        }, "SurfaceOpacityThreshold");

        // 3. Edge hardening
        this.subscribeToAppState("EdgeCut", (value: number) => {
            if (self.waterSurface) {
                self.waterSurface.edgeCut = value;
            }
        }, "EdgeCut");

        this.subscribeToAppState("MaxOpacity", (value: number) => {
            if (self.waterSurface) {
                self.waterSurface.maxOpacity = value;
            }
        }, "MaxOpacity");

        this.subscribeToAppState("DepthGradientScale", (value: number) => {
            if (self.waterSurface) {
                self.waterSurface.depthGradientScale = value;
            }
        }, "DepthGradientScale");

        // 5. Fresnel/rim lighting
        this.subscribeToAppState("FresnelExponent", (value: number) => {
            if (self.waterSurface) {
                self.waterSurface.fresnelExponent = value;
            }
        }, "FresnelExponent");

        this.subscribeToAppState("FresnelBlend", (value: number) => {
            if (self.waterSurface) {
                self.waterSurface.fresnelBlend = value;
            }
        }, "FresnelBlend");

        // 6. Lighting parameters
        this.subscribeToAppState("SpecularShininess", (value: number) => {
            if (self.waterSurface) {
                self.waterSurface.specularShininess = value;
            }
        }, "SpecularShininess");

        this.subscribeToAppState("DiffuseWeight", (value: number) => {
            if (self.waterSurface) {
                self.waterSurface.diffuseWeight = value;
            }
        }, "DiffuseWeight");

        this.subscribeToAppState("SpecularWeight", (value: number) => {
            if (self.waterSurface) {
                self.waterSurface.specularWeight = value;
            }
        }, "SpecularWeight");

        // 7. Refraction parameters
        this.subscribeToAppState("MinRefractionThickness", (value: number) => {
            if (self.waterSurface) {
                self.waterSurface.minRefractionThickness = value;
            }
        }, "MinRefractionThickness");

        // 8. Refraction weighting
        this.subscribeToAppState("ThicknessNormFactor", (value: number) => {
            if (self.waterSurface) {
                self.waterSurface.thicknessNormFactor = value;
            }
        }, "ThicknessNormFactor");

        this.subscribeToAppState("RefractionBlend", (value: number) => {
            if (self.waterSurface) {
                self.waterSurface.refractionBlend = value;
            }
        }, "RefractionBlend");

        // 10. Normal computation
        this.subscribeToAppState("NormalEpsilonFactor", (value: number) => {
            if (self.waterSurface) {
                self.waterSurface.normalEpsilonFactor = value;
            }
        }, "NormalEpsilonFactor");

        this.subscribeToAppState("SpecularNormalEpsilonFactor", (value: number) => {
            if (self.waterSurface) {
                self.waterSurface.specularNormalEpsilonFactor = value;
            }
        }, "SpecularNormalEpsilonFactor");

        this.subscribeToAppState("WaterBoundsVisible", (value: boolean) => {
            if (typeof value === "boolean" && self.waterBox) {
                self.waterBox.visible = value;
            }
        }, "WaterBoundsVisible");

        this.subscribeToAppState("WaterContainerVisible", (value: boolean) => {
            if (self.waterParticles && typeof value === "boolean") {
                self.waterParticles.containerVisible = value;
            }
        }, "WaterContainerVisible");

        this.subscribeToAppState("WaterContainerSolidDepthWrite", (value: boolean) => {
            if (self.waterParticles && typeof value === "boolean") {
                self.waterParticles.containerSolidDepthWrite = value;
            }
        }, "WaterContainerSolidDepthWrite");

        this.subscribeToAppState("WaterHueShift", (value: number) => {
            self.applyWaterHueShift(value);
        }, "WaterHueShift");

        // ================== Wind Field Controls Subscription ==================

        this.subscribeToAppState("WindVisible", (value: boolean) => {
            if (self.windField) {
                self.windField._visible = value;

            }
        }, "WindVisible");

        this.subscribeToAppState("Wind Strength", (value: number) => {
            if (self.windField) {
                self.windField.globalWindStrength = value;
            }
        }, "Wind Strength");

        const updateWindDirection = () => {
            if (!self.windField) return;
            const x = appState.getState("Wind X") ?? 1.0;
            const y = appState.getState("Wind Y") ?? 1.0;
            const z = appState.getState("Wind Z") ?? 0.0;

            const dir = new Vec3(x, y, z);
            if (dir.length > 0.0001) {
                self.windField.globalWindDirection = dir.getNormalized();
            }
        };

        this.subscribeToAppState("Wind X", (value: number) => {
            updateWindDirection();
        }, "Wind X");

        this.subscribeToAppState("Wind Y", (value: number) => {
            updateWindDirection();
        }, "Wind Y");

        this.subscribeToAppState("Wind Z", (value: number) => {
            updateWindDirection();
        }, "Wind Z");

        // 预设切换
        this.subscribeToAppState("WaterPreset", (value: string) => {
            if (self.waterSurface) {
                const newPreset = value;
                if (newPreset === self.selectedWaterPreset) {
                    return;
                }

                sessionStorage.setItem(self.presetStorageKey, newPreset);
                console.warn(`WaterPreset changed to "${newPreset}". Reloading to rebuild scene and SDF...`);
                window.location.reload();
                return;
            }
        }, "WaterPreset");

        this.subscribeToAppState("Background Color", (value: Color) => {
            this.backgroundColor = value;
            this.signalComponentUpdate();
        }, "Background Color");


    }

    /**
     * 在隐形星球表面种树
     * @param planetCenter 星球的球心位置 (Vec3)
     * @param planetRadius 星球的半径 (number)
     * @param localDirection 从球心指向树的方向向量 (Vec3)，决定树种在哪一侧
     * @param scale 树的大小
     */
    addTreeOnPlanet(planetCenter: Vec3, planetRadius: number, localDirection: Vec3, scale: number) {
        // 1. Calculate Normal (计算法线/生长方向)
        // 任何球体表面的法线，就是从球心指向该点的单位向量
        const normal = localDirection.getNormalized();

        // 2. Calculate Position (计算球体表面的确切坐标)
        // 位置 = 球心 + (方向 * 半径)
        const position = planetCenter.plus(normal.times(planetRadius));

        // 3. Call your original function (调用原本的种树函数)
        // 此时 position 就在球面上，且 normal 垂直于球面
        this.addTree(position, normal, scale);
    }

    private addTree(pos: Vec3, dir:Vec3 = new Vec3(0,1,0), scale=1) {
        let tree = new TreeModel(
            3,
            5,
            5,
            this.windField,
            this.camera,
            pos,
            dir,
            scale
        )

        this.addNode(tree)

        let leafSystem = new LeafParticleSystemModel(
            tree.leaves,
            this.windField,
            tree,
            scale
        )

        this.addNode(leafSystem)
    }

    /**
     * 将 preset 中出现的参数，统一同步到 AppState（GUI）中。
     * 这样：
     * 1) initScene 里通过 appState.getState(...) 读到的就是 preset 的值
     * 2) 已经注册到 GUI 的参数也能被 preset “强制覆盖”
     *
     * 规则：只有当 preset 提供该字段时才覆盖；否则保留当前 AppState（用户手调/持久化）的值。
     */
    private syncPresetToAppState(preset: any, appState: AppState) {
        // Leva 的控件显示值来自 GUIControlSpecs[*].value，而不一定会随着 setState 自动变化。
        // 因此这里同时：
        // 1) setState 更新 AppState（驱动订阅/模型）
        // 2) 更新 GUIControlSpecs 中的 value（驱动 Leva 显示）
        // 3) 最后只调用一次 updateControlPanel() 让 Leva store 重新初始化

        let didMutateGUI = false;

        const setGUI = (key: string, value: any) => {
            // 先更新 state（触发订阅）
            appState.setState(key, value);

            // 再尝试更新 GUI control spec 的显示值
            const spec: any = (appState as any).GUIControlSpecs?.[key];
            if (spec && typeof spec === "object" && "value" in spec) {
                spec.value = value;
                didMutateGUI = true;
            }
        };

        // --- 物理/模拟（与 GUI key 对齐） ---
        if (typeof preset.gravity === "number") setGUI("WaterGravity", preset.gravity);
        if (typeof preset.collisionDamping === "number") setGUI("WaterCollisionDamping", preset.collisionDamping);
        if (typeof preset.pressureMultiplier === "number") setGUI("PressureMultiplier", preset.pressureMultiplier);
        if (typeof preset.nearPressureMultiplier === "number") setGUI("NearPressureMultiplier", preset.nearPressureMultiplier);
        if (typeof preset.smoothingRadius === "number") setGUI("SmoothingRadius", preset.smoothingRadius);
        if (typeof preset.targetDensity === "number") setGUI("TargetDensity", preset.targetDensity);
        // 预设里叫 viscosity；GUI/model 里叫 ViscosityStrength/viscosityStrength
        if (typeof preset.viscosity === "number") setGUI("ViscosityStrength", preset.viscosity);

        // --- 渲染（与 GUI key 对齐） ---
        if (typeof preset.edgeCut === "number") setGUI("EdgeCut", preset.edgeCut);
        if (typeof preset.maxOpacity === "number") setGUI("MaxOpacity", preset.maxOpacity);
        if (typeof preset.shorelineEnabled === "boolean") setGUI("ShorelineEnabled", preset.shorelineEnabled);
        // 渲染模式（RayMarching / Geometry）
        if (typeof preset.waterRenderMode === "string") setGUI("WaterRenderMode", preset.waterRenderMode);
        if (typeof preset.containerSolidDepthWrite === "boolean") setGUI("WaterContainerSolidDepthWrite", preset.containerSolidDepthWrite);

        // 可选：如果你在 presets 里加入这些字段，也能自动同步到 GUI
        if (typeof preset.surfaceOpacityThreshold === "number") setGUI("SurfaceOpacityThreshold", preset.surfaceOpacityThreshold);
        if (typeof preset.depthGradientScale === "number") setGUI("DepthGradientScale", preset.depthGradientScale);
        if (typeof preset.fresnelExponent === "number") setGUI("FresnelExponent", preset.fresnelExponent);
        if (typeof preset.fresnelBlend === "number") setGUI("FresnelBlend", preset.fresnelBlend);
        if (typeof preset.specularShininess === "number") setGUI("SpecularShininess", preset.specularShininess);
        if (typeof preset.diffuseWeight === "number") setGUI("DiffuseWeight", preset.diffuseWeight);
        if (typeof preset.specularWeight === "number") setGUI("SpecularWeight", preset.specularWeight);
        if (typeof preset.minRefractionThickness === "number") setGUI("MinRefractionThickness", preset.minRefractionThickness);
        if (typeof preset.thicknessNormFactor === "number") setGUI("ThicknessNormFactor", preset.thicknessNormFactor);
        if (typeof preset.refractionBlend === "number") setGUI("RefractionBlend", preset.refractionBlend);
        if (typeof preset.normalEpsilonFactor === "number") setGUI("NormalEpsilonFactor", preset.normalEpsilonFactor);
        if (typeof preset.specularNormalEpsilonFactor === "number") setGUI("SpecularNormalEpsilonFactor", preset.specularNormalEpsilonFactor);
        if (typeof preset.toonSpecularEnabled === "boolean") setGUI("ToonSpecularEnabled", preset.toonSpecularEnabled);

        // 体积渲染
        if (typeof preset.waterDensityMultiplier === "number") setGUI("WaterDensityMultiplier", preset.waterDensityMultiplier);
        if (typeof preset.waterViewMarchStepSize === "number") setGUI("WaterViewMarchStepSize", preset.waterViewMarchStepSize);
        if (typeof preset.waterMaxViewSteps === "number") setGUI("WaterMaxViewSteps", preset.waterMaxViewSteps);
        if (typeof preset.waterTinyNudge === "number") setGUI("WaterTinyNudge", preset.waterTinyNudge);

        if (didMutateGUI) {
            appState.updateControlPanel();
        }
    }

    /**
     * 应用水体预设（颜色/散射/边缘/黏度）
     * 统一参数更新逻辑：确保所有可在运行时更新的参数都能正确更新
     */
    private applyWaterPreset(presetName: string, ws: WaterSurfaceGPUModel, wp?: WaterGPGPUModel) {
        const appState = GetAppState();
        const preset = this.waterPresets[presetName];
        if (!preset) {
            console.warn(`Water preset "${presetName}" not found, keep current values.`);
            return;
        }

        // default background
        let targetBgColor = new Color(0.0, 0.0, 0.0);
        if (Array.isArray(preset.backgroundColor) && preset.backgroundColor.length === 3) {
            targetBgColor = new Color(preset.backgroundColor[0], preset.backgroundColor[1], preset.backgroundColor[2]);
        }
        this.backgroundColor = targetBgColor;
        appState.setState("Background Color", targetBgColor);

        // ========== WaterSurfaceGPUModel 参数 ==========

        if (preset.shallowColor && Array.isArray(preset.shallowColor) && preset.shallowColor.length === 3) {
            ws.shallowColor = V3(preset.shallowColor[0], preset.shallowColor[1], preset.shallowColor[2]);
        }
        if (preset.deepColor && Array.isArray(preset.deepColor) && preset.deepColor.length === 3) {
            ws.deepColor = V3(preset.deepColor[0], preset.deepColor[1], preset.deepColor[2]);
        }
        if (preset.rimColor && Array.isArray(preset.rimColor) && preset.rimColor.length === 3) {
            ws.rimColor = V3(preset.rimColor[0], preset.rimColor[1], preset.rimColor[2]);
        }
        if (preset.specularColor && Array.isArray(preset.specularColor) && preset.specularColor.length === 3) {
            ws.specularColor = V3(preset.specularColor[0], preset.specularColor[1], preset.specularColor[2]);
        }
        if (preset.scattering && Array.isArray(preset.scattering) && preset.scattering.length === 3) {
            ws.scatteringCoefficients = V3(preset.scattering[0], preset.scattering[1], preset.scattering[2]);
        }

        this.baseShallowColor = ws.shallowColor;
        this.baseDeepColor = ws.deepColor;
        this.baseRimColor = ws.rimColor;
        this.baseSpecularColor = ws.specularColor;
        this.applyWaterHueShift(appState.getState("WaterHueShift") ?? 0.0);

        if (typeof preset.edgeCut === "number") {
            ws.edgeCut = preset.edgeCut;
            appState.setState("EdgeCut", preset.edgeCut);
        }
        if (typeof preset.maxOpacity === "number") {
            ws.maxOpacity = preset.maxOpacity;
            appState.setState("MaxOpacity", preset.maxOpacity);
        }

        // 3. Lighting (LightDir)
        if (Array.isArray(preset.lightDir) && preset.lightDir.length === 3) {
            ws.lightDir = V3(preset.lightDir[0], preset.lightDir[1], preset.lightDir[2]);
        } else {
            ws.lightDir = this.defaultLightDir;
        }

        // 4. Shoreline
        if (typeof preset.shorelineEnabled === "boolean") {
            ws.shorelineEnabled = preset.shorelineEnabled;
            appState.setState("ShorelineEnabled", preset.shorelineEnabled);
        } else {
            ws.shorelineEnabled = true;
            appState.setState("ShorelineEnabled", true);
        }

        // Shoreline color
        if (Array.isArray(preset.shorelineColor) && preset.shorelineColor.length === 3) {
            ws.shorelineColor = V3(preset.shorelineColor[0], preset.shorelineColor[1], preset.shorelineColor[2]);
        }

        // ============ WaterGPGPUModel ===============
        if (!wp) return;

        // 5. Gravity
        if (typeof preset.gravity === "number") {
            wp.gravity = preset.gravity;
            appState.setState("WaterGravity", preset.gravity);
        }

        // 6. Viscosity
        if (typeof preset.viscosity === "number") {
            wp.viscosityStrength = preset.viscosity;
            appState.setState("ViscosityStrength", preset.viscosity);
        }

        // 7. respawn
        if (Array.isArray(preset.spawnCenter) && preset.spawnCenter.length === 3) {
            wp.spawnCenter = V3(preset.spawnCenter[0], preset.spawnCenter[1], preset.spawnCenter[2]);
        }
        
        if (Array.isArray(preset.respawnCenter) && preset.respawnCenter.length === 3) {
            wp.respawnCenter = V3(preset.respawnCenter[0], preset.respawnCenter[1], preset.respawnCenter[2]);
        }

        if (typeof preset.respawnEnabled === "boolean") {
            wp.respawnEnabled = preset.respawnEnabled;
        }

        if (typeof preset.respawnMaxPerFrame === "number") {
            wp.respawnMaxPerFrame = preset.respawnMaxPerFrame;
        } else {
            wp.respawnMaxPerFrame = 50; // Default fallback
        }

        // 8. 容器显示相关
        if (typeof preset.containerWireframe === "boolean") {
            wp.containerWireframe = preset.containerWireframe;
        } else {
            wp.containerWireframe = false;
        }

        // 容器可见性（GUI + preset）
        if (typeof preset.containerVisible === "boolean") {
            wp.containerVisible = preset.containerVisible;
            appState.setState("WaterContainerVisible", preset.containerVisible);
        }
        // 白色 bounding box 可见性（GUI + preset）
        if (typeof preset.boundsVisible === "boolean") {
            if (this.waterBox) {
                this.waterBox.visible = preset.boundsVisible;
            }
            appState.setState("WaterBoundsVisible", preset.boundsVisible);
        }

        // ========== 注意：以下参数需要在 initScene 阶段设置，运行时无法更新 ===========================
        // - particleCount: 需要重新创建 FluidSimulator
        // - boxCenter, boxSize: 需要重新创建 WaterBoundingBoxModel
        // - camera: 在 initCamera 中处理
        // - glbModel: 触发页面刷新
    }
    private getRenderModeFromState(value: string | undefined): WaterRenderMode {
        if (value === "Geometry") return "geometry";
        return "raymarch";
    }

    // =====（Hue Shift） =====
    private clamp01(x: number) {
        return Math.max(0, Math.min(1, x));
    }

    // RGB[0..1] -> HSV(h[0..360), s,v[0..1])
    private rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;
        let h = 0;
        if (d !== 0) {
            if (max === r) h = ((g - b) / d) % 6;
            else if (max === g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
            h *= 60;
            if (h < 0) h += 360;
        }
        const s = max === 0 ? 0 : d / max;
        const v = max;
        return { h, s, v };
    }

    // HSV -> RGB[0..1]
    private hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
        const c = v * s;
        const hh = ((h % 360) + 360) % 360;
        const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
        const m = v - c;
        let rp = 0, gp = 0, bp = 0;
        if (hh < 60) { rp = c; gp = x; bp = 0; }
        else if (hh < 120) { rp = x; gp = c; bp = 0; }
        else if (hh < 180) { rp = 0; gp = c; bp = x; }
        else if (hh < 240) { rp = 0; gp = x; bp = c; }
        else if (hh < 300) { rp = x; gp = 0; bp = c; }
        else { rp = c; gp = 0; bp = x; }
        return { r: rp + m, g: gp + m, b: bp + m };
    }

    private applyWaterHueShift(deg: number) {
        if (!this.waterSurface) return;
        const shift = typeof deg === "number" ? deg : 0;

        const shiftColor = (c: any) => {
            const r = (c?.x ?? 0), g = (c?.y ?? 0), b = (c?.z ?? 0);
            const hsv = this.rgbToHsv(r, g, b);
            const rgb = this.hsvToRgb(hsv.h + shift, hsv.s, hsv.v);
            return V3(this.clamp01(rgb.r), this.clamp01(rgb.g), this.clamp01(rgb.b));
        };

        this.waterSurface.shallowColor = shiftColor(this.baseShallowColor);
        this.waterSurface.deepColor = shiftColor(this.baseDeepColor);
        this.waterSurface.rimColor = shiftColor(this.baseRimColor);
        this.waterSurface.specularColor = shiftColor(this.baseSpecularColor);
    }
    
    /**
     * Time update
     */
    timeUpdate(t?: number): void;
    timeUpdate(...args: any[]) {
        let t = this.clock.time;
        if (args !== undefined && args.length > 0) {
            t = args[0];
        }
        
        // Update FPS counter
        this.frameCount++;
        if (this.lastFPSUpdate === 0) {
            this.lastFPSUpdate = t;
        }
        const elapsed = t - this.lastFPSUpdate;
        if (elapsed >= this.fpsUpdateInterval) {
            this.currentFPS = this.frameCount / elapsed;
            this.frameCount = 0;
            this.lastFPSUpdate = t;
        }
        
        // if (this.isPaused) {
        //     if (this.waterParticles) {
        //         this.waterParticles.resetLastTime(t);
        //     }
        //     GetAppState().updateComponents();
        //     return;
        // }

        // Update all nodes
        for (const node of this.getNodeModels()) {
            node.timeUpdate(t);
        }

        // Update React GUI
        GetAppState().updateComponents();
    }
}
