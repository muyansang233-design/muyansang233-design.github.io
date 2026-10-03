import {
    ADOMPointerMoveInteraction, ADragInteraction,
    AInteractionEvent, AKeyboardInteraction, GetAppState,
    HasInteractionModeCallbacks,
    NodeTransform3D, Particle3D, V3, Vec2,
    Vec3
} from "../../../anigraph";
import {AWheelInteraction} from "../../../anigraph/interaction/AWheelInteraction";
import {MainAppPointerLockInteractionMode} from "./MainAppPointerLockInteractionMode";
import {ABasicSceneController} from "../../../anigraph/starter";

enum ExamplePointerLockControlPanelParams{
    PlayerSpeed="PlayerSpeed"
}

export class ExamplePointerLockInteractionMode extends MainAppPointerLockInteractionMode{
    /**
     * You may want to define some parameters to adjust the speed of controls...
     */
    mouseMovementSpeed:number=0.1;

    get camera(){
        return this.model.camera;
    }

    constructor(owner?:ABasicSceneController,
                name?:string,
                interactionCallbacks?:HasInteractionModeCallbacks,
                ...args:any[]) {
        super(name, owner, interactionCallbacks, ...args);
        // this.reset();
        let appState = GetAppState();
        /**
         * First argument is just a string we defined in the enum above to avoid type-based bugs...
         */
        if(appState.getState(ExamplePointerLockControlPanelParams.PlayerSpeed)===undefined) {
            appState.addSliderControl(ExamplePointerLockControlPanelParams.PlayerSpeed, 0.1, 0, 1, 0.01);
        }
    }

    reset(){
        let playerPosition = this.hasPlayer? this.player.transform.getPosition() : V3();
        // You can reset the control mode here
        this.camera.pose = NodeTransform3D.LookAt(
            playerPosition.plus(Vec3.UnitZ().times(3)),
            playerPosition,
            Vec3.UnitY()
        )

    }

    /**
     * This gets called immediately before the interaction mode is activated. For now, we will call reset()
     * @param args
     */
    beforeActivate(...args:any[]) {
        super.beforeActivate(...args);
        this.reset();
    }

    /**
     * Create an instance in a single call, instead of calling new followed by init
     * @param owner
     * @param args
     * @returns {ASceneInteractionMode}
     * @constructor
     */
    static Create(owner: ABasicSceneController, ...args: any[]) {
        let controls = new this();
        controls.init(owner);
        return controls;
    }

    onWheelMove(event: AInteractionEvent, interaction: AWheelInteraction) {
        let zoom = (event.DOMEvent as WheelEvent).deltaY;
    }

    /**
     * See other interaction mode examples for example of how to define
     * @param event
     * @param interaction
     */
    onKeyDown(event:AInteractionEvent, interaction:AKeyboardInteraction){
        // e.g., define this.player.onKeyDown(event, interaction)

    }

    onKeyUp(event:AInteractionEvent, interaction:AKeyboardInteraction){
        if(!interaction.keysDownState['w']){
        }
        if(!interaction.keysDownState['a']){
        }
        if(!interaction.keysDownState['s']){
        }
        if(!interaction.keysDownState['d']){
        }
        if(!interaction.keysDownState['r']){
        }
        if(!interaction.keysDownState['f']){
        }
    }

    onDragStart(event: AInteractionEvent, interaction: ADragInteraction): void {
        /**
         * Here we will track some interaction state. Specifically, the last cursor position.
         */
        interaction.setInteractionState('lastCursor', event.ndcCursor);
    }
    onDragMove(event: AInteractionEvent, interaction: ADragInteraction): void {
        if(!event.ndcCursor){
            return;
        }
        let mouseMovement = event.ndcCursor.minus(interaction.getInteractionState('lastCursor'));
        interaction.setInteractionState('lastCursor', event.ndcCursor);
    }
    onDragEnd(event: AInteractionEvent, interaction: ADragInteraction): void {
        let cursorWorldCoordinates:Vec2|null = event.ndcCursor;
        let dragStartWorldCoordinates:Vec2|null = interaction.dragStartEvent.ndcCursor;
    }


    onMouseMove(event:AInteractionEvent, interaction:ADOMPointerMoveInteraction ) {
        if(!this.hasPlayer){
            console.warn("No player specified!");
            return;
        }
        // console.log(event);
        if ( this.isLocked === false ) return;

        let webEvent = (event.DOMEvent as MouseEvent);
        // @ts-ignore
        const movementX = webEvent.movementX || webEvent.mozMovementX || webEvent.webkitMovementX || 0;
        // @ts-ignore
        const movementY = webEvent.movementY || webEvent.mozMovementY || webEvent.webkitMovementY || 0;

        let appState = GetAppState();
        /**
         * Move the character by a vector controlled by the mouse motion
         */
        let motionVector =
            Vec3.UnitX().times(movementX)
                .plus(
                    Vec3.UnitY().times(-movementY)
                ).times(
                0.05*appState.getState(ExamplePointerLockControlPanelParams.PlayerSpeed)
            )
        this.player.transform.setPosition(this.player.transform.getPosition().plus(motionVector));
        this.camera.position = this.camera.position.plus(motionVector);
    }



    /**
     * This would be a good place to implement the time update of any movement filters
     * @param t
     * @param args
     */
    timeUpdate(t: number, ...args:any[]) {
    }


}
