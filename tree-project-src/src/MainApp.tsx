import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min';
import React, {useEffect, useState} from "react";
import {MainComponent, GUIComponent} from "./Component";
import {Layout, FullLayout, GUIBottomComponent, DefaultAppComponent} from "./Component";
import {CreateAppState, ControlPanel, AThreeJSContextComponent} from "./anigraph";
import {loadExampleAssetDetails} from "./anigraph/starter/ExampleAssets";

// import AppClasses from "./FinalProject/Main/"
import AppClasses from "./FinalProject/Main_gpgpu_test/"
// import AppClasses from "./FinalProject/ExampleApps/Example0"
// import AppClasses from "./FinalProject/ExampleApps/Example1"
// import AppClasses from "./FinalProject/ExampleApps/Example2"
// import AppClasses from "./FinalProject/ExampleApps/Example3"
// import AppClasses from "./FinalProject/ExampleApps/ShaderDemo"wd4
// import AppClasses from "./FinalProject/ExampleApps/ShaderDemoUnabridged"
// import AppClasses from "./FinalProject/ExampleApps/MultipassExample"


loadExampleAssetDetails();

const AppComponentClass = AppClasses.ComponentClass??DefaultAppComponent;

const sceneModel = new AppClasses.SceneModelClass();
const appState = CreateAppState(sceneModel);
sceneModel.initAppState(appState);

appState.createMainRenderWindow(AppClasses.SceneControllerClass);
const initConfirmation = appState.confirmInitialized();

const UseFullWindowLayout = false;


function MainApp() {
    useEffect(() => {

        initConfirmation.then(()=> {
                console.log("Main Initialized.");
                appState.updateControlPanel();
            }
        );
    }, []);


    if(UseFullWindowLayout){
        return (
            <FullLayout>
                <div className={"control-panel-parent"}>
                    <ControlPanel appState={appState}></ControlPanel>
                </div>
            <AThreeJSContextComponent renderWindow={appState.mainRenderWindow}/>
            </FullLayout>
        )
    }else {
        return (
            <div>
                <div className={"control-panel-parent"}>
                    <ControlPanel appState={appState}></ControlPanel>
                </div>
                <Layout>
                    <div className={"container-fluid"} id={"anigraph-app-div"}>
                        <div className={"row anigraph-row"}>
                            <div
                                className={`col-${appState.getState("CanvasColumnSize") ?? 10} anigraph-component-container`}>
                                <MainComponent renderWindow={appState.mainRenderWindow} name={appState.sceneModel.name}>
                                    <GUIComponent appState={appState}>
                                        <AppComponentClass model={sceneModel}></AppComponentClass>
                                    </GUIComponent>
                                </MainComponent>
                            </div>
                        </div>
                        <div className={"row"}>
                            <div
                                className={`col-${appState.getState("CanvasColumnSize") ?? 10} anigraph-component-container`}>
                                <GUIBottomComponent appState={appState}>
                                </GUIBottomComponent>
                            </div>
                        </div>
                    </div>
                </Layout>
            </div>
        );
    }
}

export default MainApp;
