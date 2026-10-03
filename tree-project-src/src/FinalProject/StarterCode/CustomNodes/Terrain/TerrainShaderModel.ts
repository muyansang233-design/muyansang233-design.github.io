import {ATexture} from "../../../../anigraph/rendering/ATexture";
import {ATerrainShaderModel} from "../../../../anigraph/rendering/shadermodels";


export class TerrainShaderModel extends ATerrainShaderModel{
    CreateMaterial(
        diffuseTexture:ATexture,
        heightTexture?:ATexture,
        texCoordScale:number=10.0,
        ...args:any[]){

        /**
         * create the material instance
         */
        let mat = super.CreateMaterial(diffuseTexture);

        /**
         * set its diffuse texture
         * When you set a texture named "__texname__", you can then reference it in the shader by declaring the uniforms:
         * ```
         * uniform sampler2D __texname__Map;
         * uniform bool __texname__MapProvided;
         * ```
         * The first is what you use to access the texture in the shader, and the second is a boolean that tells you
         * whether the corresponding texture has been provided to the shader / is available
         * And its
         */
        mat.setTexture('diffuse', diffuseTexture);

        /**
         * To set a regular uniform, use setUniform
         */
        mat.setUniform("texCoordScale", texCoordScale)

        /**
         * Adding a terrain height scale slider. Be careful not to pick a name already used elsewhere in the shader!
         */
        // AddSliderUniform(mat, "terrainHeightScale", 0.2, -1,1,0.01);

        /**
         * If a height texture was provided, we will bind it to the shader as well
         */
        if(heightTexture){
            mat.setTexture('height', heightTexture)
        }
        return mat;
    }
}
