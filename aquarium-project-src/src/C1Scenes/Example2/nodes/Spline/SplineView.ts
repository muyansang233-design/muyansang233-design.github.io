import {
    ALineGraphic,
    ANodeView, Color,
    Handle2DGraphic,
    NodeTransform3D, V2,
    V3,
    Vec2,
    Vector,
    VertexArray2D
} from "../../../../anigraph";
import {SplineModel} from "./SplineModel";


export class SplineView extends ANodeView{
    stroke!:ALineGraphic;
    strokeVerts!:VertexArray2D;
    controlShape!:ALineGraphic;
    handles:Handle2DGraphic[]=[];
    nSamplesPerSegment:number=25;
    get model():SplineModel{
        return this._model as SplineModel;
    }

    init(): void {
        this.stroke = new ALineGraphic();
        this.stroke.init(this.getSplineVerts(this.nSamplesPerSegment), this.model.getStrokeMaterial());
        this.stroke.setLineWidth(this.model.lineWidth);
        this.controlShape = new ALineGraphic();
        this.controlShape.init(this.model.verts.clone().FillColor(Color.FromString("#00aa00")), this.model.getFrameMaterial());
        this.controlShape.setLineWidth(this.model.controlShapeWidth);
        this.registerAndAddGraphic(this.stroke);
        this.registerAndAddGraphic(this.controlShape);
    }

    update(): void {
        this.controlShape.setVerts2D(this.model.verts.clone().FillColor(Color.FromString("#00aa00")));
        this.stroke.setVerts2D(this.getSplineVerts(this.nSamplesPerSegment));
        this.stroke.setLineWidth(this.model.lineWidth);
        this.controlShape.setLineWidth(this.model.controlShapeWidth);
        this.setTransform(new NodeTransform3D(V3(0.0, 0.0, -0.1)))
        this.controlShape.visible=this.model.controlShapeVisible;
    }

    getSplineVerts(samplesPerSegment?:number){
        let splineVerts = new VertexArray2D()
        try {
        samplesPerSegment = samplesPerSegment??this.nSamplesPerSegment;
        splineVerts.initColorAttribute();
            if (this.model.verts.length > 1) {
            let totalSamples = samplesPerSegment*this.model.nBezierSegments;
            let progressSamples = Vector.LinSpace(0,1,totalSamples);
            for(let progress of progressSamples.elements) {
                splineVerts.addVertex(
                    this.model.getPointForProgress(progress),
                    this.model.getColorForProgress(progress)
                );
            }
        }else{
            splineVerts=this.model.verts;
        }
        return splineVerts
        }catch(e){
            console.error(e);
            if(this.model.verts.nVerts>1) {
                let startPointH = this.model.verts.position.getAt(0);
                let startPoint = V2(startPointH.x, startPointH.y);
                let startColor = this.model.verts.color.getAt(0);
                return VertexArray2D.FromLists([
                    startPoint,
                    startPoint.plus(V2(0.01, 0.01))
                ],
                    [
                        startColor,
                        startColor
                    ])
            }else{
            return new VertexArray2D();
        }
    }
    }

}
