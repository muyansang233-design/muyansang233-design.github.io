// WaterParticleView.ts (版本 A：调试版，蓝色小球)

import * as THREE from "three";
import {
    AGraphicElement,
    ANodeView,
    NodeTransform3D,
} from "../../../../../anigraph";
import { WaterParticleModel } from "./WaterParticleModel";
import { WaterParticleIndividual } from "./WaterParticleIndividual";

/**
 * 一个小子类：用 InstancedMesh 替换 AGraphicElement 内部的普通 Mesh
 */
class WaterInstancedGraphicElement extends AGraphicElement {
    public instancedMesh: THREE.InstancedMesh;

    constructor(
        geometry: THREE.BufferGeometry,
        material: THREE.Material,
        instanceCount: number,
    ) {
        super(); // 不传 geometry/material，避免父类在 constructor 里直接 new Mesh

        // 用父类接口先记录几何和材质
        this.setGeometry(geometry);
        this.setMaterial(material);

        // 创建 InstancedMesh
        this.instancedMesh = new THREE.InstancedMesh(
            this.geometry,
            this.material as THREE.Material,
            instanceCount,
        );
        this.instancedMesh.matrixAutoUpdate = false;

        // 把 AGraphicElement 内部的 _element 换成 InstancedMesh
        // @ts-ignore 访问受保护字段
        this._element = this.instancedMesh;
    }
}

export class WaterParticleView extends ANodeView {
    // 基础球体几何
    private particleGeometry!: THREE.BufferGeometry;
    // 唯一的 Instanced 图元
    private instancedElement?: WaterInstancedGraphicElement;
    // 临时对象用来构建矩阵
    private dummy = new THREE.Object3D();
    private dummyColor = new THREE.Color();
    // 记录当前实例数
    private lastInstanceCount = 0;

    get model(): WaterParticleModel {
        // @ts-ignore 由 anigraph 注入
        return this._model as WaterParticleModel;
    }

    /** 视图初始化：订阅粒子更新事件，并初始化 InstancedMesh */
    init(): void {
        const self = this;

        // 像旧版一样，订阅 model 的粒子更新事件
        this.subscribe(
            this.model.addParticlesListener(() => {
                self.update();
            })
        );

        // 初始化 InstancedMesh（如果已经有粒子）
        this.initInstancedMeshIfNeeded();

        // 把整体 transform 对齐 model
        this.setTransform(this.model.transform as NodeTransform3D);
    }


    /**
     * 初始化 InstancedMesh（如果还没建好，或者粒子数变了）
     */
    private initInstancedMeshIfNeeded() {
        const particles = this.model.particles as WaterParticleIndividual[];
        const count = particles.length;
        if (count === 0) return;

        if (this.instancedElement && this.lastInstanceCount === count) {
            return; // 不用重建
        }
        this.lastInstanceCount = count;

        // 1. 基础几何：一个单位球
        if (!this.particleGeometry) {
            this.particleGeometry = new THREE.SphereGeometry(1, 12, 12);
        }

        // 2. 简单白色材质（为了显示粒子颜色）
        const basicMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
        });

        // 3. 创建 InstancedGraphicElement
        const elem = new WaterInstancedGraphicElement(
            this.particleGeometry,
            basicMaterial,
            count,
        );
        this.instancedElement = elem;

        // 4. 注册到当前 View
        this.registerAndAddGraphic(elem);

        // 5. 初始填充 instanceMatrix
        const mesh = this.instancedElement.instancedMesh;
        for (let i = 0; i < count; i++) {
            const p = particles[i];

            // 注意：先用“模型局部坐标”的位置
            this.dummy.position.set(
                p.position.x,
                p.position.y,
                p.position.z,
            );

            // 半径：从 SphereParticle 里拿 radius（如果字段名不同自己改）
            // @ts-ignore
            const r: number = (p as any).radius ?? 0.02;
            this.dummy.scale.set(r, r, r);

            this.dummy.rotation.set(0, 0, 0);
            this.dummy.updateMatrix();

            mesh.setMatrixAt(i, this.dummy.matrix);

            // Set initial color
            this.dummyColor.setRGB(p.color.r, p.color.g, p.color.b);
            mesh.setColorAt(i, this.dummyColor);
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) {
            mesh.instanceColor.needsUpdate = true;
        }
    }

    /**
     * 每帧更新：只更新 InstancedMesh 的 matrix
     */
    update(...args: any[]): void {
        this.initInstancedMeshIfNeeded();
        if (!this.instancedElement) return;

        const mesh = this.instancedElement.instancedMesh;
        const particles = this.model.particles as WaterParticleIndividual[];
        const count = Math.min(particles.length, mesh.count);

        for (let i = 0; i < count; i++) {
            const p = particles[i];

            this.dummy.position.set(
                p.position.x,
                p.position.y,
                p.position.z,
            );
            // @ts-ignore
            const r: number = (p as any).radius ?? 0.02;
            this.dummy.scale.set(r, r, r);
            this.dummy.rotation.set(0, 0, 0);

            this.dummy.updateMatrix();
            mesh.setMatrixAt(i, this.dummy.matrix);

            // Update color
            this.dummyColor.setRGB(p.color.r, p.color.g, p.color.b);
            mesh.setColorAt(i, this.dummyColor);
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) {
            mesh.instanceColor.needsUpdate = true;
        }

        this.setTransform(this.model.transform as NodeTransform3D);
    }

}
