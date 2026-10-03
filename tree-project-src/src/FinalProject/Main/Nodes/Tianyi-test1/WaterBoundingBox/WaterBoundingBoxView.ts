// src/FinalProject/Main/Nodes/Tianyi-test1/WaterBoundingBox/WaterBoundingBoxView.ts
import * as THREE from "three";
import {
    AGraphicElement,
    ANodeView,
    NodeTransform3D,
} from "../../../../../anigraph";
import {WaterBoundingBoxModel} from "./WaterBoundingBoxModel";

export class WaterBoundingBoxView extends ANodeView {
    boxGraphic!: AGraphicElement;

    get model(): WaterBoundingBoxModel {
        return this._model as WaterBoundingBoxModel;
    }

    init(): void {
        // 构建白色线框来可视化 bounding box
        this.buildBox();
    }

    buildBox() {
        if (this.boxGraphic) {
            this.disposeGraphic(this.boxGraphic);
        }

        // 几何尺寸仍然用 width / depth / height（本地空间盒子以原点为中心）
        const { width, depth, height } = this.model;

        const boxGeom = new THREE.BoxGeometry(width, depth, height);

        const wireMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,      // 白色
            wireframe: true,
            transparent: true,
            opacity: 0.7,
            depthWrite: false,    // 不阻挡后面的物体
        });

        this.boxGraphic = AGraphicElement.Create(boxGeom, wireMat);
        this.registerAndAddGraphic(this.boxGraphic);

        this.updateBoxTransform();
    }

    updateBoxTransform() {
        // 直接使用模型自身的 transform（包含你在 anigraph 里用 gizmo 做的平移/旋转/缩放）
        const t = this.model.getTransformAsPRSA();
        this.boxGraphic.setTransform(t);
    }

    update(...args:any[]): void {
        // 更新 transform 以响应模型变化
        if (this.boxGraphic) {
            this.updateBoxTransform();
        }
    }
}
