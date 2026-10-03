import {
    APointLightModel,
    AppState, AVisiblePointLightModel, Color,
    GetAppState, V3, NodeTransform3D
} from "../../../anigraph";
import {ALoadedModel} from "../../../anigraph/scene/nodes/loaded/ALoadedModel";
import {ShaderDemoShaderModel} from "./ShaderDemoShaderModel";
import {ABlinnPhongShaderModel} from "../../../anigraph/rendering/shadermodels";
import {ExampleSceneModel} from "../../StarterCode/Scene/ExampleSceneModel";
import {ExampleLoadedCharacterModel} from "../../StarterCode/CustomNodes";
import {AssetManager} from "../../../anigraph/fileio/AAssetManager";

enum SHADERS{
    DEMOSHADER="demoshader",
}

const MODEL_CHOICE = "LabCat";

// const MODEL_CHOICE = "dragon";

/**
 * This is your Main Model class. The scene model is the main data model for your application. It is the root for a
 * hierarchy of models that make up your scene/
 */
export class ShaderDemoSceneModel extends ExampleSceneModel{
    lights:APointLightModel[]=[];
    /**
     * This will add variables to the control pannel
     * @param appState
     */
    initAppState(appState:AppState){
        ShaderDemoShaderModel.AddAppState();
        appState.addColorControl("NewLight", Color.White());
    }

    initCamera(...args: any[]) {
        super.initCamera(...args);
        this.camera.setPose(NodeTransform3D.LookAt(V3(0,1,1), V3(), V3(0,0,1)));
    }


    async PreloadAssets(): Promise<void> {
        let appState = GetAppState();
        await super.PreloadAssets();
        await this.LoadExampleModelClassShaders();
        await AssetManager.loadModelAsset(MODEL_CHOICE);


        /**
         * This will call:
         * let demoShaderModel = await ABasicShaderModel.CreateModel("demoshader", ...args);
         * appState.setMaterialModel("demoshader", demoShaderModel);
         *
         * You could pass custom args in after the second parameter
         */
        await AssetManager.addShaderMaterialModel(SHADERS.DEMOSHADER, ShaderDemoShaderModel);
        AssetManager.getShaderMaterialModel(SHADERS.DEMOSHADER).usesVertexColors=true;
    }


    addLight(){
        let appState = GetAppState();
        let lightColor = appState.getState("NewLight");

        /**
         * This creates a point light with a small sphere around it (so we can see where the point light is)
         * @type {AVisiblePointLightModel}
         */
        let light = new AVisiblePointLightModel(
            this.camera.transform.clone(),
            lightColor,1, 1, 1
        );

        this.lights.push(light);
        this.addNode(light)
    }

    /**
     * Use this function to initialize the content of the scene.
     * Generally, this will involve creating instances of ANodeModel subclasses and adding them as children of the scene:
     * ```
     * let myNewModel = new MyModelClass(...);
     * this.addChild(myNewModel);
     * ```
     *
     * You may also want to add tags to your models, which provide an additional way to control how they are rendered
     * by the scene controller. See example code below.
     */
    initScene(){
        let appState = GetAppState();
        this.addViewLight();
        let material = AssetManager.CreateShaderMaterial(SHADERS.DEMOSHADER);

        /**
         * This call will attach the appropriate parameters of our shader material instance to the sliders for diffuse, specular, specularExp, ambient
         */
        ABlinnPhongShaderModel.attachMaterialUniformsToAppState(material);
        this.player = AssetManager.createModelFromAsset(
            MODEL_CHOICE,
            ExampleLoadedCharacterModel,
            material
        ) as ExampleLoadedCharacterModel;
        this.addNode(this.player)

    }


    timeUpdate(t?: number):void;
    timeUpdate(...args:any[])
    {
        let t = this.clock.time;
        if(args != undefined && args.length>0){
            t = args[0];
        }

        let appState = GetAppState();
        appState.setState("time", this.clock.time);

        /**
         * Update stuff here
         */

    }
};
