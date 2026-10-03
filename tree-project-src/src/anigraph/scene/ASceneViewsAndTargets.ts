import {AObject} from "../base";
import {AModelGraph} from "./AModelGraph";
import {ASceneView, ASceneViewMap} from "./ASceneView";
import {ARenderTarget} from "../rendering/target/ARenderTarget";
import {ASceneController} from "./ASceneController";

/**
 * Scene views and targets
 */
export class ASceneViewsAndTargets extends  AObject{
    protected _sceneViews:ASceneViewMap=new ASceneViewMap();
    _renderTargets:ARenderTarget[]=[];


    //<editor-fold desc="Render Targets">

    /**
     * Targets for rendering
     * @returns {ARenderTarget[]}
     */
    get renderTargets(){
        return this._renderTargets;
    }

    /**
     * Add render target of a given size
     * @param width
     * @param height
     */
    addRenderTarget(width:number, height:number){
        this.renderTargets.push(ARenderTarget.CreateFloatRGBATarget(width, height));
    }

    //</editor-fold>


    //<editor-fold desc="Render Passes">

    /**
     * Scene view map
     * @returns {ASceneViewMap}
     */
    get sceneViews():ASceneViewMap{
        return this._sceneViews;
    }

    mapOverSceneViews(f:(rp:ASceneView)=>void){
        this.sceneViews.mapOverSceneViews(f);
    }

    /**
     * Creates a scene view that maps a given model graph
     * @param sceneController
     * @param name
     * @param modelGraph
     * @returns {ASceneView | undefined}
     */
    createSceneView(sceneController:ASceneController, name:string, modelGraph:AModelGraph){
        if(this.sceneViews.has(name)){
            throw new Error(`SceneView ${name} already exists`);
        }
        this.sceneViews.set(name, new ASceneView(sceneController, modelGraph));
        return this.sceneViews.get(name);
    }
    //</editor-fold>

    release(){
        this.releaseSceneViews();
        this.releaseTargets();
    }

    releaseSceneViews(){
        this.sceneViews.release()
    }

    releaseTargets():void{
        for(let a of this.renderTargets){
            a.release();
        }
    }

}
