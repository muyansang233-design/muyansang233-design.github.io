import {ShaderDemoUnabridgedSceneModel} from "./ShaderDemoUnabridgedSceneModel";
import {
    AGLContext,
    APointLightModel,
    APointLightView,
    AVisiblePointLightModel,
    AVisiblePointLightView,
} from "../../../anigraph";
import {ShaderDemoUnabridgedInteractionMode} from "./ShaderDemoUnabridgedInteractionMode";
import {ABasicSceneController} from "../../../anigraph/starter";
import {ALoadedModel} from "../../../anigraph/scene/nodes/loaded/ALoadedModel";
import {ALoadedView} from "../../../anigraph/scene/nodes/loaded/ALoadedView";
import {RGBATestMeshModel, RGBATestMeshView} from "../../../anigraph/starter/nodes";

/**
 * This is your Main Controller class. The scene controller is responsible for managing user input with the keyboard
 * and mouse, as well as making sure that the view hierarchy matches the model heirarchy.
 */
export class ShaderDemoUnabridgedSceneController extends ABasicSceneController{
    get model():ShaderDemoUnabridgedSceneModel{
        return this._model as ShaderDemoUnabridgedSceneModel;
    }



    async initScene(): Promise<void> {
        // You can set the clear color for the rendering context
        await super.initScene();
    }

    /**
     * initialize interaction modes
     */
    initInteractions() {
        /**
         * The parent call will trigger the following lines
         * this.setCurrentInteractionMode();
         * this.addDebugInteractionMode();
         *
         * The first line sets the default interaction mode
         * The second line creates and adds a debug interaction mode, which is provided to make initial debugging a bit easier for you
         */
        super.initInteractions();

        /**
         * Let's create our own custom interaction mode
         * @type {ShaderDemoUnabridgedInteractionMode}
         */
        let shaderInteractionMode = new ShaderDemoUnabridgedInteractionMode(this);

        /**
         * Define it as one of the modes associated with this scene controller
         */
        this.defineInteractionMode("shader", shaderInteractionMode);

        /**
         * Set the current interaction mode to the one we just created.
         */
        this.setCurrentInteractionMode("shader");
    }


    /**
     * Specifies what view classes to use for different model class.
     * If you create custom models and views, you will need to link them here by calling `addModelViewSpec` with the
     * model class as the first argument and the view class as the second.
     */
    initModelViewSpecs() {
        // Call the super function if you want default specs
        // super.initModelViewSpecs();

        /**
         * Technically, we only have three node model types in this scene, so we could get away with only those three
         */
        this.addModelViewSpec(ALoadedModel, ALoadedView);
        this.addModelViewSpec(APointLightModel, APointLightView);
        this.addModelViewSpec(AVisiblePointLightModel, AVisiblePointLightView);

    }

    onAnimationFrameCallback(context:AGLContext) {
        super.onAnimationFrameCallback(context);
    }



}
