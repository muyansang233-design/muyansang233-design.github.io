import {ASerializable, Particle3D, TransformationInterface} from "../../../anigraph";
import {ASceneInteractionMode} from "../../../anigraph/starter/interactionmodes";
import {ABasicSceneController, ABasicSceneModel} from "../../../anigraph/starter";
import {PlayerInterface} from "./PlayerInterface";



@ASerializable("MainAppInteractionMode")
export class MainAppInteractionMode extends ASceneInteractionMode {

    /**
     * You can optionally set a player object that the interaction mode will have access to. This object should have a transform property that you can use to, e.g., have the camera follow the player or have the interaction control the player's transform.
     */
    _player!:PlayerInterface|undefined;
    setPlayer(player:PlayerInterface|undefined){
        this._player = player;
    }
    get player(){
        return this._player as PlayerInterface;
    }
    get hasPlayer(){
        return this._player !== undefined;
    }


    get owner(): ABasicSceneController {
        return this._owner as ABasicSceneController;
    }

    get model(): ABasicSceneModel {
        return this.owner.model as ABasicSceneModel;
    }
}
