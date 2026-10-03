import {
    APointLightModel,
    AppState,
    AVisiblePointLightModel,
    Color,
    GetAppState,
    V3,
    NodeTransform3D,
    BlinnPhongDefaults,
    AShaderModel,
    Mat4,
    V4,
    AShaderMaterial
} from "../../../anigraph";
import {ALoadedModel} from "../../../anigraph/scene/nodes/loaded/ALoadedModel";
import {ABlinnPhongShaderModel} from "../../../anigraph/rendering/shadermodels";
import {ABasicSceneModel} from "../../../anigraph/starter";
import {AssetManager} from "../../../anigraph/fileio/AAssetManager";


enum AppStateKeys{
    TIME="time",
    TIME_SCALE = "tscale",
    VAR1 = "var1",
    VAR2 = "var2",
    SURFACE_COLORING = "surfaceColoring",
    USE_VIEWLIGHT = "useViewLight",
    NEW_LIGHT_COLOR = "NewLightColor",
}

/**
 * We should have some string handle for our shader
 * @type {string}
 */
const SHADER_NAME = "demoshader"
const MESH_NAME = "LabCat";

/**
 * This is your Main Model class. The scene model is the main data model for your application. It is the root for a
 * hierarchy of models that make up your scene/
 */
export class ShaderDemoUnabridgedSceneModel extends ABasicSceneModel{
    lights:APointLightModel[]=[];

    /**
     * The mesh model we will be looking at.
     * @type {ALoadedModel}
     */
    meshModel!:ALoadedModel;

    /**
     * This will add variables to the control pannel
     * @param appState
     */
    initAppState(appState:AppState){

        /**
         * Add a folder of control panel options for controlling custom shader variables
         */
        appState.addControlSpecGroup("CustomLoadedShader",
            {
                TimeScale: appState.CreateControlPanelSliderSpec(AppStateKeys.TIME_SCALE, 0, -50, 50, 0.01),
                SurfaceColoring: appState.CreateControlPanelSliderSpec(AppStateKeys.SURFACE_COLORING, 1.0, 0.0, 1.0, 0.01),
                Var1: appState.CreateControlPanelSliderSpec(AppStateKeys.VAR1, 0.0, -3, 3, 0.01),
                Var2: appState.CreateControlPanelSliderSpec(AppStateKeys.VAR2, 0.5, -1, 1, 0.01),
                UseViewLight: appState.CreateControlPanelCheckboxSpec(AppStateKeys.USE_VIEWLIGHT, true),
                NewLightColor: appState.CreateControlPanelColorPickerSpec(AppStateKeys.NEW_LIGHT_COLOR, Color.White())
            }
        )
        /**
         * Add a folder of control panel options for standard blinn phong parameters
         */
        appState.addControlSpecGroup(
            ABlinnPhongShaderModel.ControlSpecFolderName,
            {
                Ambient : appState.CreateControlPanelSliderSpec(ABlinnPhongShaderModel.ShaderAppState.Ambient, BlinnPhongDefaults.Ambient, 0.0, 1.0, 0.001),
                Diffuse : appState.CreateControlPanelSliderSpec(ABlinnPhongShaderModel.ShaderAppState.Diffuse, BlinnPhongDefaults.Diffuse, 0.0, 1.0, 0.001),
                Specular: appState.CreateControlPanelSliderSpec(ABlinnPhongShaderModel.ShaderAppState.Specular, BlinnPhongDefaults.Specular, 0.0, 1.0, 0.001),
                SpecularExp: appState.CreateControlPanelSliderSpec(ABlinnPhongShaderModel.ShaderAppState.SpecularExp, BlinnPhongDefaults.SpecularExp, 0.0, 20.0, 0.01),

            }
        )

        /**
         * Set the appstate time to 0 because we use it for some sinusoidal effect later
         * This doesn't need to be a control panel control
         */
        appState.setState("time", 0);
    }

    /**
     * Initialize the camera. Set the projection to be a perspective projection, and set the initial pose.
     * @param args
     */
    initCamera(...args: any[]) {
        this.initPerspectiveCameraFOV(0.5*Math.PI, 1.0)
        this.camera.setPose(NodeTransform3D.LookAt(V3(0,1,1), V3(), V3(0,0,1)));
    }


    async PreloadAssets(): Promise<void> {
        // Normally you will want to call the parent's version, which will set up some basic shaders. In this case you could technically skip, but we leave it here for good practice.
        await super.PreloadAssets();


        //##########//--Loading and compiling a shader model--\\##########
        //<editor-fold desc="Loading and compiling a shader model">



        /**
         * Load the shader source.
         * The name that you give as the first argument will be the handle for this shader source.
         * This name will be used later to reference the compiled shader program for use in a material.
         * The second arguments are paths to the vertex and fragment shader files from the public/shaders directory.
         */
        await AssetManager.shaders.LoadShader(
            SHADER_NAME,
            `./${SHADER_NAME}/${SHADER_NAME}.vert.glsl`,
            `./${SHADER_NAME}/${SHADER_NAME}.frag.glsl`
        )

        /**
         * Now we will create a shader model using our compiled source.
         * The shader model is like a factory for shader materials.
         * It couples a shader program together with customizable default parameters and behavior.
         * @type {AShaderModel}
         */
        let shaderModel = await AShaderModel.CreateModel(SHADER_NAME);

        /**
         * The app state holds a dictionary of shader/material models that have been created.
         * This is the intended place to store and access these shader models.
         */
        AssetManager.materials.setMaterialModel(
            SHADER_NAME,
            shaderModel
        )
        //</editor-fold>
        //##########\\--Loading and compiling a shader model--//##########



        //#######################//--Loading a 3D Model and its textures--\\##########################
        //<editor-fold desc="Loading a 3D Model">

        let meshPath="models/obj/LabCat1/LabCat1.obj";
        let diffuseTexturePath = "models/obj/LabCat1/LabCat1.png"
        let modelTransform=Mat4.FromColumns(
            V4(-1,0,0,0),
            V4(0,0,1,0),
            V4(0,1,0,0),
            V4(0,0,0,1)
        );

        /**
         * This will load the mesh into a dictionary of assets that the scene model keeps.
         * The second argument, meshname, is the key in that dictionary.
         */
        await AssetManager.load3DModel(meshPath, MESH_NAME, modelTransform);

        /**
         * Load the texture into a similar asset dictionary. The second argument is the key to use.
         * Be careful to give textures unique keys.
         * Or you could forego the use of the dictionary and just keep track of textures in your own variables.
         */
        await AssetManager.loadTexture(diffuseTexturePath, `${MESH_NAME}_diffuse`);
        //</editor-fold>
        //#######################\\--Loading a 3D Model and its textures--//##########################


    }

    /**
     * Will add a new node model representing a point light that will be rendered as a sphere in the scene.
     */
    addLight(){
        let appState = GetAppState();

        /**
         * Get the light color from controllable app state.
         * @type {any}
         */
        let lightColor = appState.getState(AppStateKeys.NEW_LIGHT_COLOR);

        /**
         * This creates a point light with a small sphere around it (so we can see where the point light is)
         * @type {AVisiblePointLightModel}
         */
        let light = new AVisiblePointLightModel(
            this.camera.transform.clone(),
            lightColor,1, 1, 1
        );

        /**
         * We'll keep track of lights in a scene model list.
         */
        this.lights.push(light);

        /**
         * Remember to add it to the scene.
         */
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

        /**
         * Code to add a light to the camera
         */
        this.addViewLight();

        let shaderMaterial = AssetManager.materials.getMaterialModel(SHADER_NAME).CreateMaterial() as AShaderMaterial;

        /**
         * We will attach a bunch of uniforms in our shader to app state.
         * This is done with callbacks, which you can see in the attachUniformToAppState function.
         */
        shaderMaterial.attachUniformToAppState(AppStateKeys.TIME_SCALE, AppStateKeys.TIME_SCALE);
        shaderMaterial.attachUniformToAppState(AppStateKeys.VAR1, AppStateKeys.VAR1);
        shaderMaterial.attachUniformToAppState(AppStateKeys.VAR2, AppStateKeys.VAR2);
        shaderMaterial.attachUniformToAppState(AppStateKeys.SURFACE_COLORING, AppStateKeys.SURFACE_COLORING);
        shaderMaterial.attachUniformToAppState(AppStateKeys.USE_VIEWLIGHT, AppStateKeys.USE_VIEWLIGHT);

        /**
         * We can attach uniforms to app state that isn't in the control panel as well.
         * Here we attach it to the `time` app state we created, which we will update programatically.
         */
        shaderMaterial.attachUniformToAppState("time", AppStateKeys.TIME);

        /**
         * Set the shader material's duffuse texture
         */
        shaderMaterial.setTexture('diffuse', AssetManager.getTexture(`${MESH_NAME}_diffuse`))

        /**
         * Need to specify whether to use vertex colors.
         * @type {boolean}
         */
        // shaderMaterial.usesVertexColors = true;


        /**
         * This call will attach the appropriate parameters of our shader material instance to the sliders for diffuse, specular, specularExp, ambient
         * under the hood it calls code that looks like:
         * ...
         * mat.attachUniformToAppState(ABlinnPhongShaderModel.ShaderAppState.Specular)
         * mat.attachUniformToAppState(ABlinnPhongShaderModel.ShaderAppState.SpecularExp)
         * ...
         */
        ABlinnPhongShaderModel.attachMaterialUniformsToAppState(shaderMaterial);

        /**
         * retrieve the mesh asset we loaded earlier
         * @type {AObject3DModelWrapper}
         */
        let meshAsset = AssetManager.get3DModel(MESH_NAME);

        /**
         * Create the mesh model
         * @type {ALoadedModel}
         */
        this.meshModel = ALoadedModel.Create(meshAsset, shaderMaterial);

        /**
         * Add the mesh model to the scene
         */
        this.addNode(this.meshModel);

        // if you wanted to set shader uniforms here you could do something like:
        // this.meshModel.material.setUniform(AppStateKeys.VAR1, value)

    }


    timeUpdate(t?: number):void;
    timeUpdate(...args:any[])
    {
        let t = this.clock.time;
        if(args != undefined && args.length>0){
            t = args[0];
        }

        let appState = GetAppState();

        /**
         * Setting this app state will cause the attached shader uniform to update
         */
        appState.setState("time", this.clock.time);

        /**
         * Update stuff here
         */

    }
};
