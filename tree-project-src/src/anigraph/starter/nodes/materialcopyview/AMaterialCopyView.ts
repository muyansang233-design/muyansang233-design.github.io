import {ANodeView} from "../../../scene";
import {AGraphicObject, AShaderMaterial} from "../../../rendering";
import {ASerializable} from "../../../base";

let nErrors = 0;
@ASerializable("AMaterialCopyView")
export abstract class AMaterialCopyView extends ANodeView{
    viewMaterial!:AShaderMaterial;

    init(): void {
        this.copyModelMaterial();
        this.initLoadedObjects(this.viewMaterial);
        this.update();
    }

    get mainMaterial(){
        return this.viewMaterial;
    }

    copyModelMaterial(){
        if(this.viewMaterial){
            this.viewMaterial.release()
        }
        this.viewMaterial = AShaderMaterial.Clone(this.model.material) as AShaderMaterial;
        this.adjustViewMaterial()
    }

    adjustViewMaterial(){
        //this.viewMaterial.wireframe=true
    }

    onMaterialUpdate(...args:any[]){
        const self = this;
        this.copyModelMaterial();
        this.mapOverGraphics((element:AGraphicObject)=>{
            element.onMaterialUpdate(self.viewMaterial, ...args);
        })
    }

    onMaterialChange(...args:any[]) {
        const self = this;
        this.copyModelMaterial();
        this.mapOverGraphics((element:AGraphicObject)=>{
            element.onMaterialChange(self.viewMaterial, ...args);
        })
    }

    update(): void {
        this.setTransform(this.model.transform);
    }

}
