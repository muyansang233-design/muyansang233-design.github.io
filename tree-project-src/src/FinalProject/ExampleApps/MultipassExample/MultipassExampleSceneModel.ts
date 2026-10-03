import {
    ACameraModel, AInteractionEvent, AKeyboardInteraction, AMaterial, APointLightModel,
    AppState, AssetManager, ATexture, AVisiblePointLightModel, Color, GetAppState,
    NodeTransform3D, Particle3D, Quaternion,
    V3, Vec2
} from "../../../anigraph";
import {ABlinnPhongShaderModel} from "../../../anigraph/rendering/shadermodels";
import {CharacterModel, CharacterModelInterface, LoadedCharacterModel} from "../../../anigraph/starter/nodes/character";
import {AudioManager} from "../../../anigraph/audio/AAudioManager";
import {TerrainModel} from "../../StarterCode/CustomNodes";
import {ABasicSceneModel} from "../../../anigraph/starter";

enum CONSTANTS {
    _VIEW_LIGHT_SUBSCRIPTION_KEY ="VIEW_LIGHT_CAMERA_UPDATE_SUB",
    POP_SOUND = "POP_SOUND",
    // PLAYER_MODEL = "dragon",
    // PLAYER_MODEL = "LabCat",
    // PLAYER_MODEL = "cat",
    PLAYER_MODEL = "duck",
    // PLAYER_MODEL = "car1",
}

export class MultipassExampleSceneModel extends ABasicSceneModel {
    /**
     * Camera model for the second pass
     * @type {ACameraModel}
     */
    pass2CameraModel!:ACameraModel;

    /**
     * Terrain model
     * @type {TerrainModel}
     */
    terrain!:TerrainModel;

    /**
     * Our custom player model. We will use getters and setters to access to make the player feel special...
     * Actually, it's to support more flexible subclassing behavior, but let's let the player *think* it's because they
     * are special...
     */
    _player!:CharacterModelInterface;
    get player():CharacterModel{
        return this._player as CharacterModel;
    }
    set player(v:CharacterModel){
        this._player = v;
    }


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

        appState.addColorControl("NewLight", Color.White());
    }

    /**
     * Load any assets we plan to use
     * @returns {Promise<void>}
     * @constructor
     */
    async PreloadAssets() {
        /**
         * parent version loads basic RGBA and texture shaders
         */
        await super.PreloadAssets();

        /**
         * Load terrain texture
         */
        await AssetManager.loadTexture( "./images/terrain/ground01.jpeg", "ground01")

        /**
         * Load shader models, which are like factory classes for shader materials
         */
        await TerrainModel.LoadShaderModel();
        await CharacterModel.LoadShaderModel();

        /**
         * Load model asset
         */
        await AssetManager.loadModelAsset(CONSTANTS.PLAYER_MODEL);

        /**
         * Load sound
         */
        await AudioManager.LoadSound(CONSTANTS.POP_SOUND, "./sounds/Pop1.wav")
    }

    /**
     *
     */
    initCamera() {
        this.cameraModel = ACameraModel.CreatePerspectiveFOV(90, 1, 0.01, 10);

        this.cameraModel.setPose(
            NodeTransform3D.LookAt(V3(0.0,0.5,0.25), V3(0.0,0.0, 0.2),V3(0.0,0.0,1.0))
        )
        this.addNode(this.cameraModel);

        /**
         * Now, let's create a second camera model to use in our second pass
         */
        let w=0.5;
        let h=0.5;
        this.pass2CameraModel = ACameraModel.CreateOrthographic(-w,w,-h,h);
        this.cameraModel.addChild(this.pass2CameraModel)
    }

    /**
     * Add a light attached to the main camera
     */
    addViewLight(){
        this.viewLight = new APointLightModel(this.camera.pose, Color.FromString("#ffffff"),1, 1, 1);
        this.addNode(this.viewLight)
        this._attachViewLightToCamera();
    }

    /**
     * Attach the view light to the camera
     * @private
     */
    _attachViewLightToCamera(){
        const self = this;
        this.subscribe(this.camera.addPoseListener(()=>{
            self.viewLight.setTransform(self.camera.transform);
        }), CONSTANTS._VIEW_LIGHT_SUBSCRIPTION_KEY);
    }

    /**
     * Detach view light from camera
     * @private
     */
    _detachViewLightFromCamera(){
        this.unsubscribe(CONSTANTS._VIEW_LIGHT_SUBSCRIPTION_KEY);
    }

    /**
     * Add a new point light
     */
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
        this.addNode(light)
    }

    /**
     * Initialize the terrain for our scene.
     * The terrain will span some region of the x-y plane, and have an associated height map and color texture.
     * For the height map, we will use a Data Texture, which is one that we can modify and update easily in our CPU code.
     * @param {string | ATexture} texture
     * @param args
     */
    initTerrain(texture?:string|ATexture, ...args:any[]){

        // We will get the dimensions of our terrain from the app state variables indicating the scene scale
        let appState = GetAppState();
        let terrainScaleX= appState.globalScale*10.0;
        let terrainScaleY= appState.globalScale*10.0;

        // the terrain texture height and width will determine the resolution of our height map data texture.
        let terrainTextureWidth = 128;
        let terrainTextureHeight = 128;

        // the wrap variables determine how many times the color texture repeats in each dimension over the span of the terrain geometry
        let terrainTextureWrapX = 15.0;
        let terrainTextureWrapY = 15.0;

        //this bit of code just gets an ATexture object based on the function input
        let mainTexture:ATexture;
        if(texture instanceof ATexture){
            mainTexture = texture; // input was already an ATexture
        }else{
            mainTexture =AssetManager.getTexture(texture??"ground01"); // input was undefined or the name of a loaded texture asset
        }

        /**
         * Creates a TerrainModel instance
         * @type {TerrainModel}
         */
        this.terrain = TerrainModel.Create(
            mainTexture,
            terrainScaleX, // scaleX
            terrainScaleY, // scaleY
            terrainTextureWidth, // number of vertices wide
            terrainTextureHeight, // number of vertices tall
            undefined, // transform for terrain, identity if left blank
            terrainTextureWrapX, // number of times texture should wrap across surface in X
            terrainTextureWrapY, // number of times texture should wrap across surface in Y
        );

        // Add the terrain model to the scene
        this.addNode(this.terrain);
    }

    initScene() {
        /**
         * We need to add a light before we can see anything.
         * The easiest thing is to just attach a point light to the camera.
         */
        this.addViewLight();


        /**
         * initialize terrain
         */
        this.initTerrain();

        /**
         * Let's generate a random slightly bumpy terrain.
         * It's just uniform random bumps right now, nothing fancy.
         */
        this.terrain.reRollRandomHeightMap(0);

        // await this.addBotsInHierarchy();
        let playerMaterial = CharacterModel.CreateMaterial();

        /**
         * Create the player based on the chosen asset model
         * @type {LoadedCharacterModel}
         */
        this.player = AssetManager.createModelFromAsset(
            CONSTANTS.PLAYER_MODEL,
            LoadedCharacterModel,
            playerMaterial
        ) as LoadedCharacterModel;
        this.addNode(this.player)

        /**
         * We will set up a checkbox that will switch between culling the front and back faces of the player model
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
         * Here we attach our character's shader parameters to controls in the control panel
         */
        ABlinnPhongShaderModel.attachMaterialUniformsToAppState(this.player.material);
        ABlinnPhongShaderModel.attachMaterialUniformsToAppState(this.terrain.material);
    }

    /**
     * Get the coordinates of the cursor event in normalized device coordinates.
     * @param event
     * @returns {Vec2}
     */
    getCoordinatesForCursorEvent(event: AInteractionEvent){
        return event.ndcCursor??new Vec2();
    }

    onKeyUp(event:AInteractionEvent, interaction:AKeyboardInteraction){
        if(event.key=='p'){
            this.playPopSound();
        }
        if(event.key=='P'){
            console.log(this.camera.pose)
        }

        if(event.key=='L' && event.shiftKey){
            this.addLight()
        }
    }

    playPopSound(){
        // AudioManager.sounds[CONSTANTS.POP_SOUND].
        let amanager = AudioManager;
        amanager.sounds[CONSTANTS.POP_SOUND].play();
    }

    timeUpdateDescendants(t:number, ...args:any[]) {
        /**
         * We can call timeUpdate on all of the model nodes in the scene here, which will trigger any updates that they
         * individually define.
         */
        for(let c of this.getNodeModels()){
            c.timeUpdate(t);
        }
    }

    timeUpdate(t: number, ...args:any[]) {
        this.timeUpdateDescendants(t);
    }


}


