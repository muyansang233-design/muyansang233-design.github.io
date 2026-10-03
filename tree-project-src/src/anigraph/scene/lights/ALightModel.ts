import {ANodeModel3D} from "../nodeModel/ANodeModel3D";
import {AObjectState} from "../../base/aobject/AObject";
import {ASerializable} from "../../base/aserial/ASerializable"
import {Color} from "../../math";


@ASerializable("ALightModel")
export abstract class ALightModel extends ANodeModel3D{
    @AObjectState intensity:number;
    @AObjectState color:Color;
    @AObjectState isActive!:boolean;
    constructor(color?:Color, intensity?:number) {
        super();
        this.color = color??Color.FromString("#cccccc");
        this.intensity = intensity??1;
    }

    getModelGUIControlSpec() {
        let self = this;
        return {
            intensity: {
                value: self.intensity,
                onChange: (v: any) => {
                    self.intensity = v;
                },
                min: 0,
                max: 50,
                step: 0.1
            },
        }
    }

}


