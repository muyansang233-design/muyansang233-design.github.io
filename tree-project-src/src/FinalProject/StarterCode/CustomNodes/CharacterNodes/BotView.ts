import {TriangleMeshCharacterView} from "./TriangleMeshCharacterView";
import {PlayerModel} from "../PlayerNode";
import {BotModel} from "./BotModel";
import {ATriangleMeshGraphic} from "../../../../anigraph";

/**
 * View designed to work with BotModel instances
 */
export class BotView extends TriangleMeshCharacterView{

    /**
     * Override model getter to interpret _model as a BotModel. This makes working with Typescript types easier.
     * @returns {BotModel}
     */
    get model():BotModel{
        return this._model as BotModel;
    }

    /**
     * Initialize the meshGraphic for this view (defined in parent class) to be an ATriangleMeshGraphic using the
     * model's vertices and material
     */
    init(){
        this.meshGraphic = new ATriangleMeshGraphic(this.model.verts, this.mainMaterial.threejs);
        this.registerAndAddGraphic(this.meshGraphic);
        this.setTransform(this.model.transform);
    }

    /**
     * This is to be called whenever any @AObjectState of the model changes or when its vertices/geometry change.
     * In particular, whenever the model's local matrix transform changes.
     */
    update(): void {
        this.meshGraphic.setVerts(this.model.verts);
        this.setTransform(this.model.transform);
    }
}
