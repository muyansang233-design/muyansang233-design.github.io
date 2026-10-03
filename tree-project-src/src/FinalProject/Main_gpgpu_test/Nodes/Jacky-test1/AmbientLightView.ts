import {ALightModel, Vec3} from "../../../../anigraph";
import { ASerializable, ANodeView} from "../../../../anigraph";
import { Color } from "../../../../anigraph";
import {AmbientLightModel} from "./AmbientLightModel";

@ASerializable("AmbientLightView")
export class AmbientLightView extends ANodeView {

    get model(): AmbientLightModel {
        return this._model as AmbientLightModel;
    }

    updateShaderUniforms(context: any) {
        const m = this.model;
        const c = new Vec3(m.color.r, m.color.g, m.color.b)
        const i = m.intensity;

        context.renderer.setUniform("uAmbientColor", c);
        context.renderer.setUniform("uAmbientIntensity", i);
    }

    update() {}
}
