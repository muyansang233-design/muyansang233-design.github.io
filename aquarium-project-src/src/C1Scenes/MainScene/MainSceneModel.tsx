import {AppState, Color, GetAppState} from "../../anigraph";
import {App2DSceneModel} from "../../anigraph/starter/App2D/App2DSceneModel";


let nErrors = 0;

/**
 * This is your Scene Model class. The scene model is the main data model for your application. It is the root for a
 * hierarchy of models that make up your scene/
 */
export class MainSceneModel extends App2DSceneModel{

    /**
     * This will add variables to the control pannel
     * @param appState
     */
    initAppState(appState:AppState){
        appState.addSliderIfMissing("SliderValue1", 0, 0, 1, 0.001);
        appState.addColorControl("ColorValue1", Color.FromString("#123abe"));
    }

    /**
     * Use this function to initialize the content of the scene.
     * Generally, this will involve creating instances of ANodeModel subclasses and adding them as children of the scene:
     * ```
     * let myNewModel = new MyModelClass(...);
     * this.addChild(myNewModel);
     * ```
     *
     * You may also want to add tags to your models, which provide an additional way to control how they are rendered
     * by the scene controller. See example code below.
     */
    initScene(){
        // Do stuff here!
    }

    timeUpdate(t: number) {
        try {
        }catch(e) {
            if(nErrors<1){
                console.error(e);
                nErrors+=1;
            }
        }
    }
}
