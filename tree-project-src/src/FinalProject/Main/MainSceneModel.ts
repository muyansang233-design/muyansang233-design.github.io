/**
 * @file Main scene model
 * @description Main model for your application
 */

import {
    AppState,
    GetAppState,
    NodeTransform3D,
    V3,
    Color,
    Mat4,
    ClassInterface, Quaternion
} from "../../anigraph";
import {ABasicSceneModel} from "../../anigraph/starter";
import {AssetManager} from "../../anigraph/fileio/AAssetManager";
import {TerrainModel} from "../StarterCode/CustomNodes/Terrain/TerrainModel";
import {MyTerrainModel} from "./Nodes/Terrain";
import {ADataTextureFloat4D} from "../../anigraph/rendering/image";
import {generateNoiseTexture} from "./Nodes/Terrain/generateNoiseTexture";


/**
 * This is your Main Model class. The scene model is the main data model for your application. It is the root for a
 * hierarchy of models that make up your scene/
 */
export class MainSceneModel extends ABasicSceneModel{

    terrain!: MyTerrainModel;
    private terrainSeed: number = 12345;
    private noiseTexture!: ADataTextureFloat4D;

    async PreloadAssets(): Promise<void> {
        await super.PreloadAssets()
        let appState = GetAppState();

        //Load some shaders
        await AssetManager.loadShaderMaterialModel(AssetManager.DEFAULT_MATERIALS.BLINNPHONG);

        // Load terrain shader
        await TerrainModel.LoadShaderModel();
    }


    /**
     * This will add variables to the control pannel
     * @param appState
     */
    initAppState(appState:AppState){
        // Terrain controls - defaults tuned for large-scale mountains
        // Frequency now uses normalized coordinates (0-1), so values are higher than before
        appState.addSliderIfMissing("TerrainFrequency", 6.5, 0.5, 20.0, 0.1);   // Lower = larger features
        appState.addSliderIfMissing("TerrainAmplitude", 5.7, 0.001, 30.0, 0.1);       // Higher = taller mountains
        // appState.addSliderIfMissing("TerrainOctaves", 6, 1, 10, 1);              // LOCKED: More octaves = more detail
        // appState.addSliderIfMissing("TerrainLacunarity", 2.0, 1.5, 4.0, 0.1);    // LOCKED: Frequency multiplier per octave
        // appState.addSliderIfMissing("TerrainPersistence", 0.35, 0.3, 0.7, 0.05); // LOCKED: How fast detail fades
        appState.addSliderIfMissing("TerrainResolution", 512, 16, 1024, 16);
        // Gradient trick: 0 = no erosion effect, higher = more smoothing on steep slopes
        // Using squared magnitude (dot(d,d)), so smaller values needed than linear magnitude
        appState.addSliderIfMissing("SlopeAttenuation", 0.20, 0.0, 2.0, 0.01);      // ~0.3-0.8 for nice erosion look
        // appState.addCheckboxControl("UseGaussianFalloff", false);                     // false = rational 1/(1+kx²), true = Gaussian exp(-kx²)
        
        // Circular island controls
        // appState.addSliderIfMissing("IslandSize", 10.0, 1.0, 30.0, 0.5);         // LOCKED: World-unit size
        // appState.addSliderIfMissing("IslandRadius", 0.45, 0.1, 0.5, 0.01);       // LOCKED: 0.5 = inscribed circle
        appState.addSliderIfMissing("CutoffHeight", -1.6, -2.0, 1.0, 0.1);          // Height outside boundary
        appState.addSliderIfMissing("EdgeFalloff", 0.08, 0.0, 0.3, 0.01);           // Smooth falloff width at edge
        
        // Shape controls
        appState.addSliderIfMissing("PlateauRadius", 0.10, 0.0, 0.4, 0.01);        // Flat plateau size in center
        appState.addSliderIfMissing("PlateauHeight", 0.0, 0.0, 5.0, 0.1);           // Height of the plateau
        appState.addSliderIfMissing("PlateauFalloffWidth", 0.1, 0.0, 0.3, 0.01);   // Plateau blend zone width
        // appState.addSliderIfMissing("ArcFraction", 0.75, 0.1, 1.0, 0.05);        // LOCKED: Fraction of circle
        // appState.addSliderIfMissing("ArcRotation", 320.0, 0.0, 360.0, 5.0);      // LOCKED: Rotation of arc in degrees
        // appState.addCheckboxControl("EnableMountains", true);                    // LOCKED: Toggle mountains on/off
        
        // Lake controls
        // appState.addSliderIfMissing("LakeRadius", 0.17, 0.05, 0.3, 0.01);       // Island lake radius
        // appState.addSliderIfMissing("LakeOffsetY", 0.30, 0.0, 0.3, 0.01);       // LOCKED at 0.30
        // appState.addSliderIfMissing("LakeNoiseFrequency", 2.5, 0.5, 10.0, 0.5);  // LOCKED: Noise detail scale
        // appState.addSliderIfMissing("LakeNoiseAmplitude", 0.48, 0.0, 1.0, 0.01); // LOCKED: Noise depth variation
        appState.addSliderIfMissing("LakeBowlDepth", 0.3, 0.0, 1.0, 0.01);  // Outer island lake bowl depth
        
        // Plateau lake controls (separate from island lake)
        appState.addSliderIfMissing("PlateauLakeRadius", 0.07, 0.01, 0.2, 0.01);  // Plateau lake radius
        appState.addSliderIfMissing("PlateauLakeBowlDepth", 0.0, 0.0, 1.0, 0.01);  // Plateau lake bowl depth
        
        // Plateau mountain controls (independent from island mountains)
        // Frequency now uses normalized coordinates (0-1), so values are higher than before
        appState.addSliderIfMissing("PlateauFrequency", 8.9, 0.5, 20.0, 0.1);  // Frequency for plateau mountains
        appState.addSliderIfMissing("PlateauAmplitude", 3.0, 0.1, 5.0, 0.1);  // Amplitude for plateau mountains
        appState.addSliderIfMissing("PlateauSlopeAttenuation", 0.29, 0.0, 2.0, 0.01);  // Plateau-specific slope attenuation
        // appState.addCheckboxControl("PlateauUseGaussian", false);  // Plateau-specific Gaussian falloff
        
        // Randomize terrain button
        appState.addButton("Randomize Terrain", () => {
            this.terrainSeed = Math.floor(Math.random() * 100000);
            this.regenerateTerrainFull();
        });
    }

    /**
     * Regenerate terrain with current parameters (just height map)
     */
    private regenerateTerrainHeightMap() {
        if (!this.terrain) return;
        const appState = GetAppState();
        const frequency = appState.getState("TerrainFrequency") ?? 6.5;
        const amplitude = appState.getState("TerrainAmplitude") ?? 5.7;
        const octaves = 6;  // LOCKED
        const lacunarity = 2.0;  // LOCKED
        const persistence = 0.35;  // LOCKED
        const slopeAttenuation = appState.getState("SlopeAttenuation") ?? 0.20;
        const useGaussian = appState.getState("UseGaussianFalloff") ?? false;
        const islandRadius = 0.45;  // LOCKED
        const cutoffHeight = appState.getState("CutoffHeight") ?? -1.6;
        const edgeFalloff = appState.getState("EdgeFalloff") ?? 0.08;
        const plateauRadius = appState.getState("PlateauRadius") ?? 0.11;
        const plateauFalloffWidth = appState.getState("PlateauFalloffWidth") ?? 0.1;
        const plateauHeight = appState.getState("PlateauHeight") ?? 0.0;
        const arcFraction = 0.75;  // LOCKED
        const arcRotationDeg = 320.0;  // LOCKED
        const enableMountains = true;  // LOCKED
        // Lake parameters
        const lakeRadius = appState.getState("LakeRadius") ?? 0.17;
        const lakeOffsetY = 0.30;  // LOCKED
        const lakeNoiseFrequency = 2.5;  // LOCKED
        const lakeNoiseAmplitude = 0.48;  // LOCKED
        const lakeBowlDepth = appState.getState("LakeBowlDepth") ?? 0.3;
        // Plateau lake parameters (separate from island lake)
        const plateauLakeRadius = appState.getState("PlateauLakeRadius") ?? 0.04;
        const plateauLakeBowlDepth = appState.getState("PlateauLakeBowlDepth") ?? 0.2;
        // Plateau mountain parameters (independent from island)
        const plateauFrequency = appState.getState("PlateauFrequency") ?? 2.0;
        const plateauAmplitude = appState.getState("PlateauAmplitude") ?? 2.2;
        const plateauSlopeAttenuation = appState.getState("PlateauSlopeAttenuation") ?? 0.29;
        const plateauUseGaussian = appState.getState("PlateauUseGaussian") ?? false;
        
        // Convert fraction to radians and degrees to radians
        const arcAngle = arcFraction * 2 * Math.PI;
        const arcStartAngle = (arcRotationDeg * Math.PI) / 180;
        
        this.terrain.reRollHeightMap(
            this.terrainSeed, frequency, amplitude, octaves, lacunarity, persistence,
            slopeAttenuation, useGaussian, islandRadius, cutoffHeight, edgeFalloff,
            plateauRadius, plateauFalloffWidth, plateauHeight, arcAngle, arcStartAngle, enableMountains,
            lakeRadius, lakeOffsetY, lakeNoiseFrequency, lakeNoiseAmplitude, lakeBowlDepth,
            plateauLakeRadius, plateauLakeBowlDepth, plateauFrequency, plateauAmplitude,
            plateauSlopeAttenuation, plateauUseGaussian,
            0.08, 0.6, 2.0,  // plateauMaskFrequency, plateauMaskThreshold, plateauMaskSharpness
            2 * Math.PI, 0.0, 1.5, 0.3, 1.0  // innerArcAngle, innerArcStartAngle, innerSparsityFrequency, innerSparsityThreshold, innerSparsitySharpness
        );
    }

    /**
     * Fully recreate terrain with new resolution/dimensions
     */
    private regenerateTerrainFull() {
        const appState = GetAppState();
        const resolution = appState.getState("TerrainResolution") ?? 512;
        const frequency = appState.getState("TerrainFrequency") ?? 6.5;
        const amplitude = appState.getState("TerrainAmplitude") ?? 5.7;
        const octaves = 6;  // LOCKED
        const lacunarity = 2.0;  // LOCKED
        const persistence = 0.35;  // LOCKED
        const slopeAttenuation = appState.getState("SlopeAttenuation") ?? 0.20;
        const useGaussian = appState.getState("UseGaussianFalloff") ?? false;
        const islandRadius = 0.45;  // LOCKED
        const cutoffHeight = appState.getState("CutoffHeight") ?? -1.6;
        const edgeFalloff = appState.getState("EdgeFalloff") ?? 0.08;
        const plateauRadius = appState.getState("PlateauRadius") ?? 0.11;
        const plateauFalloffWidth = appState.getState("PlateauFalloffWidth") ?? 0.1;
        const plateauHeight = appState.getState("PlateauHeight") ?? 0.0;
        const arcFraction = 0.75;  // LOCKED
        const arcRotationDeg = 320.0;  // LOCKED
        const enableMountains = true;  // LOCKED
        const islandSize = 10.0;  // LOCKED
        // Lake parameters
        const lakeRadius = appState.getState("LakeRadius") ?? 0.17;
        const lakeOffsetY = 0.30;  // LOCKED
        const lakeNoiseFrequency = 2.5;  // LOCKED
        const lakeNoiseAmplitude = 0.48;  // LOCKED
        const lakeBowlDepth = appState.getState("LakeBowlDepth") ?? 0.3;
        // Plateau lake parameters (separate from island lake)
        const plateauLakeRadius = appState.getState("PlateauLakeRadius") ?? 0.04;
        const plateauLakeBowlDepth = appState.getState("PlateauLakeBowlDepth") ?? 0.2;
        // Plateau mountain parameters (independent from island)
        const plateauFrequency = appState.getState("PlateauFrequency") ?? 2.0;
        const plateauAmplitude = appState.getState("PlateauAmplitude") ?? 2.2;
        const plateauSlopeAttenuation = appState.getState("PlateauSlopeAttenuation") ?? 0.29;
        const plateauUseGaussian = appState.getState("PlateauUseGaussian") ?? false;

        const arcAngle = arcFraction * 2 * Math.PI;
        const arcStartAngle = (arcRotationDeg * Math.PI) / 180;

        // remove old terrain
        if (this.terrain) {
            this.terrain.release();
        }

        const grayTexture = ADataTextureFloat4D.CreateSolid(4, 4, [0.5, 0.5, 0.5, 1.0]);
        this.terrain = MyTerrainModel.Create(
            grayTexture,
            islandSize,
            islandSize,
            resolution,
            resolution,
            undefined,
            1.0,  // terrainTextureWrapX
            1.0   // terrainTextureWrapY
        );
        this.addNode(this.terrain);
        
        this.terrain.setTerrainAspect(islandSize, islandSize);
        
        this.terrain.setNoiseTexture(this.noiseTexture);
        
        this.terrain.reRollHeightMap(
            this.terrainSeed, frequency, amplitude, octaves, lacunarity, persistence,
            slopeAttenuation, useGaussian, islandRadius, cutoffHeight, edgeFalloff,
            plateauRadius, plateauFalloffWidth, plateauHeight, arcAngle, arcStartAngle, enableMountains,
            lakeRadius, lakeOffsetY, lakeNoiseFrequency, lakeNoiseAmplitude, lakeBowlDepth,
            plateauLakeRadius, plateauLakeBowlDepth, plateauFrequency, plateauAmplitude,
            plateauSlopeAttenuation, plateauUseGaussian,
            0.08, 0.6, 2.0,  // plateauMaskFrequency, plateauMaskThreshold, plateauMaskSharpness
            Math.PI, 0.0, 1.5, 0.3, 1.0  // innerArcAngle, innerArcStartAngle, innerSparsityFrequency, innerSparsityThreshold, innerSparsitySharpness
        );
    }

    initCamera(...args: any[]) {
        const appState = GetAppState();

        // You can change your camera parameters here
        this.initPerspectiveCameraFOV(Math.PI/2, 1.0)

        // Camera position: further back and above for larger terrain, looking at center
        this.camera.setPose(NodeTransform3D.LookAt(V3(0, -12, 8), V3(0, 0, 0), V3(0, 0, 1)))
    }

    /**
     * Use this function to initialize the content of the scene.
     */
    initScene(){
        let appState = GetAppState();
        this.addViewLight();
        // Add Light
        this.addPointLight(
            new NodeTransform3D(V3(-30, 10, 10), Quaternion.Identity(), V3(1, 1, 1)),
            Color.FromString("#ffffff"),
            0.4, 500.0, 2.0
        );


        // Get initial values from app state
        const initialResolution = appState.getState("TerrainResolution") ?? 512;
        const initialSize = appState.getState("IslandSize") ?? 10.0;

        // Generate the noise texture once (for procedural terrain coloring)
        this.noiseTexture = generateNoiseTexture(512, 42);

        // Create a solid gray texture for the terrain (fallback)
        const grayTexture = ADataTextureFloat4D.CreateSolid(4, 4, [0.5, 0.5, 0.5, 1.0]);

        this.terrain = MyTerrainModel.Create(
            grayTexture,
            initialSize,
            initialSize,
            initialResolution,
            initialResolution,
            undefined,
            1.0,  // terrainTextureWrapX
            1.0   // terrainTextureWrapY
        );
        this.addNode(this.terrain);
        
        this.terrain.setTerrainAspect(initialSize, initialSize);
        
        this.terrain.setNoiseTexture(this.noiseTexture);

        this.subscribeToAppState("TerrainFrequency", () => this.regenerateTerrainHeightMap());
        this.subscribeToAppState("TerrainAmplitude", () => this.regenerateTerrainHeightMap());
        // this.subscribeToAppState("TerrainOctaves", () => this.regenerateTerrainHeightMap());  // LOCKED
        // this.subscribeToAppState("TerrainLacunarity", () => this.regenerateTerrainHeightMap());  // LOCKED
        // this.subscribeToAppState("TerrainPersistence", () => this.regenerateTerrainHeightMap());  // LOCKED
        this.subscribeToAppState("SlopeAttenuation", () => this.regenerateTerrainHeightMap());
        // this.subscribeToAppState("UseGaussianFalloff", () => this.regenerateTerrainHeightMap());
        // this.subscribeToAppState("IslandRadius", () => this.regenerateTerrainHeightMap());  // LOCKED
        this.subscribeToAppState("CutoffHeight", () => this.regenerateTerrainHeightMap());
        this.subscribeToAppState("EdgeFalloff", () => this.regenerateTerrainHeightMap());
        this.subscribeToAppState("PlateauRadius", () => this.regenerateTerrainHeightMap());
        this.subscribeToAppState("PlateauFalloffWidth", () => this.regenerateTerrainHeightMap());
        this.subscribeToAppState("PlateauHeight", () => this.regenerateTerrainHeightMap());
        this.subscribeToAppState("PlateauFrequency", () => this.regenerateTerrainHeightMap());
        this.subscribeToAppState("PlateauAmplitude", () => this.regenerateTerrainHeightMap());
        this.subscribeToAppState("PlateauSlopeAttenuation", () => this.regenerateTerrainHeightMap());
        // this.subscribeToAppState("PlateauUseGaussian", () => this.regenerateTerrainHeightMap());
        // lake shit
        this.subscribeToAppState("LakeRadius", () => this.regenerateTerrainHeightMap());  // Island lake
        this.subscribeToAppState("LakeBowlDepth", () => this.regenerateTerrainHeightMap());  // Island lake bowl depth
        this.subscribeToAppState("PlateauLakeRadius", () => this.regenerateTerrainHeightMap());  // Plateau lake
        this.subscribeToAppState("PlateauLakeBowlDepth", () => this.regenerateTerrainHeightMap());  // Plateau lake bowl depth
        // this.subscribeToAppState("LakeOffsetY", () => this.regenerateTerrainHeightMap());  // LOCKED at 0.30
        // this.subscribeToAppState("LakeNoiseFrequency", () => this.regenerateTerrainHeightMap());  // LOCKED
        // this.subscribeToAppState("LakeNoiseAmplitude", () => this.regenerateTerrainHeightMap());  // LOCKED
        // this.subscribeToAppState("ArcFraction", () => this.regenerateTerrainHeightMap());  // LOCKED
        // this.subscribeToAppState("ArcRotation", () => this.regenerateTerrainHeightMap());  // LOCKED
        // this.subscribeToAppState("EnableMountains", () => this.regenerateTerrainHeightMap());  // LOCKED
        
        this.subscribeToAppState("TerrainResolution", () => this.regenerateTerrainFull());
        // this.subscribeToAppState("IslandSize", () => this.regenerateTerrainFull());  // LOCKED

        this.regenerateTerrainHeightMap();
    }


    /**
     * Update the model with time here.
     * If no t is provided, use the model's time.
     * If t is provided, use that time.
     * You can decide whether to couple the controller's clock and the model's. It's usually good practice to have the model run on a separate clock.
     * @param t
     */
    timeUpdate(t?: number):void;
    timeUpdate(...args:any[])
    {
        let t = this.clock.time;
        if(args != undefined && args.length>0){
            t = args[0];
        }

        for (const node of this.getNodeModels()) {
            node.timeUpdate(t);
        }
        /**
         * If you want to update the react GUI components
         */
        GetAppState().updateComponents();

    }
};
