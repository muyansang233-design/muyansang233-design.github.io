// Teaching order: these are material branches, not eight GPU render passes.
// Original graph: source/M_Water.normalized.json and source/M_Water_Inst.normalized.json.
// Web extension requested by the user: stage 7 shares UV distortion with WPO too.
// Instance scalar overrides: source/instance-parameters.json.
// The saved M_Water_325ec895cab4e2b8 HLSL confirms the core branch operations.
// Its older WaterCurtain custom code differs from the current asset; that branch
// is disabled by UseCurtainMask in M_Water_Inst and is excluded from this lesson.
// Formula notation: sat(x) = clamp(x, 0, 1); texture powers are component-wise.
// F = 0.04 + 0.96 * (1 - max(dot(N, V), 0))^5.

export const stages = [
  {
    id: 1,
    key: "wpo",
    title: "World Position Offset",
    name: "几何起伏",
    textures: [
      { name: "T_GradationPattern", src: "./assets/T_GradationPattern.png?v=4", usage: "渐变高度，形成主要起伏" },
      { name: "LowResBlurredNoise", src: "./assets/LowResBlurredNoise.png?v=4", usage: "低频噪声，叠加不规则位移" },
    ],
    summary: "先让球体轮廓流动：两张移动纹理叠成位移量，沿顶点法线推动网格。",
    logic: "渐变纹理与低频噪声分别用时间和速度平移 UV，再按各自的平铺数采样。两路采样值先做幂运算，调整高低起伏的分布，再乘强度；最后相加并减去 1，得到推动表面的位移量。本层先使用未扰动的坐标，第七层再将共享偏移加入这两路纹理的 UV。\n\n用顶点法线与上下方向的点积判断它离极点有多近，经过平滑过渡生成遮罩，让极点附近的位移逐渐减弱。位移量乘上遮罩，再乘顶点法线，得到世界空间位移。网页按展示要求将扰动扩展到这条支路，所以第七层也会改变几何起伏的分布；原 Unreal 图的两路 WPO 并未接入这份扰动。",
    formula: "h = 8 × G^0.45 + 10 × B^2 − 1\nmask = 1 − smoothstep(0.9, 1, N.z) − smoothstep(0.9, 1, −N.z)\nWPO = N × h × mask",
    nodes: [
      { label: "UV + Time × Speed", type: "input" },
      { label: "Gradation + Blurred Noise", type: "input" },
      { label: "Power → Scalar → Add − 1", type: "operation" },
      { label: "Vertex Normal × Pole Mask", type: "operation" },
      { label: "World Position Offset", type: "output" },
    ],
    parameters: ["Vertex_Power", "Vertex_Scalar", "VertexMaskRange", "WaterVertex_Speed_U", "WaterVertex_Speed_V", "WaterVertexNoise_Power", "WaterTextureNoise_Scalar"],
  },
  {
    id: 2,
    key: "flow",
    title: "UV Flow",
    name: "流动坐标",
    textures: [],
    summary: "先让采样坐标随时间平移，水体与泡沫各自使用独立速度，建立两路流动节奏。",
    logic: "从球体的原始 UV 出发，将时间分别乘 U、V 方向的速度，再加回原始坐标。时间持续增加，纹理采样位置便沿设定方向匀速平移；随后再乘平铺数，决定纹理在表面重复的次数，此时还没有加入局部扰动。\n\n水体与泡沫使用两组独立的速度和平铺参数：水体坐标供后续水色、细节法线和透明度共用，泡沫坐标则控制泡沫自己的移动节奏。两路都遵循先平移、再平铺的顺序，使后续纹理保持连续流动，也能彼此错开。",
    formula: "uvWater = (uv + t × waterSpeed) × waterTile\nuvFoam = (uv + t × foamSpeed) × foamTile",
    nodes: [
      { label: "Original UV + Time", type: "input" },
      { label: "Time × Water / Foam Speed", type: "operation" },
      { label: "Add Original UV", type: "operation" },
      { label: "× Water / Foam Tile", type: "operation" },
      { label: "Flowing Water UV / Foam UV", type: "output" },
    ],
    parameters: ["WaterTexture_U_speed", "WaterTexture_V_speed", "WaterTexture_Tile_U", "WaterTexture_Tile_V", "Foam_U_Speed", "Foam_V_Speed", "FoamTile_U", "FoamTile_V"],
  },
  {
    id: 3,
    key: "normals",
    title: "Detail Normals",
    name: "细节法线",
    textures: [
      { name: "water_n", src: "./assets/water_n.png?v=4", usage: "基础水纹法线" },
      { name: "T_Water_N", src: "./assets/T_Water_N.png?v=4", usage: "叠加细节法线" },
    ],
    summary: "把两张法线纹理混合成细密水纹，为后续水色、反射与折射提供表面方向。",
    logic: "用流动的水体 UV 同时采样 water_n 与 T_Water_N，将纹理解码为切线空间法线。接着做角度修正混合，把第二张纹理的方向变化叠加到第一张上，保留两张纹理共同形成的水纹细节。本层先展示未扰动的法线，后续扰动层再改变采样坐标。\n\n混合后只对 XY 分量乘法线强度，保留 Z 分量，再归一化并转换到世界空间。得到的像素法线会参与视角权重、反射、高光和折射计算，因此细小波纹能改变光学效果，而球体轮廓仍由第一层的顶点位移决定。",
    formula: "n₁ = decodeNormal(water_n(uvWater))\nn₂ = decodeNormal(T_Water_N(uvWater))\nn = BlendAngleCorrectedNormals(n₁, n₂)\nN = normalize(TBN × vec3(n.xy × NormalScalar, n.z))",
    nodes: [
      { label: "WaterTexture_UV", type: "input" },
      { label: "water_n + T_Water_N", type: "input" },
      { label: "BlendAngleCorrectedNormals", type: "operation" },
      { label: "RG × NormalScalar + B", type: "operation" },
      { label: "WaterNormal", type: "output" },
    ],
    parameters: ["NormalScalar"],
  },
  {
    id: 4,
    key: "color",
    title: "Water Color & Absorption",
    name: "水色与吸收感",
    textures: [
      { name: "T_WaterColor", src: "./assets/T_WaterColor.png?v=4", usage: "去色后提供水色的明暗结构" },
    ],
    summary: "把颜色纹理转为明暗结构，再以 Fresnel 调整水色，让正面与掠射角呈现不同色调。",
    logic: "用水体 UV 采样 T_WaterColor，将颜色按亮度权重转成灰度；当前实例完全去色，只保留流动的明暗结构。随后通过幂运算调整明暗分布，再乘强度，控制这份纹理对水色的贡献。\n\n另一条支路根据法线与视线的夹角计算 Fresnel 权重，越接近掠射角，权重越大。将权重平方后，在深蓝绿色与白色之间插值，再与前面的纹理结果相乘，形成正面较深、边缘较浅的水色与吸收感。",
    formula: "textureColor = pow(desaturate(T_WaterColor(uvWater), 1), 1) × 1.714566\ntint = mix(vec3(0.127853, 0.341405, 0.40625), vec3(1), F^2)\nwaterColor = textureColor × tint",
    nodes: [
      { label: "T_WaterColor", type: "input" },
      { label: "Desaturation → Power → Scalar", type: "operation" },
      { label: "Param ↔ White / Fresnel²", type: "operation" },
      { label: "Multiply", type: "operation" },
      { label: "Water Color", type: "output" },
    ],
    parameters: ["WaterTexture_preDesaturation", "WaterTexture_Power", "WaterTexture_Scalar", "Absorbtion Fresnel_Power"],
  },
  {
    id: 5,
    key: "reflection",
    title: "Reflection & Specular",
    name: "环境反射与高光",
    textures: [],
    summary: "让法线细节显现：反射向量采样环境贴图，同时计算朝向天空光的集中高光。",
    logic: "根据视线和像素法线求出反射方向，用它读取环境颜色。环境颜色先去色，再乘由 Fresnel 控制的强度，让不同观察角度呈现不同的反射亮度；法线里的细小变化也会改变所采样的环境位置。\n\n高光单独计算：将反射方向与光照方向做点积，减去范围阈值后钳制、归一化，只保留接近光源方向的区域。再用幂运算调整形状，乘高光强度与光照颜色。环境反射和高光最后与水色相加，写入 Unlit 材质的自发光输出。",
    formula: "env = desaturate(cubemap(R), Env_Desaturation) × mix(EnvSpecular_Low, EnvSpecular_High, F^Env_Fresnel)\ns = pow(sat(dot(R, L) − 0.9) / 0.1, 1) × 266.973267\nreflection = env + s × skyLightIlluminance",
    nodes: [
      { label: "Reflection Vector", type: "input" },
      { label: "Cubemap × Fresnel Weight", type: "operation" },
      { label: "R · Light → Range → Power", type: "operation" },
      { label: "× Scalar × Light Color", type: "operation" },
      { label: "Environment + Specular", type: "output" },
    ],
    parameters: ["Specular Range", "Specular_Power", "Specular_Scalar", "Env_Desaturation", "Env_Fresnel", "EnvSpecular_Low", "EnvSpecular_High"],
  },
  {
    id: 6,
    key: "foam",
    title: "Foam",
    name: "泡沫纹理",
    textures: [
      { name: "T_Noise_Water", src: "./assets/T_Noise_Water.png?v=4", usage: "R 通道控制泡沫分布" },
    ],
    summary: "以独立移动的噪声提取泡沫分布，把对应位置推向白色，并增加这些区域的不透明度。",
    logic: "泡沫 UV 采用独立的移动速度与平铺数，本层先展示未扰动的泡沫，下一层再加入共享的坐标偏移。采样 T_Noise_Water 的 R 通道后，先做幂运算，压低较暗区域、突出较亮区域，再乘强度，得到泡沫的混合权重。\n\n用这个权重在水色与白色之间插值，让纹理较亮的位置形成白色泡沫。同一结果还会经过另一组幂运算与强度调整，加入后续的透明度分支，让泡沫区域比周围的水体更不透明。",
    formula: "uvFoam = (uv + offset + t × vec2(−0.01, −0.082)) × vec2(1, 2)\nfoam = pow(T_Noise_Water(uvFoam).r, 1.443878) × 0.952065\ncolorWithFoam = mix(waterColor, vec3(1), foam)\nfoamAlpha = pow(foam, 1) × 5",
    nodes: [
      { label: "Foam UV + Shared Distortion", type: "input" },
      { label: "T_Noise_Water · R", type: "input" },
      { label: "Power → Scalar", type: "operation" },
      { label: "Water ↔ White / Lerp", type: "operation" },
      { label: "Foam Color + Alpha", type: "output" },
    ],
    parameters: ["FoamTexture_Power", "FoamTexture_Scalar", "Foam_U_Speed", "Foam_V_Speed", "FoamTile_U", "FoamTile_V", "Foam_Power", "Foam_Scalar"],
  },
  {
    id: 7,
    key: "distortion",
    title: "UV Distortion",
    name: "扰动",
    textures: [
      { name: "Water_normal", src: "./assets/Water_normal.png?v=4", usage: "RG 解码为共享 UV 偏移" },
    ],
    summary: "生成一份共享 UV 偏移，让几何起伏、细节法线、水色、泡沫和透明度的纹理一起扰动。",
    logic: "从基础 UV 出发，按扰动支路的速度和平铺数采样 Water_normal，把解码后的 RG 作为二维偏移。当前实例再乘切线空间视线的 XY 与扰动强度，让偏移随观察角度变化。扰动源自身使用基础 UV，不把生成的偏移重新加回自己，避免递归采样。\n\n第七层将这份偏移渐入到 WPO 的渐变与低频噪声、两张细节法线、水色、泡沫和透明度纹理：先偏移基础 UV，再按各自速度平移、按各自平铺数缩放，原有时间持续运行。前六层偏移为零，第八层沿用；反射与折射通过法线和位置响应，没有额外的二维纹理 UV。WPO 接入共享扰动是本网页的展示扩展，原图只在水体与泡沫坐标使用它。",
    formula: "q = (uv + t × distortionSpeed) × distortionTile\nd = decodeNormal(Water_normal(q)).xy\noffset = mix(d, d × viewTangent.xy, Use_Parallax) × 0.03\nuvBase = uv + offset\nuvBranch = (uvBase + t × branchSpeed) × branchTile\n// Branches: WPO gradient / WPO noise / water / foam",
    nodes: [
      { label: "Distortion UV + Time × Speed → Tile", type: "input" },
      { label: "Water_normal → Decode RG", type: "input" },
      { label: "View Tangent XY → Parallax Lerp", type: "operation" },
      { label: "× Distortion_Intensity → Add Original UV", type: "operation" },
      { label: "WPO / Water / Foam Flow → Distorted UV", type: "output" },
    ],
    parameters: ["Distortion_Intensity", "Distortion_Speed_U", "Distortion_Speed_V", "Distortion_Tile_U", "Distortion_Tile_V", "Use_Parallax"],
  },
  {
    id: 8,
    key: "refraction",
    title: "Transparency & Refraction",
    name: "透明度与折射",
    textures: [
      { name: "T_SwirlNoise", src: "./assets/T_SwirlNoise.png?v=4", usage: "旋涡纹理控制基础透明度" },
      { name: "T_Noise_Water", src: "./assets/T_Noise_Water.png?v=4", usage: "复用泡沫分布，提高泡沫区域不透明度" },
    ],
    summary: "汇合纹理、Fresnel 与泡沫的透明度，再用半球遮罩调节显隐和折射率。",
    logic: "旋涡纹理经过幂运算、强度缩放并限制到 0–1，得到基础透明度分布。加上由 Fresnel 控制、随掠射角增大而减弱的吸收项，再乘整体不透明度，最后加入泡沫的不透明度贡献，让水体、观察角度和泡沫共同决定显隐。\n\n将像素法线与向上方向做点积，加偏移后经过幂运算和钳制，生成半球遮罩，再乘到透明度上，使下半球逐渐隐去。同一遮罩在无折射与设定折射率之间插值，输出前再以一半权重与无折射状态混合，控制背景偏移的强弱。",
    // The graph keeps RGB until Opacity; the float material input takes R.
    formula: "Fα = 0.01 + 0.99 × (1 − max(dot(N, V), 0))^5\nA = sat(pow(T_SwirlNoise(uvWater).r, 4) × 4)\nmask = sat(pow(N.z + 1, 1.676603))\nalpha = ((A + 0.970409 × (1 − Fα^1.107083)) × 0.395103 + foamAlpha) × mask\nIOR = mix(1, 1.33, mask)\neffectiveRefraction = mix(1, IOR, 0.5)",
    nodes: [
      { label: "T_SwirlNoise + Fresnel Alpha", type: "input" },
      { label: "× Opacity + Foam Alpha", type: "operation" },
      { label: "Normal · Up → Semi-Mask", type: "operation" },
      { label: "Alpha × Mask / IOR Lerp", type: "operation" },
      { label: "Opacity + Refraction", type: "output" },
    ],
    parameters: ["Opacity", "Absorption_opacity", "WaterFresnelAlpha_Power", "WaterAlpha_Power", "WaterAlpha_Scalar", "HemiSphereAlpha_Range", "Refraction"],
  },
];
