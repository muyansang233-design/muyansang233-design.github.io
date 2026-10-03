// src/FinalProject/Main/Nodes/Tianyi-test1/WaterBoundingBox/WaterBoundingBoxModel.ts
import {
    ANodeModel3D,
    ASerializable,
    Vec3,
    V3,
} from "../../../../../anigraph";

@ASerializable("WaterBoundingBoxModel")
export class WaterBoundingBoxModel extends ANodeModel3D {
    center: Vec3 = V3(0, 0, 0.5);

    // 把原来的 size: Vec3 拆成三个分量
    width: number  = 1.0;   // x 方向
    depth: number  = 1.0;   // y 方向（或你认为的长度）
    height: number = 1.0;   // z 方向

    // 如果你还想要一个 Vec3 的 size 方便用，可以做成 getter
    get size(): Vec3 {
        return V3(this.width, this.depth, this.height);
    }

    // 方便一次性设置：更新尺寸，同时把节点的 transform 位置设为给定的中心
    setFromCenterSize(center: Vec3, width: number, depth: number, height: number){
        this.center = center.clone();
        this.width  = width;
        this.depth  = depth;
        this.height = height;

        // 使用 anigraph 自带的 transform 来表示世界中的位置
        const t = this.getTransformAsPRSA();
        t.setPosition(center.clone());
        this.setTransform(t);
    }

    /**
     * 计算考虑 transform 后的世界空间 AABB 最小点
     * - 本地坐标系下的盒子以原点为中心，尺寸为 (width, depth, height)
     * - 再通过 getWorldTransform() 变换 8 个角点，取坐标最小值
     */
    getWorldMin(): Vec3 {
        const halfW = 0.5 * this.width;
        const halfD = 0.5 * this.depth;
        const halfH = 0.5 * this.height;

        // 本地 8 个角点（以原点为中心）
        const localCorners: Vec3[] = [
            V3(-halfW, -halfD, -halfH),
            V3(-halfW, -halfD,  halfH),
            V3(-halfW,  halfD, -halfH),
            V3(-halfW,  halfD,  halfH),
            V3( halfW, -halfD, -halfH),
            V3( halfW, -halfD,  halfH),
            V3( halfW,  halfD, -halfH),
            V3( halfW,  halfD,  halfH),
        ];

        const worldMat = this.getWorldTransform(); // Mat4
        const min = V3(
            Number.POSITIVE_INFINITY,
            Number.POSITIVE_INFINITY,
            Number.POSITIVE_INFINITY
        );

        for (const p of localCorners) {
            const wp = worldMat.appliedToPoint(p);
            if (wp.x < min.x) min.x = wp.x;
            if (wp.y < min.y) min.y = wp.y;
            if (wp.z < min.z) min.z = wp.z;
        }
        return min;
    }

    /**
     * 计算考虑 transform 后的世界空间 AABB 最大点
     */
    getWorldMax(): Vec3 {
        const halfW = 0.5 * this.width;
        const halfD = 0.5 * this.depth;
        const halfH = 0.5 * this.height;

        const localCorners: Vec3[] = [
            V3(-halfW, -halfD, -halfH),
            V3(-halfW, -halfD,  halfH),
            V3(-halfW,  halfD, -halfH),
            V3(-halfW,  halfD,  halfH),
            V3( halfW, -halfD, -halfH),
            V3( halfW, -halfD,  halfH),
            V3( halfW,  halfD, -halfH),
            V3( halfW,  halfD,  halfH),
        ];

        const worldMat = this.getWorldTransform();
        const max = V3(
            Number.NEGATIVE_INFINITY,
            Number.NEGATIVE_INFINITY,
            Number.NEGATIVE_INFINITY
        );

        for (const p of localCorners) {
            const wp = worldMat.appliedToPoint(p);
            if (wp.x > max.x) max.x = wp.x;
            if (wp.y > max.y) max.y = wp.y;
            if (wp.z > max.z) max.z = wp.z;
        }
        return max;
    }
}
