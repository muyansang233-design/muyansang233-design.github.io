import * as THREE from "three";
import {
    AGraphicElement,
    ANodeView,
    ASerializable,
    AShaderMaterial,
} from "../../../../../anigraph";

import {
    ABlinnPhongShaderModel,
} from "../../../../../anigraph/rendering/shadermodels";

import {
    ATexture,
} from "../../../../../anigraph/rendering";

import { LeafParticle } from "./LeafParticle";

@ASerializable("LeafParticleView")
export class LeafParticleView extends ANodeView {
    private graphic!: AGraphicElement;

    private static geometry: THREE.PlaneGeometry;
    private static shaderModel: ABlinnPhongShaderModel;
    private static material: AShaderMaterial;
    private static texture: ATexture;

    get model(): LeafParticle {
        return this._model as LeafParticle;
    }

    init(): void {
        if (!LeafParticleView.shaderModel) {
            LeafParticleView.shaderModel = new ABlinnPhongShaderModel("blinnphong");
        }

        if (!LeafParticleView.geometry) {
            let scale = this.model.scale;
            console.log("Particle: ", scale);
            LeafParticleView.geometry = new THREE.PlaneGeometry(0.15 * scale, 0.15 * scale, 1, 1);

            const count = LeafParticleView.geometry.attributes.position.count;
            const colors: number[] = [];

            const myGreen = new THREE.Color(0x4D8C57);

            for (let i = 0; i < count; i++) {
                colors.push(myGreen.r, myGreen.g, myGreen.b);
            }

            LeafParticleView.geometry.setAttribute(
                'color',
                new THREE.Float32BufferAttribute(colors, 3)
            );
        }

        if (!LeafParticleView.texture) {
            ATexture.LoadAsync("Texture/grass_mask.png").then(tex => {
                LeafParticleView.texture = tex;
                tex.setWrapToClamp();

                if (LeafParticleView.material) {
                    LeafParticleView.material.setTexture("diffuse", tex);
                    (LeafParticleView.material.threejs as THREE.ShaderMaterial).needsUpdate = true;
                }
            });
        }

        if (!LeafParticleView.material) {
            const mat = LeafParticleView.shaderModel.CreateMaterial();

            mat.setUniform("diffuse", 1.0);
            mat.setUniform("ambient", 0.8);
            mat.setUniform("specular", 0.1);
            mat.setUniform("specularExp", 16.0);

            const threeMat = mat.threejs as THREE.ShaderMaterial;
            threeMat.transparent = true;
            threeMat.side = THREE.DoubleSide;
            threeMat.alphaTest = 0.5;
            threeMat.depthWrite = true;

            threeMat.vertexColors = true;
            threeMat.needsUpdate = true;

            (threeMat as any).morphTargets = false;
            (threeMat as any).morphNormals = false;

            LeafParticleView.material = mat;
        }

        this.graphic = AGraphicElement.Create(
            LeafParticleView.geometry,
            LeafParticleView.material
        );

        this.registerAndAddGraphic(this.graphic);

        this.graphic.threejs.visible = false;
    }

    update(t: number, ...args: any[]): void {
        const mesh = this.graphic.threejs;

        if (!this.model.isAlive) {
            mesh.visible = false;
            return;
        }

        mesh.visible = true;

        this.graphic.setTransform(this.model.getWorldTransform());
    }
}