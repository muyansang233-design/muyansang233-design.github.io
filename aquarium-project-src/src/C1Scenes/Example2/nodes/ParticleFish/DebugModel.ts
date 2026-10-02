import {ASerializable, Vec2} from "../../../../anigraph";
import {
    Instanced2DParticleSystemModel
} from "../../../../anigraph/starter/nodes/instancedParticlesSystem/Instanced2DParticleSystemModel";
import {A2DParticle, ParticleType} from "./A2DParticle";
import {Color} from "../../../../anigraph";

@ASerializable("DebugModel")
export class DebugModel extends Instanced2DParticleSystemModel<A2DParticle> {
    constructor() {
        super();
        this.initParticles(500);
    }
    initParticles(nParticles: number) {
        for (let i = 0; i < nParticles; i++) {
            let p = new A2DParticle(new Vec2(0, 0),);
            p.color = Color.Red()
            p.radius = 2;
            this.particles.push(p);
        }
    }

    timeUpdate(t: number, ...args: any[]) {
        this.signalParticlesUpdated()
    }
}