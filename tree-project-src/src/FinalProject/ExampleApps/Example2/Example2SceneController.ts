import { ACameraElement} from "../../../anigraph/rendering/ACameraElement";
import {ExampleSceneController} from "../../StarterCode/Scene/ExampleSceneController";
import {
    AGLContext,
    AGraphicElement,
    ASceneElement,
    AShaderMaterial,
    AShaderModel,
    Color,
    GetAppState,
    Mat4,
    V2,
    V3, VertexArray3D
} from "../../../anigraph";

import * as THREE from "three";
import { Example2SceneModel } from "./Example2SceneModel";
import {ARenderTarget} from "../../../anigraph/rendering/target/ARenderTarget";

const enum RENDER_TARGET_KEYS{
    RT1="target1",
    RT2="target2"
}

// You may want to increase the mirror texture resolution for higher quality visual results.
const RenderTargetWidth:number=512;
const RenderTargetHeight:number=512;
export class Example2SceneController extends ExampleSceneController{

    /**
     * We will flip between using one target as our texture one frame and using it as a destination for the next frame. This number keeps track of which target is texture and which one is destination.
     * @type {number}
     */
    currentRenderTargetTextureIndex:number=0;

    get model():Example2SceneModel{
        return this._model as Example2SceneModel;
    }

    /**
     * This is where you specify the mapping from model classes to view classes.
     */
    initModelViewSpecs(): void {
       super.initModelViewSpecs();
       this.addExampleModelViewSpecs();
    }

    async initScene(): Promise<void> {
        await super.initScene();
        this.loadSpaceSkymap();
    }

    initInteractions() {
        super.initInteractions();
    }

    /**
     * In the examples that don't have multipass we didn't need to change how rendering was initialized. Now we want to set up resources / buffers for our passes, so we add that here.
     * @returns {Promise<void>}
     */
    async initRendering(): Promise<void> {
        await super.initRendering(); // initScene will be called here
        await this.initMultipassEffect(); // we create our postprocessing material here
    }

    /**
     * Here we allocate resources for our multipass effect and bind them to the appropriate shader material
     * @returns {Promise<void>}
     */
    async initMultipassEffect(){
        let appState = GetAppState();

        /**
         * Let's create two render targets. Each render target is a texture / buffer that we can render to and use as a texture. We are making two so that we can use them in a dual-buffer way. That means that during one frame we will render to one of the buffers and read from the other, and the next frame we will switch which one we read and which one we write.
         * Note that we could create more than one of these if we wanted. Also, you can create them yourself and save them to your own variable, but here we are using a convenience function that adds a new render target to this.renderTargets
         * @type {ARenderTarget}
         */
        this.addRenderTarget(RenderTargetWidth, RenderTargetHeight);
        this.addRenderTarget(RenderTargetWidth, RenderTargetHeight);
    }





    onAnimationFrameCallback(context:AGLContext) {
        /**
         * Start by updating the model logic and interactions
         */
        this.model.timeUpdate()
        this.timeUpdate();

        /**
         * Now we choose which render target we will use as a texture for this frame, and which we will use as a destination.
         * @type {number}
         */
        let nextIndex = (this.currentRenderTargetTextureIndex+1)%2;
        let currentTextureBuffer = this.renderTargets[this.currentRenderTargetTextureIndex];
        let currentDestinationBuffer = this.renderTargets[nextIndex];

        /**
         * We update our index so that next frame the two buffers swap roles
         * @type {number}
         */
        this.currentRenderTargetTextureIndex = nextIndex;



        /****************** First Pass *******************/
        /**
         * Tell the model to prep for our first pass,
         */
        this.model.prepForFirstPass(currentTextureBuffer);

        /**
         * Set the render target to our texture target and clear it
         */
        this.setCurrentRenderTarget(currentDestinationBuffer);
        context.renderer.clear();

        /**
         * Render the scene to texture from our model's virtualScreenCamera perspective
         */
        context.renderer.render(this.getThreeJSScene(), this.getThreeJSCamera(this.model.virtualScreenCamera))
        // console.log("camera pos:", this.getThreeJSCamera(this.model.virtualScreenCamera).position);

        /****************** Second Pass *******************/
        /**
         * Setting the render target to null will make the screen our render target again
         */
        this.setCurrentRenderTarget(null);

        /**
         * Prep for our second pass and then render it
         */
        this.model.prepForSecondPass(currentDestinationBuffer);
        context.renderer.clear();
        context.renderer.render(this.getThreeJSScene(), this.getThreeJSCamera());
        // console.log("camera pos:", this.getThreeJSCamera().position);
    }
}
