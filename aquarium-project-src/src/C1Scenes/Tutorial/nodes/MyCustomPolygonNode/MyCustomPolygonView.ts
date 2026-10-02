import {ANodeView, ANodeView2D, APolygon2DGraphic, ATriangleMeshGraphic, Color, Mat3, V2} from "../../../../anigraph";
import {MyCustomPolygonModel} from "./MyCustomPolygonModel";
import {TexturePoly2DSettings} from "../../../../anigraph/starter/nodes/textured";

export class MyCustomPolygonView extends ANodeView2D{
    element!:APolygon2DGraphic;

    get model(): MyCustomPolygonModel {
        return this._model as MyCustomPolygonModel;
    }


    init(){
        this.element = new APolygon2DGraphic();
        this.element.init(this.model.verts, this.model.material);
        this.registerAndAddGraphic(this.element);
        this.update();

        // Optionally add a listener for changes in geometry
        const self = this;
        this.subscribe(this.model.addGeometryListener(
            ()=>{
                self.updateGeometry();
            }
        ))
    }

    update(...args: any[]): void {
        this.setTransform(this.model.transform);
    }

    updateGeometry(){
        this.element.setVerts2D(this.model.verts);
    }
}
