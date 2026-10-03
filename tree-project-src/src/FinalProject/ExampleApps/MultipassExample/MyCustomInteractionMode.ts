import {ADebugInteractionMode} from "../../../anigraph/starter";
import {AInteractionEvent, AKeyboardInteraction} from "../../../anigraph";
import {MultipassExampleSceneController} from "./MultipassExampleSceneController";

export class MyCustomInteractionMode extends ADebugInteractionMode{
    get owner(): MultipassExampleSceneController {
        return this._owner as MultipassExampleSceneController;
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

        // console.log(`Key ${event.key} shift:${event.shiftKey} alt:${event.altKey}`);

        this.owner.model.onKeyUp(event, interaction);

    }
}
