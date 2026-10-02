import {ASerializable, Vector} from "../../../../anigraph";
import { Instanced2DParticleSystemModel } from "../../../../anigraph/starter/nodes/instancedParticlesSystem/Instanced2DParticleSystemModel";
import { A2DParticle } from "./A2DParticle";
import {Simulate} from "react-dom/test-utils";
import progress = Simulate.progress;
import {DebugModel} from "./DebugModel";
import {Color, Mat3, TransformationInterface,LineSegment, Vec2, Vec3,Precision} from "anigraph";

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

@ASerializable("WaterWaveModel")
export class WaterWaveModel extends Instanced2DParticleSystemModel<A2DParticle> {
    // ---- 固定参数 ----
    radius: number;
    particleRadius: number;
    totalSteps: number;
    stepStride: number;
    loop: boolean;

    currentStep: number = 0;
    delaySteps: number = 0;
    progress: number = 0;
    curr_radius: number = 0;
    activated: boolean = true;
    private _frame = 0;
    public frameSkip = 3;

    // Debug
    debugMode: DebugModel;
    constructor({
                    radius,
                    particleRadius,
                    position,
                    totalSteps,
                    stepStride = 1,
                    nParticles = 400,
                    delaySteps = 0,
                    initialStepOffset = 0,
                    loop = false,
                }: WaterWaveStepInit) {
        super();
        this.debugMode = new DebugModel();

        this.radius = radius;
        this.particleRadius = particleRadius;
        this.totalSteps = Math.max(1, Math.floor(totalSteps));
        this.stepStride = Math.max(0, Math.floor(stepStride));
        this.loop = loop;

        this.currentStep = Math.max(0, Math.floor(initialStepOffset));
        this.delaySteps = Math.max(0, Math.floor(delaySteps));

        console.log("Position at Wave1: " + this.transform.position.x + ", " + this.transform.position.y);
        this.transform.position = position;
        console.log("Position at Wave2: " + this.transform.position.x + ", " + this.transform.position.y);

        this.initParticles(nParticles);

        this.updateGeometryFromStep();
    }

    /** 供外部手动推进；k 可以是负数（后退），不需要时间 */
    public advanceSteps(k: number = this.stepStride) {
        if (!this.activated) return;

        if (this.delaySteps > 0) {
            this.delaySteps -= k;
            if (this.delaySteps > 0) return;
            k = -this.delaySteps;
            this.delaySteps = 0;
        }

        this.currentStep += Math.floor(k);
        this.updateGeometryFromStep();

        if (this.currentStep >= this.totalSteps) {
            if (this.loop) {
                this.currentStep = 0;
                this.updateGeometryFromStep();
            } else {
                this.deactivateAndHide();
            }
        } else if (this.currentStep < 0) {
            this.currentStep = 0;
            this.updateGeometryFromStep();
        }
    }


    timeUpdate(_t: number, ...args: any[]) {
        super.timeUpdate(_t, ...args);
        if (!this.activated) return;
        this._frame++;
        if (this._frame % this.frameSkip !== 0) return;
        this.advanceSteps(this.stepStride);
    }


    private updateGeometryFromStep() {
        this.progress = Math.min(1, Math.max(0, this.currentStep / this.totalSteps));
        this.curr_radius = this.progress * this.radius;

        const cx = 0;
        const cy = 0;
        const n = this.particles.length;
        const R = this.curr_radius;
        const pr = Math.max(0, this.particleRadius * (1 - this.progress)); // 渐隐

        for (let i = 0; i < n; i++) {
            const theta = (2 * Math.PI * i) / n;
            const x = cx + R * Math.cos(theta);
            const y = cy + R * Math.sin(theta);
            const pi = this.particles[i];
            pi.position = new Vec2(x, y);
            pi.radius = pr * (1 - this.progress);
            pi.color.a = 1 - this.progress;
            pi.visible = true;
        }
        this.signalParticlesUpdated();
    }

    initParticles(nParticles: number) {
        this.particles = new Array(nParticles);
        for (let i = 0; i < nParticles; i++) {
            console.log("Position at Wave3: " + this.transform.position.x + ", " + this.transform.position.y);
            const p = new A2DParticle(new Vec2(this.transform.position.x, this.transform.position.y));
            p.radius = this.particleRadius;
            p.visible = true;
            this.particles[i] = p;
        }
        this.signalParticlesUpdated();
    }

    private deactivateAndHide() {
        this.activated = false;
        for (let i = 0; i < this.particles.length; i++) this.particles[i].visible = false;
        this.signalParticlesUpdated();
    }
}
