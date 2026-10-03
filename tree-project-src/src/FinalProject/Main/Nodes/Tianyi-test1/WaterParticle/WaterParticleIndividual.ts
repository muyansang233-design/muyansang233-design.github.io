import {SphereParticle} from "../../../../StarterCode/CustomNodes/ExampleNodes/ExampleParticleSystemNode/SphereParticle";
import {Vec3, V3} from "../../../../../anigraph";

/**
 * 单个水粒子（现在当成 2D：x + z，高度在 z 轴，y 锁定 0）
 */
export class WaterParticleIndividual extends SphereParticle {
    phaseOffset: number;
    speed: number;
    center: Vec3;

    velocity: Vec3 = V3(0,0,0);

    constructor(
        position?: Vec3,
        velocity?: Vec3,
        radius?: number,
        mass?: number,
        phaseOffset?: number,
        speed?: number,
        center?: Vec3,
    ) {
        super(position ?? V3(), velocity ?? V3(), radius, mass);
        this.phaseOffset = phaseOffset ?? 0;
        this.speed = speed ?? 1.0;
        this.center = center ?? V3(0, 0, 0);
        this.velocity = velocity ?? V3(0,0,0);

        // this.position.y = 0;
        // this.velocity.y = 0;
    }

    /**
     * 现在：不再加重力，只用现有 velocity 做积分 + 盒子碰撞
     */
    timeUpdate(
        t: number,
        dt: number,
        // baseHeight: number,
        // amplitude: number,
        boundsMin?: Vec3,
        boundsMax?: Vec3,
        collisionDamping?: number,
    ) {
        if (dt <= 0) return;

        // 只更新 x、z；y 锁死成 0
        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;
        this.position.z += this.velocity.z * dt;

        // this.position.y = 0;
        // this.velocity.y = 0;

        if (boundsMin && boundsMax) {
            this.resolveCollisions(boundsMin, boundsMax, collisionDamping);
        }
    }

    /** 盒子碰撞（2D：x,z） */
    private resolveCollisions(boundsMin: Vec3, boundsMax: Vec3, collisionDamping: number = 0.9){
        const centerX = 0.5 * (boundsMin.x + boundsMax.x);
        const centerY = 0.5 * (boundsMin.y + boundsMax.y);
        const centerZ = 0.5 * (boundsMin.z + boundsMax.z);

        const halfSizeX = 0.5 * (boundsMax.x - boundsMin.x) - this.radius;
        const halfSizeY = 0.5 * (boundsMax.y - boundsMin.y) - this.radius;
        const halfSizeZ = 0.5 * (boundsMax.z - boundsMin.z) - this.radius;

        let relX = this.position.x - centerX;
        let relY = this.position.y - centerY;
        let relZ = this.position.z - centerZ;

        const bounceX = collisionDamping;
        const bounceY = collisionDamping;
        const bounceZ = collisionDamping;

        // X
        if (Math.abs(relX) > halfSizeX) {
            const sx = Math.sign(relX) || 1;
            relX = halfSizeX * sx;
            this.velocity.x *= -bounceX;
        }

        // Y （深度）
        if (Math.abs(relY) > halfSizeY) {
            const sy = Math.sign(relY) || 1;
            relY = halfSizeY * sy;
            this.velocity.y *= -bounceY;
        }


        // Z（高度）
        if (Math.abs(relZ) > halfSizeZ) {
            const sz = Math.sign(relZ) || 1;
            relZ = halfSizeZ * sz;
            this.velocity.z *= -bounceZ;
        }

        this.position.x = centerX + relX;
        this.position.y = centerY + relY;
        this.position.z = centerZ + relZ;

        // this.position.y = 0;
        // this.velocity.y = 0;
    }
}
