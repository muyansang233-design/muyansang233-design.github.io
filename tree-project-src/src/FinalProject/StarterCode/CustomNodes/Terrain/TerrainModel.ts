import {ATerrainModel} from "../../../../anigraph/starter/nodes/terrain";
import {
    ASerializable, assert, AssetManager, BlinnPhongShaderAppState,
    CreatesShaderModels, SeededRandom, Vec2
} from "../../../../anigraph";
import {TerrainShaderModel} from "./TerrainShaderModel";
import type {TransformationInterface} from "../../../../anigraph";
import {ATexture} from "../../../../anigraph/rendering/ATexture";
import {ADataTextureFloat1D} from "../../../../anigraph/rendering/image";
import * as THREE from "three";
import {makeNoise2D} from "fast-simplex-noise";
import {BlinnPhongMaterial} from "../../../../anigraph/rendering/shadermodels";



@ASerializable("TerrainModel")
export class TerrainModel extends ATerrainModel{

    useDataTexture:boolean=true;

    /**
     * Reusable instance of the shader model, which is a factory for creating shader materials
     */
    static ShaderModel:TerrainShaderModel;

    /**
     * Function to load the shader
     */
    static async LoadShaderModel(...args:any[]){
        this.ShaderModel = await TerrainShaderModel.CreateModel("terrain")
    }


    textureWrapX:number=5;
    textureWrapY:number=5;

    constructor(
        width?:number,
        height?:number,
        widthSegments?:number,
        heightSegments?:number,
        transform?:TransformationInterface,
        textureWrapX?:number,
        textureWrapY?:number
        ) {
        super(width, height, widthSegments, heightSegments, transform);
        if(textureWrapX!==undefined){this.textureWrapX = textureWrapX;}
        if(textureWrapY!==undefined){this.textureWrapY=textureWrapY;}
    }

    getTerrainHeightAtPoint(p:Vec2){
        //you can access height map pixels using something like this:
        /**
         *  you can access height map pixels using something like this:
         *  this.heightMap.pixelData.getPixelNN(5, 5);
         */
        return 0;
    }

    static Create(
        diffuseMap:ATexture,
        width?:number,
        height?:number,
        widthSegments?:number,
        heightSegments?:number,
        transform?:TransformationInterface,
        wrapTextureX?:number,
        wrapTextureY?:number,
        ...args:any[]){

        assert(TerrainModel.ShaderModel !== undefined, "You need to call TerrainModel.LoadShaderModel() in an async function like PreloadAssets")

        /**
         * Create and initialize the terrain with the provided texture
         */
        let terrain = new this(width, height, widthSegments, heightSegments, transform, wrapTextureX,wrapTextureY);
        terrain.init(diffuseMap);
        return terrain;
    }

    init(diffuseMap:ATexture, useDataTexture?:boolean){

        /**
         * Set the diffuse color map if provided with a texture
         */
        this.diffuseMap = diffuseMap;

        if(useDataTexture!==undefined){
            this.useDataTexture = useDataTexture;
        }

        /**
         * If you want to use a data texture to implement displacement map terrain, create a heightMap data texture.
         * Most recent machines should support this feature, but I haven't verified on all platforms.
         * If it seems to fail, you might set useDataTexture to false by default.
         */
        if(useDataTexture??this.useDataTexture){
            this.heightMap = ADataTextureFloat1D.CreateSolid(this.widthSegments, this.heightSegments, 0.5)
            this.heightMap.setMinFilter(THREE.LinearFilter);
            this.heightMap.setMagFilter(THREE.LinearFilter);
            this.reRollHeightMap();
        }

        let terrainMaterial = TerrainModel.ShaderModel.CreateMaterial(
            this.diffuseMap,
            this.heightMap,
        );

        terrainMaterial.setUniform(BlinnPhongShaderAppState.Diffuse, 0.5);
        this.setMaterial(terrainMaterial);
    }

    /**
     * Can be used to re-randomize height map
     * You may find the code:
     * ```
     * let simplexNoise = makeNoise2D(randomgen.rand);
     * let noiseAtXY = simplexNoise(x, y)
     * ```
     * Useful for generating simplex noise
     *
     * @param seed
     * @param gridResX
     * @param gridResY
     */
    reRollHeightMap(seed?:number, gridResX:number=5, gridResY:number=5){
        for(let y=0;y<this.heightMap.height;y++){
            for(let x=0;x<this.heightMap.width;x++) {
                /**
                 * For the starter code, we are just setting the map to 0
                 */
                this.heightMap.setPixelNN(x, y, 0);
                // this.heightMap.setPixelNN(x, y, Math.sin(2*x)*0.2+Math.sin(2*y)*0.2);
            }
        }
        this.heightMap.setTextureNeedsUpdate();
    }

    /**
     * Can be used to re-randomize height map
     * You may find the code:
     * ```
     * let simplexNoise = makeNoise2D(randomgen.rand);
     * let noiseAtXY = simplexNoise(x, y)
     * ```
     * Useful for generating simplex noise
     *
     * @param seed
     * @param gridResX
     * @param gridResY
     */
    reRollRandomHeightMap(maxHeight:number=0.2,...args:any[]){
        for(let y=0;y<this.heightMap.height;y++){
            for(let x=0;x<this.heightMap.width;x++) {
                /**
                 * For the starter code, we are just setting the map to 0
                 */
                this.heightMap.setPixelNN(x, y, Math.random()*maxHeight);
                // this.heightMap.setPixelNN(x, y, Math.sin(2*x)*0.2+Math.sin(2*y)*0.2);
            }
        }
        this.heightMap.setTextureNeedsUpdate();
    }


}
