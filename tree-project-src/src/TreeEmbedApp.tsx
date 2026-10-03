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
    React.useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            if (event.source !== window.parent || event.data?.channel !== "jacky-tree") return;
            const command = event.data;
            switch (command.action) {
                case "regenerate":
                    scene.regenerateTree();
                    break;
                case "wind":
                    scene.setWindDirection(Number(command.x), Number(command.y), Number(command.z));
                    scene.setWindStrength(Number(command.strength));
                    break;
                case "wind-visual":
                    scene.setWindVisualization(command.visible === true);
                    break;
            }
        };
        window.addEventListener("message", onMessage);
        window.parent.postMessage({ channel: "jacky-tree", action: "ready" }, "*");
        return () => window.removeEventListener("message", onMessage);
    }, []);
    return <AThreeJSContextComponent renderWindow={appState.mainRenderWindow} />;
}
