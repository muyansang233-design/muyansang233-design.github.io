import {SphereParticle} from "../../../../StarterCode/CustomNodes/ExampleNodes/ExampleParticleSystemNode/SphereParticle";
import {Vec3, V3, ANodeModel3D, ASerializable, NodeTransform3D, Quaternion, Mat4} from "../../../../../anigraph";
import {Vector3} from "three";

export enum NodeTypes {
    TRUNK = "TRUNK",
    LEAF = "LEAF",
    BRANCH = "BRANCH",
}
@ASerializable("TreeNode")
export class TreeNode extends ANodeModel3D {
    length:number = 1;
    type:NodeTypes = NodeTypes.TRUNK;
    _direction: Vec3;

    // Wind Related properties
    baseDirection: Vec3;

    public stiffness: number = 1000.0;

    public tailRadius:number = 0.5;
    public tipRadius:number = 0.2;

    public radius:number = 0.5;

    public _cacheDistance: number = 0;

    public scale = 1;

    constructor(type:NodeTypes, length:number, tailRadius:number, tipRadius:number, scale:number, radius=0.5,) {
        super();
        this.type = type;
        this.length = length;
        this._direction = new Vec3(0, 1, 0);
        this.baseDirection = this._direction.clone();

        this.tailRadius = tailRadius;
        this.tipRadius = tipRadius;
        this.radius = radius;


    }

    public bakeRestPose() {
        this._direction = this._direction.getNormalized();
        this.baseDirection = this._direction.clone();

        if (this.type === NodeTypes.TRUNK) this.stiffness = 10.0;
        if (this.type === NodeTypes.BRANCH) this.stiffness = 4.0;
        if (this.type === NodeTypes.LEAF) this.stiffness = 1.0;
    }

    timeUpdate(t: number, ...args: any[]) {
        super.timeUpdate(t, ...args);
    }

    get direction(): Vec3 {
        return this._direction;
    }

    set direction(v: Vec3) {
        this._direction = v.getNormalized();

        const q = quaternionFromDirection(this._direction);
        this.transform._setQuaternionRotation(q);
    }
}

export function quaternionFromDirection(direction: Vec3): Quaternion {
    const dir = new Vector3(direction.x, direction.y, direction.z).normalize();

    const up = new Vector3(0, 1, 0);

    const quat = new Quaternion();
    quat.setFromUnitVectors(up, dir);  // 旋转 Y → dir

    return quat;
}
