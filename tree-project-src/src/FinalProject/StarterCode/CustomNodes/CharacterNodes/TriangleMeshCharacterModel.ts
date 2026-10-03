import {CharacterModel} from "../../../../anigraph/starter/nodes/character";
import {ASerializable, VertexArray3D} from "../../../../anigraph";
import {ATexture} from "../../../../anigraph/rendering/ATexture";
import type {TransformationInterface} from "../../../../anigraph";

@ASerializable("TriangleMeshCharacterModel")
export class TriangleMeshCharacterModel extends CharacterModel{
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

    init(diffuseMap:string|ATexture, ...args:any[]){
        this.setMaterial(CharacterModel.ShaderModel.CreateMaterial(
            (diffuseMap instanceof ATexture)? diffuseMap:new ATexture(diffuseMap)
        ));
    }

}


