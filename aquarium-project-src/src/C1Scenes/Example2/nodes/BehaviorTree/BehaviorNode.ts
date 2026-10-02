import {FishSkeletonModel} from "../ParticleFish/FishSkeletonModel";
import {checkInBound, Example2SceneModel, getBounds, randomEdgeSpawn} from "../../Example2SceneModel";
import {Vec2} from "../../../../anigraph";
import {Vec3} from "../../../../anigraph";

export enum NodeStatus {
    SUCCESS = "SUCCESS",
    FAILURE = "FAILURE",
    RUNNING = "RUNNING"
}

export abstract class BehaviorNode {
    status: NodeStatus = NodeStatus.RUNNING;
    abstract tick(fish: FishSkeletonModel,  deltaTime: number): NodeStatus;

    get2Ddistance(v1: Vec2, v2: Vec2){
        return Math.sqrt((v2.x - v1.x) ** 2 + (v2.y - v1.y) ** 2)
    }
}

export class LeafNode extends BehaviorNode {
    constructor(){
        super()
        this.status = NodeStatus.RUNNING;
    }

    // Perform Action
    tick(fish: FishSkeletonModel, deltaTime: number): NodeStatus{
        console.log("LeafNode")
        return this.status;
    }
}

export class SequenceNode extends BehaviorNode {
    children: BehaviorNode[];
    constructor(nodes: BehaviorNode[] = []){
        super()
        this.children = nodes;
    }

    // Perform Action
    tick(fish: FishSkeletonModel,  deltaTime: number):NodeStatus{
        for(let child of this.children){
            const status = child.tick(fish, deltaTime);
            if(status != NodeStatus.SUCCESS){
                return status;
            }
        }
        return NodeStatus.SUCCESS;
    }
}

export class SelectorNode extends BehaviorNode {
    children: BehaviorNode[];
    successNode?: BehaviorNode;
    failureNode?: BehaviorNode;
    constructor(successNode?: BehaviorNode, failureNode?: BehaviorNode, nodes: BehaviorNode[] = []){
        super()
        this.children = nodes;
        this.successNode = successNode;
        this.failureNode = failureNode;
    }

    // Perform Action
    tick(fish: FishSkeletonModel,  deltaTime: number){
        for(let child of this.children){
            const status = child.tick(fish, deltaTime);
            if(status != NodeStatus.SUCCESS){
                return this.failureNode?.tick(fish, deltaTime) ?? status;
            }
        }
        return this.successNode?.tick(fish, deltaTime) ?? NodeStatus.FAILURE;
    }
}

// Actions and Conditions Definition

export class Conditional_Touched extends LeafNode {
    constructor() {
        super();
    }

    tick(fish: FishSkeletonModel){
        // console.log("Determining if touched......")
        if(fish.isTouched){
            // console.log("Touched")
            return NodeStatus.SUCCESS;
        } else {
            // console.log("Not touched")
            return NodeStatus.FAILURE;
        }
    }
}

export class Conditional_ReachTarget extends LeafNode {
    constructor() {
        super();
    }

    tick(fish: FishSkeletonModel): NodeStatus {
        if (fish.reachTarget){
            // console.log("Reached target")
            return NodeStatus.SUCCESS;
        } else {
            // console.log("Not reached target...moving")
            return NodeStatus.FAILURE;
        }
    }
}

export class Conditional_SetTargetEscape extends LeafNode {
    constructor() {
        super();
    }

    tick(fish: FishSkeletonModel): NodeStatus {
        // console.log("Determining reaching target......")
        if (fish.escapeTargetSetted){
            return NodeStatus.SUCCESS;
        } else {
            return NodeStatus.FAILURE;
        }
    }
}

export class Action_Patrol extends LeafNode {
    constructor() {
        super();
    }

    tick(fish: FishSkeletonModel,  deltaTime: number): NodeStatus {
        // console.log("Action_Patrol")
        if (fish.reachTarget){
            return NodeStatus.SUCCESS;
        }
        fish.moveToTarget(deltaTime)
        return NodeStatus.RUNNING
    }
}

export class Action_SetNewTarget extends LeafNode {
    constructor() {
        super();
    }

    tick(fish: FishSkeletonModel,  deltaTime: number): NodeStatus {
        // console.log("Action_SetNewTarget")
        fish.target = randomEdgeSpawn(getBounds());
        return NodeStatus.SUCCESS;
    }
}

export class Action_SetEscapeTarget extends LeafNode {
    constructor() {
        super();
    }

    tick(fish: FishSkeletonModel,  deltaTime: number): NodeStatus {
        // console.log("Action_SetEscapeTarget")
        let distance_param = 2.5
        let target = randomEdgeSpawn(getBounds());
        // Check for if target is far enough
        if (this.get2Ddistance(fish.particles[0].position, target) < distance_param){
            target = target.getNormalized().times(distance_param);
        }
        fish.escapeTargetSetted = true;
        fish.target = target;
        return NodeStatus.SUCCESS;
    }
}

export class Action_Escape extends LeafNode {
    constructor() {
        super();
    }

    tick(fish: FishSkeletonModel,  deltaTime: number): NodeStatus {
        // console.log("Action_Escape")
        let move_buff = 5
        // console.log("fish: " + fish.reachTarget)
        if (fish.reachTarget){
            fish.speed = fish._speed;
            fish.frequency = fish._frequency;
            fish.tailOscillation = fish._tailOscillation;
            fish.isTouched = false;
            return NodeStatus.SUCCESS;
        }
        fish.frequency = fish._frequency * move_buff
        fish.tailOscillation = fish.tailOscillation * (1/move_buff) * 3/2
        fish.speed = fish._speed * move_buff
        fish.moveToTarget(deltaTime)
        return NodeStatus.RUNNING
    }
}

// Food Eating Behavior
export class Conditional_SawFood extends LeafNode {
    constructor() {
        super();
    }

    tick(fish: FishSkeletonModel,  deltaTime: number): NodeStatus {
        if (fish.sawFood){
            return NodeStatus.SUCCESS;
            // console.log("Saw food")
        } else {
            return NodeStatus.FAILURE;
            // console.log("Didn't saw food")
        }
    }
}

export class Conditional_CanEat extends LeafNode {
    constructor() {
        super();
    }

    tick(fish: FishSkeletonModel,  deltaTime: number): NodeStatus {
        if (fish.canEat){
            return NodeStatus.SUCCESS;
            // console.log("Can eat food")
        } else {
            return NodeStatus.FAILURE;
            // console.log("can't eat food")
        }
    }
}

export class Conditional_LostFood extends LeafNode {
    constructor() {
        super();
    }

    tick(fish: FishSkeletonModel,  deltaTime: number): NodeStatus {
        if (!fish.lostFood){
            return NodeStatus.SUCCESS;
            // console.log("Didn't Lost food")
        } else {
            return NodeStatus.FAILURE;
            // console.log("Lost food")
        }
    }
}

export class Action_ChaseFood extends LeafNode {
    constructor() {
        super();
    }


    tick(fish: FishSkeletonModel,  deltaTime: number): NodeStatus {
        if (fish.currentFood.life <= 0){
            // console.log("Didn't saw food")
            return NodeStatus.FAILURE;
        }
        // console.log("Action_ChaseFood")
        // console.log("fish food: " + fish.currentFood.life)
        let move_buff = 6
        // console.log("fish: " + fish.reachTarget)
        if (fish.get2Ddistance(fish.particles[0].position, fish.currentFood.position) > 1.5){
            // console.log("Didn't reach food")
            fish.speed = fish._speed;
            fish.frequency = fish._frequency;
            fish.tailOscillation = fish._tailOscillation;
            fish.moveToTarget(deltaTime)
            return NodeStatus.SUCCESS;
        }
        // console.log("close to food")
        fish.frequency = fish._frequency * move_buff
        fish.tailOscillation = fish.tailOscillation * (1/move_buff) * 3/2
        fish.speed = fish._speed * move_buff
        fish.moveToTarget(deltaTime)
        return NodeStatus.SUCCESS;
    }
}


export class Action_EatFood extends LeafNode {
    constructor() {
        super();
    }

    tick(fish: FishSkeletonModel, deltaTime: number): NodeStatus {
        if (!fish.lostFood) {
            fish.seeFood = false;
            fish.currentFood.life = 0;
            return NodeStatus.SUCCESS;
        }
        return NodeStatus.FAILURE
    }
}

export class FailNode extends LeafNode {
    constructor() {
        super();
    }

    tick(fish: FishSkeletonModel, deltaTime: number): NodeStatus {
        return NodeStatus.FAILURE
    }
}

export class SuccessNode extends LeafNode {
    constructor() {
        super();
    }

    tick(fish: FishSkeletonModel, deltaTime: number): NodeStatus {
        return NodeStatus.SUCCESS
    }
}
