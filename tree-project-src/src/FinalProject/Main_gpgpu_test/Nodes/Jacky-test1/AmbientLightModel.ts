import {ALightModel} from "../../../../anigraph";
import { ASerializable } from "../../../../anigraph";
import { Color } from "../../../../anigraph";


@ASerializable("AmbientLightModel")
export class AmbientLightModel extends ALightModel {
    constructor(color?: Color, intensity?: number) {
        super(color, intensity);
        this.isActive = true;
    }
}
