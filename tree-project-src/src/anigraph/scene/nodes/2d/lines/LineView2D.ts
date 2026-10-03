import {ANodeView} from "../../../nodeView";
import {ALineGraphic} from "../../../../rendering";
import {LineModel2D} from "./LineModel2D";


export class LineView2D extends ANodeView{
    line!:ALineGraphic;
    get model():LineModel2D{
        return this._model as LineModel2D;
    }
    static Create(model:LineModel2D){
        let view = new LineView2D();
        view.setModel(model);
        return view;
    }

    init(){
        this.line = new ALineGraphic();
        this.line.init(this.model.verts, this.mainMaterial);
        // this.line.setLineWidth();
        this.registerAndAddGraphic(this.line);
        // this.addGraphicToRoot(this.line);
    }

    update(): void {
        this.line.setVerts(this.model.verts);
        this.line.setLineWidth(this.model.lineWidth);
    }
}
