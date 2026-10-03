import { AppState, NodeTransform3D, V3, Vec3 } from "../anigraph";
import { ABasicSceneModel } from "../anigraph/starter";
import { AssetManager } from "../anigraph/fileio/AAssetManager";
import { TreeModel } from "../FinalProject/Main_gpgpu_test/Nodes/Jacky-test1/Tree/TreeModel";
import { WindFieldModel } from "../FinalProject/Main_gpgpu_test/Nodes/Jacky-test1/Tree/WindFieldModel";
import { LeafParticleSystemModel } from "../FinalProject/Main_gpgpu_test/Nodes/Jacky-test1/Tree/LeafParticleSystemModel";

export const TREE_ORBIT_TARGET = V3(0.4, -0.2, -0.9);

// A focused entry point for the original procedural tree work. No water models
// or water presets are created, loaded, or rendered by this scene.
export class TreeSceneModel extends ABasicSceneModel {
    private windField!: WindFieldModel;
    private tree?: TreeModel;
    private leafParticles?: LeafParticleSystemModel;
    private windDirection = V3(1, 0.2, 0).getNormalized();
    private windStrength = 0.45;
    private windVisible = false;

    async PreloadAssets(): Promise<void> {
        await super.PreloadAssets();
        await AssetManager.loadShaderMaterialModel(AssetManager.DEFAULT_MATERIALS.BLINNPHONG);
    }

    initAppState(_appState: AppState): void {}

    initCamera(): void {
        this.initPerspectiveCameraFOV(Math.PI / 3, 1);
        this.camera.setPose(NodeTransform3D.LookAt(
            V3(-4.3, -6.2, 3.6),
            TREE_ORBIT_TARGET,
            V3(0, 0, 1)
        ));
    }

    initScene(): void {
        this.addViewLight();

        this.windField = new WindFieldModel(7, 7, 7);
        this.windField.globalWindStrength = this.windStrength;
        this.windField.globalWindDirection = this.windDirection;
        this.windField.isVisual = this.windVisible;
        this.windField.transform.setPosition(V3(-3.5, -3.5, -3.5));
        this.addNode(this.windField);

        this.addTree(V3(0.4, -0.2, -0.1), 0.4);
    }

    private addTree(position: Vec3, scale: number): void {
        this.tree = new TreeModel(3, 5, 5, this.windField, this.camera,
            position, V3(0, 0, -1), scale);
        this.leafParticles = new LeafParticleSystemModel(this.tree.leaves, this.windField, this.tree, scale);
        this.addNode(this.tree);
        this.addNode(this.leafParticles);
    }

    regenerateTree(): void {
        if (!this.windField) return;
        this.leafParticles?.release();
        this.tree?.release();
        this.addTree(V3(0.4, -0.2, -0.1), 0.4);
    }

    setWindDirection(x: number, y: number, z: number): void {
        if (![x, y, z].every(Number.isFinite)) return;
        const direction = V3(x, y, z);
        if (direction.length <= 0.0001) return;
        this.windDirection = direction.getNormalized();
        if (this.windField) this.windField.globalWindDirection = this.windDirection;
    }

    setWindStrength(strength: number): void {
        if (!Number.isFinite(strength)) return;
        this.windStrength = Math.max(0.25, Math.min(4, strength));
        if (this.windField) this.windField.globalWindStrength = this.windStrength;
    }

    setWindVisualization(visible: boolean): void {
        this.windVisible = visible;
        if (this.windField) this.windField.isVisual = visible;
    }

    timeUpdate(time: number = this.clock.time): void {
        for (const node of this.getNodeModels()) node.timeUpdate(time);
    }
}
