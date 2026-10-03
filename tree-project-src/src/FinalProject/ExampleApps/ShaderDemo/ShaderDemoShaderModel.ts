import {ABlinnPhongShaderModel} from "../../../anigraph/rendering/shadermodels";
import {AShaderMaterial, AShaderModel, AShaderModelBase, ATexture, Color, GetAppState, Vec3} from "../../../anigraph";

enum AppStateKeys{
    TIME="time",
    TIME_SCALE = "tscale",
    VAR1 = "var1",
    VAR2 = "var2",
    SURFACE_COLORING = "surfaceColoring",
    USE_VIEWLIGHT = "useViewLight"
}

export class ShaderDemoShaderModel extends ABlinnPhongShaderModel{
    /**
     * Here we will add whatever app state we want to use to control materials based on this shader
     * @constructor
     */
    static AddAppState(){
        let appState = GetAppState();
        super.AddAppState();
        appState.addControlSpecGroup("CustomLoadedShader",
            {
                TimeScale: appState.CreateControlPanelSliderSpec(AppStateKeys.TIME_SCALE, 0, -50, 50, 0.01),
                SurfaceColoring: appState.CreateControlPanelSliderSpec(AppStateKeys.SURFACE_COLORING, 1.0, 0.0, 1.0, 0.01),
                Var1: appState.CreateControlPanelSliderSpec(AppStateKeys.VAR1, 0.0, -3, 3, 0.01),
                Var2: appState.CreateControlPanelSliderSpec(AppStateKeys.VAR2, 0.5, -1, 1, 0.01),
                UseViewLight: appState.CreateControlPanelCheckboxSpec(AppStateKeys.USE_VIEWLIGHT, true),
            }
        )

        appState.setState("time", 0);
    }

    /**
     * Here we are creating the model, which represents the shader program itself. You can think of this as a material
     * factory, i.e., it creates materials that are compiled instances of the shader program.
     * @param shaderName
     * @param args
     * @returns {Promise<ShaderDemoShaderModel>}
     * @constructor
     */
    static async CreateModel(shaderName?:string, ...args:any[]){
        if(shaderName === undefined){
            shaderName = "demoshader";
        }
        await AShaderModel.ShaderSourceLoaded(shaderName);

        let model = new this(shaderName, ...args);
        // model.usesLights=true;
        model.usesVertexColors=true;
        return model;

    }


    /**
     * When you create an instance of this material, you need to attach the corresponding shader uniforms to the
     * app state we have created.
     * @param args
     * @returns {AShaderMaterial}
     * @constructor
     */
    CreateMaterial(...args:any[]){
        let appState = GetAppState();
        let mat = super.CreateMaterial();
        mat.attachUniformToAppState("time", AppStateKeys.TIME);
        mat.attachUniformToAppState(AppStateKeys.TIME_SCALE, AppStateKeys.TIME_SCALE);
        mat.attachUniformToAppState(AppStateKeys.VAR1, AppStateKeys.VAR1);
        mat.attachUniformToAppState(AppStateKeys.VAR2, AppStateKeys.VAR2);
        mat.attachUniformToAppState(AppStateKeys.SURFACE_COLORING, AppStateKeys.SURFACE_COLORING);
        mat.attachUniformToAppState(AppStateKeys.USE_VIEWLIGHT, AppStateKeys.USE_VIEWLIGHT);

        // Note that we could also remove one of the lines above and instead set the uniform on a per-instance basis.
        // Every node typically has its own material instance (the output of this function)
        // you can set individual uniformvalues like so:

        // generic
        // mat.setUniform("nameInShader", value)

        // a vec3 uniform in the shader
        // mat.setUniform3fv("uniformName", new Vec3(1,2,3))

        // a vec4 uniform in the shader
        // mat.setUniform4fv("uniformName", new Vec4(1,2,3,4))

        // a color uniform in the shader. Here we set it to green with alpha=0.8
        // mat.setUniformColor("uniformName", new Color(0.0,1.0,0.0), 0.8);

        return mat;
    }
}
