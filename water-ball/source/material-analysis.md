# M_Water_Inst → M_Water

从已展开的 WaterBall Unreal 5.8 工程中读取 `Content/M_Water.uasset` 与 `Content/M_Water_Inst.uasset`。当前材质包含 346 个导出对象；当前静态开关路径下有 229 个有效节点。原工程文件保持不变。

材质是 **Translucent / Unlit / Index of Refraction**。水色、环境反射、泡沫、手工高光在图里相加写入 Emissive。它不依赖普通 opaque PBR 材质的 Base Color / Metallic / Roughness。

## 八个教学层

| 分支 | 输入与基本逻辑 | 主要输出 |
| --- | --- | --- |
| 几何起伏 | 两张平移纹理分别做 Power / Scalar，相加减 1，乘顶点法线和极点遮罩；网页在第 7 层为两路 UV 加入共享扰动 | WPO（原图 export 125） |
| UV 流动 | 时间乘各自速度，加到原始 UV 后再乘 tile；本层暂不启用扰动偏移 | 平移后的 Water UV / Foam UV |
| 细节法线 | 先用未扰动的流动 UV 采样 water_n 和 T_Water_N，做角度修正混合，XY 乘 NormalScalar | Normal（export 109） |
| 水色与吸收感 | T_WaterColor 去色、调明暗，与 Fresnel 调色相乘 | waterColor |
| 反射与高光 | Cubemap 采样乘 Fresnel，反射向量与光方向点积形成高光 | 环境 + specular |
| 泡沫 | T_Noise_Water.r 的 Power / Scalar 控制白色混合，并增加 opacity | waterAndFoam / foamAlpha |
| 扰动 | 基础 UV 采样 Water_normal 生成视线相关偏移，在各支路平移与平铺之前加入；覆盖 WPO 两路、细节法线、水色、泡沫与透明度 | 叠加扰动后的 WPO / Water / Foam UV（WPO 为网页扩展） |
| 透明与折射 | T_SwirlNoise 透明纹理、Fresnel 吸收项、泡沫项相加，再乘半球 mask | Opacity（108）/ Refraction（90） |

最终：`EmissiveColor = environment + waterAndFoam + specular`（export 129）。完整公式及节点编号见 [material-formulas.txt](./material-formulas.txt)，实际布局和边见 [material-graph.svg](./material-graph.svg)。八层是对并行材质分支的解释顺序，并不是八次独立 GPU 渲染。第 2 层只启用时间平移，并用棋盘显示 UV 流动；第 3 层用未扰动的流动 UV 采样两张细节法线，通过中性光照显示法线；第 4 层水色覆盖诊断显示，随后叠加反射与泡沫。前 6 层的扰动偏移均为零，第 7 层将共享偏移渐入全部下游二维纹理采样：WPO 的渐变纹理与低频噪声、两张细节法线、水色、泡沫与透明度；第 8 层加入透明度与折射并沿用偏移。偏移统一在每条支路的平移与平铺之前加入，遵循 `(originalUV + offset + time × speed) × tile`，各自速度、平铺数与连续时间保持不变。

扰动源 Water_normal 从基础 UV 经自身平移与平铺后采样，生成偏移，不对自身递归扰动。反射与折射通过改变后的法线及位置响应，没有额外的二维纹理 UV。原资产只将共享偏移接到水体与泡沫坐标；两路 WPO 使用各自未扰动的基础 UV。将扰动扩展到 WPO 是按展示要求添加的网页行为，并非原 Unreal graph 的连接。原资产精确公式仍保留在 [material-formulas.txt](./material-formulas.txt)，不因这项扩展而改写。

## 当前 graph 的重要细节

- 实例 `Param` 是 `(0.127853, 0.341405, 0.40625)`，优先于母材质默认水色。
- `UseCurtainMask=false`，图内的 Custom 水幕 / SDF 分支不参与当前水球。保留其源代码作为证据，网页不启用它。
- UV 平移在 tile 之前。改成先 tile 后平移会改变实际速度。
- WPO 用顶点法线；透明半球 mask 用像素着色法线。
- 透明度表达式最终输出 float，取 RGB 结果的第一个分量。
- 当前 Refraction 输出在 `mix(1, 1.33, semiMask)` 外还有 `mix(1, IOR, 0.5)`；这是无 Alpha 输入的 Lerp 默认值。
- Saved/ShaderDebugInfo 是较早版本。旧缓存可验证匹配分支的数学，但不能覆盖当前资产的连接关系。

## 纹理与场景

8 张有效纹理来自原工程 source art，通过本机 Unreal 的 Oodle 解压和 UEDELTA 数据恢复后导出。T_WaterColor 的 AdjustHue=43.2° 已按本地 Unreal 源码的线性 RGB → HSV → 色相偏移流程烘焙。大图做了网页降采样，原始与输出哈希、尺寸和处理步骤见 [provenance.json](../assets/provenance.json)。

`CubeRenderTarget` 不包含已烘焙的 cubemap 六面数据。实时网页采用程序化展示环境、独立灯光与显示映射；原 IOR 逻辑保留，但网页背景折射使用自身场景的射线采样。原 mesh、场景变换、Niagara、Unreal 屏幕空间折射和后处理没有被搬到浏览器。这些差异不应被描述为逐像素一致。

## 可复核文件

当前有效参数见 [effective-parameters.json](./effective-parameters.json)，完整恢复数据见 [M_Water.normalized.json](./M_Water.normalized.json)，解析方法与库修正见 [source-notes.txt](./source-notes.txt)。初次生成的 `*.graph.json` 仅保留早期检查记录，程序消费应使用 `*.normalized.json`。
