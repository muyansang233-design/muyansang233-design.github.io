import * as THREE from "three";
import { WindFieldModel } from "../FinalProject/Main_gpgpu_test/Nodes/Jacky-test1/Tree/WindFieldModel";
import { WindFieldView } from "../FinalProject/Main_gpgpu_test/Nodes/Jacky-test1/Tree/WindFieldView";
import { Color } from "../anigraph";
import { ABasicSceneController } from "../anigraph/starter";
import { TreeNode } from "../FinalProject/Main_gpgpu_test/Nodes/Jacky-test1/Tree/TreeNode";
import { TreeView } from "../FinalProject/Main_gpgpu_test/Nodes/Jacky-test1/Tree/TreeView";
import { TreeModel } from "../FinalProject/Main_gpgpu_test/Nodes/Jacky-test1/Tree/TreeModel";
import { TreeModelView } from "../FinalProject/Main_gpgpu_test/Nodes/Jacky-test1/Tree/TreeModelView";
import { LeafParticle } from "../FinalProject/Main_gpgpu_test/Nodes/Jacky-test1/Tree/LeafParticle";
import { LeafParticleView } from "../FinalProject/Main_gpgpu_test/Nodes/Jacky-test1/Tree/LeafParticleView";
import { LeafParticleSystemModel } from "../FinalProject/Main_gpgpu_test/Nodes/Jacky-test1/Tree/LeafParticleSystemModel";

export class TreeSceneController extends ABasicSceneController {
    async initScene(): Promise<void> {
        await super.initScene();
        this.setClearColor(new Color(0.039, 0.05, 0.067));

        const island = new THREE.Mesh(
            new THREE.CylinderGeometry(2.55, 2.65, 0.18, 72),
            new THREE.MeshBasicMaterial({ color: 0x354f43 })
        );
        island.rotation.x = Math.PI / 2;
        island.position.set(0.4, -0.25, -2.25);
        this.getThreeJSScene().add(island);
    }

    initModelViewSpecs(): void {
        super.initModelViewSpecs();
        this.addModelViewSpec(TreeNode, TreeView);
        this.addModelViewSpec(TreeModel, TreeModelView);
        this.addModelViewSpec(WindFieldModel, WindFieldView);
        this.addModelViewSpec(LeafParticleSystemModel, TreeModelView);
        this.addModelViewSpec(LeafParticle, LeafParticleView);
    }
}
