import { AppState, NodeTransform3D, V3, Vec3 } from "../anigraph";
import { ABasicSceneModel } from "../anigraph/starter";
import { AssetManager } from "../anigraph/fileio/AAssetManager";
import { TreeModel } from "../FinalProject/Main_gpgpu_test/Nodes/Jacky-test1/Tree/TreeModel";
import { WindFieldModel } from "../FinalProject/Main_gpgpu_test/Nodes/Jacky-test1/Tree/WindFieldModel";
import { LeafParticleSystemModel } from "../FinalProject/Main_gpgpu_test/Nodes/Jacky-test1/Tree/LeafParticleSystemModel";

// A focused entry point for the original procedural tree work. No water models
// or water presets are created, loaded, or rendered by this scene.
export class TreeSceneModel extends ABasicSceneModel {
    private windField!: WindFieldModel;

    async PreloadAssets(): Promise<void> {
        await super.PreloadAssets();
        await AssetManager.loadShaderMaterialModel(AssetManager.DEFAULT_MATERIALS.BLINNPHONG);
    }

    initAppState(_appState: AppState): void {}

    initCamera(): void {
        this.initPerspectiveCameraFOV(Math.PI / 3, 1);
        this.camera.setPose(NodeTransform3D.LookAt(
            V3(-4.3, -6.2, 3.6),
            V3(0.4, -0.2, -0.9),
            V3(0, 0, 1)
        ));
    }

    initScene(): void {
        this.addViewLight();

        this.windField = new WindFieldModel(7, 7, 7);
        this.windField.globalWindStrength = 0.45;
        this.windField.globalWindDirection = V3(0.45, 0.1, 0);
        this.windField.isVisual = false;
        this.windField.transform.setPosition(V3(-3.5, -3.5, -3.5));

        this.addTree(V3(-0.85, 0, -0.1), 0.4);
        this.addTree(V3(2, -1.1, -0.3), 0.4);
    }

    private addTree(position: Vec3, scale: number): void {
        const tree = new TreeModel(3, 5, 5, this.windField, this.camera,
            position, V3(0, 0, -1), scale);
        this.addNode(tree);
        this.addNode(new LeafParticleSystemModel(tree.leaves, this.windField, tree, scale));
    }

    timeUpdate(time: number = this.clock.time): void {
        this.windField.timeUpdate(time);
        for (const node of this.getNodeModels()) node.timeUpdate(time);
    }
}
