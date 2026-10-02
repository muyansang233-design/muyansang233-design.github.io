// FishBoneNode.ts
import {ASerializable, Color, Mat3, TransformationInterface,LineSegment, Vec2, Vec3,Precision} from "anigraph";
import {A2DParticle, ParticleType} from "./A2DParticle";
import {
    Instanced2DParticleSystemModel
} from "../../../../anigraph/starter/nodes/instancedParticlesSystem/Instanced2DParticleSystemModel";
import {
    GetCubicBezierSplineSegmentDerivativeForAlpha,
    GetCubicBezierSplineSegmentValueForAlpha
} from "../Spline/CubicBezierFunctions";
import {DebugModel} from "./DebugModel";
import {
    Action_Escape, Action_Patrol,
    Action_SetEscapeTarget,
    Action_SetNewTarget,
    BehaviorNode, Conditional_SetTargetEscape, Conditional_ReachTarget, Conditional_Touched,
    SelectorNode, SequenceNode, Conditional_SawFood, Conditional_LostFood, Conditional_CanEat, Action_ChaseFood,
    Action_EatFood, FailNode, SuccessNode,
} from "../BehaviorTree/BehaviorNode";
import {WaterWaveModel} from "./WaterWaveModel";
import {FishFoodModel} from "./FishFoodModel";
import {FoodParticle} from "./FoodParticle";
import {Example2SceneModel} from "../../Example2SceneModel";

@ASerializable("FishSkeletonModel")
export class FishSkeletonModel extends Instanced2DParticleSystemModel<A2DParticle> {
    joints: number[];
    length: number;
    _length: number;
    tailOscillation: number;
    _tailOscillation: number;
    tailEscalationIndex: number;
    _tailEscalationIndex: number;
    frequency: number;
    _frequency: number;
    waveLength: number;
    _waveLength: number;
    _speed: number;
    transformMatrix: Mat3;
    direction: Vec2;

    lastdot:number = 0;

    // Local position of bone particles
    boneParticlesLocalPos: Vec2[] = [];

    // bone particles with World position transform
    translationMatrix: Mat3;
    rotationMatrix: Mat3;

    head: A2DParticle;
    body: A2DParticle;
    tail: A2DParticle;
    tailTip: A2DParticle;
    nPoints: number = 150;
    color: Color;

    // Functional Attributes
    lastUpdateTime:number=0;

    // AI Behavior
    target: Vec2;
    speed: number; // Should be between 0.0 and 1.0

    // Collision Detection
    collisionBox: Vec2[] = [];

    // AI BTree Black Board
    isTouched: boolean = false;
    seeFood: boolean = false;
    reachTarget: boolean = false;
    canEat: boolean = false;
    escapeTargetSetted: boolean = false;
    sawFood: boolean = false;
    lostFood: boolean = true;
    currentFood: FoodParticle = new FoodParticle();

    // BTree
    BehaviorTree: BehaviorNode;


    routeBezierIndex:number;
    routeBezierMin = 1;
    routeBezierMax = 3;
    bezierCurve: Vec2[] = []
    nextStep: Vec2;

    // Path related attributes
    localMaximum: Vec2;
    private phase: number = 0;


    private spraysIdxByPoint: number[][] = [];

    private sprayPoolStartIndex: number = 0;
    private sprayPoolSize: number = 4000;
    private sprayFreeList: number[] = [];

    private sprayVel: Vec2[] = [];
    private sprayAge: number[] = [];
    private sprayLife: number[] = [];

    public sprayEmitRate: number = 3;
    public spraySpeed: number = 0.35;
    public sprayLifeSec: number = 0.3;
    public sprayOffsetRatio: number = 0.02;
    public sprayEmitBoth: boolean = true;
    public sprayGravity: number = 0.0;
    public sprayDamping: number = 1.0;
    public sprayMaxPerPoint: number = 48;

    private sprayAccumulator: number = 0;
// FishSkeletonModel 内
    public sprayPointScale: number = 0.35;
    public bonePointScale: number = 1.0;
    public get SprayPoolStartIndex(): number { return this.sprayPoolStartIndex; }

    // Properties for Body Shape Curve Calculation only
    // DEBUG: Hard coded for now in constructor

    // Key point properties
    headControlLineHeight: number;
    bodyControlLineHeight: number;
    tailControlLineHeight: number;
    tailTipControlLineHeight: number;

    headBodyCP: Vec2[] = [];
    bodyTailCP: Vec2[] = [];
    TailTailCP: Vec2[] = [];

// === Trail settings ===
    private trailPoolStartIndex = 0;
    private trailPoolSize = 128;
    private trailPositions: Vec2[] = [];
    private lastTrailDrop = new Vec2(0, 0);

    public trailEnabled = true;
    public trailSpacing = 0.05;
    public trailMaxAlpha = 0.8;
    public trailRadiusHead = 2;
    public trailRadiusTail = 0.06;
    public trailColor = new Color(0.847, 0.961, 0.941);
    private trailAcc = 0;
    private prevAnchor = new Vec2(0,0);


    // Food Eating Behavior:
    foodSystem: FishFoodModel;
    sceneModel: Example2SceneModel;

    // DEBUG
    public debugModel: DebugModel;
    /**
     * Constructor
     * @param joints the joints of the fish, MUST BE IN LENGTH OF 4 between 0,1
     * @param length the length of the fish
     * @param tailOscillation the oscillation of the tail
     * @param frequency the frequency of the wave
     * @param tailEscalationIndex the index of the tail oscillation
     * @param waveLength the length of the wave
     */
    constructor(joints: number[],
                length: number,
                tailOscillation: number,
                frequency:number,
                tailEscalationIndex: number,
                waveLength: number,
                properties: number[],
                speed: number,
                color:Color,
                foodSystem: FishFoodModel,
                sceneModel: Example2SceneModel) {
        super();
        this.length = length;
        this._length = length;
        this.joints = joints;
        this.tailOscillation = tailOscillation;
        this._tailOscillation = tailOscillation;
        this.tailEscalationIndex = tailEscalationIndex;
        this._tailEscalationIndex = tailEscalationIndex;
        this.waveLength = waveLength;
        this._waveLength = waveLength;
        this.frequency = frequency;
        this._frequency = frequency;
        this._speed = speed
        this.speed = this._speed;
        this.sceneModel = sceneModel;

        this.color = color

        // Body shape initialization
        this.headControlLineHeight = properties[0];
        this.bodyControlLineHeight = properties[1];
        this.tailControlLineHeight = properties[2];
        this.tailTipControlLineHeight = properties[3];


        this.target = new Vec2(0,0);
        this.transformMatrix = new Mat3(
            1,0,this.transform.position.x,
            0,1,this.transform.position.y,
            0,0,1);
        this.direction = new Vec2(-1,0);
        this.lastUpdateTime = 0;
        this.nextStep = new Vec2(0,0);
        this.localMaximum = new Vec2(0,0);

        this.debugModel = new DebugModel();

        this.translationMatrix = Mat3.Identity();
        this.rotationMatrix = Mat3.Identity();

        this.translationMatrix = this.transform.getMatrix()

        this.initializeBodyShapeControlPoints();
        this.initParticles(this.nPoints);
        this.initCollisionBox();
        this.initTrailPool();

        this.foodSystem = foodSystem;


        this.routeBezierIndex = Math.floor(Math.random() * (this.routeBezierMax - this.routeBezierMin + 1)) + this.routeBezierMin;

        // Calculating head,body and tail
        this.head = this.particles[0];
        this.body = this.particles[this.joints[1]];
        this.tail = this.particles[this.joints[2]];
        this.tailTip = this.particles[this.joints[3]];

        // ========================= Behavior Tree ==============================
        const action_escape = new Action_Escape();
        const action_setEscapeTarget = new Action_SetEscapeTarget();
        const action_setNewTarget = new Action_SetNewTarget();
        const action_patrol = new Action_Patrol();
        const condition_reachTarget = new Conditional_ReachTarget();
        const condition_touched = new Conditional_Touched();
        const condition_escapeTarget = new Conditional_SetTargetEscape();

        const condition_sawFood = new Conditional_SawFood();
        const sequence_escape = new SequenceNode();
        const sequence_eatFood = new SequenceNode();
        const condition_lostFood = new Conditional_LostFood();
        const condition_canEat = new Conditional_CanEat();
        const action_chaseFood = new Action_ChaseFood();
        const action_eatFood = new Action_EatFood();

        const failureNode = new FailNode()
        const successNode = new SuccessNode()

        const targetUpdate_selector = new SelectorNode(
            action_setNewTarget,
            action_patrol,
            [condition_reachTarget]
        );

        const escapeUpdate_selector = new SelectorNode(
            action_escape,
            action_setEscapeTarget,
            [condition_escapeTarget]
        );


        const canEat_selector = new SelectorNode(
            action_eatFood,
            action_chaseFood,
            [condition_canEat]
        )

        const eat_selector = new SelectorNode(
            canEat_selector,
            failureNode,
            [condition_sawFood]
        )

        const lost_selector = new SelectorNode(
            eat_selector,
            targetUpdate_selector,
            [condition_lostFood]
        )


        const touch_selector = new SelectorNode(
            escapeUpdate_selector,
            lost_selector,
            [condition_touched]
        );


        this.BehaviorTree = touch_selector;
    }

    // Getter and Setters
    setTransform(transform: TransformationInterface) {this._transform = transform;}
    get Transform(): TransformationInterface {return this._transform;}

    get zValue(): number {return 1;}
    set zValue(value: number) {}

    get Length(): number { return this.length; }
    set Length(value: number) { this.length = value; }

    get TailOscillation(): number { return this.tailOscillation; }
    set TailOscillation(value: number) { this.tailOscillation = value; }

    get TailEscalationIndex(): number { return this.tailEscalationIndex; }
    set TailEscalationIndex(value: number) { this.tailEscalationIndex = value; }

    get WaveLength(): number { return this.waveLength; }
    set WaveLength(value: number) { this.waveLength = value; }

    get Frequency(): number { return this.frequency; }
    set Frequency(value: number) { this.frequency = value; }

    get Particles(): A2DParticle[] {return this.particles;}
    // Special implementation for setting tail and heads
    set Particles(value: A2DParticle[]) {this.particles = value;}

    public get Target(): Vec2 {return this.target;}
    public set Target(value: Vec2) {this.target = value;}

    get RouteBezierIndex(): number {return this.routeBezierIndex;}
    set RouteBezierIndex(value: number) {this.routeBezierIndex = value;}

    get Head(): A2DParticle {return this.particles[0];}
    set Head(value: A2DParticle) {this.head = value;}
    get Body(): A2DParticle {return this.particles[this.joints[1]];}
    set Body(value: A2DParticle) {this.body = value;}
    get Tail(): A2DParticle {return this.particles[this.joints[2]];}
    set Tail(value: A2DParticle) {this.tail = value;}
    get TailTip(): A2DParticle {return this.particles[this.joints[3]];}
    set TailTip(value: A2DParticle) {this.tailTip = value;}

    initParticles(nParticles?:number){
        // if(nParticles === undefined){
        //     nParticles = 150;
        //     console.log("nParticles is undefined, setting to 200 for now")
        // }
        //
        // this.nPoints = nParticles;

        for (let i = 1; i <= this.nPoints; i++) {
            let x = (i /this.nPoints) * this.length;
            this.boneParticlesLocalPos.push(new Vec2(x,this.GetYAtTime(x,0)));

            let p = new A2DParticle(new Vec2(x,this.GetYAtTime(x,0)));
            // p.setColor(new Color(1,1,1,(this.GetBezierInterpolatedRadiusAtIndex(i/this.nPoints)/this.bodyControlLineHeight) / 10))
            // Default: Particle is a Fish bone

            // set Radius
            p.setRadius(this.GetBezierInterpolatedRadiusAtIndex(i/this.nPoints));
            p.setType(ParticleType.FISH_BONE)
            console.log("color: " + this.color)
            p.setColor(this.color);

            this.particles.push(p);
        }


        this.spraysIdxByPoint = Array.from({ length: this.nPoints }, () => []);
    }

    private initCollisionBox(){
        // Compute collision box
        let p1 = new Vec2(0, this.bodyControlLineHeight/6);
        let p2 = new Vec2(this.length, this.bodyControlLineHeight/6);
        let p3 = new Vec2(this.length, -this.bodyControlLineHeight/6);
        let p4 = new Vec2(0, -this.bodyControlLineHeight/6);


        this.collisionBox = [p1, p2, p3, p4];
    }

    private initTrailPool() {
        this.trailPoolStartIndex = this.particles.length;
        for (let i = 0; i < this.trailPoolSize; i++) {
            const p = new A2DParticle(new Vec2(0, 0));
            if (this.trailEnabled){
                p.visible = true;
            } else {
                p.visible = false;
            }
            p.setType(ParticleType.FISH_BONE);
            p.setColor(new Color(this.trailColor.r, this.trailColor.g, this.trailColor.b, 0.0));
            p.setRadius(this.trailRadiusTail);
            this.particles.push(p);
        }
        // this.lastTrailDrop = this.particles[0].position.clone();
        this.lastTrailDrop = this.getTailCenterPos(4).clone(); // 或 this.getTailTipPos().clone()
        this.prevAnchor    = this.lastTrailDrop.clone();
        this.trailAcc      = 0;

    }



    GetBezierInterpolatedRadiusAtIndex(index: number): number {
        if(index <= this.joints[1]) {
            index = index/this.joints[1];
            // console.log(GetCubicBezierSplineSegmentValueForAlpha(index, this.headBodyCP[0], this.headBodyCP[1], this.headBodyCP[2], this.headBodyCP[3]).y);
            return GetCubicBezierSplineSegmentValueForAlpha(index, this.headBodyCP[0], this.headBodyCP[1], this.headBodyCP[2], this.headBodyCP[3]).y + (1-index)/4 * this.bodyControlLineHeight;
        }
        else if(index <= this.joints[2]) {
            index = (index - this.joints[1])/(this.joints[2] - this.joints[1]);
            return GetCubicBezierSplineSegmentValueForAlpha(index, this.bodyTailCP[0], this.bodyTailCP[1], this.bodyTailCP[2], this.bodyTailCP[3]).y;
        }
        else if(index <= 1) {
            index = (index - this.joints[2])/(1 - this.joints[2]);
            return GetCubicBezierSplineSegmentValueForAlpha(index, this.TailTailCP[0], this.TailTailCP[1], this.TailTailCP[2], this.TailTailCP[3]).y;
        }
        else{
            console.log("error in calculating radius with index of: " + index)
            return 1;
        }

    }

    initializeBodyShapeControlPoints(){
        // Constants
        const backout = 0.5
        // Calculate head to body
        let hb1 = new Vec2(0, 0);
        let hb2 = new Vec2(0,this.bodyControlLineHeight);
        let hb4 = new Vec2(this.joints[1] * this.length, this.bodyControlLineHeight);
        let hb3 = hb4
        this.headBodyCP = [hb1,hb2,hb4,hb3];

        // Calculate body to tail
        let bt1 = hb4
        let bt4 = new Vec2(this.joints[2] * this.length, this.tailControlLineHeight);
        let bt2 = new Vec2(bt1.x + backout * (bt4.x - bt1.x), this.bodyControlLineHeight);
        let bt3 = new Vec2(this.joints[1] * this.length + backout * (bt4.x - bt1.x),this.tailControlLineHeight);

        this.bodyTailCP = [bt1,bt2,bt3,bt4]

        // Calculate tail to tail
        let tt1 = bt4;
        let tt4 = new Vec2(this.length, 0);
        let tt2 = new Vec2(this.joints[2] * this.length + 0.25 * (this.length - this.joints[3] * this.length), (this.tailTipControlLineHeight - tt1.y)/2);
        let tt3 =new Vec2(this.joints[2] * this.length + 0.5 * (this.length - this.joints[3] * this.length), this.tailTipControlLineHeight/2);
        this.TailTailCP = [tt1,tt2,tt3,tt4];
    }

    getExtendedVector(vec: Vec2, length: number): Vec2 {
        const dir = vec.getNormalized();
        const scale: number = Math.sqrt(vec.x ** 2 + vec.y ** 2)+ length; // 原长度 + 延长长度
        return dir.times(scale);
    }


    updateBezierCurvePoint() {
        this.bezierCurve = [];
        let p1 = this.head.position;

        // 起点
        const P = p1;
        // 单位化方向向量
        const dir = this.direction.getNormalized();
        // 延长距离（或系数）
        const d = this.routeBezierIndex;
        // 新点
        const p2 = new Vec2(P.x + dir.x * d, P.y + dir.y * d);

        const p4 = this.target;

        const p3 = new Vec2(
            (p2.x + p4.x) / 2,
            (p2.y + p4.y) / 2
        );

        this.bezierCurve = [p1, p2, p3, p4];
    }

    // Update Direction
    // 根据bezierCurve的公式来update


    // Customized methods
    /** Calculate the oscillation of the tail
     * @param x the current x coordinate
     * @returns the oscillation value, y*/
    GetOscillationAtTime(x: number): number {
        return this.tailOscillation * (x/this.length) ** this.tailEscalationIndex
    }

    /** Calculate the y value of the fish at a given x coordinate and time
     * @param x the current x coordinate
     * @param time the current time
     * @returns the y value*/
    GetYAtTime(x: number, time: number): number {
        let s = x / this.length;
        return this.GetOscillationAtTime(x) *
            Math.sin(this.phase - 2 * Math.PI * (s / this.waveLength));
    }

    checkCollision(v: Vec2): boolean {
        // Transform v to local coordinate;
        v = this.transformMatrix.getInverse().times(v);
        // this.debugModel.particles[10].position = v;
        if (v.x >= this.collisionBox[0].x && v.x <= this.collisionBox[1].x &&
            v.y <= this.collisionBox[0].y && v.y >= this.collisionBox[3].y){
            this.isTouched = true;
        }

        return v.x <= this.collisionBox[0].x && v.x >= this.collisionBox[3].x &&
            v.y <= this.collisionBox[0].y && v.y >= this.collisionBox[3].y;
    }

    checkReachedTarget(){
        const distance = 2
        if (this.get2Ddistance(this.target, this.particles[0].position) < distance){
            // console.log("reached target")
            this.reachTarget = true;
        } else {
            this.reachTarget = false;
        }
    }

    checkSeeFood(){
        for (let i = 0; i < this.foodSystem.particleQueue.length; i++) {
            let q = this.foodSystem.particleQueue[i];

            const dot = this.direction.dot(q.position);
            // console.log("Food Dot: " + dot);
            // Food Processing
            if (this.get2Ddistance(this.head.position, q.position) < 3 && dot > 0){
                this.sawFood = true;
                this.target = q.position;
                this.lostFood = false;
                this.currentFood = q;
                if (this.get2Ddistance(this.head.position, q.position) < 0.5){
                    this.canEat = true;
                } else {
                    this.canEat = false;
                }
                return;
            }
        }
        if (!this.sawFood && !this.lostFood){
            this.lostFood = true;
        }
        this.sawFood = false;
    }

    get2Ddistance(v1: Vec2, v2: Vec2){
        return Math.sqrt((v2.x - v1.x) ** 2 + (v2.y - v1.y) ** 2)
    }

    /**
     * Update the particles of the fish, update the local position of the particles
     * @param time the current time
     */
    updateParticles(time: number) {

        for (let i = 0; i < this.nPoints; i++) {    // ✅ 只更新骨架，不碰喷射池
            // for (let i = 0; i < this.particles.length; i++) {
            // Calculate local position and put it in local position array
            let x = (i / this.nPoints) * this.length;
            this.boneParticlesLocalPos[i].x = x;
            this.boneParticlesLocalPos[i].y = this.GetYAtTime(x, time);

            // this.particles[i].color.a = (this.health/this._health) / 10;

            // Update frequency when turnning
            // Update frequency when turning
            const dot = this.direction.dot(this.target.minus(this.head.position));
            if ((dot <= 0 && this.lastdot >0) || (dot >= 0 && this.lastdot <= 0)) {
                this.sceneModel.fireWaterWave(new Vec2(this.translationMatrix.m02, this.translationMatrix.m12),1,50);
            }
            if (dot > 0.001) {
                this.frequency = this._frequency
                this.speed = this._speed
                this.tailOscillation = this._tailOscillation
                this.tailEscalationIndex = this._tailEscalationIndex;
            } else {
                this.frequency = this._frequency * 2.5
                this.tailOscillation = this._tailOscillation * 0.8
                this.speed = this._speed * 2
            }
            this.lastdot = dot;
        }
    }

    // 1) 池分配/回收
    private allocSpraySlot(): number | null {
        if (this.sprayFreeList.length === 0) return null;
        return this.sprayFreeList.pop()!;
    }

    private freeSpraySlot(poolIdx: number) {
        this.sprayLife[poolIdx] = 0;
        const arrIdx = this.sprayPoolStartIndex + poolIdx;
        const p = this.particles[arrIdx];
        p.visible = false;
        this.sprayFreeList.push(poolIdx);
    }

    updateCollisionBox(){
        for (let i = 0; i < this.collisionBox.length; i++) {
            let point = this.collisionBox[i];
            // this.debugModel.particles[i].position = point;
        }
    }

    private spawnOneAtPoint(i: number, up: boolean) {
        const list = this.spraysIdxByPoint[i];
        if (list.length >= this.sprayMaxPerPoint) return;  // 每点上限

        const slot = this.allocSpraySlot();
        if (slot === null) return; // 池满，丢弃

        const base = this.particles[i].position;
        const offset = this.sprayOffsetRatio * this.length;
        const vy = (up ? +1 : -1) * this.spraySpeed;

        const arrIdx = this.sprayPoolStartIndex + slot;
        const p = this.particles[arrIdx];
        p.position.x = base.x;
        p.position.y = base.y + (up ? offset : -offset);
        p.setColor(up ? Color.Red() : Color.White());
        p.visible = false;

        this.sprayVel[slot].x = 0;
        this.sprayVel[slot].y = vy;
        this.sprayAge[slot] = 0;
        this.sprayLife[slot] = this.sprayLifeSec;

        list.push(slot);
    }

    private spawnPairAtPoint(i: number) {
        this.spawnOneAtPoint(i, true);                 // 上
        if (this.sprayEmitBoth) this.spawnOneAtPoint(i, false); // 下
    }

    private getTrailAnchorPos(useTailTip: boolean = true): Vec2 {
        const frac = useTailTip ? (this.joints[3] ?? 1) : (this.joints[2] ?? 0.9);
        const idx = this.fracToIndex(frac);
        return this.particles[idx].position;
    }


    private fracToIndex(frac: number): number {
        if (!Number.isFinite(frac)) return 0;
        const i = Math.round(Math.max(0, Math.min(1, frac)) * (this.nPoints - 1));
        return Math.max(0, Math.min(this.nPoints - 1, i));
    }
    private getTailTipPos(): Vec2 {
        const idx = this.fracToIndex(this.joints[3] ?? 1);
        return this.particles[idx].position;
    }
    private getTailCenterPos(k: number = 4): Vec2 {
        const iStart = this.fracToIndex(this.joints[2] ?? 0.8);
        const iEnd   = this.fracToIndex(this.joints[3] ?? 1.0);
        let sx=0, sy=0, c=0;
        for (let i=iEnd; i>=iStart && c<k; i--, c++) { sx += this.particles[i].position.x; sy += this.particles[i].position.y; }
        return new Vec2(sx/(c||1), sy/(c||1));
    }


    private maybeDropTrailPoint() {
        const anchor = this.getTailCenterPos(4); // 或 this.getTailTipPos()

        const step = Math.hypot(anchor.x - this.prevAnchor.x, anchor.y - this.prevAnchor.y);
        this.prevAnchor = anchor.clone();
        if (step < 1e-9) return;

        this.trailAcc += step;

        while (this.trailAcc >= this.trailSpacing) {
            const dirx = anchor.x - this.lastTrailDrop.x;
            const diry = anchor.y - this.lastTrailDrop.y;
            const d    = Math.hypot(dirx, diry);
            if (d < 1e-9) { this.trailAcc = 0; break; }

            const nx = dirx / d, ny = diry / d;
            this.lastTrailDrop = new Vec2(
                this.lastTrailDrop.x + nx * this.trailSpacing,
                this.lastTrailDrop.y + ny * this.trailSpacing
            );

            this.trailPositions.push(this.lastTrailDrop.clone());
            if (this.trailPositions.length > this.trailPoolSize) this.trailPositions.shift();

            this.trailAcc -= this.trailSpacing;
        }
    }

    private updateTrailVisuals() {
        const n = this.trailPositions.length;
        for (let j = 0; j < this.trailPoolSize; j++) {
            const p = this.particles[this.trailPoolStartIndex + j];

            if (j < n) {
                const pos = this.trailPositions[n - 1 - j];
                p.visible = true;
                p.position.x = pos.x;
                p.position.y = pos.y;

                // 0=最新，1=最老
                const t = (n <= 1) ? 0 : j / (n - 1);
                p.setRadius(12.0 * j / this.trailPoolSize);
                const alpha = (this.trailPoolSize - j)/this.trailPoolSize;
                p.setColor(new Color(this.trailColor.r, this.trailColor.g, this.trailColor.b, (1-t)/10));
                if (this.trailEnabled){
                    p.visible = true;
                } else {
                    p.visible = false;
                }
            } else {
                // p.visible = false;
            }
        }
    }

    moveToTarget(deltaTime: number) {
        // Update the direction of the fish
        this.nextStep = GetCubicBezierSplineSegmentValueForAlpha(deltaTime, this.bezierCurve[0], this.bezierCurve[1], this.bezierCurve[2], this.bezierCurve[3]);
        this.direction = GetCubicBezierSplineSegmentDerivativeForAlpha(deltaTime, this.bezierCurve[0], this.bezierCurve[1], this.bezierCurve[2], this.bezierCurve[3]);

        const bodyIndex = Math.floor(this.joints[1] * this.nPoints);
        // const bodyIndex = Math.floor(this.nPoints/2);

        let offsetx = this.direction.getNormalized().x * this.speed/30;
        let offsety = this.direction.getNormalized().y * this.speed/30;

        this.translationMatrix.m02 += offsetx;
        this.translationMatrix.m12 += offsety;
        //

        // ====== 更新其他身体点 ======
        const angle = Math.atan2(this.direction.y, this.direction.x) + Math.PI;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        this.rotationMatrix.m00 = cosA;
        this.rotationMatrix.m01 = -sinA;
        this.rotationMatrix.m10 = sinA;
        this.rotationMatrix.m11 = cosA;

        this.transformMatrix = this.translationMatrix.times(this.rotationMatrix);

        // head 的世界坐标
        const hx = this.transformMatrix.m02;
        const hy = this.transformMatrix.m12;

        for (let i = 0; i < this.boneParticlesLocalPos.length; i++) {
            const local = this.boneParticlesLocalPos[i];

            const bodyx = this.particles[bodyIndex].position.x;
            const bodyy = this.particles[bodyIndex].position.y;

            const lx = local.x;
            const ly = local.y;
            const localPosTransform = new Mat3([
                1, 0, lx,
                0, 1, ly,
                0, 0, 1
            ]);

            const localrotation = new Mat3([
                cosA, -sinA, 0,
                sinA,  cosA, 0,
                0,     0,    1
            ]);

            const localWorldmatrix = new Mat3([
                1, 0, hx,
                0,  1, hy,
                0,  0,  1
            ])

            const localmatrix = new Mat3([
                1, 0, 0,
                0, 1, 0,
                0, 0, 1
            ]);

            const newRotation = localmatrix.times(localrotation);


            // finalmatrix = tmatrix;

            const result = localWorldmatrix.times(newRotation).times(localPosTransform);

            this.particles[i].position.x = result.m02;
            this.particles[i].position.y = result.m12;
        }
    }


    /**
     * timeUpdate
     * This will update the particle system at time t. You may consider splitting this into an `updateParticles` function that iterates through all the particles and updates them individually, and an `emit` function that resets a given particle when some condition is met.
     * We often want to know the current time when a particle is emitted. You may also consider writing a third function called something like `launchParticle` that finds a particle to recycle and explicitly sets a condition that will lead to it being emitted the next time `timeUpdate` is called. This will let you trigger the emission of a particle from a controller interaction (e.g., keyboard or mouse event), which runs asynchronously with your model.
     * @param t
     * @param args
     */
    timeUpdate(t: number, ...args:any[]) {
        super.timeUpdate(t, ...args);
        const deltaTime = t - this.lastUpdateTime;
        // this.health -= deltaTime;
        this.phase += 2 * Math.PI * this.frequency * deltaTime;
        this.lastUpdateTime = t;

        //Locally update the particles
        this.updateParticles(t);

        // Update the bezier curve route
        if (this.bezierCurve.length == 0) {
            this.updateBezierCurvePoint();
        }
        const self = this;
        this.subscribeToAppState("TrailEnabled", (enabled)=>{
            // set an attribute of this object to the value of the slider
            self.trailEnabled = enabled;
        })

        this.updateBezierCurvePoint();

        this.maybeDropTrailPoint();
        this.updateTrailVisuals();

        // Check targetReaching
        this.checkReachedTarget();
        this.checkSeeFood();

        // Trigger BTree
        // console.log("=======")
        // console.log("saw_food: " + this.sawFood);
        // console.log("lost_food: " + this.lostFood);
        // console.log("can_eat: " + this.canEat);
        this.BehaviorTree.tick(this, deltaTime)

        // this.debugModel.particles[0].position = this.target;
        this.updateCollisionBox();

        this.debugModel.particles[0].position = this.target;



        // Update the particles
        this.signalParticlesUpdated();
    }

}
