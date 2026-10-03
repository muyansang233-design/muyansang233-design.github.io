import * as THREE from "three";
import {AModelInterface, HasModelViewMap, MVMViewMap} from "../base/amvc";
import {AView} from "../base/amvc/AView";
import {ASceneController, SceneControllerSubscriptions} from "./ASceneController";
import {ANodeView} from "./nodeView/ANodeView";
import {ATexture} from "../rendering";
import {Quaternion} from "../math";
import {AModelViewClassMap, AMVClassSpec, AMVClassSpecDetails} from "../base/amvc/AModelViewClassSpec";
import {ClassInterface, SceneGraphEvents} from "../basictypes";
import {ACameraModel, ACameraView} from "./camera";
import {AGroupNodeModel2D, AGroupNodeModel3D, ANodeModel} from "./nodeModel";
import {AGroupNodeView2D, AGroupNodeView3D} from "./nodeView/AGroupNodeView";
import {APointLightModel, APointLightView} from "./lights";
import {ALoadedModel, ALoadedView} from "./nodes/loaded";
import {AModelGraph} from "./AModelGraph";
import {AObjectNode} from "../base";


export class ASceneView extends AView implements HasModelViewMap {


    protected _viewMap: MVMViewMap = {};
    protected _controller!:ASceneController;
    protected _threeJSScene!:THREE.Scene;
    get controller(){return this._controller;}
    get model(){return this.controller.model;}
    get modelID(){return this.model.uid;}
    get viewMap(){return this._viewMap;}
    _threejs!:THREE.Object3D;

    setModelGraph(modelGraph:AModelGraph){
        this._modelGraph = modelGraph;
    }

    constructor(controller:ASceneController, modelGraph?:AModelGraph, ...args:any[]) {
        super();
        this._controller = controller;
        this.classMap = new AModelViewClassMap();
        this._threeJSScene = new THREE.Scene();
        this._threejs = new THREE.Group();
        this._threejs.matrixAutoUpdate=false;
        this._threeJSScene.add(this.threejs);
        this.onModelNodeAdded = this.onModelNodeAdded.bind(this);
        this.onModelNodeRemoved = this.onModelNodeRemoved.bind(this);
        this.initModelViewSpecs();
        if(modelGraph) {
            this.setModelGraph(modelGraph);
        }
    }

    get threeJSScene(){
        return this._threeJSScene;
    }

    get threejs():THREE.Group{
        return this._threejs as THREE.Group;
    }

    /**
     * The model graph with the corresponding scene graph models
     * @type {AModelGraph | undefined}
     * @private
     */
    protected _modelGraph: AModelGraph|undefined=undefined;
    get modelGraph():AModelGraph|undefined{
        return this._modelGraph;
    }

    classMap:AModelViewClassMap;
    _defaultViewClass:ClassInterface<ANodeView>|undefined;

    /**
     * Collect all of the node views into a list and return the list.
     * @returns {any[]}
     */
    getNodeViews():ANodeView[]{
        let rval= [];
        for (let v in this.viewMap){
            let views = this.viewMap[v];
            for (let vkey in views){
                rval.push(this.viewMap[v][vkey]);
            }
        }
        return rval;
    }

    /**
     * The view class that will be used for model classes that dont have specs specified
     * @returns {ClassInterface<ANodeView> | undefined}
     */
    get defaultViewClass():ClassInterface<ANodeView>|undefined{
        return this._defaultViewClass;
    }
    /**
     * Set the view class to be created for models that don't have explicit modelviewspecs specified
     * @param newViewClass
     */
    setDefaultViewClass(newViewClass:ClassInterface<ANodeView>|undefined){
        this._defaultViewClass = newViewClass;
    }

    /**
     * Initialize the model view specs, which determine which view node classes should be created and connected to new instances of different model node classes. Base class version inits: ACameraModel, AGroupNodeModel2D, AGroupNodeModel3D, APointLightModel, and ALoadedModel
     */
    initModelViewSpecs():void{
        // Camera
        this.addModelViewSpec(ACameraModel, ACameraView);

        // Group node (2D)
        this.addModelViewSpec(AGroupNodeModel2D, AGroupNodeView2D);

        // Group node (3D)
        this.addModelViewSpec(AGroupNodeModel3D, AGroupNodeView3D);

        // Point light
        this.addModelViewSpec(APointLightModel, APointLightView);

        // Loaded model
        this.addModelViewSpec(ALoadedModel, ALoadedView);
    }

    /**
     * Add an AMVClassSpec so that new instances of modelClass will trigger the creation of corresponding instances of viewClass
     * @param modelClass
     * @param viewClass
     * @param details
     */
    addModelViewSpec(modelClass:ClassInterface<ANodeModel>, viewClass:ClassInterface<ANodeView>, details?:AMVClassSpecDetails){
        this.classMap.addSpec(new AMVClassSpec(modelClass, viewClass, details))
    }


    /**
     * Initialize subscriptions to the model graph. These will trigger whenever models are created or removed from the graph.
     */
    initModelGraphSubscriptions(clearView=true){
        this._subscribeToModelGraph(this.modelGraph, clearView);
    }

    /**
     * Subscribe to a particular model graph. Should be called in initModelGraphSubscriptions. The possible exception is that you may decicde to subscribe to multiple model graphs, but note that this has not been tested.
     * @param modelGraph
     * @param clearView whether to unsubscribe and clear previously created view if it exists
     * @private
     */
    _subscribeToModelGraph(modelGraph:AModelGraph|undefined, clearView=true){
        const self = this;

        if((this.hasSubscription(SceneControllerSubscriptions.ModelNodeAdded) ||
            this.hasSubscription(SceneControllerSubscriptions.ModelNodeRemoved) ||
            this.hasSubscription(SceneControllerSubscriptions.ModelNodeReleased)) && clearView
        ){
            this.release()
            console.warn("Calling ASceneView.subscribeToModelGraph when view already has subscriptions!!! Releasing view. Not thoroughly tested!!!")
            this.unsubscribe(SceneControllerSubscriptions.ModelNodeAdded, false);
            this.unsubscribe(SceneControllerSubscriptions.ModelNodeRemoved, false);
            this.unsubscribe(SceneControllerSubscriptions.ModelNodeReleased, false);
        }

        if(modelGraph !== undefined){
            this.subscribe(modelGraph.addEventListener(SceneGraphEvents.NodeAdded, (node: ANodeModel, ...args:any[]) => {
                self.onModelNodeAdded(node, ...args);
            }), SceneControllerSubscriptions.ModelNodeAdded);


            this.subscribe(modelGraph.addEventListener(SceneGraphEvents.NodeRemoved, (node: ANodeModel) => {
                self.onModelNodeRemoved(node);
            }), SceneControllerSubscriptions.ModelNodeRemoved);

            this.subscribe(modelGraph.addEventListener(SceneGraphEvents.NodeReleased, (node: ANodeModel) => {
                self.onModelNodeReleased(node);
            }), SceneControllerSubscriptions.ModelNodeReleased);

            modelGraph.mapOverDescendants((descendant:AObjectNode)=>{
                self.onModelNodeAdded(descendant as ANodeModel);
            })
        }
    }

    /**
     * Function that creates a new view for a new node model
     * @param nodeModel
     * @param viewClass
     * @param args
     * @returns {ANodeView}
     */
    createViewForNodeModel(nodeModel: ANodeModel, viewClass?:ClassInterface<ANodeView>, ...args:any[]){
        if(viewClass === undefined){
            let spec = this.classMap.getSpecForModel(nodeModel);
            if(spec !== undefined){
                viewClass = spec.viewClass;
            }else{
                if(this.defaultViewClass){
                    viewClass = this.defaultViewClass
                }
            }
        }

        if(viewClass !== undefined){
            let view = new viewClass();
            view.setController(this.controller);
            view.setModel(nodeModel);
            return view;
        } else{
            throw new Error(`Unsure how to create view for ${nodeModel} with class ${nodeModel.constructor.name}`)
        }
    }


    hasModel(model:AModelInterface){
        return (model.uid in this.viewMap);
        // return this.controller.hasModel(model);
    };
    hasView(view:AView){
        return (view.uid in this.viewMap[view.modelID]);
    }
    addView(view:ANodeView){
        if(this.viewMap[view.modelID]===undefined){
            this.viewMap[view.modelID]={};
        }
        this.viewMap[view.modelID][view.uid]=view;
        // if(view.model.parent === this.model){
        //     this.threejs.add(view._threejs);
        // }
        //
    }
    removeView(view:AView){
        this.threejs.remove(view._threejs);
        delete this.viewMap[view.modelID][view.uid];
    }

    releaseView(view:AView){
        this.threejs.remove(view._threejs);
        this.viewMap[view.modelID][view.uid].disposeGraphics();
        delete this.viewMap[view.modelID][view.uid];

    }


    /**
     * Set the background using a cube texture
     * @param cubeTexture
     */
    setBackgroundCubeTexture(cubeTexture:THREE.CubeTexture):void{
        this.threeJSScene.background=cubeTexture;
    }

    setBackgroundTexture(texture:ATexture){
        this._threeJSScene.background = texture.threejs
    }

    /**
     * Set the background transform. Can be used to transform cube texture background. Only rotations can be used.
     * @param transform
     */
    setBackgroundTransform(transform:Quaternion){
        this._threeJSScene.rotation.setFromQuaternion(transform);
        this.threejs.rotation.setFromQuaternion(transform.getInverse());
        this._threeJSScene.matrixWorldNeedsUpdate=true;
        this.threejs.matrixWorldNeedsUpdate=true;
    }

    getViewListForModel(model:AModelInterface):ANodeView[]{
        if(this.hasModel(model)) {
            return Object.values(this.viewMap[model.uid]);
        }
        else{
            return [];
        }
    }

    _getViewListForModelID(modelID:string):ANodeView[]{
        return Object.values(this.viewMap[modelID]);
    }

    /**
     * Triggered when a node model is added for which we have not already created and added a node view. This function will create and add the node view.
     * @param {ANodeModel} nodeModel
     * @param args
     * @protected
     */
    protected _onNewModelNodeAdded(nodeModel:ANodeModel, viewClass?:ClassInterface<ANodeView>, ...args:any[]){
        let newView = this.createViewForNodeModel(nodeModel, viewClass, ...args);
        this.addView(newView);
    }

    /**
     * Gets called whenever a new node model is added to the graph.
     * May be triggered for other scene views as well depending on whether they are set to map the same scene graph.
     * @param nodeModel
     * @param args
     */
    onModelNodeAdded(nodeModel: ANodeModel, ...args:any[]) {
        return this.updateViewForModelAdded(nodeModel, undefined, ...args);
    }

    /**
     * This gets called by onModelNodeAdded, but it can also be called explicitly if you are building your own custom scene view in some way.
     * @param {ANodeModel} nodeModel
     * @param {ClassInterface<ANodeView>} viewClass
     * @param args
     */
    updateViewForModelAdded(nodeModel:ANodeModel, viewClass?:ClassInterface<ANodeView>, ...args:any[]) {
        let modelViewList = this.getViewListForModel(nodeModel);
        if(modelViewList.length<1){
            this._onNewModelNodeAdded(nodeModel, viewClass, ...args);
            modelViewList = this.getViewListForModel(nodeModel);
        }
        if(modelViewList.length>0) {
            if(modelViewList.length>1){
                throw new Error("Have not implemented multiple views for a given model in one scene controller yet!")
            }
            let view = modelViewList[0];
            if (nodeModel.parent instanceof ANodeModel) {
                let parentView = this.getViewListForModel(nodeModel.parent)[0];
                view.setParentView(parentView);
            }else if(nodeModel.parent === this.model || nodeModel.parent === this.modelGraph){
                view.setParentView(this);
            }else{
                console.warn("Adding node model with unknown parent type:")
                console.warn(nodeModel);
            }
        }
    }

    onModelNodeRemoved(nodeModel: ANodeModel) {
        let viewList = this.getViewListForModel(nodeModel);
        if(viewList.length !== 1){
            throw new Error(`invalid number of views for node ${nodeModel}. ViewList ${viewList}`);
        }
        viewList[0].threejs.removeFromParent();
    }

    onModelNodeReleased(nodeModel:ANodeModel){
        let views = this.getViewListForModel(nodeModel);
        for (let v of views) {
            v.release();
        }
        delete this.viewMap[nodeModel.uid];
    }


    disposeViews(){
        for (let modelID in this.viewMap){
            let viewList = this._getViewListForModelID(modelID);
            for(let v of viewList) {
                this.releaseView(v);
            }
        }
        for(let modelID in this.viewMap){
            delete this.viewMap[modelID];
        }
    }

    /**
     * This should release all of the graphics resources!
     */
    release(){
        this.disposeViews();
        super.release();
    }
}

export class ASceneViewMap extends Map<string, ASceneView>{
    constructor(...args:any[]) {
        super(...args);
    }

    mapOverSceneViews(f:(rp:ASceneView)=>void){
        this.forEach((value, key)=>{
            f(value);
        })
    }

    setCommonBackgroundTransform(transform:Quaternion){
        function setbgt(rp:ASceneView){
            rp.setBackgroundTransform(transform);
        }
        this.mapOverSceneViews(setbgt);
    }

    _setBackgroundCubeTexture(cubeTexture:THREE.CubeTexture){
        function setbgt(rp:ASceneView){
            rp.setBackgroundCubeTexture(cubeTexture);
        }
        this.mapOverSceneViews(setbgt);
    }

    release(){
        this.forEach((value, key)=>{
            value.release();
        })
    }
}


