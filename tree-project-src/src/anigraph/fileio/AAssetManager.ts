import {AObject} from "../base";
import {ANodeModel} from "../scene";
import {
    AMaterialModelBase, AShaderMaterial,
    AShaderModel,
    ATexture
} from "../rendering";
import {AMaterialManager} from "../rendering/material/AMaterialManager";
import {AShaderSourceManager, ShaderManager} from "../rendering/material/ShaderManager";
import {AObject3DModelWrapper} from "../geometry";
import {Color, NodeTransform3D, TransformationInterface} from "../math";
import {A3DModelLoader} from "./A3DModelLoader";
import {ALineShaderModel} from "../rendering/material/shadermodels/ALineShaderModel";
import {ClassInterface} from "../basictypes";
import {ALoadedModel} from "../scene/nodes/loaded";


function GetTextureName(assetName:string, textureName:string){
    return `${assetName}_${textureName}`;
}


/**
 * An interface describing the details you should define for new assets in the MeshAssets dictionary
 * For textures, the key for each texture should match the corresponding uniform in your shader.
 * More specifically, if you want to include a texture "myTex", the key should be "myTex" and the sampler name
 * in your shader should be "myTexMap"
 */
export interface ModelDetails {
    path: string, // path to the 3D model
    textures: {[name:string]:string} | undefined, // a dictionary with textures and their paths
    vertexColors?:boolean, // whether vertex colors are used
    modelTransform?:TransformationInterface|undefined // a transformation to apply to the loaded asset before importing it into AniGraph
}

class AAssetManager extends AObject{

    static logging:boolean = false;
    static log(logstring:string){
        if(this.logging){
            console.log(logstring)
        }
    }

    static AssetManager:AAssetManager;
    modelAssetsDetails:{[name:string]:ModelDetails}={};

    addModelAssetDetails(name:string, modelDetails:ModelDetails){
        this.modelAssetsDetails[name]=modelDetails;
    }
    addModelAssetDetailsDict(modelAssetsDetails:{[name:string]:ModelDetails}){
        this.modelAssetsDetails = {...this.modelAssetsDetails, ...modelAssetsDetails};
    }

    shaders :AShaderSourceManager;
    materials:AMaterialManager;
    _textures:{[name:string]:ATexture}={};
    _3Dmodels:{[name:string]:AObject3DModelWrapper}={};
    // DEFAULT_MATERIALS=AMaterialManager.DefaultMaterials;

    get DEFAULT_MATERIALS(){
        return AMaterialManager.DefaultMaterials;
    }
    /**
     * Loads a texture asynchronously and stores it in the textures dictionary
     * @param path the path to the texture relative to the 'public/' directory
     * @param name the name to associate with the texture. If not provided, the file name will be used.
     * @returns {Promise<void>}
     */
    async loadTexture(path:string, name?:string){
        AAssetManager.log(`Loading image at path ${path}`)
        if(name === undefined){
            name = path.replace(/^.*[\\/]/, '')
        }
        this._textures[name] = await ATexture.LoadAsync(path);
        return;
    }

    getTexture(name:string){
        return this._textures[name];
    }

    /**
     * Loads a 3D model asset
     * @param name - The name of the asset.
     * @returns {Promise<void>}
     * @constructor
     */
    async loadModelAsset(name:string){
        let modelTransform = ('modelTransform' in this.modelAssetsDetails[name])?this.modelAssetsDetails[name].modelTransform:undefined;
        await this.load3DModel(this.modelAssetsDetails[name].path, name, modelTransform);
        let texturePaths = this.modelAssetsDetails[name].textures
        if(texturePaths !== undefined){
            for(let tname in texturePaths) {
                await this.loadTexture(texturePaths[tname], GetTextureName(name, tname));
            }
        }
    }

    /**
     * Create a node model from an asset. Assumes that the asset has already been loaded by the sceneModel.
     * @param assetName - The name of the asset.
     * @param modelClass - The class of node model you want to create. Should inherit from ALoadedModel class
     * @param material - The material to use.
     * @param args - any other args for the modelClass.Create function
     * @returns {ALoadedModel}
     * @constructor
     */
    createModelFromAsset(
        assetName:string,
        modelClass:ClassInterface<ALoadedModel>,
        material:AShaderMaterial,
        ...args:any[]){
        const self = this;

        /**
         * If we haven't loaded an asset with the given name, throw an error.
         */
        if(!this.get3DModel(assetName)){
            throw new Error(`You need to load ${assetName} assets in PreloadAssets!`)
        }

        /**
         * Get an Object3D wrapper for the loaded asset.
         * @type {AObject3DModelWrapper}
         */
        let object3D = this.get3DModel(assetName);
        function checkObjTextures(){
            if (self.getTexture(assetName)) {
                material.setTexture('diffuse', self.getTexture(assetName));
            } else {
                let textures = object3D.getTextures();
                material.setTexture('diffuse', textures['diffuse']);
                if ('normal' in textures) {
                    material.setTexture('normal', textures['normal']);
                }
            }
        }

        if(assetName in this.modelAssetsDetails){
            let texturePaths = this.modelAssetsDetails[assetName].textures
            if(texturePaths !== undefined){
                for(let tname in texturePaths) {
                    material.setTexture(tname, self.getTexture(GetTextureName(assetName, tname)));
                }
            }else{
                checkObjTextures();
            }
            if("vertexColors" in this.modelAssetsDetails[assetName] && this.modelAssetsDetails[assetName]["vertexColors"]){
                material.usesVertexColors = true;
            }
        }else {
            checkObjTextures();
        }

        let loadedmodel:ALoadedModel;
        if(modelClass !== undefined) {
            // @ts-ignore
            loadedmodel = modelClass.Create(
                object3D,
                ...args
            )
        }else{
            loadedmodel = ALoadedModel.Create(
                object3D,
                ...args
            )
        }
        loadedmodel.setMaterial(material);
        return loadedmodel;
    }



    async load3DModel(path:string, name?:string, transform?:TransformationInterface){
        /**
         * Here we need to load the .ply file into an AObject3DModelWrapper instance
         */
        if(name === undefined){
            name = path.replace(/^.*[\\/]/, '')
        }
        this._3Dmodels[name] = await A3DModelLoader.LoadFromPath(path)
        this._3Dmodels[name].sourceTransform = transform??new NodeTransform3D();
        return;
    }

    get3DModel(name:string){
        return this._3Dmodels[name];
    }



    /**
     * Loads the shader source and creates a shader model based on it.
     * Paths should be relative to the public/shaders/ directory,
     * so if the shader is at path `public/shaders/myshader/myshader.vert.glsl` then
     * vertexPath should be `myshader/myshader.vert.glsl`. If only a name is provided,
     * then the vertex and fragment paths will be set to
     * `public/shaders/{name}/{name}.{type}.glsl`, where {type} is `vert` for the vertex
     * shader and `frag` for the fragment shader.
     * @param name
     * @param vertexPath
     * @param fragPath
     * @returns {Promise<void>}
     */
    async loadShaderMaterialModel(name:string, vertexPath?:string, fragPath?:string){
        let shaderSource = this.shaders.GetShaderSource(name);
        if(shaderSource === undefined){
            await this.shaders.LoadShader(name, vertexPath, fragPath);
        }
        return this.setMaterialModel(
            name,
            new AShaderModel(name)
        )
    }

    /**
     * Loads the shader source and creates a line shader model based on it.
     * Paths should be relative to the public/shaders/ directory,
     * so if the shader is at path `public/shaders/myshader/myshader.vert.glsl` then
     * vertexPath should be `myshader/myshader.vert.glsl`. If only a name is provided,
     * then the vertex and fragment paths will be set to
     * `public/shaders/{name}/{name}.{type}.glsl`, where {type} is `vert` for the vertex
     * shader and `frag` for the fragment shader.
     * @param name
     * @param vertexPath
     * @param fragPath
     * @returns {Promise<void>}
     */
    async loadLineShaderMaterialModel(name:string, vertexPath?:string, fragPath?:string){
        let shaderSource = this.shaders.GetShaderSource(name);
        if(shaderSource === undefined){
            await this.shaders.LoadShader(name, vertexPath, fragPath);
        }
        return this.setMaterialModel(
            name,
            new ALineShaderModel(name)
        )
    }

    async addShaderMaterialModel(name:string, m:AMaterialModelBase<any>|typeof AShaderModel, ...args:any[]){
        if(m instanceof AMaterialModelBase<any>){
            return this.setMaterialModel(name, m);
        }else{
            let model = await (m as typeof AShaderModel).CreateModel(name, ...args);
            return this.setMaterialModel(name, model);
        }
    }

    async setMaterialModel(name:string, m:AMaterialModelBase<any>){
        return this.materials.setMaterialModel(name, m);
    }

    getShaderMaterialModel(name:string){
        return this.materials.getShaderMaterialModel(name);
    }

    Create2DTextureMaterial(texture?:ATexture):AShaderMaterial{
        let material = this.CreateShaderMaterial(AssetManager.DEFAULT_MATERIALS.TEXTURED2D_SHADER);
        if(texture !== undefined){
            material.setDiffuseTexture(texture);
        }
        material.setUniform("alpha", 1.0);
        return material;
    }


    Create2DRGBAMaterial():AShaderMaterial{
        return this.CreateMaterial(AssetManager.DEFAULT_MATERIALS.RGBA_SHADER) as AShaderMaterial;
    }

    CreateMaterial(modelName:string, ...args:any[]){
        return this.materials.getMaterialModel(modelName).CreateMaterial(...args);
    }

    CreateBasicMaterial(color?:Color){
        let basic = this.materials.getMaterialModel(AssetManager.DEFAULT_MATERIALS.Basic).CreateMaterial();
        if(color) {
            basic.setValue("color", color.asThreeJS());
        }
        return basic;
    }

    CreateShaderMaterial(modelName:string, ...args:any[]):AShaderMaterial{
        return this.materials.getMaterialModel(modelName).CreateMaterial(...args) as AShaderMaterial;
    }

    constructor() {
        super();
        this.shaders = ShaderManager;
        this.materials = new AMaterialManager();
    }

    async setLoadedShaderModel(name:string){
        await this.shaders.getShaderPromise(name);
        return this.setMaterialModel(
            name,
            new AShaderModel(name)
        )
    }
}

let AssetManager = new AAssetManager();
AAssetManager.AssetManager = AssetManager;
export {AssetManager};


