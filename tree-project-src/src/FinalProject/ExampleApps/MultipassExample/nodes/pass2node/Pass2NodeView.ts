import {AMaterialCopyView} from "../../../../../anigraph/starter/nodes/materialcopyview/AMaterialCopyView";
import {ASerializable} from "../../../../../anigraph";

/**
 * This is just a node view class that creates a copy of the model's material to use as the material for its elements. You can adjust properties of this material using the adjustViewMaterial
 */
@ASerializable("Pass2NodeView")
export class Pass2NodeView extends AMaterialCopyView{
    adjustViewMaterial(){
        this.viewMaterial.wireframe=true
    }

}
