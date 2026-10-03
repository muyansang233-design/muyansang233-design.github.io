import * as THREE from "three";
import { ANodeModel3D, ASerializable, Vec3, Quaternion } from "../../../../../anigraph";
import { WindFieldModel } from "./WindFieldModel";
import { Vector3 } from "three";

@ASerializable("LeafParticle")
export class LeafParticle extends ANodeModel3D {
    public isAlive: boolean = false;
    public velocity: Vec3 = new Vec3(0,0,0);
    public age: number = 0;
    public maxAge: number = 3.0;

    private gravity: number = 1;
    private drag: number = 1;

    private baseRotation: Quaternion = new Quaternion();

    private spinAxis: Vector3 = new Vector3(0, 1, 0);
    private spinSpeed: number = 0;
    private spinPhase: number = 0;

    private windInfluence: number = 2.0;

    public scale = 1.0;

    constructor( scale:number = 1.0) {
        super();
        this.scale = scale;
    }

    public activate(startPos: Vec3, initialVel: Vec3) {
        this.isAlive = true;
        this.age = 0;

        this.transform.setPosition(startPos);
        this.velocity = initialVel.times(0.2);

        // ------------------ Initial Rotation  ------------------
        const randomAxis = new Vector3(
            Math.random() - 0.5,
            Math.random() - 0.5,
            Math.random() - 0.5
        ).normalize();

        const randomAngle = Math.random() * Math.PI * 2;

        const randomQuat = new Quaternion();
        randomQuat.setFromAxisAngle(randomAxis, randomAngle);

        this.baseRotation = randomQuat.clone();
        this.transform._setQuaternionRotation(this.baseRotation);

        // ------------------ Self Rotation ------------------
        this.spinAxis = new Vector3(
            Math.random() - 0.5,
            Math.random() - 0.5,
            Math.random() - 0.5
        ).normalize();

        this.spinSpeed = THREE.MathUtils.lerp(1.5, 4.0, Math.random());
        this.spinPhase = Math.random() * Math.PI * 2;
    }

    public updateParticle(dt: number, groundHeight: number, windField: WindFieldModel) {
        if (!this.isAlive) return;

        const currentPos = this.getWorldTransform().getPosition();

        // ------------------ Calculate Force ------------------
        const windForce = windField.getWindForceAtPosition(currentPos);
        const gravityForce = new Vec3(0,0,-this.gravity);
        const dragForce = this.velocity.times(-this.drag);

        const acceleration = gravityForce
            .plus(dragForce)
            .plus(windForce.times(this.windInfluence));

        this.velocity = this.velocity.plus(acceleration.times(dt));

        // ------------------ Update Position ------------------
        const newPos = currentPos.plus(this.velocity.times(dt));
        this.transform.setPosition(newPos);

        // ------------------ Self Rotation ------------------
        this.spinPhase += this.spinSpeed * dt;

        const spinQuat = new Quaternion();
        spinQuat.setFromAxisAngle(this.spinAxis, this.spinPhase);

        const finalQuat = this.baseRotation.clone();
        finalQuat.multiply(spinQuat);

        this.transform._setQuaternionRotation(finalQuat);

        this.age += dt;
        if (this.age > this.maxAge || newPos.y < groundHeight) {
            this.isAlive = false;
        }

        this.signalGeometryUpdate()
    }
}
