import {AModel, AModelInterface} from "../base/amvc/AModel";
import {AObject, AObjectNode, AObjectNodeEvents, AObjectState} from "../base/aobject";
import {ASerializable} from "../base/aserial";
import {ANodeModel} from "./nodeModel";
import {HasModelMap, MVMModelMap} from "../base/amvc/AModelViewMap";
import {ACameraModel} from "./camera";
import {BezierTween} from "../geometry";
import {ACallbackSwitch} from "../base";
import {
    CallbackType
} from "../basictypes";
import {AClock} from "../time/AClock";
import {v4 as uuidv4} from "uuid";

import {Mutex} from 'async-mutex';
import {ConfirmInitialized} from "./ConfirmInitialized";
import {GetAppState} from "../appstate";
import {AGLContext, AShaderModel} from "../rendering";

import {AModelGraph} from "./AModelGraph";
import {SceneGraphEvents} from "../basictypes";
import {AssetManager} from "../fileio/AAssetManager";
import {Color, TransformationInterface} from "../math";
import {APointLightModel} from "./lights";

export const enum SCENE_MODEL_CONSTANTS{
    MAIN_MODEL_GRAPH_KEY = "MAIN_MODEL_GRAPH"
}

// HasInteractions
@ASerializable("ASceneModel")
export abstract class ASceneModel extends AModel implements HasModelMap, ConfirmInitialized{
    static SceneEvents=SceneGraphEvents;
    @AObjectState protected _isInitialized!:boolean;
    cameraModel!:ACameraModel;
    _modelGraphs:{[name:string]:AModelGraph}={};

    get modelGraphs(){
        return this._modelGraphs;
    }

    // addChild(child: AObjectNode, position?: number, ...args:any[]): void {
    //     this.modelGraph.addChild(child, position, ...args);
    // }

    addNode(child: AObjectNode, position?: number, ...args:any[]){
        this.modelGraph.addChild(child, position, ...args);
    }

    addChild(child: AObjectNode, position?: number, ...args:any[]): void {
        throw new Error(`Used "addChild" on ASceneModel class directly. This is likely a bug. Did you mean to call addNode (or, less likely, _addSceneChild)?`)
        super.addChild(child, position, ...args);
    }

    /**
     * This is the replacement for using `addChild` to add a direct child of the scene model. Use `addNode` otherwise.
     * This is because only model graphs should be direct children.
     * @param child
     * @param position
     * @param args
     * @private
     */
    _addSceneChild(child: AObjectNode, position?: number, ...args:any[]): void {
        super.addChild(child, position, ...args);
    }

    get modelGraph(){
        return this._modelGraphs[SCENE_MODEL_CONSTANTS.MAIN_MODEL_GRAPH_KEY];
    }
    get modelMap(){
        return this.modelGraph.modelMap;
    }
    hasModel(model:AModelInterface){
        return (model.uid in this.modelMap);
    }
    hasModelID(modelID:string){
        return (modelID in this.modelMap);
    }

    createModelGraph(name:string){
        if(name in this._modelGraphs){
            throw new Error(`ModelGraph already exists: ${name}`);
        }
        this._modelGraphs[name]=new AModelGraph(name);
        let newModelGraph = this.getModelGraph(name);
        this._addSceneChild(newModelGraph);
        // this.addChild(newModelGraph)
        return newModelGraph;
    }

    getModelGraph(name:string):AModelGraph{
        return this._modelGraphs[name];
    }

    initModelGraphs(){
        this.createModelGraph(SCENE_MODEL_CONSTANTS.MAIN_MODEL_GRAPH_KEY);
    }


    protected _clock: AClock;
    protected _interactionDOMElement:EventTarget;
    protected _initMutex:Mutex;
    get initMutex(){
        return this._initMutex;
    }

    get camera(){
        return this.cameraModel.camera;
    }

    get eventTarget(){
        return this._interactionDOMElement;
    }

    get clock() {
        return this._clock;
    }

    /**
     * Args can be customized in subclass.
     * By default, can optionally be given an AGLContext
     * @param args
     */
    protected abstract initScene(...args:any[]):void;

    /**
     * Can be customized in subclass. Optionally given an AGLContext.
     * @param args
     */
    abstract initCamera(...args: any[]):void;
    onContextResize(context:AGLContext){
        let shape = context.getShape();
        this.cameraModel.onCanvasResize(shape.x, shape.y);
    }

    abstract timeUpdate(...args:any[]): void;

    /**
     * # Initialization:
     * Main models are initialized asynchronously, and initialization may be triggered lazily by the first controller
     * that tries to access the model (it can also be triggered more proactively, depending on the application).
     * The scene model has a state variable `isInitialized` that is set to false in the constructor, but flipped to true
     * after initialization is performed.
     *
     * To trigger initialization, the function `confirmInitialized` must be called at least once.
     *
     *
     */
    async confirmInitialized(...args:any[]){
        const self = this;
        await this.initMutex.runExclusive(async () => {
            if(!self._isInitialized){
                self._isInitialized = await self._asyncInitScene(...args);
                self._isInitialized = true;
                self._clock.play();
            }
        });
    }




    /**
     * Args can be customized for subclasses.
     * Can be given an AGLContext here.
     * @param args
     * @returns {Promise<boolean>}
     * @private
     */
    protected async _asyncInitScene(...args:any[]):Promise<boolean>{
        await this.PreloadAssets()
        this.initCamera(...args);
        if(!this.cameraModel || !this.cameraModel.isInSceneGraph){
            console.warn(`Camera model not added to scene!!!`)
        }
        // this.addNode(this.cameraModel);
        this.initScene(...args)
        return true;
    }

    async loadStandardShaders(){
        let appState = GetAppState();
        await AssetManager.loadShaderMaterialModel(AssetManager.DEFAULT_MATERIALS.RGBA_SHADER);
        await AssetManager.loadShaderMaterialModel(AssetManager.DEFAULT_MATERIALS.TEXTURED_SHADER);
        await AssetManager.loadShaderMaterialModel(AssetManager.DEFAULT_MATERIALS.TEXTURED2D_SHADER);
        (AssetManager.materials.getMaterialModel(AssetManager.DEFAULT_MATERIALS.TEXTURED2D_SHADER) as AShaderModel).setUniform("alpha", 1.0);

    }


    async PreloadAssets(){
        await this.loadStandardShaders();
        // await this.materials.materialsLoadedPromise;
    }

    get isInitialized(){
        return this._isInitialized;
    }

    addIsInitializedListener(callback:(self:AObject)=>void, handle?:string, synchronous:boolean=true):ACallbackSwitch{
        return this.addStateKeyListener('_isInitialized', callback, handle, synchronous);
    }

    addComponentUpdateListener(callback:(self:AObject)=>void, handle?:string):ACallbackSwitch{
        return this.addEventListener(ASceneModel.SceneEvents.UpdateComponent, callback, handle);
    }

    signalComponentUpdate(){
        this.signalEvent(ASceneModel.SceneEvents.UpdateComponent);
    }

    constructor(name?:string) {
        super(name);
        this._initMutex = new Mutex();
        this._isInitialized = false;
        this._clock = new AClock();
        this._interactionDOMElement = document;
        this.initModelGraphs();
    }

    initPerspectiveCameraNearPlane(left: number, right: number, bottom: number, top: number, near?: number, far?: number){
        // this.camera = APerspectiveCameraModel.CreatePerspectiveFOV(90, 2, 0.001,100.0);
        this.cameraModel = ACameraModel.CreatePerspectiveNearPlane(left, right, bottom, top, near, far);
        this.addNode(this.cameraModel);
    }

    initPerspectiveCameraFOV(fovy: number, aspect: number, near?: number, far?: number){
        this.cameraModel = ACameraModel.CreatePerspectiveFOV(fovy, aspect, near, far);
        this.addNode(this.cameraModel);
    }

    initOrthographicCamera(left:number, right:number, bottom:number, top:number, near?:number, far?:number){
        this.cameraModel =ACameraModel.CreateOrthographic(left, right, bottom, top, near, far);
        this.addNode(this.cameraModel);
            // AOrthoCameraModel.Create(-1, 1, -1, 1) as AOrthoCameraModel;
        // (this.camera as AOrthoCameraModel).normalized = normalized;
    }

    initNormalizedOrthographicCamera(){
        this.cameraModel = ACameraModel.CreateOrthographic(-1, 1, -1, 1);
        this.addNode(this.cameraModel);
        // this.cameraModel = AOrthoCameraModel.Create(-1, 1, -1, 1);
    }

    initUniformOrthographicCamera(scale?:number, near?:number, far?:number){
        scale = scale??1.0;
        this.cameraModel = ACameraModel.CreateOrthographic(-scale, scale, -scale, scale, near, far);
        this.addNode(this.cameraModel);
        // this.cameraModel = AOrthoCameraModel.Create(-1, 1, -1, 1);
    }

    init2DOrthoCamera(scale?:number, near:number=-1, far:number=1, aspect:number=1){
        scale = scale??1.0;
        this.cameraModel = ACameraModel.CreateOrthographic(-scale*aspect, scale*aspect, -scale, scale, near, far);
        this.addNode(this.cameraModel);
    }



    getSceneModelControlSpec(){
        let self = this;
        return {
            Name: {
                value: self.name,
                onChange: (v: string) => {
                    self.name = v;
                }
            },
        }
    }

    addNodeAddedListener(callback: (...args: any[]) => void, handle?: string){
        return this.modelGraph.addEventListener(SceneGraphEvents.NodeAdded, callback, handle)
    }

    addNodeRemovedListener(callback: (...args: any[]) => void, handle?: string){
        return this.modelGraph.addEventListener(SceneGraphEvents.NodeRemoved,callback, handle)
    }

    addNodeReleasedListener(callback: (...args: any[]) => void, handle?: string){
        return this.modelGraph.addEventListener(SceneGraphEvents.NodeReleased,callback, handle)
    }


    addPointLight(transform?:TransformationInterface, color?:Color, intensity?:number, distance?:number, decay?:number){
        return this.addPointLightToModelGraph(this.modelGraph, transform, color, intensity, distance, decay);
    }

    addPointLightToModelGraph(modelGraph?:AModelGraph|string, ...args: any[]){
        let modelGraphObj = this.modelGraph;
        if(modelGraph instanceof AModelGraph){
            modelGraphObj = modelGraphObj
        }else if(modelGraph !== undefined){
            modelGraphObj = this.getModelGraph(modelGraph);
        }
        return modelGraphObj.addPointLight(...args);
    }


    mapOverNodeModels(fn:(descendant:ANodeModel)=>any[]|void){
        let nodeModelDescendants = this.getNodeModels();
        return nodeModelDescendants.map(fn);
    }

    getNodeModels(){
        let rlist = [];
        let allDescendants = this.getDescendantList();
        for(let c of allDescendants){
            if(c instanceof ANodeModel){
                rlist.push(c);
            }
        }
        return rlist;
    }

    getNodeModelsForModelGraph(modelGraph?:AModelGraph|string, ...args: any[]){
        let modelGraphObj = this.modelGraph;
        if(modelGraph instanceof AModelGraph){
            modelGraphObj = modelGraphObj
        }else if(modelGraph !== undefined){
            modelGraphObj = this.getModelGraph(modelGraph);
        }
        return modelGraphObj.getDescendantList();
    }

    /**
     * If you provide a handle, then the action will not call so long as an existing subscription by that handle exists.
     * This means that you won't duplicate the action before one has finished previously.
     * @param callback  what should be called at each update
     * @param duration  how long it will take in total
     * @param tween  an optional tween curve
     * @param actionOverCallback  what to run when completed
     * @param handle  a handle to identify the timed action
     */
    addTimedAction(callback: (actionProgress: number) => any, duration: number, actionOverCallback?: CallbackType, tween?: BezierTween, handle?: string) {
        if (handle && (handle in this._subscriptions)) {
            return;
        }
        const self = this;
        const subscriptionHandle = handle ?? uuidv4();
        this.subscribe(this._clock.CreateTimedAction(callback, duration, () => {
                self.unsubscribe(subscriptionHandle);
                if (actionOverCallback) {
                    actionOverCallback();
                }
            }, tween),
            subscriptionHandle);
    }
}





