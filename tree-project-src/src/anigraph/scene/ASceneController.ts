import * as THREE from "three";
import {AController} from "../base/amvc/AController";
import {
    AModelInterface, AObjectState,
    AView,
    HasModelViewMap,
    SceneControllerInterface
} from "../base";
import {AModelGraph} from "./AModelGraph";
import {ClassInterface} from "../basictypes";
import {AGLContext, AGLRenderWindow} from "../rendering";
import {ASceneModel, SCENE_MODEL_CONSTANTS} from "./ASceneModel";
import {ASceneView} from "./ASceneView";
import {ACameraModel, ACameraView} from "./camera";
import {AGroupNodeModel2D, AGroupNodeModel3D, ANodeModel} from "./nodeModel";
import {ANodeView} from "./nodeView";
import {AModelViewClassMap, AMVClassSpecDetails} from "../base/amvc/AModelViewClassSpec";
import {Mutex} from "async-mutex";
import {Color, Quaternion} from "../math";
import {ASceneViewMap} from "./ASceneView";
import {ARenderTarget} from "../rendering/target/ARenderTarget";
import {ASceneViewsAndTargets} from "./ASceneViewsAndTargets";
import {AGroupNodeView2D, AGroupNodeView3D} from "./nodeView/AGroupNodeView";
import {APointLightModel, APointLightView} from "./lights";

export enum SceneControllerSubscriptions {
    ModelNodeAdded = "ModelNodeAdded",
    // ModelNewNodeCreated="ModelNewNodeCreated",
    ModelNodeRemoved = "ModelNodeRemoved",
    ModelNodeReleased = "ModelNodeReleased"
}

enum Constants{
    MAIN_RENDER_PASS = "MAIN_RENDER_PASS",
}

export interface RenderTargetInterface{
    target:THREE.WebGLRenderTarget|null
}




export abstract class ASceneController extends AController implements HasModelViewMap, SceneControllerInterface{
    @AObjectState protected readyToRender:boolean;
    @AObjectState protected _isInitialized!:boolean;
    private _clearColor!:Color;
    _renderWindow!: AGLRenderWindow;
    protected _model!: ASceneModel;
    // protected _view!: ASceneView;
    // protected _cameraView!: ACameraView;
    protected _initMutex:Mutex;
    protected _tabIndex:number=0;

    protected _sceneViewsAndTargets!:ASceneViewsAndTargets;
    _currentRenderTarget:ARenderTarget|null=null;

    getSceneViewsAndTargets(){
        return this._sceneViewsAndTargets;
    }


    get isInitialized(){
        return this._isInitialized;
    }

    get clearColor(){return this._clearColor;}

    get tabIndex(){
        return this._tabIndex;
    }

    //<editor-fold desc="Scene views">
    get sceneViews():ASceneViewMap{
        return this.getSceneViewsAndTargets().sceneViews;
    }

    _getSceneView(name:string):ASceneView|undefined{
        return this.sceneViews.get(name);
    }

    get mainSceneView():ASceneView{
        let mainView = this.getSceneView(SCENE_MODEL_CONSTANTS.MAIN_MODEL_GRAPH_KEY);
        if(!mainView){
            throw new Error(`Scene View ${SCENE_MODEL_CONSTANTS.MAIN_MODEL_GRAPH_KEY} not found`);
        }
        return mainView;
    }

    /**
     * Creates a scene view for each model graph in the scene model
     * @private
     */
    initSceneViews(){
        let modelGraphs = this.model.modelGraphs;
        for(let graphName in modelGraphs){
            this.createSceneView(graphName, modelGraphs[graphName]);
        }
    }

    _releaseSceneViews():void{
        this._sceneViewsAndTargets.releaseSceneViews();
    }

    mapOverSceneViews(f:(rp:ASceneView)=>void){
        this.getSceneViewsAndTargets().mapOverSceneViews(f);
    }

    createSceneView(name:string, modelGraph:AModelGraph, autoUpdate:boolean=false){
        return this.getSceneViewsAndTargets().createSceneView(this, name, modelGraph) as ASceneView;
    }
    //</editor-fold>

    //<editor-fold desc="Render Targets">
    get renderTargets(){
        return this.getSceneViewsAndTargets().renderTargets;
    }

    get currentRenderTarget(){
        return this._currentRenderTarget;
    }

    addRenderTarget(width:number, height:number){
        this.getSceneViewsAndTargets().addRenderTarget(width, height);
    }

    setCurrentRenderTarget(renderTarget?:ARenderTarget|null){
        if(renderTarget !== undefined && renderTarget !== null) {
            this.renderer.setRenderTarget(renderTarget.target)
            this._currentRenderTarget=renderTarget;
        }else{
            this.renderer.setRenderTarget(null);
        }
    }
    //</editor-fold>



    get initMutex(){
        return this._initMutex;
    }
    // protected _modelSubscriptionsAdded

    get context(){
        return this._renderWindow.context;
    }

    classMap:AModelViewClassMap;

    /**
     * Initialize the model view specs that specify which view node classes should be created and connected to new instances of different model node classes for each scene view. Note that the ASceneView class already initializes some basic specs for: ACameraModel, AGroupNodeModel2D, AGroupNodeModel3D, and APointLightModel
     */
    abstract initModelViewSpecs():void;

    abstract onAnimationFrameCallback(context: AGLContext): void

    _beforeInitScene(...args:any[]){
        //  if(this.renderWindow) {
        //     this.onWindowResize(this.renderWindow);
        // }
    }

    abstract initInteractions():void;


    setClearColor(color:Color){
        this._clearColor = color;
        this.renderer.setClearColor(this.clearColor.asThreeJS());
        this.renderer.clear();
    }




    async initScene(){
        // You can set the clear color for the rendering context
        this.renderer.setClearColor(this.clearColor.asThreeJS());
        this.renderer.clear();
        this.initInteractions();
    }

    get isReadyToRender(): boolean {
        return this.readyToRender;
    }

    get renderWindow(): AGLRenderWindow {
        return this._renderWindow;
    }

    get renderer(): THREE.WebGLRenderer {
        return this.context.renderer;
    }

    get sceneController(){
        return this;
    }

    get eventTarget(): HTMLElement {
        return this.context.renderer.domElement;
    }



    constructor(model: ASceneModel) {
        super();
        this._sceneViewsAndTargets = new ASceneViewsAndTargets();
        this._clearColor = new Color(0.0, 0.0, 0.0);
        this._initMutex = new Mutex();
        this._isInitialized = false;
        this.readyToRender=false;
        this.classMap = new AModelViewClassMap();
        // this.addModelViewSpec(ACameraModel, ACameraView);
        // this.addModelViewSpec(ACameraModel, ACameraView);
        if (model) {
            this.setModel(model)
        }
    }

    setRenderWindow(renderWindow:AGLRenderWindow){
        this._renderWindow = renderWindow;
        this.clearAllInteractionModes();
        // this.initInteractions();
    }

    async confirmInitialized(){
        const self = this;
        self.model.confirmInitialized().then(():Promise<void>=>{
            return self.initMutex.runExclusive(async () => {
                self.initSceneViews();
                self.initModelViewSpecs();
                await self.initRendering();
                self._isInitialized = true;
                self._clock.play();
            });
        });

    }

    initViewSubscriptions(){
        this.mapOverSceneViews((rpass:ASceneView)=>{
            rpass.initModelGraphSubscriptions();
        })
    }

    async initRendering(...args:[]) {
        this.renderer.autoClear = false;
        this.renderer.clear()
        await this.model.confirmInitialized();

        this.initViewSubscriptions()

        this._beforeInitScene(this.context);
        await this.initScene();
        this.readyToRender = true;
    }

    createViewForNodeModel(nodeModel: ANodeModel, ...args:any[]):ANodeView{
        throw new Error("This should not be called anymore.")
    }

    addModelViewSpec(modelClass:ClassInterface<ANodeModel>, viewClass:ClassInterface<ANodeView>, details?:AMVClassSpecDetails){
        this.mainSceneView.addModelViewSpec(modelClass, viewClass, details);
        // this.classMap.addSpec(new AMVClassSpec(modelClass, viewClass, details))
    }

    setModel(model: ASceneModel) {
        if (this._model && this._model !== model) {
            this._unSetModel();
        }
        this._model = model;
        // this._view = new ASceneView(this);
    }

    _connectSceneViewToModelGraph(sceneViewName:string, modelGraph:AModelGraph) {
        let sceneView = this.getSceneView(sceneViewName);
        sceneView?._subscribeToModelGraph(modelGraph);
    }

    setBackgroundTransform(transform:Quaternion){
        this.sceneViews.setCommonBackgroundTransform(transform)
    }

    _setBackgroundCubeTexture(cubeTexture:THREE.CubeTexture, allSceneViews=true){
        if(allSceneViews){
            this.sceneViews._setBackgroundCubeTexture(cubeTexture)
        }
    }

    protected _unSetModel() {
        this.clearSubscriptions();
        this.view.release();
        this._releaseSceneViews();
    }

    get model(): ASceneModel {
        return this._model as ASceneModel;
    }

    getSceneView(passName?:string){
        passName = passName? passName : SCENE_MODEL_CONSTANTS.MAIN_MODEL_GRAPH_KEY;
        let sceneView = this._getSceneView(passName);
        if(sceneView){
            return sceneView;
        }else{
            throw new Error(`No scene view named ${passName}`);
        }
    }

    get view(): ASceneView {
        return this.mainSceneView;
        // return this._view as ASceneView;
    }

    get cameraModel() {
        return this.cameraView.model;
    }

    // get clock() {
    //     return this._clock;
    // }

    get cameraView(){
        return this.mainSceneView.getViewListForModel(this.model.cameraModel)[0] as ACameraView;
        // return this._cameraView;
    }

    getThreeJSCamera(cameraModel?:ACameraModel){
        if(cameraModel === undefined) {
            return this.cameraView.threeJSCamera;
        }else{
            let camview = this.getViewListForModel(cameraModel);
            return (camview[0] as ACameraView).threeJSCamera;
        }
    }

    getThreeJSScene(passName?:string){
        if(passName === undefined){
            passName = SCENE_MODEL_CONSTANTS.MAIN_MODEL_GRAPH_KEY;
        }
        return this.getSceneView(passName).threeJSScene;
    }

    get modelMap() {
        return this.model.modelMap
    };

    get viewMap() {
        return this.view.viewMap;
    }

    hasModel(model: AModelInterface) {
        return this.model.hasModel(model);
    };

    hasView(view: AView) {
        return this.view.hasView(view);
        // return (this.model.hasModelID(view.modelID) && view.uid in this.viewMap[view.modelID]);
    }

    addView(view: ANodeView) {
        this.view.addView(view);
    }

    removeView(view: AView) {
        this.view.removeView(view);
    }

    disposeViews() {
        this.view.disposeViews();
    }

    getViewListForModel(model: AModelInterface) {
        return this.view.getViewListForModel(model);
    }

    onWindowResize(renderWindow?: AGLRenderWindow): void {
        if(renderWindow && renderWindow.container !== undefined) {
            this.renderer.setSize(renderWindow.container.clientWidth, renderWindow.container.clientHeight);
            /**
             * This will call `cameraModel.onCanvasResize(width, height)` unless overridden
             */
            this.model.onContextResize(this.context);
            // this.cameraModel.onCanvasResize(renderWindow.container.clientWidth, renderWindow.container.clientHeight);
        }
    }

}
