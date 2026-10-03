import {ExampleSceneController} from "../../StarterCode/Scene/ExampleSceneController";
import {Color} from "../../../anigraph";
import {Example1SceneModel} from "./Example1SceneModel";

export class Example1SceneController extends ExampleSceneController{
    get model():Example1SceneModel{
        return this._model as Example1SceneModel;
    }

    /**
     * This is where you specify the mapping from model classes to view classes.
     */
    initModelViewSpecs(): void {
        super.initModelViewSpecs();
        this.addExampleModelViewSpecs();
    }

    async initScene(): Promise<void> {
        await super.initScene()
        this.initSkyBoxCubeMap();
        this.setClearColor(Color.Black());
    }

    initInteractions() {
        super.initInteractions();
        this.initExampleInteractions();

    }

}




