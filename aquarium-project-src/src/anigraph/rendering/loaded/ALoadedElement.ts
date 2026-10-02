import {AGraphicGroup} from "../graphicobject";
import {Color} from "../../math";
import {AObject3DModelWrapper} from "../../geometry";
import {AMaterial} from "../material";
import * as THREE from "three";
import {ASerializable} from "../../base";

export interface ALoadedElementInterface{
    updateSourceTransform():void;
}

@ASerializable("ALoadedElement")
export class ALoadedElement extends AGraphicGroup implements ALoadedElementInterface{
    public _sourceObject:AObject3DModelWrapper
    public loadedObject:THREE.Object3D;
    constructor(object:AObject3DModelWrapper) {
        super();
        this.loadedObject= object.getNewSceneObject();
        this.threejs.add(this.loadedObject);
        this._sourceObject=object;
    }

    setMaterial(material:Color|THREE.Color|THREE.Material|THREE.Material[]){
        if(this.loadedObject instanceof THREE.Mesh && this.loadedObject.material instanceof THREE.Material){
            this.loadedObject.material = material;
        }
    }

    onMaterialChange(newMaterial:AMaterial){
        this.setMaterial(newMaterial.threejs);
    }
    onMaterialUpdate(newMaterial: AMaterial, ...args:any[]) {
        super.onMaterialUpdate(newMaterial, ...args);
    }

    updateSourceTransform(){
        this._sourceObject.sourceTransform.getMatrix().assignTo(this.loadedObject.matrix);
    }
}

