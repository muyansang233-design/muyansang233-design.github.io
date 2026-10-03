import {
    ACamera,
    ACameraModel,
    AInteractionEvent, ANodeModel3D,
    AObject3DModelWrapper,
    AppState,
    AShaderMaterial, ATriangleMeshModel, GetAppState, Mat4, NodeTransform,
    NodeTransform3D,
    Quaternion,
    UnitQuadModel, V2,
    V3, V4,
    Vec2, VertexArray3D
} from "../../../anigraph";
// import { ExampleLoadedCharacterModel, ExampleParticleSystemModel} from "../../StarterClasses/CustomNodes";
import { ExampleSceneModel} from "../../StarterCode/Scene/ExampleSceneModel";
import {ABlinnPhongShaderModel} from "../../../anigraph/rendering/shadermodels";
import {ARenderTarget} from "../../../anigraph/rendering/target/ARenderTarget";
import {CharacterModel} from "../../../anigraph/starter/nodes/character";
import {ExampleLoadedCharacterModel} from "../../StarterCode/CustomNodes";
import {ExampleAssetModels} from "../../../anigraph/starter/ExampleAssets";
import {AssetManager} from "../../../anigraph/fileio/AAssetManager";

const VirtualScreenCameraIsMovingAppStateKey:string="MoveVirtualScreenCamera"
const CheckBoxAppStateKey:string="checkBox"
const ShowMirrorTextureCoordsAppStateKey:string="showMirrorTextureCoords";

const MODEL_TO_LOAD:string = ExampleAssetModels.dragon;

export class Example2SceneModel extends ExampleSceneModel {
    /**
     * This will be the virtual screen / mirror / window that we render our texture onto.
     * @type {ANodeModel3D}
     */
    virtualScreen!:ATriangleMeshModel;

    /**
     * This will control where we render our virtual screen image from
     * @type {ACamera}
     */
    virtualScreenCamera!:ACameraModel;

    /**
     * This is the material we will use to render our virtual screen
     * @type {AShaderMaterial}
     */
    virtualScreenMaterial!: AShaderMaterial;
    virtualScreenCameraIsMoving:boolean=false;



    initAppState(appState: AppState) {
        ABlinnPhongShaderModel.AddAppState();
        appState.addCheckboxControl(VirtualScreenCameraIsMovingAppStateKey, false);
        appState.addCheckboxControl(CheckBoxAppStateKey, false);
        appState.addCheckboxControl(ShowMirrorTextureCoordsAppStateKey, false);
    }

    async PreloadAssets() {
        await super.PreloadAssets();
        await super.LoadExampleTextures();
        await super.LoadExampleModelClassShaders();
        await AssetManager.loadModelAsset(MODEL_TO_LOAD);
        let appState = GetAppState();

        /**
         * Load a custom shader. We will use this when we render our texture to the screen
         */
        // await AssetManager.loadShaderMaterialModel("postprocessing");
        // this.virtualScreenMaterial = AssetManager.CreateShaderMaterial("postprocessing");

        // Load the shader code.
        await AssetManager.shaders.LoadShader("example2", "./example2/example2.vert.glsl", "./example2/example2.frag.glsl")

        // create a model based on the shader code
        await AssetManager.loadShaderMaterialModel("example2")
        this.virtualScreenMaterial = AssetManager.CreateShaderMaterial("example2");


        /**
         * Add a slider to control one of our uniforms
         */
        appState.addSliderIfMissing("sliderValue", 0,-1,1,0.01);
        this.virtualScreenMaterial.attachUniformToAppState("sliderValue", "sliderValue")



    }



    initCamera() {
        super.initCamera();
        // the ground is the xy plane
        this.camera.setPose(
            NodeTransform3D.LookAt(
                V3(0,-3,1),
                V3(),
                V3(0,0,1)
            )
        );

        /**
         * We will create a virtual camera to render our virtual screen's viewpoint from
         * @type {ACameraModel}
         */
        this.virtualScreenCamera = new ACameraModel(ACamera.CopyOf(this.camera));

        /**
         * For now, the code makes the virtual camera a child of the current camera, so it will move with the current camera. You may want to change this behavior to get a mirror effect...
         */
        this.cameraModel.addChild(this.virtualScreenCamera);
        // this.addNode(this.virtualScreenCamera);

        const self = this;
        this.subscribeToAppState(VirtualScreenCameraIsMovingAppStateKey, (v:boolean)=>{
            if(v) {
                self.virtualScreenCameraIsMoving=true;
            }else{
                self.virtualScreenCameraIsMoving=false;

                /**
                 * We will reset the virtual screen camera's pose to the identity so that it is the same as our main
                 * camera (because it is a child of our main camera)
                 */
                self.virtualScreenCamera.setPose(new NodeTransform3D());
            }
        })
    }

    initCharacters(){
        let playerMaterial = CharacterModel.CreateMaterial();
        this.player = AssetManager.createModelFromAsset(
            MODEL_TO_LOAD,
            ExampleLoadedCharacterModel,
            playerMaterial
        ) as ExampleLoadedCharacterModel;
        this.addNode(this.player)
        ABlinnPhongShaderModel.attachMaterialUniformsToAppState(this.player.material)
    }

    /**
     * This will create textured quad geometry with texture coordinates
     * @param scale
     * @returns {VertexArray3D}
     */
    createTexturedQuadGeometry(scale?:number){
        scale = scale??1.0;
        let verts = VertexArray3D.CreateForRendering(false, true);
        // Add a vertex for each corner of a square
        verts.addVertex(V3(-1,-1,0).times(scale),undefined, V2(0,0))
        verts.addVertex(V3(1,-1,0).times(scale),undefined, V2(1,0))
        verts.addVertex(V3(1,1,0).times(scale),undefined, V2(1,1))
        verts.addVertex(V3(-1,1,0).times(scale),undefined, V2(0,1))

        //make two triangles by connecting corners 012 and corners 230
        verts.addTriangleIndices(0,1,2);
        verts.addTriangleIndices(2,3,0);
        return verts;
    }


    initScene() {
        this.addViewLight();
        this.initTerrain();
        this.initCharacters();

        /**
         * We will create a big quad to use as our virtual screen
         * @type {ATriangleMeshModel}
         */
        this.virtualScreen =new ATriangleMeshModel();
        this.virtualScreen.setVerts(this.createTexturedQuadGeometry());
        this.virtualScreenMaterial.attachUniformToAppState(CheckBoxAppStateKey, CheckBoxAppStateKey)
        this.virtualScreenMaterial.attachUniformToAppState(ShowMirrorTextureCoordsAppStateKey, ShowMirrorTextureCoordsAppStateKey)
        this.virtualScreen.setMaterial(this.virtualScreenMaterial);
        this.virtualScreen.setTransform(Mat4.FromColumns(
            V4(1,0,0,0),
            V4(0,0,1,0),
            V4(0,1,0,0),
            V4(0,0,1,1)
        ));
        this.player.transform.setPosition(V3(0.0, -1.5, 0.0))
        this.addNode(this.virtualScreen);
    }

    /**
     * A hook for our controller to call before it renders the first passs
     * @param target
     * @param args
     */
    prepForFirstPass(target?:ARenderTarget, ...args:any[]){
        this.virtualScreenMaterial.setTexture("input", target?target.targetTexture:undefined);
    }

    /**
     * A hook for our controller to call before it renders the second passs
     * @param target
     * @param args
     */
    prepForSecondPass(target?:ARenderTarget, ...args:any[]){
        this.virtualScreenMaterial.setTexture("input", target?target.targetTexture:undefined);
    }

    /**
     * We update the scene here
     * @param t
     * @param args
     */
    timeUpdate(t?: number, ...args:any[]) {
        t = t??this.clock.time;
        super.timeUpdateDescendants(t);

        if(this.virtualScreenCameraIsMoving){
            this.virtualScreenCamera.setPose(new NodeTransform3D(
                V3(Math.sin(t)*0.22, 0, 0)
            ))
        }

    }

    getCoordinatesForCursorEvent(event: AInteractionEvent){
        return event.ndcCursor??new Vec2();
    }
}


