import {
    ANodeModel3D,
    ASerializable,
    Vec3,
    ACamera, NodeTransform3D,
} from "../../../../../anigraph";
import { NodeTypes, TreeNode } from "./TreeNode";
import { WindFieldModel } from "./WindFieldModel";

@ASerializable("TreeModel")
export class TreeModel extends ANodeModel3D {

    // ================== Tree Properties ==================
    tree: TreeNode;
    depth: number = 3;
    height: number = 10;
    scale: number = 1.0;

    // Branch length range
    branch_min = 0.5;
    branch_max = 1.2;

    // Trunk radius
    trunkRadiusBottom = 0.2;
    trunkRadiusTop = 0.04;
    leafRadius = 0.5;

    // Branch radius + decay
    branchRadiusBottom = 0.05;
    branchRadiusTop = 0.02;
    branchDecayPercent = 0.005;

    num_branches = 10;

    // Environment Properties
    sunDirection: Vec3 = new Vec3(0, 1, 0);
    windField: WindFieldModel;
    public static camera: ACamera;

    // ================== Leaf & Particle ==================
    leaves: TreeNode[];

    // ================== Optimization ==================
    private branches: TreeNode[] = [];
    public easyRender: boolean = false;

    public id: number=0;
    constructor(
        depth: number,
        height: number,
        num_branches: number = 10,
        windFieldModel: WindFieldModel,
        camera: ACamera,
        pos: Vec3 = new Vec3(0, 0, 0),
        dir: Vec3 = new Vec3(0, 1, 0),
        scale: number = 1.0
    ) {
        super();
        this.scale = scale; // 保存 scale
        this.depth = depth;

        this.height = height * scale;

        this.branch_min *= scale;
        this.branch_max *= scale;

        this.trunkRadiusBottom *= scale;
        this.trunkRadiusTop *= scale;
        this.leafRadius *= scale;

        this.branchRadiusBottom *= scale;
        this.branchRadiusTop *= scale;

        this.branchDecayPercent = (this.branchRadiusBottom - this.branchRadiusTop) / (this.height - 1); // 这里的 height 已经是缩放过的了，分母可能需要注意，但通常让它自动计算即可

        this.num_branches = num_branches;
        this.windField = windFieldModel;

        this.setTransform(new NodeTransform3D(pos));

        const trunk = new TreeNode(
            NodeTypes.TRUNK,
            this.height,
            this.trunkRadiusBottom,
            this.trunkRadiusTop,
            this.scale
        );
        this.id = Math.round(Math.random() * 100);
        this.addChild(trunk);
        trunk.transform.setPosition(new Vec3(0, 0, 0));
        trunk.direction = dir;
        this.tree = trunk;
        TreeModel.camera = camera;

        this.leaves = [];
        this.generateMainStructure(trunk);
    }

    // ================== Generate Tree ==================

    private randRange(min: number, max: number): number {
        return min + Math.random() * (max - min);
    }

    private generateMainStructure(trunk: TreeNode) {
        let remainingBranches = this.num_branches;

        let branchesPerLayer: number[] = [];
        let currentLayerCount = 1;
        while (remainingBranches > 0) {
            let count = Math.min(currentLayerCount, remainingBranches);
            branchesPerLayer.push(count);
            remainingBranches -= count;
            currentLayerCount++;
        }

        const totalLayers = branchesPerLayer.length;

        const startH = 0.4 * this.height;
        const endH = 0.95 * this.height;
        const heightStep = totalLayers > 1 ? (endH - startH) / (totalLayers - 1) : 0;

        for (let layerIdx = 0; layerIdx < totalLayers; layerIdx++) {
            const countInThisLayer = branchesPerLayer[layerIdx];
            const layerY = startH + layerIdx * heightStep;
            const layerPhaseShift = layerIdx * (Math.PI / 6);

            const progress = totalLayers > 1 ? layerIdx / (totalLayers - 1) : 0;
            const lengthScale = (1.0 - progress) * 0.7 + 0.3;

            for (let b = 0; b < countInThisLayer; b++) {
                const angleStep = (Math.PI * 2) / countInThisLayer;
                const radialAngle = angleStep * b + layerPhaseShift;

                const upwardAngle = (Math.PI / 6) * (1 - progress * 0.3);

                const yComponent = Math.sin(upwardAngle);
                const hComponent = Math.cos(upwardAngle);

                const xComponent = hComponent * Math.cos(radialAngle);
                const zComponent = hComponent * Math.sin(radialAngle);

                const direction = new Vec3(xComponent, yComponent, zComponent).getNormalized();

                this.createBranchRecursive(trunk, layerY, direction, this.depth - 1, lengthScale);
            }
        }
    }

    // ================== Recursive Branch Generation ==================
    private createBranchRecursive(
        parent: TreeNode,
        offsetY: number | null,
        direction: Vec3,
        currentDepth: number,
        scale: number = 1.0
    ) {
        const baseLength = this.randRange(this.branch_min, this.branch_max);
        const length = baseLength * scale;

        let tailRadius = parent.tipRadius;
        if (offsetY !== null && parent.length > 0) {
            const ratio = offsetY / parent.length;
            tailRadius = parent.tailRadius * (1 - ratio) + parent.tipRadius * ratio;
            tailRadius *= 0.8;
        }

        const tipRadius = tailRadius * 0.6;

        const branch = new TreeNode(
            NodeTypes.BRANCH,
            length,
            tailRadius,
            tipRadius,
            this.scale,
            this.leafRadius
        );

        // Store all branch into array
        if (currentDepth > this.depth - 2){
            this.branches.push(branch);
        }

        
        if (direction.y < 0.1) {
            direction.y = 0.1;
            direction = direction.getNormalized();
        }

        branch.direction = direction;
        parent.addChild(branch);

        if (offsetY !== null) {
            branch.transform.setPosition(new Vec3(0, offsetY, 0));
        } else {
            branch.transform.setPosition(new Vec3(0, parent.length, 0));
        }

        branch.bakeRestPose();

        this.addLeavesToNode(branch);

        if (currentDepth <= 0) {
            return;
        }

        const baseDir = direction.getNormalized();
        let tempUp = Math.abs(baseDir.y) > 0.9 ? new Vec3(1, 0, 0) : new Vec3(0, 1, 0);
        const rightDir = baseDir.cross(tempUp).getNormalized();
        const childScale = scale * 0.7;

        for (let i = 0; i < 2; i++) {
            const isMainExt = (i === 0);

            const verticalBias = isMainExt ? new Vec3(0, 1, 0) : new Vec3(0, 0.1, 0);
            const sideBias = rightDir.times(isMainExt ? 0.4 : -0.4);
            let newDir = baseDir.plus(verticalBias).plus(sideBias).getNormalized();
            if (newDir.y < 0.05) newDir.y = 0.05;

            let posRatio: number;
            if (isMainExt) {
                posRatio = this.randRange(0.8, 1.0);
            } else {
                posRatio = this.randRange(0.3, 0.6);
            }

            const childOffsetY = branch.length * posRatio;

            this.createBranchRecursive(branch, childOffsetY, newDir, currentDepth - 1, childScale);
        }
    }

    // ================== Leaf Generation ==================

    private addLeavesToNode(node: TreeNode) {
        const count = 1;

        for (let i = 0; i < count; i++) {
            let leaf = new TreeNode(
                NodeTypes.LEAF,
                this.randRange(0.5, 0.8),
                1,
                1,
                this.scale,
                this.leafRadius
            );

            const offset = new Vec3(
                this.randRange(-0.2, 0.2) * this.scale,
                node.length,
                this.randRange(-0.2, 0.2) * this.scale
            );

            leaf.transform.setPosition(offset);
            leaf.direction = new Vec3(0, 1, 0);
            leaf.bakeRestPose();

            node.addChild(leaf);
            this.leaves.push(leaf);
        }
    }

    timeUpdate(t: number, ...args: any[]) {
        super.timeUpdate(t, ...args);

        let dis = this.getWorldTransform().getPosition().minus(TreeModel.camera.transform.getPosition()).length;

        this.easyRender = dis > (20 * this.scale);
        if (this.windField && !this.easyRender) {
            this.applyWindFast();
        } else {
            for (let leaf of this.leaves) {
                leaf._cacheDistance = leaf.getWorldTransform().getPosition().minus(TreeModel.camera.transform.getPosition()).length;
                leaf.signalGeometryUpdate();
            }
        }

        this.signalGeometryUpdate();
    }

    private applyWindFast() {
        if (!this.windField) return;

        const globalResilienceBase = 0.1;

        for (const node of this.branches) {
            const wt = node.getWorldTransform();
            const pos = wt.getPosition();

            const wind = this.windField.getWindForceAtPosition(pos);
            const windStrength = wind.length;

            const originalDir = node.baseDirection;
            let targetDir: Vec3;

            if (windStrength > 0.0001) {
                const bending = wind.times(1.0 / node.stiffness);
                targetDir = originalDir.plus(bending).getNormalized();
            } else {
                targetDir = originalDir;
            }

            let resilienceSpeed = globalResilienceBase;
            if (windStrength < 0.001) {
                resilienceSpeed = globalResilienceBase * 2.0;
            }

            const currentDir = node.direction;
            const newDir = currentDir
                .times(1 - resilienceSpeed)
                .plus(targetDir.times(resilienceSpeed))
                .getNormalized();

            node.direction = newDir;
        }

        for (const leaf of this.leaves) {
            const parent = leaf.parent;
            if (parent instanceof TreeNode && parent.type === NodeTypes.BRANCH) {
                leaf.direction = parent.direction;
            }
        }
    }
}
