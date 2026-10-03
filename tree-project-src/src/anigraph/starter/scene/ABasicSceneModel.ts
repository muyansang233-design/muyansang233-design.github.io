import {AObjectState, ASerializable} from "../../base";
import {ASceneModel} from "../../scene/ASceneModel";
import {AppState, GetAppState} from "../../appstate";
import {AShaderMaterial, AShaderModel, ATexture} from "../../rendering";
import {AObject3DModelWrapper} from "../../geometry";
import {Color, NodeTransform3D, TransformationInterface} from "../../math";
import {A3DModelLoader} from "../../fileio";
import {ALightModel, APointLightModel} from "../../scene/lights";
import {ClassInterface} from "../../basictypes";
import {ALoadedModel} from "../../scene/nodes/loaded/ALoadedModel";
import {AssetManager} from "../../fileio/AAssetManager";


@ASerializable("ABasicSceneModel")
export abstract class ABasicSceneModel extends ASceneModel{
    @AObjectState _sceneScale!:number;

    get sceneScale(){
        if(this._sceneScale === undefined){
            this._sceneScale = GetAppState().globalScale;
        }
        return this._sceneScale;
    }
    _textures:{[name:string]:ATexture}={};

    viewLight!:APointLightModel;
    static _VIEW_LIGHT_SUBSCRIPTION_KEY:string ="VIEW_LIGHT_CAMERA_UPDATE_SUB"

    getTexture(name:string){
        return this._textures[name];
    }

    addTimeRateAppStateControl(appState:AppState){
        const STATEKEY = "ModelPlaySpeed"
        appState.addSliderIfMissing(STATEKEY, 1, 0, 10, 0.001);
        const self = this;
        this.subscribeToAppState(STATEKEY, (value:number)=>{
            self.clock.rate = value;
        })
    }


    addViewLight(){
        this.viewLight =this.addPointLight(this.camera.pose, Color.FromString("#ffffff"),1, 1, 1);
        this._attachViewLightToCamera();
    }


    _attachViewLightToCamera(){
        const self = this;
        this.subscribe(this.camera.addPoseListener(()=>{
            self.viewLight.setTransform(self.camera.transform);
        }), ABasicSceneModel._VIEW_LIGHT_SUBSCRIPTION_KEY);
    }
    _detachViewLightFromCamera(){
        this.unsubscribe(ABasicSceneModel._VIEW_LIGHT_SUBSCRIPTION_KEY);
    }

    async PreloadAssets(){
        await super.PreloadAssets();
    }
    abstract initAppState(appState:AppState):void;

}

