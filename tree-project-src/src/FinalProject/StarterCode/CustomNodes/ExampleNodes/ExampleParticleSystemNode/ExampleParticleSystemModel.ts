import {
    ANodeModel3D,
    AObject,
    ASerializable,
    AShaderModel,
    Color,
} from "../../../../../anigraph";
import {SphereParticle} from "./SphereParticle";

enum ParticleEvents{
    PARTICLES_UPDATED="PARTICLES_UPDATED"
}

@ASerializable("ExampleParticleSystemModel")
export class ExampleParticleSystemModel extends ANodeModel3D{
    static ShaderModel:AShaderModel;
    static async LoadShaderModel(...args:any[]){
        await AShaderModel.ShaderSourceLoaded("exampleparticle");
        ExampleParticleSystemModel.ShaderModel = await AShaderModel.CreateModel("exampleparticle")
    }

    /**
     * Here we don't want to make particles AObjectState because we may update particles one at a time, which would
     * cause listeners to update for every minor change. Instead, we will batch these updates by sending an update
     * signal with `this.signalParticlesUpdated()` to anything that added a listener using `addParticlesListener`
     */
    particles:SphereParticle[];

    orbitRadius:number=0.5;
    orbitFrequency:number=2;
    zOffset:number=0.1;

    constructor() {
        super();
        this.particles = [];
        this.setMaterial(ExampleParticleSystemModel.ShaderModel.CreateMaterial());
        this.material.setUniform("particleColor", Color.FromRGBA(0.2,1.0,0.2,0.5));
    }

    addParticle(particle:SphereParticle){
        this.particles.push(particle);
    }

    /**
     *
     * @param callback
     * @param handle
     * @param synchronous
     * @returns {AStateCallbackSwitch}
     */
    addParticlesListener(callback:(self:AObject)=>void, handle?:string, synchronous:boolean=true,){
        return this.addEventListener(ParticleEvents.PARTICLES_UPDATED,callback, handle);
    }

    signalParticlesUpdated(...args:any[]){
        this.signalEvent(ParticleEvents.PARTICLES_UPDATED, ...args);
    }

    timeUpdate(t: number, ...args:any[]) {
        super.timeUpdate(t);

        let phase = t*Math.PI*2*this.orbitFrequency;
        for(let p=0;p<this.particles.length;p++){
            let offset = p*Math.PI*2/(this.particles.length);
            this.particles[p].position.x = this.orbitRadius*Math.sin(offset+phase);
            this.particles[p].position.y = this.orbitRadius*Math.cos(offset+phase);
            this.particles[p].position.z = this.zOffset;
        }

        this.signalParticlesUpdated();
    }

}
