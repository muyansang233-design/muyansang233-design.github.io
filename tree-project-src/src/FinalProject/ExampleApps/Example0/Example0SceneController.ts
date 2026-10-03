/**
 * @file Main scene controller for your application
 * @description This is where you connect models to views.
 * This is done mainly by defining your model view spec and interaction modes.
 */

import {Example0SceneModel} from "./Example0SceneModel";
import {ExampleSceneController} from "../../StarterCode/Scene/ExampleSceneController";
import {Color, Mat3, V3} from "../../../anigraph";
import {ExampleClickInteractionMode} from "../../StarterCode";

export class Example0SceneController extends ExampleSceneController{
    get model():Example0SceneModel{
        return this._model as Example0SceneModel;
    }

    /**
     * This is where you specify the mapping from model classes to view classes.
     */
    initModelViewSpecs(): void {
        super.initModelViewSpecs();
        this.addExampleModelViewSpecs()
    }

    async initScene(): Promise<void> {
        /**
         * Call the super functions. Because it is super.
         */
        await super.initScene();
        this.setClearColor(Color.Black());
        this.loadSpaceSkymap();
    }

    initInteractions() {
        /**
         * We will define the debug interaction mode here.
         * The debug mode is offered mainly to provide camera controls for developing and debugging non-control-related
         * features. It may also be useful as an example for you to look at if you like.
         */
        super.initInteractions();

        // add the example interaction modes
        this.initExampleInteractions();

        this.defineInteractionMode("ExampleClick", ExampleClickInteractionMode.Create(this));

        /**
         * We can optionally set the starting interaction mode to be whatever we want here
         */
        // this.setCurrentInteractionMode("ExampleClick");

    }
}



