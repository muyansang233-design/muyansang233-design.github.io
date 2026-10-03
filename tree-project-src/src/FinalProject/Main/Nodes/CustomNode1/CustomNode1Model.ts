import {
    ANodeModel3D,
    ASerializable,
    ATriangleMeshModel, Color,
    NodeTransform3D,
    V2,
    V3, Vec2, Vec3, Vec4,
    VertexArray3D
} from "../../../../anigraph";
import type {TransformationInterface} from "../../../../anigraph";

@ASerializable("CustomNode1Model")
export class CustomNode1Model extends ANodeModel3D{

    constructor(verts?:VertexArray3D, transform?:TransformationInterface) {
        super();
        if(transform){
            this.setTransform(transform);
        }
        if(verts === undefined){
            verts = new VertexArray3D();
        }
        this._setVerts(verts);
    }


    static Create(transform?:TransformationInterface, ...args:any[]){
        let verts = VertexArray3D.CreateForRendering(
            true,
            true,
            true);
        return new this(verts);
    }

    static CreateTriangle(transform?:TransformationInterface, ...args:any[]){
        let verts = VertexArray3D.CreateForRendering(
            true,
            true,
            true);

        let height = 0.0;
        let vpositions = [
            V3(0,0,height),
            V3(1,0,height),
            V3(1,1,height)
        ]
        let normal = vpositions[1].minus(vpositions[0]).cross(
            vpositions[2].minus(vpositions[0])
        ).getNormalized();

        verts.addVertex(vpositions[0], normal, V2(0,0), Color.Red());
        verts.addVertex(vpositions[1], normal, V2(1,0), Color.Green());
        verts.addVertex(vpositions[2], normal, V2(1,1), Color.Blue());

        // indicate that there should be a triangle face defined by the first, second, and third vertex of our array
        verts.addTriangleIndices(0,1,2);

        let newmodel = new this(verts);
        if(transform){
            newmodel.setTransform(transform);
        }
        return newmodel;
    }



}



