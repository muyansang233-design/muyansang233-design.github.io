import {
    ACameraModel, ACameraView,
    AGLContext,
    ANodeModel, ANodeView, APointLightModel, APointLightView,
    ASceneView, AVisiblePointLightModel, AVisiblePointLightView,
    Color,
    GetAppState, NodeTransform3D, V2, V3,
} from "../../../anigraph";
import {MultipassExampleSceneModel} from "./MultipassExampleSceneModel";
import {
    PlayerModel, PlayerView, TerrainModel, TerrainView,
    TriangleMeshCharacterModel,
    TriangleMeshCharacterView
} from "../../StarterCode/CustomNodes";
import {LoadedCharacterModel, LoadedCharacterView} from "../../../anigraph/starter/nodes/character";
import {ABasicSceneController, ADebugInteractionMode} from "../../../anigraph/starter";
import {MyCustomInteractionMode} from "./MyCustomInteractionMode";
import {Pass2NodeView} from "./nodes/pass2node/Pass2NodeView";

enum Constants {
    SECOND_SCENE_VIEW = "SecondSceneView"
}
export class MultipassExampleSceneController extends ABasicSceneController {

    get model():MultipassExampleSceneModel{
        return this._model as MultipassExampleSceneModel;
    }

    /**
     * This is where you specify the mapping from model classes to view classes.
     */
    initModelViewSpecs(): void {
        super.initModelViewSpecs()
        this.addModelViewSpec(TerrainModel, TerrainView);
        this.addModelViewSpec(LoadedCharacterModel,LoadedCharacterView);
        this.addModelViewSpec(AVisiblePointLightModel, AVisiblePointLightView);

        /**
         * Here we create a second render pass that uses the same model graph as the first pass
         * @type {ASceneView}
         */
        let pass2 = this.createSceneView(Constants.SECOND_SCENE_VIEW, this.model.modelGraph);

        /**
         * We can set a default view class to use for any model class that doesn't have an explicit spec associated with it. This is useful if you want to maintain the transformation hierarchy, but only want to render some models in a particular pass.
         */
        pass2.addModelViewSpec(AVisiblePointLightModel, AVisiblePointLightView);
        pass2.addModelViewSpec(LoadedCharacterModel, Pass2NodeView)
        pass2.addModelViewSpec(TerrainModel, TerrainView);
    }


    async initScene(): Promise<void> {
        let appState = GetAppState();
        const self = this;
        await super.initScene()
        this.initSkyBoxCubeMap();
        this.setClearColor(Color.Black());

        let pass2 = this.getSceneView(Constants.SECOND_SCENE_VIEW);
    }

    initInteractions() {
        let debugInteractionMode = new ADebugInteractionMode(this);
        this.defineInteractionMode(ADebugInteractionMode.NameInGUI, debugInteractionMode);
        let myCustomInteractionMode = new MyCustomInteractionMode(this);
        this.defineInteractionMode(MyCustomInteractionMode.NameInGUI, myCustomInteractionMode);
        this.setCurrentInteractionMode(MyCustomInteractionMode.NameInGUI);

    }

    /**
     *
     * @param {AGLContext} context
     */
    onAnimationFrameCallback(context: AGLContext) {
        /**
         * let's update the model...
         */
        this.model.timeUpdate(this.time);
        this.interactionMode.timeUpdate(this.time);
        // this.pass2CameraModel.setPose(this.cameraModel.pose);

        /**
         * Clear the context when the viewport is set to the full screen
         */
        context.renderer.clear();

        // you could also specify which buffers to clear: clear(color?: boolean, depth?: boolean, stencil?: boolean)
        // this.renderer.clear(false, true);
        // context.renderer.clearDepth()

        /**
         * Gets the current viewport
         */
        let [x,y,w,h] = context.getViewport();

        /**
         * We will render the left and right half of the screen differently
         */
        let vsize= 0.5

        /**
         * Set left viewport and render first pass with perspective camera
         */
        let leftViewport = [0, h*vsize*0.5, w*vsize, h*vsize];
        context.setViewport(leftViewport);
        context.renderer.render(this.getThreeJSScene(), this.getThreeJSCamera());

        /**
         * Now the second pass
         */
        let pass2 = this.getSceneView(Constants.SECOND_SCENE_VIEW) as ASceneView;
        let pass2ThreeJSScene = pass2.threeJSScene;

        /**
         * Set the right viewport and render second pass with ortho camera
         */
        let rightViewport = [w-w*vsize, h*vsize*0.5, w*vsize, h*vsize];
        context.setViewport(rightViewport);
        context.renderer.render(pass2ThreeJSScene, this.getThreeJSCamera(this.model.pass2CameraModel));

        /**
         * Reset the viewport
         */
        context.renderer.setViewport(x,y,w,h)
    }

}




