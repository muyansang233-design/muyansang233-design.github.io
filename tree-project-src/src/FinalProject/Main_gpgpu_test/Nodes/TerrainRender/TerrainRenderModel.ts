/**
 * @file TerrainRenderModel
 * @description Model for rendering terrain_render mesh (high-poly, textured, visible)
 */

import { ANodeModel3D } from "../../../../anigraph/scene";
import { ASerializable } from "../../../../anigraph/base";

@ASerializable("TerrainRenderModel")
export class TerrainRenderModel extends ANodeModel3D {

    constructor() {
        super();
    }
}
