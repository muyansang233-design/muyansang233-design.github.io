import {
    VertexArray3D
} from "../../../geometry";
import {V2, V3, V4} from "../../../math";
import {AGroupCallbackSwitch, ASerializable} from "../../../base";
import {ACameraModel, ATriangleMeshModel} from "../../../scene";

const CAMERA_MODEL_LISTENER_HANDLE = "CAMERA_MODEL_LISTENER_HANDLE";

@ASerializable("ABackgroundQuadModel")
export class ABackgroundQuadModel extends ATriangleMeshModel{
    cameraModel!:ACameraModel;
    _cameraModelListenerSwitch!:AGroupCallbackSwitch;

    constructor(cameraModel?:ACameraModel) {
        let verts = VertexArray3D.CreateForRendering(false, true);
        verts.addVertex(V3(-1,-1,0),undefined, V2(0,0))
        verts.addVertex(V3(1,-1,0),undefined, V2(1,0))
        verts.addVertex(V3(1,1,0),undefined, V2(1,1))
        verts.addVertex(V3(-1,1,0),undefined, V2(0,1))
        verts.addTriangleIndices(0,1,2);
        verts.addTriangleIndices(2,3,0);
        super(verts);
        if(cameraModel){
            this.setCameraModel(cameraModel);
        }
    }

    setCameraModel(cameraModel:ACameraModel){
        this.cameraModel = cameraModel;
        const self = this;
        if(this._cameraModelListenerSwitch){
            this._cameraModelListenerSwitch.deactivate()
        }
        this._cameraModelListenerSwitch = cameraModel.addCameraChangeListener(
            ()=>{
                self.onCameraUpdate();
            },
            CAMERA_MODEL_LISTENER_HANDLE
        )
        this.onCameraUpdate();
    }



    onCameraUpdate():void{
        let epsilon = 0.1;
        let PVinv = this.cameraModel.camera.PV.getInverse();
        // let zval = 1-epsilon;
        // let zval = -1+epsilon;
        let zval = 1-epsilon;
        let corners = [
            PVinv.times(V4(-1,-1,zval,1)).Point3D,
            PVinv.times(V4(1,-1,zval,1)).Point3D,
            PVinv.times(V4(1,1,zval,1)).Point3D,
            PVinv.times(V4(-1,1,zval, 1)).Point3D,
        ]
        // this.verts.position.updateElements(corners);

        let verts = VertexArray3D.CreateForRendering(false, true);
        verts.addVertex(corners[0], undefined, V2(0,0));
        verts.addVertex(corners[1], undefined, V2(1,0));
        verts.addVertex(corners[2], undefined, V2(1,1));
        verts.addVertex(corners[3], undefined, V2(0,1));
        verts.addTriangleIndices(0,1,2);
        verts.addTriangleIndices(2,3,0);
        this.setVerts(verts);

    }


    static CreateForCameraModel(cameraModel:ACameraModel, ...args:any[]){
        return new this(cameraModel);
    }
}

