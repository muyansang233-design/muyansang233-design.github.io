import React from "react";
import { AThreeJSContextComponent, CreateAppState } from "./anigraph";
import { TreeSceneModel } from "./TreeEmbed/TreeSceneModel";
import { TreeSceneController } from "./TreeEmbed/TreeSceneController";

const scene = new TreeSceneModel();
const appState = CreateAppState(scene);
scene.initAppState(appState);
appState.createMainRenderWindow(TreeSceneController);
appState.confirmInitialized();

export default function TreeEmbedApp() {
    return <AThreeJSContextComponent renderWindow={appState.mainRenderWindow} />;
}
