import {Color, Particle2D, V2, Vec2} from "../../../../anigraph";

/**
 * Our custom 2D particle class. It must implement the Particle2D interface, which means it has `position`, `depth`, and `visible` properties.
 * You can customize your particle class with additional properties and functions.
 */
export class A2DParticle implements Particle2D{
    mass:number;
    position:Vec2;
    velocity:Vec2;
    visible:boolean=true;
    public radius:number;
    depth:number=0;
    color:Color;
    type: ParticleType

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

    constructor(position?:Vec2, velocity?:Vec2, mass?:number, radius?:number){
        this.position = position??V2();
        this.velocity = velocity??V2();
        this.mass = mass??1;
        this.radius = radius??2;
        this.color = Color.White();
        this.visible = true;
        this.type = ParticleType.FISH_BODY;
    }

    setType(type: ParticleType){this.type = type;}
    getType(): ParticleType{return this.type;}

    setColor(color:Color){this.color = color;}
    getColor(): Color{return this.color;}

    setRadius(radius:number){
        this.radius = radius;
    }

    getRadius():number{
        return this.radius;
    }

}

// State of Particles
export enum ParticleType {
    FISH_BODY,
    FISH_BONE,
    FISH_JOINTS,
    WATER_RIPPLE
}

