/**
 * @file Manages the configuration settings for the widget.
 * @author Abe Davis
 * @description Defines the AGLContext class, which is a wrapper on the THREE.WebGLRenderer class with convenience functions.
 */
import {AObject, ASerializable} from "../../base";
import * as THREE from "three";
import * as WebGLRenderer from "three/src/renderers/WebGLRenderer";
import {Vector2, Vector4} from "three";
import {Vec2, Vec4} from "../../math";

const _DEFAULT_WEBGLRENDERER_PARAMS = {
  alpha: true,
  preserveDrawingBuffer: true,
};

@ASerializable("AGLContext")
export class AGLContext extends AObject {
    public renderer!: THREE.WebGLRenderer;
    static DEFAULT_SETTINGS = _DEFAULT_WEBGLRENDERER_PARAMS;
    constructor(contextParams?: WebGLRenderer.WebGLRendererParameters) {
        super();
        // this.container=container;
        this.renderer = new THREE.WebGLRenderer(
            {
                ...AGLContext.DEFAULT_SETTINGS,
                ...(contextParams ?? {})
            }
        );
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.sortObjects = false;
    }

    /**
     * Returns viewport as [x, y, width, height]
     * @returns {number[]}
     */
    getViewport(){
        let rviewport = new Vector4();
        this.renderer.getViewport(rviewport);
        return [rviewport.x, rviewport.y, rviewport.z, rviewport.w]
    }

    /**
     *
     * @param x | Vec4(x,y,w,h) | [x,y,w,h]
     * @param y
     * @param w
     * @param h
     * @returns {Vec4}
     */
    setViewport(x:number|Vec4|number[],y?:number,w?:number,h?:number):void{
        let tvp:Vector4;
        if(x instanceof Vec4){
            tvp = x.asThreeJS();
        }else if(Array.isArray(x)){
            tvp = new Vector4(x[0],x[1],x[2],x[3])
        }else{
            tvp = new Vector4(x,y,w,h);
        }
        this.renderer.setViewport(tvp);
    }


    getShape(){
        let rsize = new Vector2();
        this.renderer.getSize(rsize);
        return new Vec2(rsize.x, rsize.y);
    }

    getAspect(){
        let shape = this.getShape();
        return shape.x/shape.y;
    }

}
