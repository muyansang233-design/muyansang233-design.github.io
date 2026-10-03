import * as THREE from "three";
import {AGraphicElement, ANodeView, NodeTransform3D} from "../../../../../anigraph";
import {ExampleParticleSystemModel} from "./ExampleParticleSystemModel";
import {SphereParticle} from "./SphereParticle";

export class ExampleParticleSystemView extends ANodeView{
    particleGeometry!:THREE.BufferGeometry;
    particleGraphics:AGraphicElement[]=[];

    /**
     * We are overriding the get model function so that the type of this.model will be an ExampleParticleSystemModel.
     * @returns {ExampleParticleSystemModel}
     */
    get model():ExampleParticleSystemModel{
        return this._model as ExampleParticleSystemModel;
    }

    init(): void {
        this.particleGeometry = new THREE.SphereBufferGeometry(1);
        const self = this;
        this.subscribe(this.model.addParticlesListener(()=>{
            self.update();
        }))

        for(let p of this.model.particles){
            this.addParticleGraphic(p);
        }
        this.setTransform(this.model.transform);
    }



    addParticleGraphic(p:SphereParticle){
        let pel = AGraphicElement.Create(this.particleGeometry, this.mainMaterial);
        this.particleGraphics.push(pel);
        let particleTransform = new NodeTransform3D(p.position, undefined, p.radius);
        pel.setTransform(particleTransform);
        this.registerAndAddGraphic(pel)
    }

    update(...args: any[]): void {
        if(this.model.particles.length>=this.particleGraphics.length){
            for(let pi=0;pi<this.model.particles.length;pi++){
                let p = this.model.particles[pi];
                if(pi<this.particleGraphics.length){
                    this.particleGraphics[pi].setTransform(new NodeTransform3D(
                        this.model.transform.appliedToPoint(p.position),
                        undefined,
                        p.radius)
                    );
                }else{
                    this.addParticleGraphic(p);
                }
            }
        }else{
            for(let killi=this.model.particles.length;killi<this.particleGraphics.length;killi++){
                this.disposeGraphic(this.particleGraphics[killi]);
            }
            for(let pi=0;pi<this.model.particles.length;pi++) {
                let p = this.model.particles[pi];
                this.particleGraphics[pi].setTransform(new NodeTransform3D(p.position, undefined, p.radius));
            }

        }
        this.setTransform(this.model.transform);
    }

}
