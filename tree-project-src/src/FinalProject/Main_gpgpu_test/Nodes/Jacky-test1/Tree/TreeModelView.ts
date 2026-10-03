import * as THREE from "three";
import {
    AGraphicElement,
    ANodeView,
    NodeTransform3D,
    ASerializable,
    V3
} from "../../../../../anigraph";
import { TreeNode, NodeTypes } from "./TreeNode";
import {log} from "leva/dist/declarations/src/utils"; // 按你的文件名改路径

@ASerializable("TreeModelView")
export class TreeModelView extends ANodeView {
    private graphic!: AGraphicElement;

    get model(): TreeNode {
        return this._model as TreeNode;
    }

    init(): void {

    }

    update(...args: any[]): void {

    }
}
