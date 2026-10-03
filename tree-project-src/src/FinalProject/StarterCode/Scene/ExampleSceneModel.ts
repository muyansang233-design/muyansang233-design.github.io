import {
    CharacterModel,
    CharacterModelInterface,
    LoadedCharacterModel
} from "../../../anigraph/starter/nodes/character";

import {
    BillboardParticleSystemModel,
    BotModel,
    ExampleLoadedCharacterModel, ExampleParticleSystemModel,
    PlayerModel, SphereParticle,
    TerrainModel
} from "../CustomNodes";
import {
    AGroupNodeModel3D,
    AInteractionEvent,
    AModel,
    AShaderMaterial,
    ATexture, ATriangleMeshModel,
    Color,
    GetAppState,
    NodeTransform3D,
    Particle3D, V2,
    V3,
    Vec2,
    Vec3, VertexArray3D
} from "../../../anigraph";
import {ABasicSceneModel} from "../../../anigraph/starter";
import {ExampleAssetModels} from "../../../anigraph/starter/ExampleAssets";
import {AssetManager} from "../../../anigraph/fileio/AAssetManager";

const N_CAT_TEXTURES = 6;

export abstract class ExampleSceneModel extends ABasicSceneModel {
    /**
     * Our custom terrain model
     */
    terrain!:TerrainModel;
    /**
     * An array of bots...
     */
    bots:BotModel[]=[];
    botGroup!:AGroupNodeModel3D;

    /**
     * Cursor model
     * @type {ATriangleMeshModel}
     */
    cursorModel!:ATriangleMeshModel;


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

    //###############################################--Example asset loading--###############################################

    async loadBotTexture(i:number){
        await AssetManager.loadTexture(`./images/catfaces/catface0${i + 1}.jpeg`, `cat${i}`)
    }

    getBotTexture(i:number){
        return AssetManager.getTexture(`cat${i}`);
    }

    /**
     * This function would be called from inside a PreloadAssets() function:
     * ```await this.LoadExampleAssets();```
     * @returns {Promise<void>}
     * @constructor
     */
    async LoadExampleModelClassShaders() {

        /**
         * Some custom models can have their own shaders (see implementations for details)
         * Which we can load to the model class.
         */
        await TerrainModel.LoadShaderModel();
        await CharacterModel.LoadShaderModel();
        await ExampleParticleSystemModel.LoadShaderModel();
        await BillboardParticleSystemModel.LoadShaderModel();
    }

    async LoadExampleTextures(){
        /**
         * Let's load some example textures
         */
        await AssetManager.loadTexture("./images/gradientParticle.png", "particle")
        await AssetManager.loadTexture("./images/tanktexburngreen.jpeg", "tank")
        await AssetManager.loadTexture( "./images/terrain/ground01.jpeg", "ground01")
        for(let i=0;i<N_CAT_TEXTURES;i++){
            await this.loadBotTexture(i)
        }
    }





    //#####################################//--Loading and using the cat model (3D model with texture)--\\#####################################
    //<editor-fold desc="Loading and using the cat model (3D model with texture)">
    /**
     * First let's declare some instance attributes we will use to keep track of the cat assets.
     * Normally we would do this at the top of the class definition, but we're putting them here to associate them
     * with the rest of the cat-model-related content.
     */
    static CAT_MODEL_STRING_IDENTIFIER:string=ExampleAssetModels.cat; // we will use this to keep track of the 3D model and texture
    catModelMaterial!:AShaderMaterial;

    /**
     * Here we are going to load a 3D cat model and corresponding cat texture.
     * @returns {Promise<void>}
     * @constructor
     */
    async _LoadTheCatWithoutAssetManager(){
        let appState=GetAppState();
        /**
         *
         *
         * Let's start by loading the 3D model. We will use one defined as a .glb file, which you can export from blender by
         * exporting a mesh as a gltf format. We can also provide a transform that will be applied to the model geometry
         * when it is loaded, which is useful when the model was built with inconvenient choice of default scale or
         * orientation. Finally, we will load a texture that comes with the model as well.
         */
        let catTransform = NodeTransform3D.FromPositionZUpAndScale(V3(), Vec3.UnitZ().times(1), Vec3.UnitY().times(-1), 0.02);
        await AssetManager.load3DModel("./models/gltf/cat.glb", ExampleSceneModel.CAT_MODEL_STRING_IDENTIFIER, catTransform);

        /**
         * Load the texture atlas. The uv coordinates on our model are specified relative to this atlas.
         */
        await AssetManager.loadTexture("./models/gltf/Cat_diffuse.jpg", ExampleSceneModel.CAT_MODEL_STRING_IDENTIFIER)
    }

    createTexturedSquareVerts(){
        /**
         * Create a vertex array with texture coordinates (and no normals)
         * @type {VertexArray3D}
         */
        let verts = VertexArray3D.CreateForRendering(false, true)

        /**
         * Add 4 verts with the included attributes (position and texture coords)
         */
        verts.addVertex(
            V3(-1,-1,0), // position
            undefined, // no normal
            V2(0,0) // texture coordinate
        )

        verts.addVertex(
            V3(1,-1,0), // position
            undefined, // no normal
            V2(1,0) // texture coordinate
        )

        verts.addVertex(
            V3(1,1,0), // position
            undefined, // no normal
            V2(1,1) // texture coordinate
        )

        verts.addVertex(
            V3(-1,1,0), // position
            undefined, // no normal
            V2(0,1) // texture coordinate
        )

        /**
         * Make two triangles out of the 4 verts
         */
        verts.addTriangleIndices(0,1,2);
        verts.addTriangleIndices(2,3,0);
        return verts;
    }


    initCursorModel(){
        let appState = GetAppState();
        this.cursorModel = new ATriangleMeshModel();
        let verts = this.createTexturedSquareVerts();
        this.cursorModel.setVerts(verts);

        /**
         * Let's create the material for our cursor.
         * Think of the material as an instance of a given shader that we can attach specific uniform values to and use
         * for rendering specific geometry.
         * @type {AShaderMaterial}
         */
        let cursorMaterial = AssetManager.CreateShaderMaterial("simpletexture");

        /**
         * Setting the "diffuse" texture on our material will set the corresponding "diffuseMap" sampler2d in our shader,
         * and the "diffuseMapProvided" boolean uniform will become true.
         */
        cursorMaterial.setTexture("diffuse", AssetManager.getTexture("cursor"));
        this.cursorModel.setMaterial(cursorMaterial);

        /**
         * Add the cursor quad as a child of the camera
         */
        this.cameraModel.addChild(this.cursorModel);
    }


    initCatPlayer(material?:AShaderMaterial){
        let playerMaterial = CharacterModel.CreateMaterial();
        this.player = AssetManager.createModelFromAsset(
            "cat",
            LoadedCharacterModel,
            playerMaterial
        ) as LoadedCharacterModel;
        this.addNode(this.player)
    }

    /**
     * Create and return a cat model. This example shows how to do this without using AssetManager.
     * @returns {LoadedCharacterModel}
     * @constructor
     */
    _initCatPlayerWithoutAssetManager(){
        if(!AssetManager.get3DModel(ExampleSceneModel.CAT_MODEL_STRING_IDENTIFIER)){
            throw new Error("You need to load the cat assets using LoadTheCat() in PreloadAssets!")
        }

        /**
         * Let's start by creating an instance of our material
         */
        let catMaterial = CharacterModel.CreateMaterial();

        /**
         * We will set the sampler2D called "xxxMap" using setTexture("xxx", aTextureInstance)
         * Here we will set the diffuse texture listed as "diffuseMap" in our shader to our texture atlas
         */
        catMaterial.setTexture("diffuse", AssetManager.getTexture(ExampleSceneModel.CAT_MODEL_STRING_IDENTIFIER))

        // optionally use vertex colors for your model. don't need them for the cat model (we get color from texture)
        // catMaterial.usesVertexColors=true;

        this.player = ExampleLoadedCharacterModel.Create(
            AssetManager.get3DModel(ExampleSceneModel.CAT_MODEL_STRING_IDENTIFIER),
            catMaterial
        )
        this.addNode(this.player)
    }
    //</editor-fold>





    //###############################################//--Some custom Bot objects--\\###############################################
    //<editor-fold desc="Some custom Bot objects">
    addBotHierarchy(){
        if(!this.terrain){
            throw new Error("Must initialize terrain before adding bot hierarchy... they need something to stand on.")
        }

        /**
         * Let's create a bunch of bots with different cat faces...
         * Here we will make each one a child of the last.
         */
        let parent:AModel = this.botGroup;
        for(let e=0;e<6; e++) {
            let bot = BotModel.Create(this.getBotTexture(e));
            bot.position = new Vec3((Math.random() - 0.5) * this.terrain.width, (Math.random() - 0.5) * this.terrain.height, 0);
            bot.mass = 50;
            this.bots.push(bot);
            parent.addChild(bot);
            parent = bot;
        }
    }
    //</editor-fold>

    /**
     * This function defines how the main camera for the scene is initialized
     * @param args
     */
    initCamera(...args:any[]) {
        this.initPerspectiveCameraFOV(0.5*Math.PI, 1.0)
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

    /**
     * Adds a very basic rgb triangle for testing / debugging purposes
     */
    addDebugTriangle(){
        let model = ATriangleMeshModel.Create(false,
            false,
            true);
        let material = AssetManager.materials.createRGBAShaderMaterial();
        model.setMaterial(material);
        model.verts.addVertex(V3(), undefined, undefined, Color.FromRGBA(1.0, 0.0, 0.0, 1.0));
        model.verts.addVertex(V3(1, 1,0), undefined, undefined, Color.FromRGBA(0.0, 1.0, 0.0, 1.0));
        model.verts.addVertex(V3(1, 0,0), undefined, undefined, Color.FromRGBA(0.0, 0.0, 1.0, 1.0));
        model.verts.indices.push([0,1,2])
        this.addNode(model);
    }

    addBotsInHierarchy(){
        this.botGroup = new AGroupNodeModel3D();
        this.addNode(this.botGroup);
        /**
         * Then we will create a bunch of bots with different cat faces...
         * Let's make each one a child of the last.
         */
        let parent:AModel = this.botGroup;
        for(let e=0;e<6; e++) {
            let bot = BotModel.Create(this.getBotTexture(e));
            bot.position = new Vec3((Math.random() - 0.5) * this.terrain.width, (Math.random() - 0.5) * this.terrain.height, 0);
            bot.mass = 50;
            this.bots.push(bot);
            parent.addChild(bot);
            parent = bot;
        }
    }

    /**
     * Initialized a tank player and adds it to the scene
     * @param texture
     */
    initTankPlayer(texture?:ATexture){
        /**
         * First we will initialze the player and add it to the scene.
         */
        this.player = PlayerModel.Create(texture??AssetManager.getTexture("tank"));
        this.addNode(this.player);
    }

    initDragonPlayer(material?:AShaderMaterial){
        let playerMaterial = CharacterModel.CreateMaterial();
        playerMaterial.usesVertexColors=true;
        this.player = AssetManager.createModelFromAsset(
            "dragon",
            ExampleLoadedCharacterModel,
            playerMaterial
        ) as ExampleLoadedCharacterModel;
        this.addNode(this.player)
    }

    initLabCatPlayer(material?:AShaderMaterial){
        let playerMaterial = CharacterModel.CreateMaterial();
        this.player = AssetManager.createModelFromAsset(
            "LabCat",
            ExampleLoadedCharacterModel,
            playerMaterial
        ) as ExampleLoadedCharacterModel;
        this.addNode(this.player)
    }


    CreateExampleBasicParticleSystem(n:number){
        /**
         * Now an example particle system.
         */
        let particles = new ExampleParticleSystemModel();
        particles.orbitRadius = 0.3;
        let radius = 0.05;
        for(let i=0;i<n;i++) {
            particles.addParticle(new SphereParticle(undefined, undefined, radius));
        }
        return particles;
    }


    CreateBilboardParticleSystem(nParticles:number){
        // BillboardParticleSystemModel.AddParticleSystemControls();
        /**
         * And now let's create our particle system
         */

        let billboardParticles = BillboardParticleSystemModel.Create(nParticles, AssetManager.getTexture("particle"));
        return billboardParticles
    }

    addExampleBilboardParticleSystem(nParticles:number=50){
        this.addNode(this.CreateBilboardParticleSystem(nParticles))
    }

    timeUpdateOrbitBots(t:number, ...args:any[]) {
        /**
         * For interactions between models, we can trigger logic here. For example, if you want characters to walk on
         * uneven terrain, you can make that happen by completing the functions used here:
         */
        const self = this;
        function adjustHeight(character:Particle3D){
            let height = self.terrain.getTerrainHeightAtPoint(character.position.xy);
            if(character.position.z<height){character.position.z = height;}
        }

        /**
         * Here we would apply our adjust height function to the player
         */
        adjustHeight(this.player);

        /**
         * Now lets update bots
         */
        let orbitradius = 0.25;
        for(let ei=0;ei<this.bots.length;ei++){
            let e = this.bots[ei];

            /**
             * Characters have velocity and mass properties in case you want to implement particle physics
             * But for now we will just have them orbit each other.
             */
            e.position = new Vec3(Math.cos(t*(ei+1)), Math.sin(t*(ei+1)),0).times(orbitradius);

            /**
             * adjust their height
             */
            adjustHeight(e);
        }
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

    getCoordinatesForCursorEvent(event: AInteractionEvent){
        return event.ndcCursor??new Vec2();
    }
}


