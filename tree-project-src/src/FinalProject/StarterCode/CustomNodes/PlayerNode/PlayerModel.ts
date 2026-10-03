import {ASerializable, V3, VertexArray3D} from "../../../../anigraph";
import {TriangleMeshCharacterModel} from "../CharacterNodes/TriangleMeshCharacterModel";
import {ATexture} from "../../../../anigraph/rendering/ATexture";
import {CharacterModel} from "../../../../anigraph/starter/nodes/character";

@ASerializable("PlayerModel")
export class PlayerModel extends TriangleMeshCharacterModel{
    static DEFAULT_SIZE=0.15
    size!:number;
    static Create(diffuseMap:ATexture, size?:number, ...args:any[]){
        size = size??PlayerModel.DEFAULT_SIZE;
        let newmodel = new this();
        newmodel.size = size;
        newmodel.init(diffuseMap);
        return newmodel;
    }

    init(diffuseMap:ATexture, ...args:any[]){
        this.setMaterial(CharacterModel.ShaderModel.CreateMaterial(
            diffuseMap
        ));
    }
}



