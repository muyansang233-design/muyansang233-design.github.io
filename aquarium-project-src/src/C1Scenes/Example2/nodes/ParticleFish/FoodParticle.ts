import {Color, Particle2D, V2, Vec2} from "../../../../anigraph";
import {A2DParticle} from "./A2DParticle";

/**
 * Our custom 2D particle class. It must implement the Particle2D interface, which means it has `position`, `depth`, and `visible` properties.
 * You can customize your particle class with additional properties and functions.
 */
export class FoodParticle extends A2DParticle{

    /**
     * You can show or hide particles by setting their `visible` parameter.
     * This is important, because with instanced particles, you will need to create all the particles you plan to use up front so that the GPU can allocate the appropriate resources. This means that if you want fewer than this maximum number, you just hide the particles you aren't using.
     */
    show(){
        this.visible = true;
    }
    hide(){
        this.visible = false;
    }

    life:number;
    maxLife = 30;
    maxRadius = 0.4;

    constructor(position?:Vec2, velocity?:Vec2, mass?:number, radius?:number){
        super(position);
        this.radius = this.maxRadius;
        this.color = new Color(0.294, 0.180, 0.020)
        this.life = this.maxLife;
    }


    setColor(color:Color){this.color = color;}
    getColor(): Color{return this.color;}

    setRadius(radius:number){
        this.radius = radius;
    }

    getRadius():number{
        return this.radius;
    }

}
