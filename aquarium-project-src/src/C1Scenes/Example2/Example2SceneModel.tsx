import { App2DSceneModel } from "anigraph/starter/App2D/App2DSceneModel";
import {ExampleParticleSystemModel} from "./nodes";
import {LabCatFloationgHeadModel} from "./nodes/LabCatFloatingHead/LabCatFloationgHeadModel";
import {
    AMaterialManager,
    ANodeModel,
    AppState,
    Color,
    DefaultMaterials,
    GetAppState,
    SVGAsset,
    Vec2
} from "../../anigraph";
import React from "react";
import {CustomSVGModel} from "./nodes/CustomSVGModel";
import {FishSkeletonModel} from "./nodes/ParticleFish/FishSkeletonModel";
import {WaterWaveModel} from "./nodes/ParticleFish/WaterWaveModel";
import {Vec3} from "anigraph/math";
import {FishFoodModel} from "./nodes/ParticleFish/FishFoodModel";



// ---- spawn helpers (place AFTER imports, BEFORE the class) ----
type Bounds = { left:number; right:number; bottom:number; top:number };
const DEFAULT_BOUNDS: Bounds = { left: -8.05, right: 8.05, bottom: -8.05, top: 8.05 };
let bound: Bounds = DEFAULT_BOUNDS;

export function randomEdgeSpawn(bounds: Bounds): Vec2 {
    const { left, right, bottom, top } = bounds;
    const side = Math.floor(Math.random() * 4); // 0:左 1:右 2:下 3:上
    if (side === 0) return new Vec2(left,  bottom + Math.random() * (top - bottom));
    if (side === 1) return new Vec2(right, bottom + Math.random() * (top - bottom));
    if (side === 2) return new Vec2(left + Math.random() * (right - left), bottom);
    return               new Vec2(left + Math.random() * (right - left), top);
}

export function checkInBound(bounds: Bounds, v: Vec2): boolean{
    let left = bounds.left;
    let right = bounds.right;
    let top = bounds.top;
    let bottom = bounds.bottom;

    return v.x >= left && v.x <= right && v.y >= bottom && v.y <= top;
}

export function getBounds(): Bounds{
    return bound;
}

function angleFromTo(from: Vec2, to: Vec2): number {
    return Math.atan2(to.y - from.y, to.x - from.x);
}


let nErrors = 0;
export class Example2SceneModel extends App2DSceneModel{

    /**
     * Our example particle system model. Note that if we are declaring some class instance attribute that may not be
     * initialized in the constructor, we need to put the "!" after its name to indicate that we intend to initialize it
     * elsewhere. In this case, we will initialize `particleSystem` in the `initScene()` function.
     * @type {ExampleParticleSystemModel}
     */
    particleSystem!:ExampleParticleSystemModel;
    waterWave!:WaterWaveModel;

    /**
     * Lab Cat's floating head. Lab Cat wants to show you how to create a simple quad textured with a cool texture.
     * In this case, a texture of Lab Cat's floating head... What could be cooler than that?
     * @type {LabCatFloationgHeadModel}
     */
    labCatFloatingHead!:LabCatFloationgHeadModel;
    fishFood!:FishFoodModel;
    /**
     * Lab Cat vector asset. Also a floating head.
     * @type {SVGAsset}
     */
    labCatSVG!:SVGAsset;
    labCatVectorHead!:CustomSVGModel;


    // Sets of fishes
    fishes:FishSkeletonModel[] = [];
    waterWaves: WaterWaveModel[] = [];
    foodMode = false;

    presetColor = new Color(1,1,1,1);

    private readonly fishParticleTexture = "WhiteParticle";
    private readonly splashParticleTexture = "GaussianSplat";
    /**
     * This will add variables to the control pannel
     * @param appState
     */
    initAppState(appState:AppState){
        appState.addColorControl("presetColor", Color.FromString("#ffffff"));
        // Fish
        appState.addCheckboxControl("TrailEnabled", true);
        appState.addButton("Generate Asian Carp", ()=>{this.addFish(0)});
        appState.addButton("Generate Puffer Fish", ()=>{this.addFish(1)});
        appState.addButton("Generate Pacific Saury", ()=>{this.addFish(2)});
        appState.addButton("Generate Anchovy", ()=>{this.addFish(3)});
        appState.addButton("Generate Tuna", ()=>{this.addFish(4)});
        appState.addButton("Generate Eel", ()=>{this.addFish(5)});

        appState.addButton("Remove Last Fish", ()=>{this.removeLastFish()});
        appState.addCheckboxControl("Feeding Mode", false);


    }

    /**
     * This function is a good place to preload files that the scene uses; things like textures and shaders.
     * In the final project, we will use a similar function to load 3D meshes.
     * @returns {Promise<void>}
     * @constructor
     */
    async PreloadAssets(): Promise<void> {
        await super.PreloadAssets();
        let appState = GetAppState();

        /**
         * We will talk about shaders later in the semester. For now, just know that each one of these is something like
         * a material used for rendering objects.
          */
        await appState.loadShaderMaterialModel(AMaterialManager.DefaultMaterials.INSTANCED_TEXTURE2D_SHADER);
        await appState.loadShaderMaterialModel(AMaterialManager.DefaultMaterials.PARTICLE_TEXTURE_2D_SHADER);
        await appState.loadShaderMaterialModel(DefaultMaterials.TEXTURED2D_SHADER);
        await this.loadTexture( "./images/gradientParticle.png", "GaussianSplat")
        await this.loadTexture("./images/white_circle.png", this.fishParticleTexture)
        this.labCatSVG = await SVGAsset.Load("./images/svg/LabCatVectorHead.svg");
        await LabCatFloationgHeadModel.PreloadAssets();
    }

    /**
     * Use this function to initialize the content of the scene.
     * Generally, this will involve creating instances of ANodeModel subclasses and adding them as children of the scene:
     * ```
     * let myNewModel = new MyModelClass(...);
     * this.addChild(myNewModel);
     * ```
     *
     * You may also want to add tags to your models, which provide an additional way to control how they are rendered
     * by the scene controller. See example code below.
     */
    async initScene(){
        let appState = GetAppState();

        // Create an instance of Lab Cat's floating head. Not as cool as the real Lab Cat, but still pretty cool.
        this.labCatFloatingHead = LabCatFloationgHeadModel.Create();
        // The geometry itself is a unit square that ranges from -0.5 to 0.5 in x and y. Let's scale it up x3.
        this.labCatFloatingHead.transform.scale = 3;

        // // Lab Cat on the scene. Or in the scene, I guess... Either way, this will cause the controller to make a view.
        // this.addChild(this.labCatFloatingHead);


        // Lab Cat on the scene... again!
        this.labCatVectorHead = new CustomSVGModel(this.labCatSVG);
        // this.addChild(this.labCatVectorHead);

        // Water Wave Model
        // this.waterWave = new WaterWaveModel(3, 0.05,1.2, new Vec2(0, 0));
        // this.addChild(this.waterWave);
        // console.log("ttttttttest");

        // Now let's create some particles...
        // Here we initialize our particle system. We will initialize to a relatively small number of particles here to
        // be safe, but you can probably increase this on most modern machines. I can run thousands on my machine just fine.
        this.particleSystem = new ExampleParticleSystemModel();

        this.fishFood = new FishFoodModel();
        this.addChild(this.fishFood);

        let particleMaterial = GetAppState().CreateShaderMaterial(DefaultMaterials.PARTICLE_TEXTURE_2D_SHADER);
        particleMaterial.setUniform("opacityInMatrix", true);
        this.bindParticleTexture(particleMaterial, "GaussianSplat");

        this.fishFood.setMaterial(particleMaterial);


        let maxNumParticles = 50;
        this.particleSystem.initParticles(maxNumParticles) // the number you pass here will be the maximum number of particles you can have at once for this particle system

        // For now, use this material that I've created for you. It will render each particle as the
        // pixel-wise product of a particle texture and an instance color. The texture I've used here is a simple blurry
        // dot. Can't go wrong with a blurry dot...
        // You can use a different texture if you want by putting it in the /public/images/ directory, loading it in
        // PreloadAssets() with its own name and assigning it here using that name instead of "GaussianSplat"
        particleMaterial.setUniform("opacityInMatrix", true);
        this.bindParticleTexture(particleMaterial, "GaussianSplat");
        this.particleSystem.setMaterial(particleMaterial)

        // Let's add the particle system, which will cause the scene controller to create a particle system view and add
        // it to our scene graph. Pretty sweet.
        // this.addChild(this.particleSystem);

        /** By default, objects are placed at a depth of 0. If you don't change this, then child objects will render on top of parents, and objects added to the scene later will be rendered on top of objects you added earlier. If you want to change this behavior, you can set the zValue of an object. The depth of an object will be the sum of zValues along the path that leads from its scene graph node to world space. Objects with higher depth values will be rendered on top of objects with lower depth values. Note that any depth value outside the scene's depth range will not be rendered. The depth range is [this.cameraModel.camera.zNear, this.cameraModel.camera.zFar] (defaults to [-5,5] at time of writing in 2024...)
         */
        this.addFish(3);
        this.addFish(3);



        // Here we will change the zValue of our particles so that they render behind Lab Cat...
        this.particleSystem.zValue = -0.01;


        // Alternatively, we could have made the particles a child of Lab Cat, which would cause them to move with Lab Cat.
        // this.labCatFloatingHead.addChild(this.particleSystem);

        appState.setState("Aquarium Zen", 1.0);
        appState.setReactGUIContentFunction(
            (props:{appState:AppState})=>{
                return (
                    <React.Fragment>
                    {`Aquarium Zen`}
                    </React.Fragment>
                );
            }
        );

    }


    /**
     * Our time update function.
     * @param t
     */
    timeUpdate(t: number) {
        let appState = GetAppState();
        const preset = appState.getState("presetColor");
        if (preset instanceof Color) {
            this.presetColor = preset;
        } else {
            this.presetColor = Color.White();
        }

        // if (this.foodMode && !this.children.includes(this.labCatVectorHead)){
        //     this.addChild(this.labCatVectorHead);
        // } else if (this.children.includes(this.labCatVectorHead) && !this.foodMode){
        //     this.removeChild(this.labCatVectorHead);
        // }

        // Delete Unsed Waves
        for (let i = this.waterWaves.length - 1; i >= 0; i--) {
            const wave = this.waterWaves[i];
            if (wave.currentStep >= wave.totalSteps) {
                this.removeChild(wave);
                this.waterWaves.splice(i, 1);
            }
        }

        this.subscribeToAppState("Feeding Mode", (enabled)=>{
            // set an attribute of this object to the value of the slider
            this.foodMode = enabled;
        })

        try {
            // This is a good strategy in general. It iterates over all of the models in the scene and calls the
            // individual `timeUpdate` functions for each model. If you don't have many interactions between models you
            // can usually implement most of your scene logic this way
            let updatesThisFrame = 0;
            this.mapOverDescendants((d)=>{
                // (d as ANodeModel).timeUpdate(t);
                const m = d as ANodeModel;
                m.timeUpdate?.(t);
                updatesThisFrame += 1;
            })

            this.fishes.forEach((fish) => {
                for (let i = 0; i < fish.nPoints && i < fish.particles.length; i++) {
                    fish.particles[i].setColor(Color.White());
                }
            });
        }catch(e) {
            if(nErrors<1){
                console.error(e);
                nErrors+=1;
            }
        }
    }


    /** Add a fish to the Scene
     * @param fish
     */
    addFish(code:number){
        // Keep fish color stable and white for the requested module style.
        const fishColor = Color.White();
        const fish1 = new FishSkeletonModel([0,0.25,0.75,1],
            3,
            0.7,
            0.5,
            0.6,
            2.5,
            [2,3,0.3,2],
            0.3,
            fishColor,
            this.fishFood, this);

        let fishModel = fish1;
        const fish2 = new FishSkeletonModel([0,0.25,0.75,1],
            1.5,
            0.2,
            0.8,
            1.2,
                1.5,
            [1,5,.5,2.5],
            0.3,
            fishColor,
            this.fishFood, this);

        const fish3 = new FishSkeletonModel([0,0.4,0.75,1],
            6,
            0.7,
            0.5,
            0.6,
            2.5,
            [2.5,3.5,0.5,3],
            0.3,
            fishColor,
            this.fishFood, this);

        let anchovySpeed = Math.random() * (0.75 - 0.4)
        const fish4 = new FishSkeletonModel([0,0.25,0.75,1],
            1,
            0.2,
            1,
            0.6,
            3,
            [0.66,1,0.1,0.66],
            0.3 + anchovySpeed,
            fishColor,
            this.fishFood, this);

        const fish5 = new FishSkeletonModel(
            [0, 0.5, 0.9, 1],
            10* 0.75,
            0.12,
            0.5,
            0.01,
            0.9,
            [10, 14* 0.75, 1* 0.75, 5],
            0.5,
            fishColor,
            this.fishFood,
            this
        );

        const fish6 = new FishSkeletonModel([0,0.4,0.75,1],
            8,
            1,
            1,
            1,
            0.5,
            [4,3.5,1,3],
            0.3,
            fishColor,
            this.fishFood, this);

        let fishes = [fish1, fish2, fish3, fish4, fish5,fish6];

        const fish = fishes[code];
        const b = (this as any).cameraModel?.getOrthoBounds?.();
        const bounds: Bounds = b
            ? { left: b.left, right: b.right, bottom: b.bottom, top: b.top }
            : DEFAULT_BOUNDS;
        bound = bounds;

        // 从四周随机生成
        const spawn = randomEdgeSpawn(bounds);
        // const spawn = new Vec2(0,0);

        fish.target = spawn;

        let particleMaterial = GetAppState().CreateShaderMaterial(DefaultMaterials.PARTICLE_TEXTURE_2D_SHADER);
        particleMaterial.setUniform("opacityInMatrix", true);
        this.bindParticleTexture(particleMaterial, this.fishParticleTexture);
        fish.setMaterial(particleMaterial);

        this.addChild(fish);

        (this.fishes ?? (this.fishes = [])).push(fish);
    }


    setTarget(target:Vec2){
        this.fishes[0].target = target;
    }

    checkFishClicked(position: Vec2) {
        for (let fish of this.fishes) {
            if (fish.checkCollision(position)) {
                fish.isTouched = true;
            }
            }
    }

    fireWaterWave(v: Vec2, r: number, s: number) {
        // console.log("Position at Scene Model: " + v.x + ", " + v.y);
        const wave = new WaterWaveModel({
            radius: r, particleRadius: 0.1, position: v,
            totalSteps: s, stepStride: 1,
            delaySteps: 0,              // 随机延迟 0~9 步
            initialStepOffset: Math.floor(Math.random()*Math.max(1, 0.1*120)), // 初始偏移
        });

        let particleMaterial = GetAppState().CreateShaderMaterial(DefaultMaterials.PARTICLE_TEXTURE_2D_SHADER);
        particleMaterial.setUniform("opacityInMatrix", true);
        this.bindParticleTexture(particleMaterial, this.splashParticleTexture);

        wave.setMaterial(particleMaterial);
        wave.zValue = 1
        // wave.fireParticles(v);
        this.addChild(wave);
        // this.addChild(wave.debugMode);
        this.waterWaves.push(wave);

    }

    AddFood(v: Vec2){
        this.fishFood.addFood(v)
    }




    removeLastFish(){
        if (this.fishes.length <= 0) return;
        let f = this.fishes.pop();
        if(f != undefined && this.children.includes(f)){
            this.removeChild(f);
        }
    }

    private bindParticleTexture(material: any, textureName: string) {
        const texture = this.getTexture(textureName);
        if (!texture) return;
        material.setTexture("diffuse", texture);
        material.setTexture("particle", texture);
    }
}
