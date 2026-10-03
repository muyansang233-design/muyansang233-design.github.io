import {CustomNode1Model} from "./CustomNode1Model";
import {
    ANodeModel,
    ANodeView,
    ATriangleMeshGraphic,
    ATriangleMeshModel,
    ATriangleMeshView,
    V3,
    VertexArray3D
} from "../../../../anigraph";

export class CustomNode1View extends ANodeView{
    meshGraphic!:ATriangleMeshGraphic;

    /**
     * Redefine the model getter to return a model with our custom model class
     * @returns {ATriangleMeshModel}
     */
    get model():CustomNode1Model{
        return this._model as CustomNode1Model;
    }

    /**
     * Creates a new instance for a given model
     * @param model
     * @param args
     * @returns {CustomNode1View}
     * @constructor
     */
    static Create(model:ANodeModel, ...args:any[]){
        let view = new this();
        view.setModel(model);
        return view;
    }

    /**
     * Initializer that gets called once the model has been set
     */
    init(){
        this.meshGraphic = new ATriangleMeshGraphic(this.model.verts, this.mainMaterial.threejs);
        this.registerAndAddGraphic(this.meshGraphic);
    }

    /**
     * Update that gets called whenever AObjectState for the model changes
     */
    update(): void {
        this.meshGraphic.setVerts(this.model.verts);
        this.setTransform(this.model.transform);
    }
}


