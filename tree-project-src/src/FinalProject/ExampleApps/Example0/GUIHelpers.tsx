import {AppState, GetAppState} from "../../../anigraph";
import {Fragment} from "react";
import {Example0SceneModel} from "./Example0SceneModel";

export function UpdateGUIJSX(...args:any[]){
    let appState:AppState = GetAppState();
    if(appState.sceneModel) {
        return (
            <Fragment>{appState.sceneModel.name}</Fragment>
        )
    }
    else{
        return;
    }
}

export function UpdateGUIJSXWithCameraPosition(...args:any[]){
    let appState:AppState = GetAppState();
    if(appState.sceneModel && appState.sceneModel.cameraModel) {
        return (
            <Fragment>
                <p>Camera Location: {appState.sceneModel.camera.position.sstring(2)}</p>
            </Fragment>
        )
    }else{
        return;
    }
}



export function UpdateGUIWithBots(...args:any[]){
    let appState:AppState = GetAppState();
    let sceneModel = appState.sceneModel as Example0SceneModel;
    if(appState.sceneModel && appState.sceneModel.cameraModel) {
        return (
            <Fragment>
                <p>Bot1 World Coordinates: {sceneModel.bots[0].worldPosition.sstring(2)}</p>
            </Fragment>
        )
    }else{
        return;
    }
}



