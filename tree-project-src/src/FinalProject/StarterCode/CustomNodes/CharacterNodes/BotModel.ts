import {ATexture} from "../../../../anigraph/rendering/ATexture";
import {ASerializable, V3, VertexArray3D} from "../../../../anigraph";
import {CharacterModel} from "../../../../anigraph/starter/nodes/character";
import {TriangleMeshCharacterModel} from "./TriangleMeshCharacterModel";

@ASerializable("BotModel")
export class BotModel extends TriangleMeshCharacterModel{

    static DefaultBotSize = 0.15;
    /**
     * Creates a new bot model to be textured with the provided diffuse texture map.
     * @param diffuseMap
     * @param size
     * @param args
     * @returns {Promise<BotModel>}
     * @constructor
     */
    static Create(diffuseMap:ATexture, size?:number, ...args:any[]){
        size = size??BotModel.DefaultBotSize;

        /**
         * Set the vertices to be a box. The Box3D helper function creates box geometry based on opposite corners,
         * specifically the minimumum and maximum x,y,z coordinate values for an axis-aligned box
         */
        let verts = VertexArray3D.Box3D(
            V3(-0.5,-0.5,0).times(size),
            V3(0.5,0.5,1.0).times(size)
        );

        /**
         * Create the new bot model, initialize it with the provided diffuse map, and return it when that is done
         * @type {BotModel}
         */
        let newmodel = new this(verts);
        newmodel.init(diffuseMap);
        return newmodel;
    }

    init(diffuseMap:ATexture, ...args:any[]){
        /**
         * Sets the material for our model to the corresponding AShaderMaterial instance, with the provided texture as
         * the diffuse texture.
         */
        this.setMaterial(CharacterModel.ShaderModel.CreateMaterial(
            diffuseMap
        ));
    }

}


