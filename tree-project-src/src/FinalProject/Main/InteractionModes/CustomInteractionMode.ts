import {
    ACamera,
    ACameraModel, AClickInteraction,
    ADOMPointerMoveInteraction, ADragInteraction,
    AInteractionEvent,
    AInteractionMode,
    AKeyboardInteraction, ASceneController,
    ASerializable, AWheelInteraction,
    SetInteractionCallbacks, V2
} from "../../../anigraph";
import type {HasInteractionModeCallbacks} from "../../../anigraph";

@ASerializable("CustomInteractionMode")
export class CustomInteractionMode extends AInteractionMode implements HasInteractionModeCallbacks {
    static MODE_NAME = "Custom Mode"

    // onKeyDown!:CallbackType;
    onClick(event:AInteractionEvent):void{
        console.log(`clicked ${event}`);
    }
    onKeyDown(event:AInteractionEvent, interaction:AKeyboardInteraction){}
    onKeyUp(event:AInteractionEvent, interaction:AKeyboardInteraction){}
    onWheelMove(event:AInteractionEvent, interaction?:AWheelInteraction){}
    onMouseMove(event:AInteractionEvent, interaction?: ADOMPointerMoveInteraction){}
    onDragStart(event:AInteractionEvent, interaction:ADragInteraction){}
    onDragMove(event:AInteractionEvent, interaction:ADragInteraction){}
    onDragEnd(event:AInteractionEvent, interaction:ADragInteraction){}

    get owner():ASceneController{
        return this._owner as ASceneController;
    }

    // onKeyUp!:CallbackType;
    // onMouseMove!:CallbackType;
    // onWheelMove!:AWheelInteractionCallback;
    // onDragStart!:ADragInteractionCallback;
    // onDragMove!:ADragInteractionCallback;
    // onDragEnd!:ADragInteractionCallback;



    /**
     * If you use the regular constructor, it's best to call init(...) to initialize after.
     * @param owner
     * @param args
     */
    constructor(name?:string, owner?:ASceneController,
                interactionCallbacks?:HasInteractionModeCallbacks,
                ...args:any[]) {
        super(name, owner);
        //Set and bind default interaction callbacks if they are defined for class
        SetInteractionCallbacks(this, this, true);

        //Override with any custom callbacks provided in the argument to the constructor.
        if(interactionCallbacks) {
            SetInteractionCallbacks(this, interactionCallbacks, false);
        }
        if(name === undefined){
            this.name = this.serializationLabel;
        }
        this.isGUISelectable = true;
        if(owner){
            this.init(this.owner);
        }
    }


    setupInteractions(){
        if(this.onKeyDown!==undefined || this.onKeyUp!==undefined){
            this.addInteraction(AKeyboardInteraction.Create(
                this.domElement.ownerDocument,
                this.onKeyDown,
                this.onKeyUp
            ))
        }

        const self = this;
        if(this.onClick!==undefined) {
            this.addInteraction(AClickInteraction.Create(this.domElement, this.onClick));
        }

        if(this.onMouseMove!==undefined) {
            this.addInteraction(ADOMPointerMoveInteraction.Create(
                this.domElement,
                this.onMouseMove
            ))
        }

        if(this.onWheelMove!==undefined) {
            this.addInteraction(AWheelInteraction.Create(
                this.domElement,
                this.onWheelMove
            ));
        }
        if(
            this.onDragStart!==undefined ||
            this.onDragMove!==undefined ||
            this.onDragEnd!==undefined
        ) {
            this.addInteraction(ADragInteraction.Create(
                this.domElement,
                this.onDragStart,
                this.onDragMove,
                this.onDragEnd
            ));
        }
    }

    static GetMouseEventMovement(event:AInteractionEvent){
        let webEvent = (event.DOMEvent as MouseEvent);
        // @ts-ignore
        const movementX = webEvent.movementX || webEvent.mozMovementX || webEvent.webkitMovementX || 0;
        // @ts-ignore
        const movementY = webEvent.movementY || webEvent.mozMovementY || webEvent.webkitMovementY || 0;
        return V2(movementX, movementY);
    }



    /**
     * APlayerControls are a subclass of interactions that can only be added to SceneControllers
     * @returns {A3DSceneController<any, any>}
     */
    get sceneController(): ASceneController{
        return this.owner;
    }

    get serializationLabel() {
        // @ts-ignore
        return this.constructor._serializationLabel
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
    // domElement!: HTMLElement;
    get domElement():HTMLElement{
        return this.owner._renderWindow.container;
    }



    init(owner: ASceneController, ...args: any[]) {
        this._owner = owner;
        this.setupInteractions();
    }



    /**
     * Create an instance in a single call, instead of calling new followed by init
     * @param owner
     * @param args
     * @returns {ASceneInteractionMode}
     * @constructor
     */
    static Create(owner: ASceneController, ...args: any[]) {
        let controls = new this();
        controls.init(owner);
        return controls;
    }

}
