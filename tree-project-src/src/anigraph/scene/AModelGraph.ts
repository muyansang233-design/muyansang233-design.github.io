import {SceneGraphEvents} from "../basictypes";
import {AModel, AModelInterface, AObjectNode} from "../base";
import {HasModelMap, MVMModelMap} from "../base";
import {AObjectNodeEvents} from "../base";
import {ANodeModel} from "./nodeModel";
import {APointLightModel} from "./lights/APointLightModel";
import {Color, type TransformationInterface} from "../math";

export enum ASCENEMODEL_EVENT_HANDLES{
    SCENE_NODE_ADDED="SCENE_NODE_ADDED",
    SCENE_NODE_REMOVED="SCENE_NODE_REMOVED",
    SCENE_NODE_RELEASED="SCENE_NODE_RELEASED",
    SCENE_CHILD_REMOVED="SCENE_CHILD_REMOVED"
}

export class AModelGraph extends AModel implements HasModelMap{
    protected _modelMap:MVMModelMap={};
    get modelMap(){
        return this._modelMap;
    }

    get isSceneGraphRoot(){
        return true;
    }

    getModelGraph():AModelGraph{
        return this;
    }

    constructor(name?:string) {
        super(name);
        this._initSceneGraphSubscriptions();
    }


    addPointLight(transform?:TransformationInterface, color?:Color, intensity?:number, distance?:number, decay?:number){
        let plight = new APointLightModel(transform, color,intensity, distance, decay);
        this.addChild(plight);
        return plight;
    }

    getPointLights(){
        function isPointLight(n:AObjectNode):boolean{
            return n instanceof APointLightModel;
        }
        return this.filterDescendants(isPointLight)
    }

    hasModel(model:AModelInterface){
        return (model.uid in this.modelMap);
    }

    hasModelID(modelID:string){
        return (modelID in this.modelMap);
    }

    /**
     * same as addChild, but included to allow same calling convention as adding a node to a scene model
     * @param node
     * @param position
     * @param args
     */
    addNode(node:AObjectNode, position?:number, ...args:any[]): void {
        this.addChild(node, position, ...args);
    }

    /**
     * Adds the model to the model map if it isn't already in there, then signals that a node has been added.
     * @param model
     * @private
     */
    _addModel(model:AModelInterface, ...args:any[]){
        if(!this.hasModel(model)){
            this.modelMap[model.uid]=model;
        }
        this.signalEvent(SceneGraphEvents.NodeAdded, model, ...args);
    }
    _removeModel(model:AModelInterface){
        // delete this._modelMap[model.uid];
        this.signalEvent(SceneGraphEvents.NodeRemoved, model);
    }

    _releaseModel(model:AModelInterface){
        delete this._modelMap[model.uid];
        this.signalEvent(SceneGraphEvents.NodeReleased, model);
    }

    _initSceneGraphSubscriptions(){
        const self = this;
        this.subscribe(this.addEventListener(AObjectNodeEvents.DescendantAdded, (descendant:ANodeModel, ...args:any[])=>{
            this._addModel(descendant, ...args)
            // self._addModel(descendant);
        }), ASCENEMODEL_EVENT_HANDLES.SCENE_NODE_ADDED);

        this.subscribe(this.addEventListener(AObjectNodeEvents.DescendantRemoved, (descendant:ANodeModel)=>{
            self._removeModel(descendant);
        }), ASCENEMODEL_EVENT_HANDLES.SCENE_NODE_REMOVED);

        this.subscribe(this.addEventListener(AObjectNodeEvents.DescendantReleased, (descendant:ANodeModel)=>{
            self._releaseModel(descendant);
        }), ASCENEMODEL_EVENT_HANDLES.SCENE_NODE_RELEASED);
    }


}



