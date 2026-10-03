import * as THREE from "three";
import {
    AGraphicElement,
    ANodeView,
    NodeTransform3D,
    ASerializable,
    Quaternion,
    V3,
    AShaderMaterial, Vec3,
} from "../../../../../anigraph";
import {
    ABlinnPhongShaderModel,
} from "../../../../../anigraph/rendering/shadermodels";
import {
    ATexture,
} from "../../../../../anigraph/rendering";
import { TreeNode, NodeTypes} from "./TreeNode";
import { randFloat } from "three/src/math/MathUtils";
import {TreeModel} from "./TreeModel";
import {addOutlineToGraphic} from "../ToonShadingHelper";

@ASerializable("TreeView")
export class TreeView extends ANodeView {
    private graphic!: AGraphicElement;

    // Shared Geometry
    private trunkGeom: THREE.CylinderGeometry | undefined;
    private branchGeom: THREE.CylinderGeometry | undefined;

    private static grassGeomClose: THREE.PlaneGeometry; // 亮黄绿
    private static grassGeomMid: THREE.PlaneGeometry;   // 标准绿
    private static grassGeomFar: THREE.PlaneGeometry;   // 深墨绿
    private static grassGeomDark: THREE.PlaneGeometry;  // 最暗

    // Shader and Material
    private static treeShaderModel: ABlinnPhongShaderModel;
    private static trunkMat: AShaderMaterial;
    private static branchMat: AShaderMaterial;

    // 3 Leaf textures
    private static grassMat8: AShaderMaterial;  // texture 8
    private static grassMat9: AShaderMaterial;  // texture 9
    private static grassMat10: AShaderMaterial; // texture 10 (High detail / Outer)

    private static trunkTex?: ATexture;
    private static branchTex?: ATexture;

    private static grassTex8?: ATexture;
    private static grassTex9?: ATexture;
    private static grassTex10?: ATexture;

    private leafBillboards: THREE.Mesh[] = [];
    public static leafCount = 3; // 默认值，会被 SceneController 修改
    public static leafSize = 1.4;   // 默认值
    private camPos: Vec3 = V3(0, 0, 0);

    public static BARK_COLOR_HEX = 0xffffff;

    get model(): TreeNode {
        return this._model as TreeNode;
    }

    init(): void {
        const m = this.model;

        if (!TreeView.treeShaderModel) {
            TreeView.treeShaderModel = new ABlinnPhongShaderModel("blinnphong");
        }

        const tail = m.tailRadius;
        const tip = m.tipRadius;

        switch (m.type) {
            case NodeTypes.TRUNK: {
                if (!TreeView.trunkTex) {
                    ATexture.LoadAsync("Texture/tree_texture.png").then(tex => {
                        TreeView.trunkTex = tex;
                        tex.setWrapToRepeat(1.0);
                        if (TreeView.trunkMat) {
                            TreeView.trunkMat.setTexture("diffuse", tex);
                            (TreeView.trunkMat.threejs as THREE.ShaderMaterial).needsUpdate = true;
                        }
                    });
                }

                if (!this.trunkGeom) {
                    this.trunkGeom = new THREE.CylinderGeometry(tip, tail, 1, 12);

                    const count = this.trunkGeom.attributes.position.count;
                    const colors: number[] = [];
                    const color = new THREE.Color(TreeView.BARK_COLOR_HEX);
                    for (let i = 0; i < count; i++) {
                        colors.push(color.r, color.g, color.b);
                    }
                    this.trunkGeom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
                }

                if (!TreeView.trunkMat) {
                    const mat = TreeView.treeShaderModel.CreateMaterial();
                    if (TreeView.trunkTex) mat.setTexture("diffuse", TreeView.trunkTex);

                    mat.setUniform("ambient", 0.25);
                    mat.setUniform("diffuse", 1.0);
                    mat.setUniform("specular", 0);
                    mat.setUniform("specularExp", 32.0);

                    const threeMat = mat.threejs as THREE.ShaderMaterial;
                    threeMat.vertexColors = true;

                    (threeMat as any).morphTargets = false;
                    (threeMat as any).morphNormals = false;

                    TreeView.trunkMat = mat;
                }

                this.graphic = AGraphicElement.Create(this.trunkGeom, TreeView.trunkMat);
                break;
            }

            case NodeTypes.BRANCH: {
                if (!TreeView.trunkTex) {
                    ATexture.LoadAsync("Texture/tree_texture.png").then(tex => {
                        TreeView.trunkTex = tex;
                        tex.setWrapToRepeat(1.0);
                        if (TreeView.trunkMat) {
                            TreeView.trunkMat.setTexture("diffuse", tex);
                            (TreeView.trunkMat.threejs as THREE.ShaderMaterial).needsUpdate = true;
                        }
                    });
                }

                if (!this.branchGeom) {
                    this.branchGeom = new THREE.CylinderGeometry(tip, tail, 1, 8);
                    const count = this.branchGeom.attributes.position.count;
                    const colors: number[] = [];
                    const color = new THREE.Color(TreeView.BARK_COLOR_HEX); // 使用相同的棕色
                    for (let i = 0; i < count; i++) {
                        colors.push(color.r, color.g, color.b);
                    }
                    this.branchGeom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
                }

                if (!TreeView.trunkMat) {
                    const mat = TreeView.treeShaderModel.CreateMaterial();
                    if (TreeView.trunkTex) mat.setTexture("diffuse", TreeView.trunkTex);

                    mat.setUniform("ambient", 0.25);
                    mat.setUniform("diffuse", 1.0);
                    mat.setUniform("specular", 0);
                    mat.setUniform("specularExp", 32.0);

                    const threeMat = mat.threejs as THREE.ShaderMaterial;
                    threeMat.vertexColors = true;

                    (threeMat as any).morphTargets = false;
                    (threeMat as any).morphNormals = false;

                    TreeView.trunkMat = mat;
                }
                this.graphic = AGraphicElement.Create(this.branchGeom, TreeView.trunkMat);
                break;
            }

            case NodeTypes.LEAF:
            default: {
                this.ensureGrassResources();

                const leafGroup = new THREE.Group();
                const count = TreeView.leafCount;
                const spread = this.model.radius;

                const baseScaleFactor = this.model.radius * 2.0 * this.model.scale;

                for (let i = 0; i < count; i++) {
                    const x = (Math.random() - 0.5) * spread * this.model.scale;
                    const y = (Math.random() - 0.5) * spread * this.model.scale;
                    const z = (Math.random() - 0.5) * spread * this.model.scale;

                    const distRatio = Math.sqrt(x*x + y*y + z*z) / (spread * 1.2);

                    let targetMat = TreeView.grassMat8;

                    const prob10 = 0.1 + Math.max(0, (distRatio - 0.3) * 1.5);

                    if (Math.random() < prob10) {
                        targetMat = TreeView.grassMat10; // 外层高概率
                    } else {
                        targetMat = Math.random() < 0.5 ? TreeView.grassMat8 : TreeView.grassMat9;
                    }

                    const mesh = new THREE.Mesh(
                        TreeView.grassGeomMid,
                        targetMat.threejs as THREE.Material
                    );

                    mesh.position.set(x, y, z);
                    mesh.up.set(0, 0, 1);

                    const randomScale = 1.0 + (Math.random() - 0.5) * 0.5;
                    const finalScale = randomScale * baseScaleFactor;

                    mesh.scale.set(finalScale, finalScale, finalScale);

                    leafGroup.add(mesh);
                    this.leafBillboards.push(mesh);
                }

                this.graphic = AGraphicElement.Create(
                    new THREE.BufferGeometry(),
                    TreeView.grassMat8
                );
                this.graphic.threejs.add(leafGroup);
                break;
            }
        }

        if (TreeModel.camera) {
            this.camPos = TreeModel.camera.transform.getPosition();
        }
        addOutlineToGraphic(this.graphic)
        this.registerAndAddGraphic(this.graphic);
        this.maintainTree();
    }

    // Grass Texture Creation
    private ensureGrassResources() {
        // 辅助：创建带颜色的 Plane
        const createColoredPlane = (hexColor: number) => {
            const size = TreeView.leafSize;
            const geom = new THREE.PlaneGeometry(size, size);
            const count = geom.attributes.position.count;
            const colors: number[] = [];
            const col = new THREE.Color(hexColor);
            for (let i = 0; i < count; i++) {
                colors.push(col.r, col.g, col.b);
            }
            geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            return geom;
        }

        if (!TreeView.grassGeomClose) TreeView.grassGeomClose = createColoredPlane(0x7DB35C);
        if (!TreeView.grassGeomMid) TreeView.grassGeomMid = createColoredPlane(0x4D8C57);
        if (!TreeView.grassGeomFar) TreeView.grassGeomFar = createColoredPlane(0x2E5E4E);
        if (!TreeView.grassGeomDark) TreeView.grassGeomDark = createColoredPlane(0x1B4D3E);

        const setupGrassMaterial = (texPath: string, matRefName: 'grassMat8' | 'grassMat9' | 'grassMat10', texRefName: 'grassTex8' | 'grassTex9' | 'grassTex10') => {
            if (!TreeView[texRefName]) {
                ATexture.LoadAsync(texPath).then(tex => {
                    TreeView[texRefName] = tex;
                    tex.setWrapToClamp();
                    if (TreeView[matRefName]) {
                        TreeView[matRefName].setTexture("diffuse", tex);
                        (TreeView[matRefName].threejs as THREE.ShaderMaterial).needsUpdate = true;
                    }
                });
            }

            if (!TreeView[matRefName]) {
                const mat = TreeView.treeShaderModel.CreateMaterial();
                if (TreeView[texRefName]) mat.setTexture("diffuse", TreeView[texRefName]);

                mat.setUniform("diffuse", 1.0);
                mat.setUniform("ambient", 0.8);
                mat.setUniform("specular", 0.0);

                const threeMat = mat.threejs as THREE.ShaderMaterial;
                threeMat.transparent = true;
                threeMat.alphaTest = 0.5;
                threeMat.side = THREE.DoubleSide;
                threeMat.depthWrite = true;
                threeMat.vertexColors = true;

                (threeMat as any).morphTargets = false;
                (threeMat as any).morphNormals = false;

                TreeView[matRefName] = mat;
            }
        };

        setupGrassMaterial("Texture/grass_texture2.png", "grassMat8", "grassTex8");
        setupGrassMaterial("Texture/grass_texture2.png", "grassMat9", "grassTex9");
        setupGrassMaterial("Texture/grass_texture2.png", "grassMat10", "grassTex10");
    }


    private static _tempCamPos = new THREE.Vector3();
    private static _tempWorldPos = new THREE.Vector3();
    private static _tempBillboardTarget = new THREE.Vector3();
    private lastCamPosVal = { x: 0, y: 0, z: 0 };

    update(t: number, ...args: any[]): void {
        this.maintainTree();
        if (this.model.type !== NodeTypes.LEAF || this.leafBillboards.length === 0) return;

        const camera = TreeModel.camera;
        if (!camera) return;

        const currentCamPos = camera.transform.getPosition();

        const hasMoved =
            Math.abs(currentCamPos.x - this.lastCamPosVal.x) > 0.001 ||
            Math.abs(currentCamPos.y - this.lastCamPosVal.y) > 0.001 ||
            Math.abs(currentCamPos.z - this.lastCamPosVal.z) > 0.001;

        if (hasMoved) {
            this.lastCamPosVal.x = currentCamPos.x;
            this.lastCamPosVal.y = currentCamPos.y;
            this.lastCamPosVal.z = currentCamPos.z;

            TreeView._tempCamPos.set(currentCamPos.x, currentCamPos.y, currentCamPos.z);

            this.leafBillboards.sort((meshA, meshB) => {
                meshA.getWorldPosition(TreeView._tempWorldPos);
                const distA = TreeView._tempWorldPos.distanceToSquared(TreeView._tempCamPos);
                meshB.getWorldPosition(TreeView._tempWorldPos);
                const distB = TreeView._tempWorldPos.distanceToSquared(TreeView._tempCamPos);
                return distA - distB;
            });
        } else {
            TreeView._tempCamPos.set(this.lastCamPosVal.x, this.lastCamPosVal.y, this.lastCamPosVal.z);
        }

        const dist = this.model._cacheDistance;
        let vis_scal = 1.0;
        if (dist > 30) vis_scal = 0.1;
        else if (dist > 15) vis_scal = 0.2;
        else if (dist > 10) vis_scal = 0.5;

        const visibleCount = Math.max(0, Math.round(this.leafBillboards.length * vis_scal));
        const oneThird = Math.floor(visibleCount / 3);
        const twoThirds = oneThird * 2;
        const totalMeshes = this.leafBillboards.length;

        for (let i = 0; i < totalMeshes; i++) {
            const mesh = this.leafBillboards[i];
            const shouldShow = i < visibleCount;

            if (mesh.visible !== shouldShow) mesh.visible = shouldShow;
            if (!shouldShow) continue;

            // Keep foliage upright in this Z-up scene. Only yaw toward the
            // camera's horizontal direction, so pitch cannot roll the leaves.
            mesh.getWorldPosition(TreeView._tempWorldPos);
            TreeView._tempBillboardTarget.set(
                TreeView._tempCamPos.x,
                TreeView._tempCamPos.y,
                TreeView._tempWorldPos.z
            );
            if (TreeView._tempBillboardTarget.distanceToSquared(TreeView._tempWorldPos) > 1e-6) {
                mesh.lookAt(TreeView._tempBillboardTarget);
            }

            // Color LOD Assignment (Geometry Switch)
            let targetGeom = TreeView.grassGeomFar;


            if (i < oneThird) targetGeom = TreeView.grassGeomClose;
            else if (i < twoThirds) targetGeom = TreeView.grassGeomMid;

            if (visibleCount > 5 && i > visibleCount - 3) {
                targetGeom = TreeView.grassGeomDark;
            } else if (visibleCount <= 2) {
                targetGeom = TreeView.grassGeomClose;
            }

            if (mesh.geometry !== targetGeom) {
                mesh.geometry = targetGeom;
            }
        }
    }

    private maintainTree() {
        const m = this.model;
        const length = m.length ?? 1;
        const wt1 = m.getWorldTransform().clone();
        const wt = new NodeTransform3D(
            wt1.getPosition(),
            wt1._getQuaternionRotation(),
            V3(1, 1, 1)
        );
        let scale = V3(1, 1, 1);
        switch (m.type) {
            case NodeTypes.TRUNK:
            case NodeTypes.BRANCH: {
                scale = V3(1, length, 1);
                wt.anchor = V3(0, -0.5, 0);
                break;
            }
            case NodeTypes.LEAF:
            default: {
                wt.anchor = V3(0, 0, 0);
                scale = V3(1, 1, 1);
                break;
            }
        }
        wt.scale = scale;
        this.graphic.setTransform(wt);
    }
}
