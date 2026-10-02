# 清新夏日水岸 - 作品集网站

这是一个基于纯前端的个人技术美术作品集原型：

- 首屏：交互式 WebGL 水面 shader，支持鼠标/触控涟漪反馈
- 漂浮物：标题、Demo Reel 木板、荷叶和莲花的柔和物理漂浮
- 交互：拖拽、惯性、边界约束、对象间碰撞和反馈
- Overlay：Demo Reel 全屏视频弹窗，支持遮罩关闭与 Esc 关闭
- 项目区：Games / Tech Art & Graphics / Digital Art 三个区块，组件化渲染

## 快速启动

1. 在终端进入项目目录：

```bash
cd /Users/muyan/Documents/personal-website
```

2. 启动本地静态服务器（任意方式），示例：

```bash
python3 -m http.server 8080
```

3. 打开浏览器访问：

`http://localhost:8080`

## 文案来源

页面文案读取自：`data/portfolio-content.json`。
请在该文件中替换你自己的项目内容、媒体链接和 Demo Reel 地址。

## 可扩展项

- `css/styles.css`：视觉系统与动画、配色、卡片样式
- `js/app.js`：物理和交互主逻辑
- `data/portfolio-content.json`：全部项目和身份文案
