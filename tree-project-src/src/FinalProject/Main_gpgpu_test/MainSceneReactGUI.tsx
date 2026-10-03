import { AppState, GetAppState } from "../../anigraph";
import { Fragment } from "react";
import { MainSceneModel } from "./MainSceneModel";

export function UpdateGUIWithFPS(...args: any[]) {
    const appState: AppState = GetAppState();
    const sceneModel = appState.sceneModel as MainSceneModel;
    
    if (sceneModel) {
        return (
            <Fragment>
                <p style={{
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: sceneModel.currentFPS < 30 ? '#ff4444' :
                           sceneModel.currentFPS < 50 ? '#ffaa00' : '#44ff44'
                }}>
                    FPS: {sceneModel.currentFPS.toFixed(1)}
                </p>
                <p style={{ fontSize: '12px', color: '#888' }}>
                    Particles: {sceneModel.waterParticles?.particleCount ?? 0} (GPGPU)
                </p>
            </Fragment>
        );
    } else {
        return null;
    }
}

