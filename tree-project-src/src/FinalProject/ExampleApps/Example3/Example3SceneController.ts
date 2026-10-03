import { ACameraElement} from "../../../anigraph/rendering/ACameraElement";
import {ExampleSceneController} from "../../StarterCode/Scene/ExampleSceneController";
import {
    ACameraModel,
    AGLContext,
    AGraphicElement,
    ASceneElement,
    AShaderMaterial,
    AShaderModel, ATriangleMeshView,
    GetAppState,
    Mat4,
    V2,
    V3, VertexArray3D
} from "../../../anigraph";

import * as THREE from "three";
import {Example3SceneConstants, Example3SceneModel} from "./Example3SceneModel";
import {ARenderTarget} from "../../../anigraph/rendering/target/ARenderTarget";
import {AssetManager} from "../../../anigraph/fileio/AAssetManager";
import {ABackgroundQuadModel} from "../../../anigraph/starter/nodes/backgroundquad/ABackgroundQuadModel";

const enum Constants{
    Pass1="Pass1",
    Pass2="Pass2",
}

const enum RENDER_TARGET_KEYS{
    RT1="target1",
    RT2="target2"
}

const RenderTargetWidth:number=512;
const RenderTargetHeight:number=512;

export class Example3SceneController extends ExampleSceneController{



    get model():Example3SceneModel{
        return this._model as Example3SceneModel;
    }

    /**
     * This is where you specify the mapping from model classes to view classes.
     */
    initModelViewSpecs(): void {
        super.initModelViewSpecs();
        this.addExampleModelViewSpecs();

        /**
         * Let's get the scene view corresponding to our scene model's pass2 model graph
         * @type {ASceneView}
         */
        let pass2view = this.getSceneView(Example3SceneConstants.POST_PROCESSING_PASS);

        /**
         * We will map our background quad model class to triangle mesh views. The background quad model is basically just a triangle mesh set to fill the screen of a given camera.
         */
        pass2view.addModelViewSpec(ABackgroundQuadModel, ATriangleMeshView)
    }

    async initScene(): Promise<void> {
        await super.initScene();
        this.loadSpaceSkymap();
    }

    initInteractions() {
        super.initInteractions();
    }

    onAnimationFrameCallback(context: AGLContext) {
        // super.onAnimationFrameCallback(context);
        this.multiPassOnAnimationFrameCallback(context)
    }

    multiPassOnAnimationFrameCallback(context:AGLContext) {
        this.model.timeUpdate()
        this.timeUpdate();

        /**
         * Set the render target to our texture target and clear it
         */
        this.setCurrentRenderTarget(this.model.renderToTextureTarget);
        context.renderer.clear();

        /**
         * Render the scene to the texture
         */
        context.renderer.render(this.getThreeJSScene(), this.getThreeJSCamera())

        /**
         * Setting the render target to null will make the screen our render target again
         */
        this.setCurrentRenderTarget(null);

        /**
         * Clear the screen buffer and render to it with:
         * - Our full screen quad using the post processing shader
         * - the inputMap sampler set to the texture we rendered in the previous pass
         */
        context.renderer.clear();

        /**
         * Get the pass 2 view
         * @type {ASceneView}
         */
        let pass2View = this.getSceneView(Example3SceneConstants.POST_PROCESSING_PASS);

        context.renderer.render(pass2View.threeJSScene, this.getThreeJSCamera(this.model.pass2CameraModel));
    }

}
