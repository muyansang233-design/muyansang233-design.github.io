import * as THREE from "three";
import {ANodeModel3D, ASerializable, NodeTransform3D, Vec3} from "../../../../../anigraph";
import { LeafParticle } from "./LeafParticle";
import {TreeNode} from "./TreeNode";
import {WindFieldModel} from "./WindFieldModel";
import {TreeModel} from "./TreeModel";


@ASerializable("LeafParticleSystemModel")
export class LeafParticleSystemModel extends ANodeModel3D {
    private _particles: LeafParticle[] = [];
    private _maxParticles: number = 20; // 可以稍微给多一点
    private _numLeafPerBranch: number = 2;
    private _windField: WindFieldModel;
    private leaves: TreeNode[] = [];
    private tree: TreeModel;

    private _lastTime: number = -1;
    private _spawnTimer: number = 0;
    private _spawnInterval: number = 0.5;

    public scale = 1.0;

    constructor(leaves: TreeNode[] = [], wind: WindFieldModel, tree: TreeModel, scale: number = 1.0) {
        super();
        console.log("LeafParticleSystemModel init");
        this.scale = scale;
        this.leaves = leaves;
        this._windField = wind;
        this.tree = tree;

        // Particle Pool initiation
        for(let i = 0; i < this._maxParticles; i++){
            let p = new LeafParticle(this.scale);
            this._particles.push(p);
            this.addChild(p);
        }


    }

    private _getFreeParticle(): LeafParticle | null {
        // Find dead particle
        let p = this._particles.find(p => !p.isAlive);
        return p || null;
    }

    public spawnParticles(count: number, rootPos: Vec3, radius: number = 0.1) {
        for (let i = 0; i < count; i++) {
            const p = this._getFreeParticle();
            if (p) {
                // Random Generation within radius
                const randDir = new Vec3(
                    (Math.random() * 2 - 1),
                    (Math.random() * 2 - 1),
                    (Math.random() * 2 - 1)
                ).getNormalized();

                const randLen = Math.random() * radius;

                const spawnPos = rootPos.plus(randDir.times(randLen));

                // Get wind force at spawnPos
                let windForce = this._windField.getWindForceAtPosition(spawnPos);
                let startVel = windForce.times(0.1);

                p.activate(spawnPos, startVel);
            }
        }
    }

    public timeUpdate(t: number) {
        if (this._lastTime < 0) {
            this._lastTime = t;
            return;
        }
        const dt = t - this._lastTime;
        this._lastTime = t;

        this._spawnTimer += dt;

        if (this._spawnTimer > this._spawnInterval) {
            this._spawnTimer = 0; // 重置计时器

            if (this.leaves.length > 0) {
                const randomIndex = Math.floor(Math.random() * this.leaves.length);
                const targetLeaf = this.leaves[randomIndex];

                if (!this.tree.easyRender){
                    this.spawnParticles(
                        this._numLeafPerBranch,
                        targetLeaf.getWorldTransform().clone().getPosition(),
                        targetLeaf.radius
                    );
                }
            }
        }

        // Update physics for all particles
        for (let p of this._particles) {
            p.updateParticle(dt, -10.0, this._windField);
        }
    }
}