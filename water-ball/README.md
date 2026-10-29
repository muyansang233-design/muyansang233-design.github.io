# Water Ball · Material study

个人网站中的独立静态页面：`/water-ball/`。首页作品集已加入入口。不需要 npm 或打包步骤。

在网站根目录运行：

```sh
python3 -m http.server 8088 --bind 127.0.0.1
```

然后访问 `http://127.0.0.1:8088/water-ball/`。需要 HTTP 服务与 WebGL 2，不能直接双击 HTML 用 `file://` 运行。

## 展示内容

- 8 个教学层：几何起伏（WPO）、UV 流动、细节法线、水色、反射与高光、泡沫、扰动、透明度与折射。
- 实时 GLSL 预览；28 秒一轮，逐层加入后停留在完整效果，再从基础球体重新开始。UV 按原始速度连续流动，层间淡入只控制显示权重，避免切层时重新缩放累计时间造成快转。
- 播放/暂停、连续进度滑块、0.5×/1×/2×速度、独立冻结水流、鼠标/触控/方向键调整视角。
- 第 02 部分有 16 张单层与累积预览，第 03 部分有 8 张较大的累积预览；均使用同一时间点（t=3s）的 shader 输出，便于对比。
- 第 03 部分采用两列：左列是逐层累积的材质预览，向下箭头串联八层；右列分段说明纹理输入、计算与组合逻辑，并保留节点截图占位。窄屏时每组上下排列。数学细节保留在原始节点图与来源文件中。
- 整体视频占位和工程内已有的 Unreal 参考截图。
- 完整有效 graph 的 SVG（真实节点位置与连接）以及可核查的 JSON。

系统启用“减少动态效果”时，默认暂停循环和水流；仍可手动播放。离屏实验室与后台标签页暂停计算。

## 放入整体视频和节点截图

页面上的「本地预览」只在当前标签页读取本地文件，不上传、不保存到服务器；刷新后回到 `media.json` 的配置。

要让媒体永久随网站发布：

1. 将录屏放在 `water-ball/assets/overall.mp4`，建议 H.264 MP4。
2. 将各部分节点截图放在 `water-ball/assets/node-01.png` 等位置。
3. 编辑 `water-ball/media.json`，路径相对于 `water-ball/index.html`：

```json
{
  "overall": { "src": "./assets/overall.mp4", "poster": "./assets/unreal-reference.png" },
  "nodes": {
    "1": { "src": "./assets/node-01.png", "alt": "WPO 顶点位移节点图" },
    "2": { "src": "./assets/node-02.png", "alt": "UV 流动节点图" },
    "3": { "src": "./assets/node-03.png", "alt": "细节法线节点图" },
    "7": { "src": "./assets/node-07.png", "alt": "扰动节点图" }
  }
}
```

保留其他未填项目的空 `src`，页面继续显示对应 placeholder。视频使用播放控件、静音与循环的选择由浏览器用户控制；它与实时 GLSL 演示互相独立。

## 代码与来源

| 文件 | 用途 |
| --- | --- |
| `app.js` | 播放器、滑块、预览图、媒体占位及输入交互 |
| `renderer.js` | 原生 WebGL 2、球体网格、纹理加载、相机 |
| `shaders/water.vert.glsl` | 当前材质的 WPO 计算 |
| `shaders/water.frag.glsl` | 法线、调色、反射、泡沫、透明度与折射 |
| `shaders/uv.glsl` | 顶点与像素着色器共享的扰动偏移、各支路 UV 构造 |
| `shaders/scene.glsl` | 网页展示环境、背景网格与显示映射 |
| `stages.js` | 八层的介绍文案与来源对照数据 |
| `media.json` | 整体视频和各层节点截图的可替换路径 |
| `source/effective-parameters.json` | 实例覆盖合并母材质默认值，运行时直接注入 GLSL |
| `source/material-analysis.md` | 解析结论与对应关系 |
| `source/material-formulas.txt` | 当前有效图的精确公式与节点 ID |
| `source/material-graph.svg` | 229 个有效节点的布局和连接；可在新标签页放大 |
| `source/M_Water.normalized.json` | 完整母材质 graph 的机读数据 |
| `assets/provenance.json` | 原资产和导出纹理的哈希、尺寸、提取过程 |
| `tools/extract_textures.py` | 原纹理解压脚本；依赖本地 Unreal Oodle 库 |
| `tools/verify-global-uv.html` | 浏览器 GPU 检查：第七层扰动改变 WPO，第八层沿用，前六层单独查看不提前启用 |

`source/*.raw.json` 保留解析证据，但网页运行时只加载有效参数 JSON。原始 Unreal 工程没有被修改，也不随网站复制。

## 复刻范围

以当前 `.uasset` graph 为基础，而非旧 ShaderDebugInfo 缓存中的过时版本。材质为 Translucent / Unlit / Index of Refraction，`UseCurtainMask=false`。网页的八层是对并行材质分支的教学拆解，不是 Unreal 的八次 GPU draw pass。第二层先启用 UV 时间平移，第三层用尚未扰动的流动 UV 采样并混合两张法线，随后加入水色、反射与高光和泡沫。前六层的扰动偏移均为零，第七层渐入共享偏移，第八层加入透明度与折射并沿用偏移。

按展示要求，第七层的共享扰动作用于所有下游二维纹理采样：WPO 的渐变与低频噪声、两张细节法线、水色、泡沫和透明度。各支路先将偏移加到基础 UV，再按原有速度平移、按原有平铺数缩放，即 `(originalUV + offset + time × speed) × tile`；时间始终连续。扰动源 Water_normal 从基础 UV 生成偏移，不对自身递归扰动。反射与折射通过法线及位置响应，不另设二维纹理 UV。原 Unreal 图的两路 WPO 没有接入该偏移；将扰动扩展到 WPO 是本网页按要求增加的行为，原资产公式仍完整保留在 `source/material-formulas.txt`。

共享偏移以未位移的球面位置计算视线，避免位移结果反过来驱动自身的 UV；顶点与像素阶段使用同一段 GLSL 和显式 LOD 0 采样扰动源。

以下平台适配已与材质数学分开：

- 生成的 UV sphere 以 50 cm 半径归一化，WPO 按 0.02 换算。原场景的 mesh/transform 未直接导入。
- UE 的 Z-up 转成网页的 Y-up；相机与切线基于网页网格。
- `CubeRenderTarget` 只有运行时描述、无可导出六面图，因此使用明确的程序化 studio 环境与独立灯光。
- 原 IOR 数值与半球 mask 保留，屏幕空间折射由网页对自身背景的折射射线采样替代。
- 浏览器使用独立显示映射；未复现 Unreal 的曝光、后处理、透明排序和 Niagara 飞溅粒子。
- 2048 纹理按 provenance 缩至 1024；T_WaterColor 的资产级 AdjustHue=43.2° 已按线性 RGB → HSV 流程烘焙，shader 不重复调色。源像素不含 Unreal 的最终 GPU 块压缩损失。
- 基础球体与第一层 WPO 使用灰材质辅助显示；仅第二层用平移棋盘展示 UV 流动，第三层通过中性光照显示细节法线，第四层水色覆盖这些诊断显示。第七层在已有几何起伏、法线、水色、反射与泡沫上展示统一扰动的影响。WPO 从第一层开始参与后续累积效果，第七层也会改变它的纹理采样与起伏分布；单层法线视图保留法线颜色诊断。

因此它是可核查的材质计算复刻与教学展示，不承诺与原场景逐像素一致。整体视频位用于展示实际 Unreal 最终效果。
