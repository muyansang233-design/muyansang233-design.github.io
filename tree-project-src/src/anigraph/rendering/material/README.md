

## Classes

### Loading GLSL code from files with AssetManager.shaders (ShaderManager)
[AssetManager.ts] exports `AssetManager` which has `AssetManager.shaders`, which is a const instance of `AShaderSourceManager`:

This provides a global library of the loaded GLSL shaders. 

If you load a shader using:
```typescript
AssetManager.shaders.LoadShader(SHADER_NAME);
```
this will load the shader at path [public/shaders/#SHADER_NAME](../../../../public/shaders/README.md), defined by `public/shaders/#SHADER_NAME/#SHADERNAME.vert.glsl` and `public/shaders/#SHADER_NAME/#SHADERNAME.frag.glsl`.

The function itself returns a `ShaderPromise` which is a `Promise<AShaderProgramSource>`.




## AMaterialModels \& AMaterials
`AMaterialModels` are basically a template for creating a material.
`AMaterial` is an instance of that material with its own values for uniforms.
The actual THREE.Material for an AMaterial is created by calling it's model's `_CreateTHREEJS` function.


- AShaderManager: 
- AMaterialManager
