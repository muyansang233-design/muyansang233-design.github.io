import {
    ALineMaterialModel,
    ANodeModel2D,
    ASerializable,
    Color, Curve2DModel, CurveInterpolationModes,
    V2,
    Vec2, Vector,
    VectorBase,
    VertexArray2D
} from "../../../../anigraph";
import {
    GetCubicBezierSplineSegmentValueForAlpha,
    GetCubicBezierSplineSegmentDerivativeForAlpha
} from "./CubicBezierFunctions";


@ASerializable("SplineModel")
export class SplineModel extends Curve2DModel{

    /**
     * We will have two interpolation modes: Linear, and CubicBezier.
     * These are set to the enum declared at the top of this file.
     * @type {CurveInterpolationModes}
     */
    static InterpolationModes=CurveInterpolationModes;

    /**
     * Getter and setter for `interpolationMode`, which wraps the protected variable _interpolationMode holding the
     * current interpolation mode for the spline.
     * */
    protected _interpolationMode:CurveInterpolationModes=CurveInterpolationModes.CubicBezier;
    /**
     * When the interpolation mode changes, we need to signal an update of the geometry.
     * @param value
     */
    set interpolationMode(value){
        this._interpolationMode = value;
        this.signalGeometryUpdate();
    }
    get interpolationMode(){return this._interpolationMode;}

    /**
     * Width/thickness of the control shape when it is visible
     * @type {number}
     */
    controlShapeWidth:number=0.003;
    /**
     * Whether the control shape is visible.
     * @type {boolean}
     */
    controlShapeVisible:boolean=true;

    /**
     * The number of control points in our spline.
     * This is simply the number of vertices in `this.verts`, which is a VertexArray2D inherited from `ANodeModel2D`,
     * which is a parent class.
     * @returns {number}
     */
    get nControlPoints():number{
        return this.verts.nVerts;
    }



    getControlPointLocation(index:number):Vec2{
        return this.verts.getPoint2DAt(index);
    }

    getControlPointColor(index:number):Color{
        return this.verts.color.getAt(index);
    }

    /**
     * There are 4 point in a cubic Bezier segment, and when we chain segments together we typically use the last
     * control point of each segment as the first control point of the subsequent segment.
     *
     * Here we give you a function that takes a segment index and returns the 4 corresponding control points.
     * @param segmentIndex
     * @returns {[Vec2, Vec2, Vec2, Vec2]}
     */
    getSegmentControlPoints(segmentIndex:number):[Vec2, Vec2, Vec2, Vec2]{
        let startHandle = segmentIndex*3
        return [
            this.verts.getPoint2DAt(startHandle),
            this.verts.getPoint2DAt(startHandle + 1),
            this.verts.getPoint2DAt(startHandle + 2),
            this.verts.getPoint2DAt(startHandle + 3)
        ]
    }

    /**
     * Similar to `getSegmentControlPoints`, we give you a function to get the colors stored at each of the control
     * points in the bezier segment with index `segmentIndex`.
     * @param segmentIndex
     * @returns {[Color, Color, Color, Color]}
     */
    getSegmentControlPointColors(segmentIndex:number):[Color, Color, Color, Color]{
        let startHandle = segmentIndex*3
        return [
            this.verts.color.getAt(startHandle),
            this.verts.color.getAt(startHandle + 1),
            this.verts.color.getAt(startHandle + 2),
            this.verts.color.getAt(startHandle + 3)
        ]
    }


    //###########################################//--Linear Interpolation--\\###########################################
    //<editor-fold desc="Linear Interpolation">

    /**
     * Returns a point `progress` along the linear interpolation of control points.
     * Remember, only the first and last point in each segment are interpolated!
     * @param progress
     * @returns {Vec2}
     */
    getLinearInterpolationPoint(progress:number):Vec2{
        if(this.nControlPoints<2){
            return V2();
        }
        let currentIndex = progress*(this.nControlPoints-2);
        let tfloor = Math.floor(currentIndex);

        let startControlPointIndex = tfloor;
        let startControlPoint = this.verts.getPoint2DAt(startControlPointIndex);

        let endControlPointIndex =Math.ceil(currentIndex);
        let endControlPoint = this.verts.getPoint2DAt(endControlPointIndex);

        let alpha = currentIndex-tfloor;

        /**
         * We've given you most of this function as an example of how to get control points by index.
         * From here, you need to return a point that is interpolated `alpha` along the way from `startControlPoint` to
         * `endControlPoint`...
         */

        return endControlPoint.times(alpha).plus(startControlPoint.times(1 - alpha));
    }


    /**
     * Colors can be represented as a vector of color channels. We can interpolate between these vectors in the same way
     * we interpolate between the coordinate vector representations of spline control points.
     *
     * Hint: AniGraph's Color class represents a 4D vector with channels [red, green, blue, alpha], and is implemented
     * as a subclass of VectorBase, which has element-wise `.plus()` and `.times()` operators, which can make
     * implementing this function much shorter.
     * @param progress
     * @returns {VectorBase | Vec2}
     */
    getLinearInterpolationColor(progress:number):Color{
        if(this.nControlPoints<2){
            if(this.nControlPoints>0) {
                return this.verts.color.getAt(0);
            }else{
                return Color.FromString("#000000")
            }
        }


        let currentIndex = progress*(this.nControlPoints-2);
        let tfloor = Math.floor(currentIndex);
        let tceil = Math.ceil(currentIndex);

        let alpha = currentIndex-tfloor;

        let startColor: Color = this.verts.color.getAt(tfloor);
        let endColor: Color = this.verts.color.getAt(tceil);

        return endColor.times(alpha).plus(startColor.times(1 - alpha));

    }

    /**
     * Returns a unit vector pointed toward the linearly interpolated shape's positive tangent `progress` along the
     * length of the shape. Make sure you still return a unit vector at control points, though we won't test you on
     * the direction of vectors at control points.
     * @param progress
     * @returns {Vec2}
     */
    getLinearInterpolationVelocity(progress:number):Vec2{
        if(this.nControlPoints<2){
            return V2();
        }

        let currentIndex = progress*(this.nControlPoints-2);
        let tfloor = Math.floor(currentIndex);
        let tceil = Math.ceil(currentIndex);

        let vec = this.verts.getPoint2DAt(tceil).minus(this.verts.getPoint2DAt(tfloor));
        vec.normalize();
        return vec;

    }
    //</editor-fold>
    //###########################################\\--Linear Interpolation--//###########################################


    //################################
    // ###############//--Cubic Bezier--\\###############################################
    //<editor-fold desc="Cubic Bezier">

    /**
     * The number of interpolated control points in the spline.
     * Review the online documentation for the assignment to figure out how the number of interpolated control points relates to the total number of
     * control points.
     * @returns {number}
     */
    get nInterpolatedControlPoints():number{
        if(this.nControlPoints == 0){
            return 0;
        } else if (this.nControlPoints < 4) {
            return 1;
        } else if (this.nControlPoints == 4) {
            return 2;
        }

        return Math.floor(((this.nControlPoints - 4) / 3) + 2);
    }

    /**
     * The number of spline segments. This should also be a function of the number of control points.
     * @returns {number}
     */
    get nBezierSegments():number{
        if(this.nControlPoints == 0){return 0}
        return this.nInterpolatedControlPoints - 1
    }

    constructor() {
        super();
    }

    /**
     * Progress of 0 should map to the first interpolated point of the spline. Progress of 1 should map to the last interpolated point.
     * A segment index of `n` where `n` is an integer should map to the first interpolated point of the nth segment.
     * values between n and n+1 should map linearly to progress along the nth segment.
     * @param progress
     * @returns {number}
     */
    continuousSegmentIndexForProgress(progress:number):number{
        if(this.nControlPoints<4){return 0}
        return Math.floor(progress * this.nBezierSegments);
    }

    /**
     * Should return the control point index for the kth interpolated point.
     * Remember that not every control point is an interpolated point.
     * @param interpolatedPointIndex
     * @returns {number}
     */
    getControlPointIndexForInterpolatedPoint(interpolatedPointIndex:number):number{
        // TODO TOBE DEBUGGED?
        if (interpolatedPointIndex < 3) {
            return 1
        } else if (interpolatedPointIndex == 3) {
            return 2
        }

        return (interpolatedPointIndex - 1) / 2
    }

    /**
     * Returns the point `progress` along the bezier spline interpolation of the control points
     * @param progress
     * @returns {VectorBase | Vec2}
     */
    getCubicBezierInterpolationPoint(progress:number):Vec2{
        if(this.nControlPoints<4){
            return this.getLinearInterpolationPoint(progress);
        }

        //Hint: you probably want to use GetCubicBezierSplineSegmentValueForAlpha here
        const segmentIndex = this.continuousSegmentIndexForProgress(progress);
        const alpha = progress * this.nBezierSegments - segmentIndex;
        const [p0, p1, p2, p3] = this.getSegmentControlPoints(segmentIndex);
        return GetCubicBezierSplineSegmentValueForAlpha(alpha, p0, p1, p2, p3);
    }

    /**
     * Returns the point `progress` along the bezier spline interpolation of the control points
     * @param progress
     * @returns {VectorBase | Vec2}
     */
    getCubicBezierInterpolatedColor(progress:number):Color{
        if(this.nControlPoints<4){
            return this.getLinearInterpolationColor(progress);
        }
        // Hint: you probably want to use GetCubicBezierSplineSegmentValueForAlpha
        const segmentIndex = this.continuousSegmentIndexForProgress(progress);
        const alpha = progress * this.nBezierSegments - segmentIndex;
        const [p0, p1, p2, p3] = this.getSegmentControlPointColors(segmentIndex);
        return GetCubicBezierSplineSegmentValueForAlpha(alpha, p0, p1, p2, p3);
    }

    /**
     * Returns the point `progress` along the bezier spline interpolation of the control points
     * @param progress
     * @returns {VectorBase | Vec2}
     */
    getCubicBezierVelocityVector(progress:number):Vec2{
        if(this.nControlPoints<4){
            return this.getLinearInterpolationVelocity(progress);
        }
        // Hint: you probably want to use GetCubicBezierSplineSegmentDerivativeForAlpha here
        const segmentIndex = this.continuousSegmentIndexForProgress(progress);
        const alpha = progress * this.nBezierSegments - segmentIndex;
        const [p0, p1, p2, p3] = this.getSegmentControlPoints(segmentIndex);
        return GetCubicBezierSplineSegmentDerivativeForAlpha(alpha, p0, p1, p2, p3);
    }
    //</editor-fold>
    //###############################################\\--Cubic Bezier--//###############################################




    getPointForProgress(progress:number){
        switch (this.interpolationMode){
            case SplineModel.InterpolationModes.Linear:
                return this.getLinearInterpolationPoint(progress);
            case SplineModel.InterpolationModes.CubicBezier:
                try {
                return this.getCubicBezierInterpolationPoint(progress);
                }catch(e){
                    console.error(e);
                    return this.getLinearInterpolationPoint(progress);
                }
            default:
                throw new Error(`Unknown interpolation mode ${this.interpolationMode}`);
        }
    }

    getDerivativeForProgress(progress:number){
        switch (this.interpolationMode){
            case SplineModel.InterpolationModes.Linear:
                return this.getLinearInterpolationVelocity(progress);
            case SplineModel.InterpolationModes.CubicBezier:
                try {
                    return this.getCubicBezierVelocityVector(progress);
                }catch(e){
                    console.error(e);
                    return this.getLinearInterpolationVelocity(progress);
                }
            default:
                throw new Error(`Unknown interpolation mode ${this.interpolationMode}`);
        }
    }

    getColorForProgress(progress:number){
        switch (this.interpolationMode){
            case SplineModel.InterpolationModes.Linear:
                return this.getLinearInterpolationColor(progress);
            case SplineModel.InterpolationModes.CubicBezier:
                try {
                return this.getCubicBezierInterpolatedColor(progress);
                }catch(e){
                    console.error(e);
                    return this.getLinearInterpolationColor(progress);
                }
            default:
                throw new Error(`Unknown interpolation mode ${this.interpolationMode}`);
        }
    }

}
