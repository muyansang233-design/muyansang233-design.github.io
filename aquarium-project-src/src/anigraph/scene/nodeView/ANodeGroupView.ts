import {ANodeView} from "./ANodeView";

export abstract class ANodeGroupView extends ANodeView{
}


export class ANodeGroup2DView extends ANodeView{
    init(){

    }
    update(){
        this.setTransform2D(this.model.transform);
    }
}

export class ANodeGroup3DView extends ANodeGroupView{
    init(){

    }
    update(){
        this.setTransform(this.model.transform);
    }
}
