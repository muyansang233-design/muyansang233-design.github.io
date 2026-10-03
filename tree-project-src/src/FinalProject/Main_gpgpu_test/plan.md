# WebGL GPGPU SPH Implementation Plan

This plan details how to move your SPH fluid simulation from CPU to GPU using WebGL 2.0 and `GPUComputationRenderer`. This will allow you to simulate thousands of particles (e.g., 16k+) at 60 FPS.

## Part 1: Conceptual Knowledge You Must Master

Before writing code, you must understand these core concepts:

1.  **Texture as Data (DataTextures)**

    -   In GPGPU, we don't use `Array` to store data. We use **Floating Point Textures**.
    -   Think of a $128 \times 128$ texture not as an image, but as an array of $16,384$ particles.
    -   **RGBA Channels**: A single pixel `vec4(r, g, b, a)` stores 4 floats.
        -   Position Texture: `r=x`, `g=y`, `b=z`, `a=mass/type`
        -   Velocity Texture: `r=vx`, `g=vy`, `b=vz`, `a=unused`

2.  **The Ping-Pong Technique**

    -   GPUs cannot read and write to the same texture simultaneously (Feedback Loop).
    -   **Solution**: Create two copies for every data texture (Current & Next).
    -   **Read** from `Texture_A`, **Write** to `Texture_B`. Next frame, swap them.

3.  **Fragment Shader Physics**

    -   Instead of a `for` loop in TypeScript, you write a `main()` function in GLSL.
    -   This function runs for **every pixel** (every particle) in parallel.
    -   To read neighbor data, you cannot just access `particles[j]`. You must "sample" the texture at specific UV coordinates.

4.  **Vertex Shader Displacement**

    -   Your `WaterParticleView` will no longer update `InstancedMesh` matrices on the CPU.
    -   Instead, you write a **Vertex Shader** that reads the *Position Texture* and moves the generic sphere geometry to the correct world location.

## Part 2: Implementation Steps

### Step 1: Setup `GPUComputationRenderer`

Since `three` is v0.142.0, you likely need to import `GPUComputationRenderer` from examples.

-   **Location**: Create a new file `src/FinalProject/Main/GPGPU/FluidSimulator.ts`.
-   **Action**: Initialize the renderer.
    ```typescript
    import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer';
    // Initialize with texture size (e.g., 128x128 for 16k particles)
    const gpuCompute = new GPUComputationRenderer(WIDTH, WIDTH, renderer);
    ```


### Step 2: Initialize Data

-   Create initial `DataTexture`s filled with random positions and zero velocities.
-   **File**: `FluidSimulator.ts`
-   **Key Code**:
    ```typescript
    const dtPosition = gpuCompute.createTexture();
    const dtVelocity = gpuCompute.createTexture();
    // Fill dtPosition.image.data with float32 array of x,y,z...
    ```


### Step 3: Write the GLSL Shaders (The Hard Part)

You need two main shader files (as strings in TS or .glsl files):

1.  **`PositionShader.glsl`**:

    -   Reads `texturePosition` and `textureVelocity`.
    -   Updates: `pos += vel * dt`.
    -   Handles boundary collision (simple box).

2.  **`VelocityShader.glsl`**:

    -   **Input**: `texturePosition`, `textureVelocity`, uniforms (gravity, radius, mousePos).
    -   **Logic**:

        1.  Sample self position/velocity.
        2.  **Loop through all particles**:

            -   `for (float y=0.0; y<height; y++)`
            -   `for (float x=0.0; x<width; x++)`
            -   Convert (x,y) to UV: `vec2 uv = vec2(x+0.5, y+0.5) / resolution.xy`
            -   Read neighbor pos: `texture2D(texturePosition, uv)`
            -   Calculate distance $r$.
            -   If $r < h$, add Density/Pressure force.
    -   **Output**: New velocity `vec4`.

### Step 4: Integrate into `MainSceneController`

-   Instantiate `FluidSimulator` in `MainSceneController`.
-   In `onAnimationFrameCallback`:

    1.  Update uniforms (time, mouse interaction).
    2.  `gpuCompute.compute()`.
    3.  **Crucial**: Extract the result texture: `gpuCompute.getCurrentRenderTarget(posVariable).texture`.

### Step 5: Render with `WaterParticleView`

-   Modify `WaterParticleView.ts`.
-   Instead of `MeshBasicMaterial`, use `THREE.ShaderMaterial`.
-   **Vertex Shader**:
    ```glsl
    uniform sampler2D uParticlePos; // Input texture
    attribute vec2 aReference;      // (u,v) coordinate for this instance
    
    void main() {
        vec4 posData = texture2D(uParticlePos, aReference); // Read pos from texture
        vec3 pos = posData.xyz;
        
        // Standard instance logic + texture offset
        vec4 mvPosition = modelViewMatrix * vec4(pos + position * scale, 1.0);
        gl_Position = projectionMatrix * mvPosition;
    }
    ```

-   **Geometry Setup**:
    -   You must add a new attribute `aReference` to your `InstancedBufferGeometry`.
    -   This attribute tells instance $i$ which pixel in the texture belongs to it.

## Part 3: What to do next?

1.  Confirm if you want to proceed with this **Naive GPGPU (O(N^2))** approach. It is the easiest to implement and works for ~10k particles.
2.  If yes, I will guide you to create the `FluidSimulator.ts` class first.