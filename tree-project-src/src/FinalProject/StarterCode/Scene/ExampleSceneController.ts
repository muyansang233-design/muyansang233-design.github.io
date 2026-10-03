import {
    BillboardParticleSystemModel, BillboardParticleSystemView,
    BotModel,
    BotView, ExampleLoadedCharacterModel, ExampleLoadedView, ExampleParticleSystemModel, ExampleParticleSystemView,
    PlayerModel,
    PlayerView,
    TerrainModel,
    TerrainView, TriangleMeshCharacterModel, TriangleMeshCharacterView
} from "../CustomNodes";
import {ExamplePlayerInteractionMode, ExamplePointerLockInteractionMode} from "../InteractionModes";
import {
    AGLContext, AGroupNodeModel2D, AGroupNodeModel3D,
    ANodeModel,
    ANodeView, APointLightModel, APointLightView,
    ATriangleMeshModel,
    ATriangleMeshView, AVisiblePointLightModel, AVisiblePointLightView,
    GetAppState,
    Quaternion, UnitQuadModel, UnitQuadView
} from "../../../anigraph";
import {ExampleSceneModel} from "./ExampleSceneModel";
import {ABasicSceneController} from "../../../anigraph/starter";
import {LoadedCharacterModel, LoadedCharacterView} from "../../../anigraph/starter/nodes/character";
import {ALoadedModel} from "../../../anigraph/scene/nodes/loaded/ALoadedModel";
import {ALoadedView} from "../../../anigraph/scene/nodes/loaded/ALoadedView";
import {RGBATestMeshModel, RGBATestMeshView} from "../../../anigraph/starter/nodes";
import {AGroupNodeView2D, AGroupNodeView3D} from "../../../anigraph/scene/nodeView/AGroupNodeView";
import {AssetManager} from "../../../anigraph/fileio/AAssetManager";

export class ExampleSceneController extends ABasicSceneController{
    get model():ExampleSceneModel{
        return this._model as ExampleSceneModel;
    }

    /**
     * So that interaction modes know how to access the model's player
     * @returns {CharacterModel}
     */
    get player(){
        return this.model.player;
    }

    /**
     * add the example model view specs
     */
    addExampleModelViewSpecs(): void {
        this.addModelViewSpec(ALoadedModel, ALoadedView);
        this.addModelViewSpec(RGBATestMeshModel, RGBATestMeshView);
        this.addModelViewSpec(ATriangleMeshModel, ATriangleMeshView);
        this.addModelViewSpec(UnitQuadModel, UnitQuadView);
        this.addModelViewSpec(APointLightModel, APointLightView);
        this.addModelViewSpec(AVisiblePointLightModel, AVisiblePointLightView);
        this.addModelViewSpec(AGroupNodeModel2D, AGroupNodeView2D);
        this.addModelViewSpec(AGroupNodeModel3D, AGroupNodeView3D);
        this.addModelViewSpec(TriangleMeshCharacterModel, TriangleMeshCharacterView);
        this.addModelViewSpec(TerrainModel, TerrainView);
        this.addModelViewSpec(PlayerModel, PlayerView);
        this.addModelViewSpec(BotModel, BotView);
        this.addModelViewSpec(ExampleParticleSystemModel, ExampleParticleSystemView);
        this.addModelViewSpec(BillboardParticleSystemModel, BillboardParticleSystemView);
        this.addModelViewSpec(ExampleLoadedCharacterModel, ExampleLoadedView)
        this.addModelViewSpec(LoadedCharacterModel, LoadedCharacterView)
    }

    /**
     * Initialize / add example interaction modes
     */
    initExampleInteractions() {
        /**
         * This code adds the ExamplePlayer interaction mode and sets it as the current active mode
         */
        let playerInteractionMode = new ExamplePlayerInteractionMode(this);
        playerInteractionMode.cameraTarget = this.model.player;
        this.defineInteractionMode("ExamplePlayer", playerInteractionMode);


        let pointerLockInteractionMode = new ExamplePointerLockInteractionMode(this);
        this.defineInteractionMode("ExamplePointerLock", pointerLockInteractionMode);

        /**
         * If we want to start out in debug interaction mode we have a convenience method for switching to it
         */
        this.switchToDebugInteractionMode()

        /**
         * if we want to switch to one of the others we can do that like this
         */
        // this.setCurrentInteractionMode("ExamplePlayer");

    }

    loadSpaceSkymap(){
        /**
         * Set up the skybox background
         */
        // let urls = [];
        // for(let i=0;i<6; i++) {
        //     urls.push("./images/cube/spaceface/spaceface.jpg")
        // }
        this.initSkyBoxCubeMap(
            undefined, undefined,
            // Quaternion.RotationX(Math.PI*0.5)
        );
    }

    initInteractions() {
        /**
         * We will define the debug interaction mode here.
         * The debug mode is offered mainly to provide camera controls for developing and debugging non-control-related
         * features. It may also be useful as an example for you to look at if you like.
         */
        super.initInteractions();
    }

    /**
     * This is what gets called every time the browser grabs a new frame to render
     * @param context
     */
    onAnimationFrameCallback(context:AGLContext) {
        /**
         * let's update the model...
         */
        this.model.timeUpdate(this.model.clock.time);

        /**
         * and let's update the controller...
         * This will mostly update any interactions that depend on time.
         * Keep in mind that the model and controller run on separate clocks for this, since we may
         * want to pause our model's clock and continue interacting with the scene (e.g., moving the camera around).
         */
        this.timeUpdate();

        /**
         * Clear the rendering context.
         * you can also specify which buffers to clear: clear(color?: boolean, depth?: boolean, stencil?: boolean)
         * ``` this.renderer.clear(false, true); ```
         */
        context.renderer.clear();

        // render the scene view
        context.renderer.render(this.getThreeJSScene(), this.getThreeJSCamera());
    }



}



