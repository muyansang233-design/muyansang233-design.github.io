import {AppState, GetAppState} from "../../anigraph";
import {Fragment} from "react";
import {MainSceneModel} from "./MainSceneModel";

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
