import {
    ANodeModel3D,
    ASerializable,
    Vec3,
    V3,
    Mat4
} from "../../../../../anigraph";

export enum WindFieldEvents {
    WIND_UPDATED = "WIND_UPDATED"
}

@ASerializable("WindFieldModel")
export class WindFieldModel extends ANodeModel3D {
    gridResolution: Vec3 = V3(10, 5, 10);
    cellSize: number = 1.0;

    windVectors: Vec3[] = [];

    globalWindDirection: Vec3 = V3(1, 0, 0);
    globalWindStrength: number = 1.0;
    variability: number = 0.5;
    timeMultiplier: number = 1.0;

    public isVisual = true;

    constructor(x:number,y:number,z:number) {
        super();
        this.gridResolution = V3(x,y,z);
        this.initGrid();
    }

    initGrid() {
        const totalCount = this.gridResolution.x * this.gridResolution.y * this.gridResolution.z;
        this.windVectors = new Array(totalCount);
        for(let i=0; i<totalCount; i++){
            this.windVectors[i] = V3(0,0,0);
        }
    }

    public getWindForceAtPosition(worldPos: Vec3): Vec3 {
        const localPos = worldPos.minus(this.transform.getPosition()).times(1.0 / this.cellSize);

        const x0 = Math.floor(localPos.x);
        const y0 = Math.floor(localPos.y);
        const z0 = Math.floor(localPos.z);

        const u = localPos.x - x0;
        const v = localPos.y - y0;
        const w = localPos.z - z0;

        if (x0 < 0 || x0 >= this.gridResolution.x - 1 ||
            y0 < 0 || y0 >= this.gridResolution.y - 1 ||
            z0 < 0 || z0 >= this.gridResolution.z - 1) {
            return this.globalWindDirection.times(this.globalWindStrength);
        }

        const c000 = this.windVectors[this.getIndex(x0, y0, z0)];
        const c100 = this.windVectors[this.getIndex(x0+1, y0, z0)];
        const c010 = this.windVectors[this.getIndex(x0, y0+1, z0)];
        const c110 = this.windVectors[this.getIndex(x0+1, y0+1, z0)];

        const c001 = this.windVectors[this.getIndex(x0, y0, z0+1)];
        const c101 = this.windVectors[this.getIndex(x0+1, y0, z0+1)];
        const c011 = this.windVectors[this.getIndex(x0, y0+1, z0+1)];
        const c111 = this.windVectors[this.getIndex(x0+1, y0+1, z0+1)];

        // Trilinear interpolation
        const lerpX00 = c000.times(1-u).plus(c100.times(u));
        const lerpX10 = c010.times(1-u).plus(c110.times(u));
        const lerpX01 = c001.times(1-u).plus(c101.times(u));
        const lerpX11 = c011.times(1-u).plus(c111.times(u));

        const lerpY0 = lerpX00.times(1-v).plus(lerpX10.times(v));
        const lerpY1 = lerpX01.times(1-v).plus(lerpX11.times(v));

        return lerpY0.times(1-w).plus(lerpY1.times(w));
    }

    private getIndex(x: number, y: number, z: number): number {
        return x + y * this.gridResolution.x + z * this.gridResolution.x * this.gridResolution.y;
    }

    timeUpdate(t: number, ...args: any[]) {
        super.timeUpdate(t, ...args);

        const rx = this.gridResolution.x;
        const ry = this.gridResolution.y;
        const rz = this.gridResolution.z;

        const time = t * this.timeMultiplier;

        for(let z=0; z<rz; z++){
            for(let y=0; y<ry; y++){
                for(let x=0; x<rx; x++){
                    const idx = this.getIndex(x, y, z);

                    const noiseX = Math.sin(x * 0.5 + time) * this.variability;
                    const noiseY = Math.cos(y * 0.5 + time) * (this.variability * 0.2);
                    const noiseZ = Math.sin(z * 0.5 + time * 1.2) * this.variability;

                    const baseWind = this.globalWindDirection;
                    let currentVec = baseWind.plus(V3(noiseX, noiseY, noiseZ)).times(this.globalWindStrength);


                    this.windVectors[idx] = currentVec;
                }
            }
        }

        this.signalEvent(WindFieldEvents.WIND_UPDATED);
    }
}