/**
 * WaterGPGPUView - View for GPGPU-based water particle rendering
 * 
 * This view creates geometry with 'reference' attributes that allow
 * the vertex shader to look up particle positions from a texture.
 */

import * as THREE from "three";
import {
    ANodeView,
    NodeTransform3D,
    AssetManager,
} from "../../../../anigraph";
import { WaterGPGPUModel } from "./WaterGPGPUModel";
import { FluidSimulator, FluidSimulatorParams } from "../../FluidSimulator";

// Shaders in this view file are specific to rendering water particles, not physical simulation

// Vertex shader - reads position from texture
const particleVertexShader = /*glsl*/`
attribute vec2 reference;

uniform sampler2D texturePosition;
uniform float particleRadius;

varying vec3 vPosition;

void main() {
    // Read particle position from texture
    vec4 posData = texture2D(texturePosition, reference);
    vec3 particlePos = posData.xyz;
    
    // Scale the sphere vertex and translate to particle position
    vec3 transformed = position * particleRadius + particlePos;
    
    vPosition = transformed;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
}
`;

// Fragment shader - simple blue water color
const particleFragmentShader =/*glsl*/`
varying vec3 vPosition;

void main() {
    // Simple blue water color
    gl_FragColor = vec4(0.2, 0.5, 1.0, 0.8);
}
`;

/**
 * Custom geometry that includes 'reference' attribute for texture lookup
 */
class WaterParticleGeometry extends THREE.BufferGeometry {
    constructor(particleCount: number, textureWidth: number) {
        super();
        
        console.log(`WaterParticleGeometry: Creating geometry for ${particleCount} particles, textureWidth=${textureWidth}`);
        
        // Use SphereGeometry which has proper indices
        const sphereGeom = new THREE.SphereGeometry(1, 6, 4); // radius 1, low poly for performance
        const spherePositions = sphereGeom.getAttribute("position").array;
        
        // Ensure we have indices
        let sphereIndicesArray: ArrayLike<number>;
        const indexAttr = sphereGeom.getIndex();
        if (indexAttr) {
            sphereIndicesArray = indexAttr.array;
        } else {
            const numVertices = spherePositions.length / 3;
            const tempIndices = new Uint16Array(numVertices);
            for (let i = 0; i < numVertices; i++) {
                tempIndices[i] = i;
            }
            sphereIndicesArray = tempIndices;
        }
        
        const verticesPerSphere = spherePositions.length / 3;
        const indicesPerSphere = sphereIndicesArray.length;
        
        console.log(`  Sphere template: ${verticesPerSphere} vertices, ${indicesPerSphere} indices`);
        
        // Allocate arrays for all particles
        const totalVertices = particleCount * verticesPerSphere;
        const totalIndices = particleCount * indicesPerSphere;
        
        const positions = new Float32Array(totalVertices * 3);
        const references = new Float32Array(totalVertices * 2);
        const indices = new Uint32Array(totalIndices);
        
        // Fill arrays
        for (let p = 0; p < particleCount; p++) {
            // Calculate texture UV for this particle
            // The texture is textureWidth x textureWidth
            // Particle p is at texel (p % textureWidth, floor(p / textureWidth))
            // UV coordinates should be in [0, 1] range, sampling center of texel
            const texelX = p % textureWidth;
            const texelY = Math.floor(p / textureWidth);
            const refX = (texelX + 0.5) / textureWidth;
            const refY = (texelY + 0.5) / textureWidth;
            
            // Debug first few particles
            // if (p < 3) {
            //     console.log(`  Particle ${p}: texel (${texelX}, ${texelY}), ref (${refX.toFixed(4)}, ${refY.toFixed(4)})`);
            // }
            
            // Copy sphere vertices for this particle
            for (let v = 0; v < verticesPerSphere; v++) {
                const vertexIndex = p * verticesPerSphere + v;

                positions[vertexIndex * 3 + 0] = spherePositions[v * 3 + 0];
                positions[vertexIndex * 3 + 1] = spherePositions[v * 3 + 1];
                positions[vertexIndex * 3 + 2] = spherePositions[v * 3 + 2];

                references[vertexIndex * 2 + 0] = refX;
                references[vertexIndex * 2 + 1] = refY;
            }
            
            // Copy indices with offset
            const indexOffset = p * verticesPerSphere;
            for (let i = 0; i < indicesPerSphere; i++) {
                indices[p * indicesPerSphere + i] = sphereIndicesArray[i] + indexOffset;
            }
        }
        
        this.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        this.setAttribute("reference", new THREE.BufferAttribute(references, 2));
        this.setIndex(new THREE.BufferAttribute(indices, 1));
        
        console.log(`  Total: ${totalVertices} vertices, ${totalIndices} indices`);
        
        sphereGeom.dispose();
    }
}

export class WaterGPGPUView extends ANodeView {
    private particleMesh?: THREE.Mesh;
    private particleMaterial?: THREE.ShaderMaterial;
    private containerObject?: THREE.Object3D; // Store reference to container for visibility control
    private fluidSimulator?: FluidSimulator;
    private debugLogged: boolean = false;
    private isInitialized: boolean = false;
    private renderer?: THREE.WebGLRenderer;
    private sdfCollisionInitialized: boolean = false;
    private ellipsoidWire?: THREE.LineSegments;
    private lastSdfCheckTime: number = 0;
    private sdfCheckInterval: number = 1.0; // seconds between SDF checks
    private sdfCheckTolerance: number = 0.1; // world units tolerance
    
    get model(): WaterGPGPUModel {
        return this._model as WaterGPGPUModel;
    }

    /**
     * Create a bowl-shaped mesh using a quadratic surface
     * Bowl opens in +z direction, bottom aligned with box bottom
     */
    private createBowlMesh(radiusX: number, radiusY: number, depth: number): THREE.BufferGeometry {
        // IMPORTANT: segments^2 * 2 = number of triangles
        // SDF shader has a loop limit, so keep triangles within that limit
        // 16 segments = 16*16*2 = 512 triangles (matches shader limit)
        const segments = 16;
        const geometry = new THREE.BufferGeometry();

        const positions: number[] = [];
        const indices: number[] = [];

        // Generate vertices for the bowl
        // Opening in +z direction: z = depth * r^2
        // Bottom at z = 0, opens toward +z
        for (let i = 0; i <= segments; i++) {
            const u = i / segments; // 0 to 1
            for (let j = 0; j <= segments; j++) {
                const v = j / segments; // 0 to 1

                // Polar coordinates for circular bowl
                const theta = u * Math.PI * 2; // 0 to 2π
                const r = v; // 0 to 1 (normalized radius)

                // Position on bowl (in x-y plane at origin)
                const x = r * radiusX * Math.cos(theta);
                const y = r * radiusY * Math.sin(theta);

                // Quadratic depth: z = depth * r^2
                // r=0: z=0 (bottom of bowl)
                // r=1: z=depth (opening edge)
                const z = depth * r * r;

                positions.push(x, y, z);
            }
        }

        // Generate indices
        // Need to reverse winding order so normals point INWARD (upward for a bowl)
        for (let i = 0; i < segments; i++) {
            for (let j = 0; j < segments; j++) {
                const a = i * (segments + 1) + j;
                const b = a + segments + 1;
                const c = a + 1;
                const d = b + 1;

                // Two triangles per quad - reversed winding for inward normals
                indices.push(a, c, b);
                indices.push(b, c, d);
            }
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        console.log(`Bowl mesh: ${positions.length / 3} vertices, ${indices.length / 3} triangles`);

        return geometry;
    }
    
    init(): void {
        const self = this;

        // Subscribe to model updates - this is called every frame by model.timeUpdate()
        this.subscribe(
            this.model.addParticlesListener(() => {
                // When model signals update, run the simulation and update the view
                self.runSimulationStep();
            })
        );

        // We'll initialize the simulator and mesh lazily when we have access to the renderer
        // This is because GPUComputationRenderer needs the WebGLRenderer
    }
    
    /**
     * Initialize the fluid simulator (called when we have access to renderer)
     */
    private initializeSimulator(renderer: THREE.WebGLRenderer): void {
        if (this.isInitialized) return;
        
        console.log("WaterGPGPUView: Initializing simulator...");
        console.log(`  particleCount: ${this.model.particleCount}`);
        console.log(`  boundsMin: ${this.model.getBoundsMin()}`);
        console.log(`  boundsMax: ${this.model.getBoundsMax()}`);
        
        const params: FluidSimulatorParams = {
            particleCount: this.model.particleCount,
            gravity: this.model.gravity,
            collisionDamping: this.model.collisionDamping,
            particleRadius: this.model.particleRadius,
            boundsMin: this.model.getBoundsMin(),
            boundsMax: this.model.getBoundsMax(),

            // SPH
            smoothingRadius: this.model.smoothingRadius,
            targetDensity: this.model.targetDensity,
            pressureMultiplier: this.model.pressureMultiplier,
            nearPressureMultiplier: this.model.nearPressureMultiplier,
            particleMass: this.model.particleMass,
            viscosityStrength: this.model.viscosityStrength,
            maxSpeed: this.model.maxSpeed,

            // Particle init
            jitterStrength: this.model.jitterStrength,
            initialVelocity: this.model.initialVelocity,
            spawnRegionScale: this.model.spawnRegionScale,
            particleSpacing: this.model.particleSpacing,
            spawnCenter: this.model.spawnCenter ?? undefined,
            respawnCenter: this.model.respawnCenter ?? undefined,
            respawnEnabled: this.model.respawnEnabled,
            respawnMaxPerFrame: this.model.respawnMaxPerFrame,
            enableLoopWaterfall: this.model.loopWaterfallEnabled,
            sdfResolution: this.model.sdfResolution,
            volumeResolution: this.model.volumeResolution,
        };
        
        this.fluidSimulator = new FluidSimulator(renderer, params);
        const textureWidth = this.fluidSimulator.getTextureWidth();
        const particleCount = this.fluidSimulator.getParticleCount();
        const geometry = new WaterParticleGeometry(particleCount, textureWidth);
        const initialPosTexture = this.fluidSimulator.getPositionTexture();
        
        this.particleMaterial = new THREE.ShaderMaterial({
            uniforms: {
                texturePosition: { value: initialPosTexture },
                particleRadius: { value: this.model.particleRadius },
            },
            vertexShader: particleVertexShader,
            fragmentShader: particleFragmentShader,
            transparent: true,
            side: THREE.DoubleSide,
        });
        
        this.particleMesh = new THREE.Mesh(geometry, this.particleMaterial);
        this.particleMesh.frustumCulled = false; // Particles may be anywhere
        // Hide particles if particleCount is 0 (for terrain_only preset)
        this.particleMesh.visible = this.model.renderMode === "geometry" && this.model.particleCount > 0;
        
        // Add particles to scene
        this.threejs.add(this.particleMesh);

        // Try to use terrain_render if available, otherwise fallback to WaterfallTestContainer
        const terrainContainer = AssetManager.get3DModel("TerrainContainer");
        const container = AssetManager.get3DModel("WaterfallTestContainer");
        
        let obj: THREE.Object3D | null = null;
        let useTerrainRender = false;
        
        if (terrainContainer) {
            obj = terrainContainer.getNewSceneObject(false, true) as THREE.Object3D;
            useTerrainRender = true;
        } else if (container) {
            obj = container.getNewSceneObject(false, true) as THREE.Object3D;
        }
        
        if (obj) {
            obj.name = "WaterContainerDebug";

            const useWireframe = this.model.containerWireframe;
            const useSolidDepthWrite = this.model.containerSolidDepthWrite;

            let hasTerrainSplitMeshes = false;
            obj.traverse((child: THREE.Object3D) => {
                const name = (child.name || "").toLowerCase();
                if (name === "terrain_render" || name.includes("terrain_render") ||
                    name === "terrain_collision" || name.includes("terrain_collision")) {
                    hasTerrainSplitMeshes = true;
                }
            });

            const shouldUseTerrainSplit = useTerrainRender && hasTerrainSplitMeshes;
            obj.traverse((child: THREE.Object3D) => {
                const maybeMesh = child as THREE.Mesh;
                if ((maybeMesh as any).isMesh) {
                    const mesh = maybeMesh as THREE.Mesh;
                    
                    // Hide collision mesh - it should never be visible
                    if (mesh.name === "terrain_collision" || mesh.name.includes("terrain_collision")) {
                        mesh.visible = false;
                        return; // Skip material setup for collision mesh
                    }
                    
                    // Only show render mesh if using terrain split (and split meshes exist)
                    if (shouldUseTerrainSplit && mesh.name !== "terrain_render" && !mesh.name.includes("terrain_render")) {
                        mesh.visible = false;
                        return;
                    }

                    mesh.userData.isWaterContainer = true;
                    if (useWireframe) {
                        mesh.material = new THREE.MeshBasicMaterial({
                            color: 0x00ff00,
                            transparent: true,
                            opacity: 0.5,
                            wireframe:true,
                            depthWrite: false,
                            side: THREE.DoubleSide
                        });
                    } else if (this.model.containerSolidDepthWrite) {
                        mesh.material = new THREE.MeshBasicMaterial({
                            color:  0xa3a3a0,
                            wireframe: false,
                            transparent: false,
                            depthWrite: true,
                            depthTest: true,
                            side: THREE.DoubleSide
                        });
                    } else {
                        const originalMaterial = mesh.material as THREE.Material;
                        
                        if (originalMaterial && (originalMaterial as any).isMeshStandardMaterial || 
                            (originalMaterial as any).map || (originalMaterial as any).isMeshPhongMaterial) {
                            const mat = originalMaterial as any;
                            const newMaterial = new THREE.MeshStandardMaterial({
                                map: mat.map || null,
                                normalMap: mat.normalMap || null,
                                roughnessMap: mat.roughnessMap || null,
                                metalnessMap: mat.metalnessMap || null,
                                aoMap: mat.aoMap || null,
                                emissiveMap: mat.emissiveMap || null,
                                side: THREE.DoubleSide,
                                color: mat.color || 0xffffff,
                                roughness: mat.roughness !== undefined ? mat.roughness : 0.5,
                                metalness: mat.metalness !== undefined ? mat.metalness : 0.0,
                                transparent: mat.transparent || false,
                                opacity: mat.opacity !== undefined ? mat.opacity : 1.0
                            });
                            mesh.material = newMaterial;
                        } else {
                            mesh.material = new THREE.MeshStandardMaterial({
                                color: 0xa3a3a0,
                                side: THREE.DoubleSide
                            });
                        }
                    }
                }
            });

            this.containerObject = obj; // Store reference to container
            this.threejs.add(obj);
        } else {
            console.warn("WaterGPGPUView: TerrainContainer and WaterfallTestContainer models not found in AssetManager; make sure PreloadAssets loaded them.");
        }

        this.isInitialized = true;

        // Initialize SDF collision with ellipsoid (replaces box SDF)
        this.initSDFCollision();
    }

    /**
     * 初始化 SDF 碰撞体积。
     * 优先使用 Blender 导入的 waterfalltest.glb 作为 SDF 容器；
     * 如果没找到该模型，则回退到原来的长方体 bounding box。
     */
    private initSDFCollision(): void {
        if (!this.fluidSimulator) {
            console.log("WaterGPGPUView: SDF collision skipped - simulator not ready");
            return;
        }

        // 1. 优先尝试使用 terrain_collision mesh 作为 SDF 容器
        // First try to find terrain_collision mesh specifically
        const terrainContainer = AssetManager.get3DModel("TerrainContainer");
        if (terrainContainer) {
            const obj = terrainContainer.getNewSceneObject(false, true) as THREE.Object3D;

            // Look for terrain_collision mesh by name
            let collisionMesh: THREE.Mesh | null = null;
            obj.traverse((child: THREE.Object3D) => {
                if (collisionMesh) return;
                // Check if this is the collision mesh by name
                if (child.name === "terrain_collision" || child.name.includes("terrain_collision")) {
                    const maybeMesh = child as THREE.Mesh;
                    if ((maybeMesh as any).isMesh) {
                        collisionMesh = maybeMesh;
                    }
                }
            });

            if (collisionMesh) {
                const mesh = collisionMesh as THREE.Mesh;
                if (mesh.geometry instanceof THREE.BufferGeometry) {
                    mesh.updateMatrixWorld(true);

                    const geom = mesh.geometry as THREE.BufferGeometry;
                    const worldMatrix = mesh.matrixWorld.clone();

                    console.log("WaterGPGPUView: Using terrain_collision mesh as SDF container");
                    console.log("  geometry vertices:", geom.attributes.position.count);

                    this.fluidSimulator.setCollisionMesh(geom, worldMatrix);
                    this.sdfCollisionInitialized = true;
                    return;
                } else {
                    console.warn("WaterGPGPUView: terrain_collision mesh has no BufferGeometry, fallback to first mesh");
                }
            }
        }
        
        // 2. Fallback: try WaterfallTestContainer (legacy support)
        const container = AssetManager.get3DModel("WaterfallTestContainer");
        if (container) {
            const obj = container.getNewSceneObject(false, true) as THREE.Object3D;

            let foundMesh: THREE.Mesh | null = null;
            obj.traverse((child: THREE.Object3D) => {
                if (foundMesh) return;
                const maybeMesh = child as THREE.Mesh;
                if ((maybeMesh as any).isMesh) {
                    foundMesh = maybeMesh;
                }
            });

            if (foundMesh) {
                const mesh = foundMesh as THREE.Mesh;
                if (mesh.geometry instanceof THREE.BufferGeometry) {
                    mesh.updateMatrixWorld(true);

                    const geom = mesh.geometry as THREE.BufferGeometry;
                    const worldMatrix = mesh.matrixWorld.clone();

                    console.log("WaterGPGPUView: Using WaterfallTestContainer as SDF container (fallback)");
                    console.log("  geometry vertices:", geom.attributes.position.count);

                    this.fluidSimulator.setCollisionMesh(geom, worldMatrix);
                    this.sdfCollisionInitialized = true;
                    return;
                } else {
                    console.warn("WaterGPGPUView: WaterfallTestContainer mesh has no BufferGeometry, fallback to bounding box SDF");
                }
            } else {
                console.warn("WaterGPGPUView: WaterfallTestContainer has no Mesh child, fallback to bounding box SDF");
            }
        } else {
            console.warn("WaterGPGPUView: TerrainContainer and WaterfallTestContainer not found, fallback to bounding box SDF");
        }

        if (!this.model.boundingBox) {
            console.log("WaterGPGPUView: SDF collision skipped - no bounding box");
            return;
        }

        const box = this.model.boundingBox;
        console.log(`Bounding box dimensions: width=${box.width}, depth=${box.depth}, height=${box.height}`);

        const boxMesh = new THREE.BoxGeometry(box.width, box.height, box.depth);
        boxMesh.scale(1, 1, -1);
        boxMesh.computeVertexNormals();

        const worldMatrix = new THREE.Matrix4();
        const worldTransform = box.getWorldTransform();
        worldMatrix.set(
            worldTransform.m00, worldTransform.m01, worldTransform.m02, worldTransform.m03,
            worldTransform.m10, worldTransform.m11, worldTransform.m12, worldTransform.m13,
            worldTransform.m20, worldTransform.m21, worldTransform.m22, worldTransform.m23,
            worldTransform.m30, worldTransform.m31, worldTransform.m32, worldTransform.m33
        );

        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        worldMatrix.decompose(position, quaternion, scale);

        const transformNoScale = new THREE.Matrix4();
        transformNoScale.compose(position, quaternion, new THREE.Vector3(1, 1, 1));

        console.log(`Box collider positioned at (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);

        this.fluidSimulator.setCollisionMesh(boxMesh, transformNoScale);
        this.sdfCollisionInitialized = true;

        console.log("WaterGPGPUView: SDF collision initialized with bounding box (fallback)");

        // Hide/remove previous bowl wireframe if any
        if (this.ellipsoidWire) {
            this.threejs.remove(this.ellipsoidWire);
            this.ellipsoidWire.geometry.dispose();
            (this.ellipsoidWire.material as THREE.Material).dispose();
            this.ellipsoidWire = undefined;
        }

        // Optionally add a thin wireframe of the box for debugging (kept hidden for now)
        // const wireGeo = new THREE.WireframeGeometry(boxMesh);
        // const wireMat = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.3 });
        // this.ellipsoidWire = new THREE.LineSegments(wireGeo, wireMat);
        // this.ellipsoidWire.matrixAutoUpdate = false;
        // this.ellipsoidWire.applyMatrix4(transformNoScale);
        // this.threejs.add(this.ellipsoidWire);

        // Clean up
        boxMesh.dispose();
    }
    
    /**
     * Run one simulation step - called every frame by model's timeUpdate signal
     */
    private runSimulationStep(): void {
        // Need renderer to initialize
        if (!this.isInitialized) {
            return;
        }
        if (!this.fluidSimulator || !this.particleMaterial) return;

        if (this.containerObject) {
            this.containerObject.visible = this.model.containerVisible;
        }

        // Update simulator parameters from model (respond to GUI changes)
        this.fluidSimulator.gravity = this.model.gravity;
        this.fluidSimulator.collisionDamping = this.model.collisionDamping;
        this.fluidSimulator.particleRadius = this.model.particleRadius;
        this.fluidSimulator.smoothingRadius = this.model.smoothingRadius;
        this.fluidSimulator.targetDensity = this.model.targetDensity;
        this.fluidSimulator.pressureMultiplier = this.model.pressureMultiplier;
        this.fluidSimulator.nearPressureMultiplier = this.model.nearPressureMultiplier;
        this.fluidSimulator.viscosityStrength = this.model.viscosityStrength;
        this.fluidSimulator.loopWaterfallEnabled = this.model.loopWaterfallEnabled;
        this.fluidSimulator.respawnEnabled = this.model.respawnEnabled;
        this.fluidSimulator.respawnCenter = this.model.respawnCenter;
        this.fluidSimulator.respawnMaxPerFrame = this.model.respawnMaxPerFrame;
        (this.fluidSimulator as any).externalForceEnabled = this.model.externalForceEnabled;
        (this.fluidSimulator as any).externalForceActive = this.model.externalForceActive;
        (this.fluidSimulator as any).externalForceCenter = this.model.externalForceCenter;
        (this.fluidSimulator as any).externalForceRadius = this.model.externalForceRadius;
        (this.fluidSimulator as any).externalForceStrength = this.model.externalForceStrength;
        this.fluidSimulator.setBounds(
            this.model.getBoundsMin(),
            this.model.getBoundsMax()
        );

        if (!this.model.isPaused) {
            const dt = 1 / 120; // Fixed 60fps timestep
            this.fluidSimulator.compute(dt);
        } else {
            this.fluidSimulator.computeRenderingOnly();
        }

        const posTexture = this.fluidSimulator.getPositionTexture();
        this.particleMaterial.uniforms.texturePosition.value = posTexture;
        this.particleMaterial.uniforms.particleRadius.value = this.model.particleRadius;

        if (this.particleMesh) {
            this.particleMesh.visible = this.model.renderMode === "geometry";
        }
        
        // Debug: log texture info once
        if (!this.debugLogged) {
            console.log("[WaterGPGPUView] First frame:");
            console.log("  Position texture:", posTexture);
            console.log("  Texture size:", posTexture.image?.width, "x", posTexture.image?.height);
            this.debugLogged = true;
        }

        // // Debug: periodically assert particles are inside the SDF container
        // if (this.fluidSimulator.isSDFCollisionEnabled()) {
        //     const now = performance.now() / 1000; // seconds
        //     if (now - this.lastSdfCheckTime >= this.sdfCheckInterval) {
        //         this.lastSdfCheckTime = now;
        //         try {
        //             this.fluidSimulator.debugAssertParticlesInsideSDF(this.sdfCheckTolerance);
        //         } catch (e) {
        //             console.error(e);
        //         }
        //     }
        // }
    }
    
    /**
     * Update called by framework (initial setup)
     */
    update(...args: any[]): void {
        // Update transform
        this.setTransform(this.model.transform as NodeTransform3D);
    }
    
    /**
     * Expose method to set renderer (called from controller)
     */
    public setRenderer(renderer: THREE.WebGLRenderer): void {
        this.renderer = renderer;
        if (!this.isInitialized) {
            this.initializeSimulator(renderer);
        }
    }
    
    /**
     * called from controller
     */
    public getFluidSimulator(): FluidSimulator | undefined {
        return this.fluidSimulator;
    }
    
    /**
     * Override visibility update to keep container visible even when water is disabled
     */
    _updateVisible() {
        super._updateVisible();
        // Keep container visibility driven by GUI/model
        if (this.containerObject) {
            this.containerObject.visible = this.model.containerVisible;
        }
    }
}
