import { TreeSceneModel, TREE_ORBIT_TARGET } from "./TreeSceneModel";
import { WindFieldModel } from "../FinalProject/Main_gpgpu_test/Nodes/Jacky-test1/Tree/WindFieldModel";
import { WindFieldView } from "../FinalProject/Main_gpgpu_test/Nodes/Jacky-test1/Tree/WindFieldView";
import { Color, NodeTransform3D, V3 } from "../anigraph";
import { ADragInteraction, AInteractionEvent } from "../anigraph/interaction";
import { ABasicSceneController, ADebugInteractionMode } from "../anigraph/starter";
import { TreeNode } from "../FinalProject/Main_gpgpu_test/Nodes/Jacky-test1/Tree/TreeNode";
import { TreeView } from "../FinalProject/Main_gpgpu_test/Nodes/Jacky-test1/Tree/TreeView";
import { TreeModel } from "../FinalProject/Main_gpgpu_test/Nodes/Jacky-test1/Tree/TreeModel";
import { TreeModelView } from "../FinalProject/Main_gpgpu_test/Nodes/Jacky-test1/Tree/TreeModelView";
import { LeafParticle } from "../FinalProject/Main_gpgpu_test/Nodes/Jacky-test1/Tree/LeafParticle";
import { LeafParticleView } from "../FinalProject/Main_gpgpu_test/Nodes/Jacky-test1/Tree/LeafParticleView";
import { LeafParticleSystemModel } from "../FinalProject/Main_gpgpu_test/Nodes/Jacky-test1/Tree/LeafParticleSystemModel";

const WORLD_UP = V3(0, 0, 1);

class TreeOrbitInteractionMode extends ADebugInteractionMode {
    static NameInGUI = "Tree Orbit";

    // Disable the debug mode's WASD/free-flight camera movement.
    onKeyDown(): void {}

    onDragMove(event: AInteractionEvent, interaction: ADragInteraction): void {
        const cursor = event.ndcCursor;
        if (!cursor) return;
        const previous = interaction.getInteractionState("lastCursor");
        interaction.setInteractionState("lastCursor", cursor);
        if (!previous) return;

        const angle = -(cursor.x - previous.x) * this.cameraOrbitSpeed;
        const position = this.camera.nodeTransform.position;
        const x = position.x - TREE_ORBIT_TARGET.x;
        const y = position.y - TREE_ORBIT_TARGET.y;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        this.camera.setPose(NodeTransform3D.LookAt(
            V3(TREE_ORBIT_TARGET.x + x * cos - y * sin,
               TREE_ORBIT_TARGET.y + x * sin + y * cos,
               position.z),
            TREE_ORBIT_TARGET,
            WORLD_UP
        ));
    }

    onWheelMove(event: AInteractionEvent): void {
        const delta = (event.DOMEvent as WheelEvent).deltaY;
        if (!Number.isFinite(delta)) return;
        const offset = this.camera.nodeTransform.position.minus(TREE_ORBIT_TARGET);
        const currentDistance = offset.length;
        if (currentDistance < 0.001) return;
        const factor = Math.exp(Math.max(-500, Math.min(500, delta)) * 0.001);
        const distance = Math.max(3.5, Math.min(14, currentDistance * factor));
        this.camera.setPose(NodeTransform3D.LookAt(
            TREE_ORBIT_TARGET.plus(offset.times(distance / currentDistance)),
            TREE_ORBIT_TARGET,
            WORLD_UP
        ));
    }
}

export class TreeSceneController extends ABasicSceneController {
    initInteractions(): void {
        super.initInteractions();
        const orbitMode = new TreeOrbitInteractionMode(this, TreeOrbitInteractionMode.NameInGUI);
        this.defineInteractionMode(TreeOrbitInteractionMode.NameInGUI, orbitMode);
        this.setCurrentInteractionMode(TreeOrbitInteractionMode.NameInGUI);
        this.deleteInteractionMode(ADebugInteractionMode.NameInGUI);
    }

    async initScene(): Promise<void> {
        await super.initScene();
        this.setClearColor(new Color(0.039, 0.05, 0.067));
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
