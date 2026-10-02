import {ASerializable, GetAppState, V2, Vector} from "../../../../anigraph";
import { Instanced2DParticleSystemModel } from "../../../../anigraph/starter/nodes/instancedParticlesSystem/Instanced2DParticleSystemModel";
import { A2DParticle } from "./A2DParticle";
import {Simulate} from "react-dom/test-utils";
import progress = Simulate.progress;
import {DebugModel} from "./DebugModel";
import {Color, Mat3, TransformationInterface,LineSegment, Vec2, Vec3,Precision} from "anigraph";
import {FoodParticle} from "./FoodParticle";
import {AParticleEnums} from "../../../../anigraph/physics/particles/AParticleEnums";
import {Custom2DParticle} from "../ExampleParticleSystem";
import {Queue} from "better-react-mathjax/MathJax2";

type WaterWaveStepInit = {
    radius: number;
    particleRadius: number;
    position: Vec2;
    totalSteps: number;
    stepStride?: number;
    nParticles?: number;
    delaySteps?: number;
    initialStepOffset?: number;
    loop?: boolean;
};

@ASerializable("FishFoodModel")
export class FishFoodModel extends Instanced2DParticleSystemModel<FoodParticle> {
    // Debug
    debugMode: DebugModel = new DebugModel();
    particleQueue: FoodParticle[] = [];
    nextIndex = 0;
    /**
     * Particle system model for using instanced particles
     * "Instanced" graphics are ones where the same geometry is rendered many times, possibly with minor variations (e.g., in position and color). Each render of the object is an "instance". This is handled as a special case so that the program can share common data across the different instances, which helps scale up to a larger number of instances more efficiently. This makes it great for something like a particle system, where you have many copies of the same geometry.
     * Note that with instanced graphics, you need to specify the number of instances you plan to use up front so that we can allocate resources on the GPU to store whatever attributes vary between instances. This means that instead of creating new particles and destroying old ones as the application progresses, you will create a fixed budget of particles up front and simply hide any particles you aren't using. Then, when you want to "create" a new particle, you take one of the hidden particles, set its attributed, and un-hide it.
     */


        // These are just keys for some simple app state properties we will control via sliders in this demo.
    static ParticleOrbitKey = "ParticleOrbit"
    static ParticleColorKey = "ParticleColor"

    /**
     * If you plan to simulate things with time steps, you are going to want to keep track of the last clock time when you updated so you can calculate how much time has passed between `timeUpdate(t)` calls
     * @type {number}
     */
    lastUpdateTime:number=0;

    constructor() {
        super();
        this.initParticles(50)
    }

    /**
     * timeUpdate
     * This will update the particle system at time t. You may consider splitting this into an `updateParticles` function that iterates through all the particles and updates them individually, and an `emit` function that resets a given particle when some condition is met.
     * We often want to know the current time when a particle is emitted. You may also consider writing a third function called something like `launchParticle` that finds a particle to recycle and explicitly sets a condition that will lead to it being emitted the next time `timeUpdate` is called. This will let you trigger the emission of a particle from a controller interaction (e.g., keyboard or mouse event), which runs asynchronously with your model.
     * @param t
     * @param args
     */
    timeUpdate(t: number, ...args:any[]) {
        super.timeUpdate(t, ...args); // Be a good citizen and call the parent function in case something important happens there...
        let deltaTime:number = t - this.lastUpdateTime;

        for (let i = 0; i < this.particleQueue.length; ++i) {
            let p = this.particleQueue[i];
            p.life -= deltaTime;
            p.color.a = p.life/p.maxLife;
            p.radius = p.maxRadius * (p.life/p.maxLife);
            if (p.life < 0){
                p.life = p.maxLife;
                p.visible = false;
                let temp = this.particleQueue[this.particleQueue.length - 1]
                this.particleQueue[this.particleQueue.length - 1] = p;
                this.particleQueue[i] = temp;
                this.particleQueue.pop()
            }
        }

        // Let's signal that our particle data has changed, which will trigger the view to refresh.
        this.signalParticlesUpdated();

        // Remember to update `this.lastUpdateTime` so that it will be accurate the next time you call this function!
        this.lastUpdateTime = t;
    }

    /**
     * Initialize the particles
     * If you want to add and remove particles on the fly, you should still initialize nParticles to the maximum you plan to use at any one point. Then you should create and add that many in initParticles, and set the `visible` parameter of any you aren't using right away to false. Then, later, when you want to turn a particle on, you can set `particle.visible=true` and assign its other attributes accordingly.
     * @param nParticles the maximum number of particles you might want to use
     */
    initParticles(nParticles?:number){
        if(nParticles === undefined){nParticles = AParticleEnums.DEFAULT_MAX_N_PARTICLES;}
        for(let i=0;i<nParticles;i++){
            // create one particle
            let newp = new FoodParticle(new Vec2(0,0))

            // set it to be visible
            newp.visible=false;
            // newp.visible=false; // if you don't want to show this particle right now

            // add it to the particle system
            this.addParticle(newp);
        }
        this.signalParticlesUpdated();
    }

    addFood(v:Vec2){
        if (this.particleQueue.length >= 20) {
            return;
        }
        let particle = this.particles[this.nextIndex]
        particle.position = v;
        this.nextIndex++;
        if (this.nextIndex == this.nParticles - 1){
            this.nextIndex = 0;
        }
        particle.visible=true;
        this.particleQueue.push(particle);
    }
}
