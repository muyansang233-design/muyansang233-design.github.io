/**
 * @file Main scene controller for GPGPU test
 * @description Controller that connects GPGPU models to views
 */

import { MainSceneModel } from "./MainSceneModel";
import {AGLContext, Color} from "../../anigraph";
import { ABasicSceneController, ADebugInteractionMode } from "../../anigraph/starter";
import { V3 } from "../../anigraph";

import * as THREE from "three";

// Import bounding box from original location
import { WaterBoundingBoxModel } from "../Main/Nodes/Tianyi-test1/WaterBoundingBox/WaterBoundingBoxModel";
import { WaterBoundingBoxView } from "../Main/Nodes/Tianyi-test1/WaterBoundingBox/WaterBoundingBoxView";
import { MyTerrainModel } from "../Main/Nodes/Terrain/MyTerrainModel";
import { TerrainView } from "../StarterCode/CustomNodes/Terrain";

import { WaterSurfaceGPUModel } from "./Nodes/WaterSurface/WaterSurfaceGPUModel";
import { WaterSurfaceGPUView } from "./Nodes/WaterSurface/WaterSurfaceGPUView";

import {
    TreeNode,
    TreeModel,
    TreeView, WindFieldView, LeafParticle, LeafParticleView,
} from "./Nodes/Jacky-test1/Tree";

import {WindFieldModel} from "./Nodes/Jacky-test1/Tree/WindFieldModel";
import {LeafParticleSystemModel} from "./Nodes/Jacky-test1/Tree/LeafParticleSystemModel";
import {AmbientLightModel} from "./Nodes/Jacky-test1/AmbientLightModel";

// Import GPGPU water
import { WaterGPGPUModel, WaterGPGPUView } from "./Nodes/WaterGPGPU";
import {TreeModelView} from "./Nodes/Jacky-test1/Tree/TreeModelView";
import { TerrainRenderModel, TerrainRenderView } from "./Nodes/TerrainRender";

/**
 * Main Controller class for GPGPU water simulation test
 */
export class MainSceneController extends ABasicSceneController {
    private rendererExposed: boolean = false;
    private keydownHandler?: (event: KeyboardEvent) => void;
    
    // 深度渲染相关
    private depthRenderTarget: THREE.WebGLRenderTarget | null = null;
    private waterSurfaceView: WaterSurfaceGPUView | null = null;

    // ===== 交互吸力：鼠标指针（NDC）+ Raycaster =====
    private pointerNDC: THREE.Vector2 = new THREE.Vector2(0, 0);
    private raycaster: THREE.Raycaster = new THREE.Raycaster();
    private rendererDomElement: HTMLCanvasElement | null = null;

    // ===== Debug 可视化：射线与命中点 =====
    private forceHitMarker: THREE.Mesh | null = null;
    private forceRayLine: THREE.Line | null = null;

    get model(): MainSceneModel {
        return this._model as MainSceneModel;
    }

    async initScene(): Promise<void> {
        await super.initScene();
        this.setClearColor(new Color(0.9529, 0.9215, 0.8666));
    }

    /**
     * Specify view classes for model classes
     */
    initModelViewSpecs() {
        super.initModelViewSpecs();

        // Register model-view pairs
        this.addModelViewSpec(WaterBoundingBoxModel, WaterBoundingBoxView);
        this.addModelViewSpec(WaterGPGPUModel, WaterGPGPUView);
        this.addModelViewSpec(MyTerrainModel, TerrainView);
        this.addModelViewSpec(TerrainRenderModel, TerrainRenderView);

        // NEW: marching-cubes water surface
        this.addModelViewSpec(WaterSurfaceGPUModel, WaterSurfaceGPUView);
        this.addModelViewSpec(TreeNode, TreeView);
        this.addModelViewSpec(TreeModel, TreeModelView);
        this.addModelViewSpec(WindFieldModel, WindFieldView);
        this.addModelViewSpec(LeafParticleSystemModel, TreeModelView);
        this.addModelViewSpec(LeafParticle, LeafParticleView);
    }

    /**
     * Animation frame callback
     */
    onAnimationFrameCallback(context: AGLContext) {
        // Expose renderer globally for GPGPU views (needed for GPUComputationRenderer)
        if (!this.rendererExposed) {
            (window as any).__THREE_RENDERER__ = context.renderer;
            this.rendererExposed = true;
            this.rendererDomElement = context.renderer.domElement as HTMLCanvasElement;
            
            // 确保 Three.js 按 renderOrder 排序对象
            context.renderer.sortObjects = true;

            // 初始化 GPGPU views
            this.initializeGPGPUViews(context.renderer);
        }

        // Update model
        this.model.timeUpdate(this.model.clock.time);

        // Update controller
        this.timeUpdate();

        // 交互外力：若开启，则每帧用鼠标射线更新吸力中心
        this.updateInteractiveForceFromMouse();

        // 每帧更新 WaterSurfaceGPUView 的屏幕分辨率（处理窗口 resize）
        this.updateWaterSurfaceScreenSize(context.renderer);
        
        // 更新相机近/远平面
        if (this.waterSurfaceView) {
            const cam = this.model.camera;
            this.waterSurfaceView.setCameraNearFar(cam.zNear, cam.zFar);
        }

        // === 两遍渲染以实现正确的深度遮挡 ===
        
        // 第一遍：渲染场景到深度 RenderTarget（隐藏水面）
        if (this.depthRenderTarget && this.waterSurfaceView) {
            // 隐藏水面
            const waterThreejs = (this.waterSurfaceView as any).threejs;
            if (waterThreejs) {
                waterThreejs.visible = false;
            }
            
            // 渲染到深度 RenderTarget
            context.renderer.setRenderTarget(this.depthRenderTarget);
            context.renderer.clear();
            context.renderer.render(this.getThreeJSScene(), this.getThreeJSCamera());
            
            // 恢复水面可见性
            if (waterThreejs) {
                waterThreejs.visible = true;
            }
            
            // 恢复渲染到屏幕
            context.renderer.setRenderTarget(null);
        }
        
        // 第二遍：正常渲染场景到屏幕（水面现在有深度信息）
        context.renderer.clear();
        context.renderer.render(this.getThreeJSScene(), this.getThreeJSCamera());
    }

    /**
     * 更新水面视图的屏幕分辨率和深度 RenderTarget 大小
     */
    private updateWaterSurfaceScreenSize(renderer: THREE.WebGLRenderer): void {
        if (!this.model.waterSurface) return;
        
        const size = new THREE.Vector2();
        renderer.getDrawingBufferSize(size);
        
        // 更新深度 RenderTarget 大小（如果尺寸变化）
        if (this.depthRenderTarget) {
            if (this.depthRenderTarget.width !== size.x || this.depthRenderTarget.height !== size.y) {
                this.depthRenderTarget.setSize(size.x, size.y);
                // 重新创建深度纹理
                this.depthRenderTarget.depthTexture = new THREE.DepthTexture(size.x, size.y);
                this.depthRenderTarget.depthTexture.format = THREE.DepthFormat;
                this.depthRenderTarget.depthTexture.type = THREE.UnsignedIntType;
                
                // 更新水面视图的深度纹理引用
                if (this.waterSurfaceView) {
                    this.waterSurfaceView.setDepthRenderTarget(this.depthRenderTarget);
                }
            }
        }
        
        const surfaceViews = this.getViewListForModel(this.model.waterSurface);
        for (const view of surfaceViews) {
            if (view instanceof WaterSurfaceGPUView) {
                view.setScreenSize(size.x, size.y);
            }
        }
    }

    /**
     * 修改后的初始化逻辑，带详细 Debug 日志
     */
    private initializeGPGPUViews(renderer: THREE.WebGLRenderer): void {
        let simulator: any = null;

        if (this.model.waterParticles) {
            const particleViews = this.getViewListForModel(this.model.waterParticles);
            for (const view of particleViews) {
                if (view instanceof WaterGPGPUView) {
                    view.setRenderer(renderer);
                    simulator = view.getFluidSimulator();
                    
                }
            }
        }

        if (this.model.waterSurface && simulator) {
            const surfaceViews = this.getViewListForModel(this.model.waterSurface);
            for (const view of surfaceViews) {
                if (view instanceof WaterSurfaceGPUView) {
                    view.setFluidSimulator(simulator);
                    view.setCamera(this.model.camera);
                    
                    const size = new THREE.Vector2();
                    renderer.getDrawingBufferSize(size);
                    view.setScreenSize(size.x, size.y);
                    
                    // 创建深度渲染目标
                    this.depthRenderTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
                        minFilter: THREE.NearestFilter,
                        magFilter: THREE.NearestFilter,
                        format: THREE.RGBAFormat,
                        type: THREE.UnsignedByteType,
                    });
                    // 添加深度纹理
                    this.depthRenderTarget.depthTexture = new THREE.DepthTexture(size.x, size.y);
                    this.depthRenderTarget.depthTexture.format = THREE.DepthFormat;
                    this.depthRenderTarget.depthTexture.type = THREE.UnsignedIntType;
                    
                    // 传递深度渲染目标给水面视图
                    view.setDepthRenderTarget(this.depthRenderTarget);
                    
                    // 设置相机近/远平面（从 ACamera 获取）
                    const cam = this.model.camera;
                    view.setCameraNearFar(cam.zNear, cam.zFar);
                    
                    // 保存引用以便每帧更新
                    this.waterSurfaceView = view;
                    
                    console.log("💧 WaterSurface initialized with depth texture, near:", cam.zNear, "far:", cam.zFar);
                }
            }
        }

        // 初始化 debug 可视化（只创建一次）
        this.ensureForceDebugVisuals();
    }

    /**
     * Initialize interactions
     */
    /**
     * Initialize interactions
     */
    initInteractions() {
        super.initInteractions();

        // Use debug interaction mode for camera controls
        this.setCurrentInteractionMode(ADebugInteractionMode.NameInGUI);

        this.setupKeyboardControls();
        this.setupMouseControls();

        // ===== 修正后的代码 =====
        // 因为 Model 里用了 addColorControl，这里的 value 直接就是 Color 对象
        this.subscribeToAppState("Background Color", (value: Color) => {
            // 1. 同步给 Model (虽然 Model 自己也在监听，但在 Controller 里做双保险也没问题，或者你可以只在这里做渲染设置)
            // this.model.backgroundColor = value;

            // 2. 直接设置渲染器背景色
            this.setClearColor(value);

        }, "Background Color Controller Subscription"); // 给个不同的名字防止冲突
    }

    /**
     * 设置键盘控制
     */
    private setupKeyboardControls() {
        const handleKeyDown = (event: KeyboardEvent) => {
            switch (event.key.toLowerCase()) {
                case 'p':
                    // p 键：开始/切换模拟
                    if (this.model.waterParticles) {
                        this.model.waterParticles.toggleSimulation();
                    }
                    break;
                case 'l':
                    // l 键：开启/关闭循环瀑布重生
                    if (this.model.waterParticles) {
                        this.model.waterParticles.toggleLoopWaterfall();
                    }
                    break;
                case 'v':
                    // V 键：开启/关闭交互吸力模式
                    if (this.model.waterParticles) {
                        this.model.waterParticles.toggleExternalForce();
                    }
                    break;
            }
        };

        // 添加全局键盘监听
        window.addEventListener('keydown', handleKeyDown);
        
        console.log("⌨️ 键盘控制已启用：");
        console.log("   P = 开始/切换模拟");
        console.log("   L = 开关循环瀑布重生");
        console.log("   V = 开关交互吸力（鼠标指向位置）");
    }

    /**
     * 记录鼠标位置（NDC: [-1,1]）用于射线
     */
    private setupMouseControls() {
        const onMove = (e: MouseEvent) => {
            // 始终使用 renderer 的 canvas rect（避免 e.target 不是 canvas 导致 NDC 错位）
            const rect = this.rendererDomElement?.getBoundingClientRect?.();
            const w = rect?.width ?? window.innerWidth;
            const h = rect?.height ?? window.innerHeight;
            const x = rect ? (e.clientX - rect.left) : e.clientX;
            const y = rect ? (e.clientY - rect.top) : e.clientY;
            this.pointerNDC.set((x / w) * 2 - 1, -(y / h) * 2 + 1);
        };
        window.addEventListener("mousemove", onMove);
    }

    /**
     * 若开启交互吸力模式，则从相机发射射线到鼠标指向位置，求与水体 AABB 的交点。
     * 命中时将该点写到 model.waterParticles.externalForceCenter，供 GPU 施力。
     */
    private updateInteractiveForceFromMouse() {
        const wp = this.model.waterParticles;
        if (!wp) return;
        if (!wp.externalForceEnabled) {
            wp.externalForceActive = false;
            // 关闭外力时隐藏 debug
            if (this.forceHitMarker) this.forceHitMarker.visible = false;
            if (this.forceRayLine) this.forceRayLine.visible = false;
            return;
        }

        const threeCam = this.getThreeJSCamera() as THREE.Camera;
        if (!threeCam) return;

        // 射线来自鼠标 NDC
        this.raycaster.setFromCamera(this.pointerNDC, threeCam);

        // 优先与容器 mesh 求交（这样才会出现“没命中”的红色射线）
        const scene = this.getThreeJSScene();
        const containerObj = scene?.getObjectByName("WaterContainerDebug") ?? null;
        if (containerObj) {
            const hits = this.raycaster.intersectObject(containerObj, true);
            if (hits.length > 0) {
                const p = hits[0].point;
                wp.externalForceCenter = V3(p.x, p.y, p.z);
                wp.externalForceActive = true;
                this.updateForceDebugVisuals(p);
                return;
            }
        }

        // fallback：与水体边界盒求交（使用当前 bounds）
        const bmin = wp.getBoundsMin();
        const bmax = wp.getBoundsMax();
        const box = new THREE.Box3(
            new THREE.Vector3(bmin.x, bmin.y, bmin.z),
            new THREE.Vector3(bmax.x, bmax.y, bmax.z)
        );
        const hit = new THREE.Vector3();
        const ok = this.raycaster.ray.intersectBox(box, hit);
        if (ok) {
            wp.externalForceCenter = V3(hit.x, hit.y, hit.z);
            wp.externalForceActive = true;
            this.updateForceDebugVisuals(hit);
        } else {
            wp.externalForceActive = false;
            this.updateForceDebugVisuals(null);
        }
    }

    private ensureForceDebugVisuals() {
        if (this.forceHitMarker && this.forceRayLine) return;
        const scene = this.getThreeJSScene();
        if (!scene) return;

        // 命中点小球
        const sphereGeo = new THREE.SphereGeometry(0.06, 12, 12);
        const sphereMat = new THREE.MeshBasicMaterial({ color: 0xff3333 });
        this.forceHitMarker = new THREE.Mesh(sphereGeo, sphereMat);
        this.forceHitMarker.visible = false;
        this.forceHitMarker.renderOrder = 999; // 尽量画在上层
        scene.add(this.forceHitMarker);

        // 射线线段（两点动态更新）
        const lineGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(6); // 2 points * vec3
        lineGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        const lineMat = new THREE.LineBasicMaterial({ color: 0xff3333 });
        this.forceRayLine = new THREE.Line(lineGeo, lineMat);
        this.forceRayLine.visible = false;
        this.forceRayLine.renderOrder = 998;
        scene.add(this.forceRayLine);
    }

    private updateForceDebugVisuals(hitPoint: THREE.Vector3 | null) {
        this.ensureForceDebugVisuals();
        const cam = this.getThreeJSCamera() as THREE.Camera | undefined;
        if (!cam || !this.forceHitMarker || !this.forceRayLine) return;

        const lineMat = this.forceRayLine.material as THREE.LineBasicMaterial;
        const sphereMat = this.forceHitMarker.material as THREE.MeshBasicMaterial;

        if (!hitPoint) {
            // 没命中：只显示一小段红色射线作为提示
            const origin = this.raycaster.ray.origin;
            const dir = this.raycaster.ray.direction;
            const end = origin.clone().add(dir.clone().multiplyScalar(2.0));

            this.forceHitMarker.visible = false;
            this.forceRayLine.visible = true;
            lineMat.color.setHex(0xff3333);

            const attr = this.forceRayLine.geometry.getAttribute("position") as THREE.BufferAttribute;
            attr.setXYZ(0, origin.x, origin.y, origin.z);
            attr.setXYZ(1, end.x, end.y, end.z);
            attr.needsUpdate = true;
            return;
        }

        // 命中：绿色线段 + 绿色点
        this.forceHitMarker.visible = true;
        this.forceRayLine.visible = true;
        sphereMat.color.setHex(0x33ff66);
        lineMat.color.setHex(0x33ff66);

        this.forceHitMarker.position.copy(hitPoint);
        const origin = this.raycaster.ray.origin;

        const attr = this.forceRayLine.geometry.getAttribute("position") as THREE.BufferAttribute;
        attr.setXYZ(0, origin.x, origin.y, origin.z);
        attr.setXYZ(1, hitPoint.x, hitPoint.y, hitPoint.z);
        attr.needsUpdate = true;
    }
}
