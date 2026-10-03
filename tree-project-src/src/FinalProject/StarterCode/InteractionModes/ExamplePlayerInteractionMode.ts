import {
    ADOMPointerMoveInteraction, ADragInteraction,
    AInteractionEvent, AKeyboardInteraction,
    ASerializable,
    NodeTransform3D, Vec2,
    Vec3,
    AWheelInteraction
} from "../../../anigraph";
import {ABasicSceneController, ASceneInteractionMode} from "../../../anigraph/starter";
import type {HasInteractionModeCallbacks} from "../../../anigraph"
import {MainAppInteractionMode} from "./MainAppInteractionMode";


interface HasPosition3D{
    position:Vec3;
}

@ASerializable("ExamplePlayerInteractionMode")
export class ExamplePlayerInteractionMode extends MainAppInteractionMode{
    /**
     * You may want to define some parameters to adjust the speed of controls...
     */
    mouseMovementSpeed:number=3;
    keyboardMovementSpeed:number=0.25;
    cameraTarget!:HasPosition3D;

    get camera(){
        return this.cameraModel.camera;
    }

    constructor(owner?:ABasicSceneController,
                name?:string,
                interactionCallbacks?:HasInteractionModeCallbacks,
                ...args:any[]) {
        super(name, owner, interactionCallbacks, ...args);
        // this.reset();
    }

    reset(){
        // You can reset the control mode here
        this.camera.pose = NodeTransform3D.LookAt(
            this.cameraTarget.position.plus(Vec3.UnitZ().times(3)),
            this.cameraTarget.position,
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
        console.log(`Wheel moved! deltaY: ${zoom}`);
    }

    onMouseMove(event:AInteractionEvent, interaction: ADOMPointerMoveInteraction){
        // console.log(`mouse move! ${event}`);
    }

    onKeyDown(event:AInteractionEvent, interaction:AKeyboardInteraction){
        if(interaction.keysDownState['w']){
            this.cameraTarget.position.y = this.cameraTarget.position.y+this.keyboardMovementSpeed;
        }
        if(interaction.keysDownState['a']){
            this.cameraTarget.position.x = this.cameraTarget.position.x-this.keyboardMovementSpeed;
        }
        if(interaction.keysDownState['s']){
            this.cameraTarget.position.y = this.cameraTarget.position.y-this.keyboardMovementSpeed;

        }
        if(interaction.keysDownState['d']){
            this.cameraTarget.position.x = this.cameraTarget.position.x+this.keyboardMovementSpeed;
        }
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

        let movementX = mouseMovement.x*this.mouseMovementSpeed;
        let movementY = mouseMovement.y*this.mouseMovementSpeed;
        this.cameraTarget.position = this.cameraTarget.position.plus(new Vec3(movementX, movementY, 0));
        this.camera.position = this.camera.position.plus(new Vec3(movementX, movementY, 0));
    }
    onDragEnd(event: AInteractionEvent, interaction: ADragInteraction): void {
        let cursorWorldCoordinates:Vec2|null = event.ndcCursor;
        let dragStartWorldCoordinates:Vec2|null = interaction.dragStartEvent.ndcCursor;
    }

    /**
     * This would be a good place to implement the time update of any movement filters
     * @param t
     * @param args
     */
    timeUpdate(t: number, ...args:any[]) {
    }

}
