import {
    ACamera,
    ACameraModel, AClickInteraction,
    ADOMPointerMoveInteraction, ADragInteraction,
    AInteractionEvent,
    AInteractionMode,
    AKeyboardInteraction, ANodeModel3D, ASceneController,
    ASceneModel,
    ASerializable, AWheelInteraction, NodeTransform3D,
    SetInteractionCallbacks, V2, V4
} from "../../../anigraph";
import {ASceneInteractionMode} from "../../../anigraph/starter";


interface IsSceneModelWithRequirements extends ASceneModel{
    // Put any expected functions of supported scene models here
    onClick(event:AInteractionEvent):void;
    cursorModel:ANodeModel3D;
}

@ASerializable("ExampleClickInteractionMode")
export class ExampleClickInteractionMode extends ASceneInteractionMode{
    static MODE_NAME = "Custom Mode"

    /**
     * Here we are simply defining our model getter to cast our scene model as one with the required interface implemented
     * @returns {IsSceneModelWithRequirements}
     */
    get model():IsSceneModelWithRequirements{
        return (this.owner.model as IsSceneModelWithRequirements);
    }

    get owner():ASceneController{
        return this._owner as ASceneController;
    }

    updateCursor(event:AInteractionEvent){
        let ndcCursor = event.ndcCursor;
        if(ndcCursor) {

            /**
             * The cursor in NDC coordinates (randing from -1 to 1 across the x and y dimensions of your rendering window), as a homogeneous 3D vector at depth 0 in NDC space
             * @type {Vec4}
             */
            let cursorCoordsH = V4(
                ndcCursor.x,
                ndcCursor.y,
                0,
                1
            );

            /**
             * The cursor in eye coordinates. We will calculate this by transforming by the inverse of our projection matrix.
             * @type {Vec4}
             */
            let eyeCoordinates = this.camera.projection.getInverse().times(cursorCoordsH).getHomogenized();

            /**
             * Set the position of our cursor to this eye coordinates position
             */
            this.model.cursorModel.setTransform(
                new NodeTransform3D(eyeCoordinates.Point3D, undefined, 0.0002)
            );
        }
    }

    /**
     * Our click response will simply call whatever `onClick` method is defined in our model
     * @param event
     */
    onClick(event:AInteractionEvent):void{
        this.model.onClick(event);
    }

    // onKeyDown(event:AInteractionEvent, interaction:AKeyboardInteraction){}
    // onKeyUp(event:AInteractionEvent, interaction:AKeyboardInteraction){}
    // onWheelMove(event:AInteractionEvent, interaction?:AWheelInteraction){}
    onMouseMove(event:AInteractionEvent, interaction?: ADOMPointerMoveInteraction){
        this.updateCursor(event);
    }
    onDragStart(event:AInteractionEvent, interaction:ADragInteraction){
        this.updateCursor(event);
    }
    // onDragMove(event:AInteractionEvent, interaction:ADragInteraction){}
    // onDragEnd(event:AInteractionEvent, interaction:ADragInteraction){}

    /**
     * We will make the cursor visible when this mode is activated
     * @param args
     */
    beforeActivate(...args:any[]) {
        super.beforeActivate(...args);
        this.model.cursorModel.visible=true;
    }

    /**
     * We will make the cursor invisible when this mode is deactivated
     * @param args
     */
    beforeDeactivate(...args:any[]) {
        super.beforeDeactivate(...args);
        this.model.cursorModel.visible=false;
    }

    /**
     * This is a model that contains a camera.
     * The camera itself just encapsulates a pose and projection matrix. The model is what the camera belongs to,
     * and can be an actual entity in the scene.
     * @returns {ACameraNodeModel}
     */
    get cameraModel(): ACameraModel {
        return this.owner.cameraModel;
    }

    get camera(): ACamera {
        return this.cameraModel.camera;
    }

    /**
     * This is the DOM element that is the game window being controlled
     * @type {HTMLElement}
     */
    get domElement():HTMLElement{
        return this.owner._renderWindow.container;
    }

    /**
     * Create an instance in a single call, instead of calling new followed by init
     * @param owner
     * @param args
     * @returns {ASceneInteractionMode}
     * @constructor
     */
    static Create(owner: ASceneController, ...args: any[]) {
        let controls = new this(this.InteractionModeClassName(), owner);
        controls.init(owner);
        return controls;
    }

}
