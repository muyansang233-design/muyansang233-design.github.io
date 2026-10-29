// Original author: Jan Mroz (jaszunio15), as credited in the supplied code.
// CC BY 3.0: https://creativecommons.org/licenses/by/3.0/
// Modified 2026-10-16: independent layers and parameterized screenshot behavior.
// Custom node output type: CMOT Float3. Inputs are supplied by the clipboard graph.
// UV and downward motion follow the screenshot; cell hashing follows the supplied code.

const float eps = 0.000001;
float2 p = (UV * 2.0 - 1.0) * max(abs(UVScale), eps);
float globalTime = TimeIn * TimeSpeed;
float d = 99999.0;

[unroll]
for (int layer = 0; layer < 2; ++layer)
{
    float t = globalTime * (layer == 0 ? Grid1TimeSpeed : Grid2TimeSpeed);
    float scale = max(layer == 0 ? Grid1Scale : Grid2Scale, 0.001);
    float fallSpeed = layer == 0 ? Grid1FallSpeed : Grid2FallSpeed;
    float swayAmplitude = layer == 0 ? Grid1SwayAmplitude : Grid2SwayAmplitude;
    float swaySpeed = layer == 0 ? Grid1SwaySpeed : Grid2SwaySpeed;
    float swayPhase = layer == 0 ? Grid1SwayPhase : Grid2SwayPhase;
    float rangeMin = layer == 0 ? Grid1RangeMin : Grid2RangeMin;
    float rangeMax = layer == 0 ? Grid1RangeMax : Grid2RangeMax;
    float shrink = layer == 0 ? Grid1Shrink : Grid2Shrink;
    float vScale = layer == 0 ? Grid1VScale : Grid2VScale;
    float vOffset = layer == 0 ? Grid1VOffset : Grid2VOffset;
    float shiftAmplitude = layer == 0 ? Grid1ShiftAmplitude : Grid2ShiftAmplitude;
    float shiftSpeed = layer == 0 ? Grid1ShiftSpeed : Grid2ShiftSpeed;
    float cellMerge = max(layer == 0 ? Grid1CellMerge : Grid2CellMerge, 0.0);
    float jitterAmplitude = clamp(layer == 0 ? Grid1JitterAmplitude : Grid2JitterAmplitude, 0.0, 0.5);
    float jitterSpeed = layer == 0 ? Grid1JitterSpeed : Grid2JitterSpeed;
    float stretchSpeed = max(layer == 0 ? Grid1StretchSpeed : Grid2StretchSpeed, 0.0);
    float maxStretch = clamp(layer == 0 ? Grid1MaxStretch : Grid2MaxStretch, 1.0, 3.0);

    // Positive FallSpeed moves the visible pattern down when UV.y increases downwards.
    float2 movement = float2(
        sin(t * swaySpeed + swayPhase) * swayAmplitude,
        -t * fallSpeed
    );
    float2 dotShift = float2(0.0, vOffset + sin(t * shiftSpeed) * shiftAmplitude);
    float radial = length(p * float2(1.0, vScale) - dotShift);

    // Equivalent to the screenshot's reversed smoothstep for RangeMin < RangeMax.
    // Equal endpoints become a hard cutoff. Reversed endpoints reverse the envelope.
    float envelope;
    if (abs(rangeMax - rangeMin) <= eps)
        envelope = 1.0 - step(rangeMin, radial);
    else if (rangeMax > rangeMin)
        envelope = 1.0 - smoothstep(rangeMin, rangeMax, radial);
    else
        envelope = smoothstep(rangeMax, rangeMin, radial);

    // Negative radii are intentional: they let dots disappear outside the envelope.
    float radius = envelope - shrink;
    float stretch = min(1.0 + max(t, 0.0) * stretchSpeed, maxStretch);
    float2 gp = (p + movement) * scale;
    float2 cellBase = floor(gp);
    float gd = 99999.0;

    [unroll]
    for (int x = -1; x <= 1; ++x)
    {
        [unroll]
        for (int y = -3; y <= 3; ++y)
        {
            // Screenshot: 3 x 3. Optional stretch retains the original 3 x 7 search.
            if (stretch <= 1.0 && abs(y) > 1)
                continue;

            float2 cell = cellBase + float2(x, y);
            float hash = frac(sin(dot(cell, float2(127.1, 311.7))) * 43758.5453);
            float phase = hash * 532.121 + t * jitterSpeed;
            float2 center = cell + float2(sin(phase), cos(phase)) * jitterAmplitude + 0.5;
            float2 delta = gp - center;
            delta.y /= stretch;
            float sd = length(delta) - radius;

            if (cellMerge > eps)
            {
                float h = saturate((gd - sd) / cellMerge * 0.5 + 0.5);
                gd = lerp(gd, sd, h) - h * (1.0 - h) * cellMerge;
            }
            else
                gd = min(gd, sd);
        }
    }
    gd /= scale;

    if (layer == 0)
    {
        d = gd;
        // The screenshot disables this circle. It is retained as an optional old feature.
        if (CenterEnabled > 0.5)
        {
            float centerDistance = length(p) - MainRadius;
            float merge = max(Grid1Merge, 0.0);
            if (merge > eps)
            {
                float h = saturate((centerDistance - d) / merge * 0.5 + 0.5);
                d = lerp(centerDistance, d, h) - h * (1.0 - h) * merge;
            }
            else
                d = min(centerDistance, d);
        }
    }
    else
    {
        float merge = max(Grid2Merge, 0.0);
        if (merge > eps)
        {
            float h = saturate((d - gd) / merge * 0.5 + 0.5);
            d = lerp(d, gd, h) - h * (1.0 - h) * merge;
        }
        else
            d = min(d, gd);
    }
}

// Raw signed field before the final smoothstep/color mapping.
SDF = d;

// Final smoothstep thresholds: EdgeMin * BorderWidth and EdgeMax * BorderWidth.
float edgeA = EdgeMin * abs(BorderWidth);
float edgeB = EdgeMax * abs(BorderWidth);
float positive;
if (abs(edgeB - edgeA) <= eps)
    positive = step(edgeA, d);
else if (edgeB > edgeA)
    positive = smoothstep(edgeA, edgeB, d);
else
    positive = 1.0 - smoothstep(edgeB, edgeA, d);

// The clipboard graph retains the original OneMinus -> Saturate after this output.
return lerp(InsideColor, OutsideColor, positive);
