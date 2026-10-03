/**
 * @file TerrainRenderView
 * @description View for rendering terrain_render mesh
 */

import { ANodeView } from "../../../../anigraph/scene/nodeView/ANodeView";
import { TerrainRenderModel } from "./TerrainRenderModel";
import * as THREE from "three";
import { AssetManager } from "../../../../anigraph/fileio/AAssetManager";

export class TerrainRenderView extends ANodeView {
    private terrainRenderObject?: THREE.Object3D;

    get model(): TerrainRenderModel {
        return this._model as TerrainRenderModel;
    }

    init() {
        super.init();

        const container = AssetManager.get3DModel("TerrainContainer");
        if (!container) {
            return;
        }

        const obj = container.getNewSceneObject(false, true) as THREE.Object3D;

        // Find terrain_render mesh by name
        let renderMesh: THREE.Mesh | null = null;
        obj.traverse((child: THREE.Object3D) => {
            if (renderMesh) return;
            if (!(child as any).isMesh) return;

            const name = (child.name || "").toLowerCase();
            if (name === "terrain_render" || name.includes("terrain_render")) {
                renderMesh = child as THREE.Mesh;
            }
        });

        if (!renderMesh) {
            let bestMesh: THREE.Mesh | null = null;
            let bestScore = -Infinity;
            
            obj.traverse((child: THREE.Object3D) => {
                if (!(child as any).isMesh) return;
                
                const mesh = child as THREE.Mesh;
                const geom = mesh.geometry as THREE.BufferGeometry;
                if (!geom?.attributes?.position) return;
                
                const name = (child.name || "").toLowerCase();
                // Skip collision meshes
                if (name.includes("terrain_collision") || name.includes("collision")) {
                    return;
                }
                
                geom.computeBoundingBox();
                const bb = geom.boundingBox!;
                const sizeX = bb.max.x - bb.min.x;
                const sizeY = bb.max.y - bb.min.y;
                const sizeZ = bb.max.z - bb.min.z;
                const vertexCount = geom.attributes.position.count;
                
                const isVeryFlat = sizeY < 0.05 * Math.max(sizeX, sizeZ);
                
                let score = sizeY;
                if (isVeryFlat) score *= 0.1;
                
                const isTerrainLike = name.includes("terrain") || name.includes("island") || 
                                     name.includes("land") || name.includes("ground");
                if (isTerrainLike) score *= 1.2;
                
                if (score > bestScore) {
                    bestScore = score;
                    bestMesh = mesh;
                }
            });
            
            if (bestMesh) {
                const selectedMesh = bestMesh as THREE.Mesh;
                renderMesh = selectedMesh;
                const geom = selectedMesh.geometry as THREE.BufferGeometry;
                geom.computeBoundingBox();
                const bb = geom.boundingBox!;
                const sizeY = bb.max.y - bb.min.y;
            }
        }

        if (!renderMesh) {
            obj.visible = true;
            this.terrainRenderObject = obj;
            this.threejs.add(obj);
            return;
        }

        const mesh = renderMesh as THREE.Mesh;

        // for UV presence
        const geom: any = mesh.geometry;
        const hasUV = !!geom?.attributes?.uv;


        if (!geom.attributes.normal) {
            geom.computeVertexNormals();
        }

        mesh.material = this.cloneMaterial(mesh.material);

        mesh.visible = true;

        const presetTex = this.getTerrainTextureFromPreset();
        // const fallbackTex = "./images/terrain_height_bands.png";
        const fallbackTex = "./Texture/rock_texture.jpg";

        const texPath = presetTex ?? fallbackTex;

        this.loadAndApplyTexture(mesh, texPath).catch((err) => {
        });

        const renderGroup = new THREE.Group();
        renderGroup.add(mesh);
        renderGroup.name = "TerrainRenderGroup";

        this.terrainRenderObject = renderGroup;
        this.threejs.add(renderGroup);
    }

    update(...args: any[]): void {
        super.updateTransform();
    }

    updateTransform(): void {
        super.updateTransform();
    }

    _updateVisible() {
        super._updateVisible();
        if (this.terrainRenderObject) {
            this.terrainRenderObject.visible = this.model.visible;
        }
    }

    private cloneMaterial(mat: THREE.Material | THREE.Material[]): THREE.Material | THREE.Material[] {
        if (Array.isArray(mat)) {
            return mat.map((m) => {
                const c = m.clone();
                (c as any).side = THREE.DoubleSide;
                return c;
            });
        } else {
            const c = mat.clone();
            (c as any).side = THREE.DoubleSide;
            return c;
        }
    }

    /**
     * Try to get terrain texture from a preset.
     */
    private getTerrainTextureFromPreset(): string | null {
        try {
            const sceneModel = (this as any)._controller?._model;
            if (!sceneModel) return null;

            const presets = (sceneModel as any).waterPresets;
            const presetName = (sceneModel as any).selectedWaterPreset;

            if (!presets || !presetName) return null;

            const preset = presets[presetName];
            const path = preset?.terrainTexture;
            if (typeof path === "string" && path.length > 0) {
                return path;
            }
            return null;
        } catch {
            return null;
        }
    }

    /**
     * Load and apply a PNG texture to the mesh material.
     */
    private async loadAndApplyTexture(mesh: THREE.Mesh, texturePath: string): Promise<void> {
        try {
            const loader = new THREE.TextureLoader();
            const texture = await loader.loadAsync(texturePath);

            // texture.wrapS = THREE.RepeatWrapping;
            // texture.wrapT = THREE.RepeatWrapping;
            
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;

            // const repeatScale = 2;
            const repeatScale = 1;
            texture.repeat.set(repeatScale, repeatScale);

            const newMaterial = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.DoubleSide,
            });

            mesh.material = newMaterial;
        } catch (error) {
            mesh.material = new THREE.MeshBasicMaterial({
                color: 0x888888, // gray
                side: THREE.DoubleSide,
            });
        }
    }
}
