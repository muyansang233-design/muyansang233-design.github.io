/**
 * @file Main scene model
 * @description Scene model for your application
 */

import {
    AInteractionEvent,
    AppState, ATriangleMeshModel,
    GetAppState, NodeTransform3D, Quaternion,
    V2,
    V3,
    V4,
    Vec2, VertexArray3D
} from "../../../anigraph";
import {ExampleSceneModel} from "../../StarterCode/Scene/ExampleSceneModel";
import {BillboardParticleSystemModel, ExampleParticleSystemModel} from "../../StarterCode/CustomNodes";
import {UpdateGUIJSX, UpdateGUIWithBots} from "./GUIHelpers";
import {ABlinnPhongShaderModel} from "../../../anigraph/rendering/shadermodels";
import {CharacterModel, CharacterShaderModel} from "../../../anigraph/starter/nodes/character";
import {AssetManager} from "../../../anigraph/fileio/AAssetManager";

// The name of our app state in the control pannel
const TerrainSliderAppStateName:string="TerrainSlider";

// The name of the uniform we want to reference in our terrain shader
const TerrainSliderUniformName:string="textureTransition"

export class Example0SceneModel extends ExampleSceneModel {
    playerParticleSystemModel!:ExampleParticleSystemModel;

    initAppState(appState: AppState): void {
        BillboardParticleSystemModel.AddParticleSystemControls();

        /**
         * Here we will specify functions that determine what is displayed in the react gui part of our webpage
         */
        appState.setReactGUIContentFunction(UpdateGUIJSX);
        appState.setReactGUIBottomContentFunction(UpdateGUIWithBots);

        /**
         * Let's create an app state slider with the terrain slider app state name we want.
         * We will use this slider to control the textureTransition uniform in our terrain
         * shader later in this example
         */
        appState.addSliderIfMissing(TerrainSliderAppStateName, 0, -1, 1, 0.01);
        appState.addCheckboxControl("MixedTerrain", false);

        // Optionally add standard Blinn Phone model controls
        ABlinnPhongShaderModel.AddAppState();
        // You can hook materials up to these controls later with:
        // ABlinnPhongShaderModel.attachMaterialUniformsToAppState(material);

    }

    async PreloadAssets() {
        await super.PreloadAssets();
        await this.LoadExampleModelClassShaders()
        await this.LoadExampleTextures();


        let appState = GetAppState();

        /**
         * Loading Shader Models:
         * Shaders are defined in pairs of files, where each pair contains a vertex shader file and a fragment shader file.
         * Before we can use a shader, we need to load these files and compile them into a shader program.
         * ShaderModel's represent these compiled programs. You can think of a shader model as a factory for materials.
         * You load the shader model in PreloadAssets, then later on you can create materials that use that model for shading.
         * There are two ways we can load a shader model in AniGraph.
         */

        /**
         * The first is to just provide the name of the shader and load it as a generic shader model.
         * This will load the "simpletexture" shader model.
         */
        await AssetManager.loadShaderMaterialModel("simpletexture");

        /**
         * The second option works mostly the same way, but it lets us specify what shader model class to use.
         * The benefit here is that it lets us optionally customize the material model that we load our shader
         * into. You are welcome to dig into this implemenatation if you want to explore more advanced features.
         */
        await AssetManager.addShaderMaterialModel("blinnphong", ABlinnPhongShaderModel);

        /**
         * Loading textures
         * We can also load textures to use later.
         * Textures are typically used by assigning them to one of the sampler2D objects in the shader for a given material.
         */
        await AssetManager.loadTexture("./images/compass.png", "cursor");

        // load a texture and name it terrain2
        await AssetManager.loadTexture("./images/terrain/800px_COLOURBOX7251255.jpeg", "terrain2");


    }

    initCamera(...args:any[]) {
        super.initCamera();

        // the ground is the xy plane
        this.camera.setPose(
            NodeTransform3D.LookAt(V3(0,0,1), V3(), V3(0,1,0))
        );
    }

    initScene() {
        let appState = GetAppState();

        /**
         * If we are using physically based shaders, then we will need to add a light before we can see anything.
         * The easiest thing is to just attach a point light to the camera.
         * Some of the provided starter shaders will render as all red if you don't have any point lights (to help you debug)
         */
        this.addViewLight();

        /**
         * initialize terrain
         */
        this.initTerrain();

        // optionally connect to blinn phong controls:
        // ABlinnPhongShaderModel.attachMaterialUniformsToAppState(this.terrain.material);

        /**
         * Let's attach the `textureTransition` uniform in our terrain shader to the "TerrainSlider" app state slider in our control panel
         */
        this.terrain.material.attachUniformToAppState(TerrainSliderUniformName, TerrainSliderAppStateName)

        const self = this;

        /**
         * We will set it so that when the user checks the MixedTerrain control in the control panel it sets the tex2
         * texture in the terrain model's material. This will render the terrain with two textures.
         * You can see the corresponding sampler2D in the starter terrain shader.
         */
        this.subscribeToAppState("MixedTerrain", (v:boolean)=>{
            if(v) {
                self.terrain.material.setTexture("tex2", AssetManager.getTexture("terrain2"))
            }else{
                self.terrain.material.setTexture("tex2")
            }
        })

        /**
         * initialize characters
         */
        this.initCharacters();


        /**
         * Let's add the cursor model but keep it invisible until an appropriate mode is activated
         * @type {boolean}
         */
        this.initCursorModel();
        this.cursorModel.visible = false;


        /**
         * Add an example bilboard particle system starter
         */
        // this.addExampleBilboardParticleSystem()
    }



    initCharacters(){
        // add tank player
        this.initTankPlayer();

        /**
         * Add bots so that they stack parent to child
         * You probably don't want to stack them that way; it's just an example of how to add objects and build a scene graph.
         */
        this.addBotsInHierarchy()

        /**
         * Let's add our basic particle system to the player
         */
        this.playerParticleSystemModel = this.CreateExampleBasicParticleSystem(3);
        this.player.addChild(this.playerParticleSystemModel);
    }

    timeUpdate(...args:any[]) {
        let t: number = this.clock.time;

        /**
         * Call the timeUpdate function of all the node models in the scene
         */
        this.timeUpdateDescendants(t);

        /**
         * Update the bots
         */
        this.timeUpdateOrbitBots(t);


        /**
         * Update stuff here
         */

        /**
         * Optionally update the React GUI every frame
         */
        GetAppState().updateComponents();

    }

    CreateNewClickModel(radius:number=0.01){
        let appState = GetAppState();
        let newClickModel = new ATriangleMeshModel();
        let verts = VertexArray3D.Sphere(radius);
        newClickModel.setVerts(verts);
        let newModelMaterial = AssetManager.CreateShaderMaterial("blinnphong");
        newModelMaterial.setTexture("diffuse", AssetManager.getTexture("cursor"));
        newClickModel.setMaterial(newModelMaterial);
        return newClickModel
    }


    onClick(event:AInteractionEvent){
        console.log(event);
        let appState = GetAppState();
        let newModel = this.CreateNewClickModel(0.1);
        newModel.setTransform(
            new NodeTransform3D(
                V3(
                    Math.random()-0.5,
                    Math.random()-0.5,
                    0
                ).times(appState.globalScale),
                Quaternion.RotationY(-Math.PI*0.5).times(Quaternion.RotationX(-Math.PI*0.25))
            )

        )
        this.addNode(newModel);
    }

    getCoordinatesForCursorEvent(event: AInteractionEvent){
        return event.ndcCursor??new Vec2();
    }
}


