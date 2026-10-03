import {ADebugInteractionMode} from "../../../anigraph/starter";
import {AInteractionEvent, AKeyboardInteraction, ASceneController} from "../../../anigraph";
import {ShaderDemoSceneController} from "./ShaderDemoSceneController";

export class ShaderDemoInteractionMode extends ADebugInteractionMode{
    get owner(): ShaderDemoSceneController {
        return this._owner as ShaderDemoSceneController;
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

        if(event.key=='L' && event.shiftKey){
            this.owner.model.addLight()
        }

    }
}
