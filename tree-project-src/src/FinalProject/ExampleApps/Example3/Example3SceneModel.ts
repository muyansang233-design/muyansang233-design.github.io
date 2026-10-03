import {
    ACameraModel,
    AInteractionEvent, AMaterial,
    AObject3DModelWrapper,
    AppState,
    AShaderMaterial, AssetManager,
    NodeTransform3D,
    Quaternion,
    V3,
    Vec2
} from "../../../anigraph";
// import { ExampleLoadedCharacterModel, ExampleParticleSystemModel} from "../../StarterClasses/CustomNodes";
import { ExampleSceneModel} from "../../StarterCode/Scene/ExampleSceneModel";
import {ABlinnPhongShaderModel} from "../../../anigraph/rendering/shadermodels";
import {CharacterModel} from "../../../anigraph/starter/nodes/character";
import {ExampleLoadedCharacterModel} from "../../StarterCode/CustomNodes";
import {ExampleAssetModels} from "../../../anigraph/starter/ExampleAssets";
import {ABackgroundQuadModel} from "../../../anigraph/starter/nodes/backgroundquad/ABackgroundQuadModel";
import {AModelGraph} from "../../../anigraph/scene/AModelGraph";
import {ARenderTarget} from "../../../anigraph/rendering/target";

export const enum Example3SceneConstants {
    _VIEW_LIGHT_SUBSCRIPTION_KEY ="VIEW_LIGHT_CAMERA_UPDATE_SUB",
    POP_SOUND = "POP_SOUND",
    // ASSET_TO_LOAD = "dragon",
    // ASSET_TO_LOAD = "LabCat",
    // ASSET_TO_LOAD = "cat",
    // ASSET_TO_LOAD = "duck",
    ASSET_TO_LOAD = "car1",
    POST_PROCESSING_PASS = "PostProcessingPass",
    POST_PROCESSING_SHADER ="postprocessing",
    TEXTURE_TARGET_WIDTH = 1024,
    TEXTURE_TARGET_HEIGHT = 1024,
}


export class Example3SceneModel extends ExampleSceneModel {
    pass2CameraModel!:ACameraModel;
    pass2Quad!:ABackgroundQuadModel
    pass2ModelGraph!:AModelGraph;
    pass2Material!:AShaderMaterial;
    renderToTextureTarget!:ARenderTarget


    initAppState(appState: AppState) {
        ABlinnPhongShaderModel.AddAppState();

        /**
         * Add a slider to control one of our uniforms
         */
        appState.addSliderIfMissing("sliderValue", 0,-1,1,0.01);
    }

    async PreloadAssets() {
        await super.PreloadAssets();
        await super.LoadExampleTextures();
        await super.LoadExampleModelClassShaders();
        await AssetManager.loadModelAsset(Example3SceneConstants.ASSET_TO_LOAD);

        /**
         * Load the shader code. If your shader name and location follow the conventions of public/shaders,
         * then this might get done automatically when you load the shader material model later.
         * However, the code below shows how you would load shader code with custom names and paths.
         */
        // await AssetManager.shaders.LoadShader(
        //     "postprocessing",
        //     "./postprocessing/postprocessing.vert.glsl",
        //     "./postprocessing/postprocessing.frag.glsl"
        // )
        await AssetManager.loadShaderMaterialModel(Example3SceneConstants.POST_PROCESSING_SHADER);

    }


    initCamera() {

        /**
         * Initialize our main camera model, which will be the one the user controls.
         * @type {ACameraModel}
         */
        this.cameraModel = ACameraModel.CreatePerspectiveFOV(0.5*Math.PI, 1.0);
        this.addNode(this.cameraModel);
        // the ground is the xy plane
        this.camera.setPose(NodeTransform3D.LookAt(V3(0,0,1), V3(), V3(0,1,0)));

        /**
         * We'll also create a camera model for rendering to a full screen quad in our second pass.
         * @type {ACameraModel}
         */
        this.pass2CameraModel = ACameraModel.CreateOrthographic(-0.5,0.5,-0.5,0.5);
        this.addNode(this.pass2CameraModel);
    }

    initCharacters(){
        let playerMaterial = CharacterModel.CreateMaterial();
        this.player = AssetManager.createModelFromAsset(
            Example3SceneConstants.ASSET_TO_LOAD,
            ExampleLoadedCharacterModel,
            playerMaterial
        ) as ExampleLoadedCharacterModel;
        this.addNode(this.player)
        ABlinnPhongShaderModel.attachMaterialUniformsToAppState(this.player.material)
    }


    initScene() {
        this.addViewLight();
        this.initTerrain();
        this.initCharacters();

        this.initPass2()
    }

    initPass2() {

        /**
         * Let's create a render target. This is a texture / buffer that we can render to
         * Note that we could create more than one of these if we wanted
         * @type {ARenderTarget}
         */
        this.renderToTextureTarget = ARenderTarget.CreateFloatRGBATarget(Example3SceneConstants.TEXTURE_TARGET_WIDTH, Example3SceneConstants.TEXTURE_TARGET_HEIGHT);

        /**
         * Let's set the "input" sampler uniform in our post processing shader to be our textureRenderTarget's texture
         */
        this.pass2Material = AssetManager.CreateShaderMaterial(Example3SceneConstants.POST_PROCESSING_SHADER);
        this.pass2Material.setTexture("input", this.renderToTextureTarget.targetTexture);
        this.pass2Material.attachUniformToAppState("sliderValue", "sliderValue")

        /**
         * Create a second model graph for our second pass
         * @type {AModelGraph}
         */
        this.pass2ModelGraph = this.createModelGraph(Example3SceneConstants.POST_PROCESSING_PASS)

        this.pass2Quad = new ABackgroundQuadModel(this.pass2CameraModel);
        this.pass2Quad.setMaterial(this.pass2Material)
        this.pass2ModelGraph.addNode(this.pass2Quad)
    }


    /**
     * We update the scene here
     * @param t
     * @param args
     */
    timeUpdate(t?: number, ...args:any[]) {
        t = t??this.clock.time;
        super.timeUpdateDescendants(t);

    }

    getCoordinatesForCursorEvent(event: AInteractionEvent){
        return event.ndcCursor??new Vec2();
    }
}


