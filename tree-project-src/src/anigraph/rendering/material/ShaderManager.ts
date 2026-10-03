import * as THREE from "three";
import {ASerializable} from "../../base/aserial";
import {AObject, AObjectState} from "../../base/aobject";

export enum ShaderManagerEnums{
    SHADER_DIRECTORY_URL='shaders/',
    DEFAULT_SHADER='basic'
}


export class AShaderProgramSource extends AObject{
    public name: string;
    public vertexURL: string;
    public fragURL: string;
    @AObjectState vertexSource!: string;
    @AObjectState fragSource!: string;
    public sourcesLoadedPromise:Promise<this>;

    constructor(name: string, vertexURL: string, fragURL: string) {
        super();
        this.name = name;
        this.vertexURL = vertexURL;
        this.fragURL = fragURL;
        const self = this;
        async function loadSources(){
            self.vertexSource = (await AShaderProgramSource.LoadShaderFile(vertexURL)) as string;
            self.fragSource = (await AShaderProgramSource.LoadShaderFile(fragURL)) as string;
            return self;
        };
        this.sourcesLoadedPromise = loadSources();
        // this.sourcesLoadedPromise = new Promise(function (myResolve, myReject){
        //     self.vertexSource = (ShaderProgramSource.LoadShaderFile(vertexURL)) as string;
        //     self.fragSource = (ShaderProgramSource.LoadShaderFile(fragURL)) as string;
        //     myResolve();
        // });
        // this.sourcesLoadedPromise = loadSources();
    }

    static LoadShaderFile(sourceURL: string) {
        let shaderLoader = new THREE.FileLoader();
        let shaderSource = shaderLoader.loadAsync(
            sourceURL,
            function (xhr) {
                // console.log((xhr.loaded / xhr.total * 100) + '% loaded');
            });
        return shaderSource;
    }
}

export type ShaderPromise = Promise<AShaderProgramSource>;

@ASerializable("ShaderSourceManager")
export class AShaderSourceManager extends AObject{
    @AObjectState _shaderSources!:{[name:string]:AShaderProgramSource}
    _shaderPromises:{[name:string]:Promise<AShaderProgramSource>}={};
    constructor() {
        super();
        this._shaderSources={};
    }

    static GetURLForShaderAtPath(path:string){
        return ShaderManagerEnums.SHADER_DIRECTORY_URL+path;
    }

    getShaderPromise(name:string){
        return this._shaderPromises[name];
    }

    /**
     * Loads the shader source. Paths should be relative to the public/shaders/ directory, so if the shader is at path `public/shaders/myshader/myshader.vert.glsl` then vertexPath should be `myshader/myshader.vert.glsl`. If only a name is provided, then the vertex and fragment paths will be set to `public/shaders/{name}/{name}.{type}.glsl` where {type} is `vert` for the vertex shader and `frag` for the fragment shader.
     * @param name
     * @param vertexPath
     * @param fragPath
     * @returns {Promise<AShaderProgramSource>}
     * @constructor
     */
    LoadShader(name:string, vertexPath?:string, fragPath?:string):ShaderPromise{
        let vPath = vertexPath??`${name}/${name}.vert.glsl`
        let fPath = fragPath??`${name}/${name}.frag.glsl`
        const self=this;
        let newSource =
            new AShaderProgramSource(
                name,
                AShaderSourceManager.GetURLForShaderAtPath(vPath),
                AShaderSourceManager.GetURLForShaderAtPath(fPath)
            );
        self._shaderSources[name]=newSource;
        self._shaderPromises[name]=newSource.sourcesLoadedPromise;
        return this._shaderPromises[name];
    }

    GetShaderSource(name:string){
        return this._shaderSources[name];
    }
}


export const ShaderManager = new AShaderSourceManager();
