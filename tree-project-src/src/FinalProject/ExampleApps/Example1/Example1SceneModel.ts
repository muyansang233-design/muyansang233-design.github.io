import {
    ACameraModel, AInteractionEvent, AMaterial,
    AppState, GetAppState,
    NodeTransform3D, Particle3D,
    V3, Vec2
} from "../../../anigraph";
import {
    BillboardParticleSystemModel
} from "../../StarterCode/CustomNodes";
import {ExampleSceneModel} from "../../StarterCode/Scene/ExampleSceneModel";
import {ABlinnPhongShaderModel, BlinnPhongMaterial} from "../../../anigraph/rendering/shadermodels";
import {CharacterModel, LoadedCharacterModel} from "../../../anigraph/starter/nodes/character";
import {AssetManager} from "../../../anigraph/fileio/AAssetManager";

const PLAYER_MODEL_NAME = "duck";

export class Example1SceneModel extends ExampleSceneModel {
    billboardParticles!:BillboardParticleSystemModel;

    /**
     * Optionally add some app state here. Good place to set up custom control panel controls.
     * @param appState
     */
    initAppState(appState: AppState): void {

        /**
         * Adding sliders to control blinn phong parameters
         * We can attach the corresponding parameters for a material later on by calling
         * ```
         * ABlinnPhongShaderModel.attachMaterialUniformsToAppState(material);
         * ```
         */
        ABlinnPhongShaderModel.AddAppState();
        BillboardParticleSystemModel.AddParticleSystemControls();

    }


    async PreloadAssets() {
        await super.PreloadAssets();
        await this.LoadExampleTextures();
        await this.LoadExampleModelClassShaders()

        // You can load shader source like this if it's not already integrated into other code
        let appState = GetAppState();
        await AssetManager.loadShaderMaterialModel("diffuse");




        await AssetManager.loadModelAsset(PLAYER_MODEL_NAME);
    }

    /**
     * Here is an example of overriding the parent's initCamera.
     */
    initCamera() {
        this.cameraModel = ACameraModel.CreatePerspectiveFOV(90, 1, 0.01, 10);
        this.cameraModel.setPose(
            NodeTransform3D.LookAt(
                V3(0, -1, 1),
                V3(0,0,0),
                V3(0,0,1)
            )
        )
        this.addNode(this.cameraModel);
    }

    initScene() {
        /**
         * We need to add a light before we can see anything.
         * The easiest thing is to just attach a point light to the camera.
         */
        this.addViewLight();

        /**
         * initialize terrain
         * Check ExampleSceneModel.initTerrain() for details.
         */
        this.initTerrain();



        /**
         * Let's generate a random slightly bumpy terrain.
         * It's just uniform random bumps right now, nothing fancy.
         */
        this.terrain.reRollRandomHeightMap(0.0);
        // await this.addBotsInHierarchy();


        /***********************/
        /**
         * Now we'll add a player character based on a loaded 3D model. There are going to be some restrictions on what you can load, but simple models should work fine.
         */

        /**
         * Let's start by creating a shader material to render our model. We'll use the simple diffuse material defined in the "shaders/diffuse" folder.
         * @type {AShaderMaterial}
         */
        let playerMaterial = AssetManager.CreateShaderMaterial("diffuse");

        // We'll set the diffuse and ambient coefficients here, which correspond to uniforms in the fragment shader.
        playerMaterial.setUniform("diffuse", 1.0);
        playerMaterial.setUniform("ambient", 0.05);


        /**
         * Now we'll create a model from an asset we loaded earlier in our PreloadAssets() function.
         * I've provided you with the AssetManager class to make things easier.
         * The important inputs are going to be:
         * - the name of the 3D model asset, which should match the name used to load the asset.
         * - the model class you want to create, which should inherit from ALoadedModel
         * - the material to use for the model
         * If you want more custom behavior, you are welcome to look through the source behind this function to figure out how it work under the hood.
         * @type {LoadedCharacterModel}
         */
        this.player = AssetManager.createModelFromAsset(
            PLAYER_MODEL_NAME,
            LoadedCharacterModel,
            playerMaterial
        ) as LoadedCharacterModel;

        // add the player to the scene
        this.addNode(this.player)
        /***********************/

        /**
         * We provide a starter node for bilboard particle systems.
         * It shows you how to create instanced particles, similar to the 2D starter code you had in C1,
         * However, these particles do not have billboarding implemented yet.
         * You will need to modify the code so that they always point toward the camera to get bilboarding to work.
         */
        this.addExampleBilboardParticleSystem();

        /**
         * Adding app state to switch between front and back face culling.
         * This might be handy for those of you interested in implementing toon shading.
         */
        GetAppState().addCheckboxControl("CullFront", false);
        const self = this;
        this.subscribeToAppState("CullFront", (v:boolean)=>{
            if(v) {
                self.player.material.setRenderSide(AMaterial.GEOMETRY_SIDE.BACK)
            }else{
                self.player.material.setRenderSide(AMaterial.GEOMETRY_SIDE.FRONT)
            }
        })

        /**
         * Here we attach our character's shader parameters to controls in the control panel.
         * Note that the diffuse shader does not add specular shading, so the specular sliders won't do anything.
         * They will if you use a shader with the corresponding uniforms, though (like BlinnPhong)
         */
        ABlinnPhongShaderModel.attachMaterialUniformsToAppState(this.player.material);
    }


    getCoordinatesForCursorEvent(event: AInteractionEvent){
        return event.ndcCursor??new Vec2();
    }

    /**
     * Here we will separate out logic that check to see if an object intersects the terrain.
     * @param object
     */
    adjustObjectHeight(object:Particle3D){
        let height = this.terrain.getTerrainHeightAtPoint(object.position.xy);
        if(object.position.z<height){object.position.z = height;}
    }



    timeUpdate(t: number, ...args:any[]) {

        this.timeUpdateDescendants(t);
        this.adjustObjectHeight(this.player);
        for(let ei=0;ei<this.bots.length;ei++){
            let e = this.bots[ei];
            /**
             * adjust their height
             */
            this.adjustObjectHeight(e);
        }
        // this.timeUpdateOrbitBots(t);
    }


}


