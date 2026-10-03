import {
    ANodeView,
    AObject,
    Mat4,
    V3,
    Quaternion,
    Vec3
} from "../../../../../anigraph";
import {WindFieldModel, WindFieldEvents} from "./WindFieldModel";
import * as THREE from "three";

export class WindFieldView extends ANodeView {
    get model(): WindFieldModel {
        return this._model as WindFieldModel;
    }

    private arrowsMesh: THREE.InstancedMesh | null = null;
    private dummyObj = new THREE.Object3D();

    init(): void {
        this.subscribe(this.model.addEventListener(WindFieldEvents.WIND_UPDATED, () => {
            this.updateArrows();
        }));

        this.initVisuals();
    }

    initVisuals() {
        const resolution = this.model.gridResolution;
        const count = resolution.x * resolution.y * resolution.z;

        const geometry = new THREE.BoxGeometry(0.05, 0.05, 0.5);
        geometry.translate(0, 0, 0.25);

        const material = new THREE.MeshBasicMaterial({color: 0x00ff00, transparent: true, opacity: 0.6});
        this.arrowsMesh = new THREE.InstancedMesh(geometry, material, count);

        this.threejs.add(this.arrowsMesh);
    }

    updateArrows() {
        if (!this.arrowsMesh) return;
        if (!this.model.isVisual) {
            this.arrowsMesh.visible = false;
            return;
        } else {
            this.arrowsMesh.visible = true;
        }

        const resolution = this.model.gridResolution;
        const cellSize = this.model.cellSize;
        const vectors = this.model.windVectors;

        let index = 0;

        // Traversal the grid and update the arrows' positions and scales'
        for(let z=0; z<resolution.z; z++){
            for(let y=0; y<resolution.y; y++){
                for(let x=0; x<resolution.x; x++){

                    // Get wind vector at this grid cell
                    const windVec = vectors[index];
                    const windSpeed = windVec.length

                    if(windSpeed < 0.001) {
                        this.dummyObj.scale.set(0,0,0);
                    } else {
                        this.dummyObj.position.set(x * cellSize, y * cellSize, z * cellSize);

                        const targetPos = this.dummyObj.position.clone().add(new THREE.Vector3(windVec.x, windVec.y, windVec.z));
                        this.dummyObj.lookAt(targetPos);

                        const scale = Math.min(windSpeed * 0.5, cellSize * 0.8);
                        this.dummyObj.scale.set(1, 1, scale);
                    }

                    this.dummyObj.updateMatrix();
                    this.arrowsMesh.setMatrixAt(index, this.dummyObj.matrix);
                    index++;
                }
            }
        }
        this.arrowsMesh.instanceMatrix.needsUpdate = true;
    }

    update(...args:any[]): void {
        super.updateTransform()
        this.updateArrows();
    }
}