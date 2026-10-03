import {AParticle3D} from "../../../../../anigraph";
import {Color, Vec3} from "../../../../../anigraph";

export class SphereParticle extends AParticle3D{
    radius:number;
    color:Color;
    constructor(position?:Vec3, velocity?:Vec3, radius?:number, mass?:number) {
        super(position, velocity, mass);
        //set this.radius to the radius argument if it is not undefined, otherwise to 1.
        this.radius = radius??1;
        this.color = Color.FromRGBA(1,1,1,0.5);
    }

    get opacity(){
        return this.color.a;
    }
}
