const shaderURL = name => new URL(`./shaders/${name}`, import.meta.url);
const safeName = name => name.replace(/[^a-zA-Z0-9_]/g, '_');
const number = value => Number(value).toFixed(10);
const normalize = a => { const l = Math.hypot(...a); return a.map(v => v / l); };
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot = (a,b) => a.reduce((s,v,i) => s+v*b[i],0);
function matrixMultiply(a,b) {
  const c = new Float32Array(16);
  for(let col=0;col<4;col++) for(let row=0;row<4;row++) for(let k=0;k<4;k++) c[col*4+row]+=a[k*4+row]*b[col*4+k];
  return c;
}
async function getText(url) { const r=await fetch(url,{cache:'no-cache'}); if(!r.ok) throw new Error(`无法读取 ${url} (${r.status})`); return r.text(); }

export class WaterRenderer {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.gl = this.canvas.getContext('webgl2',{alpha:false,antialias:true,preserveDrawingBuffer:true});
    if(!this.gl) throw new Error('此浏览器未能启用 WebGL 2。请开启硬件加速后刷新，或使用支持 WebGL 2 的浏览器。下方仍可查看原始截图和材质说明。');
    this.yaw=0.35; this.pitch=0.13;
    this.canvas.addEventListener('webglcontextlost', e => {e.preventDefault(); this.lost=true;});
    this.canvas.addEventListener('webglcontextrestored', () => location.reload());
  }
  async init() {
    const [vertex,fragment,scene,uv,parameters] = await Promise.all([
      getText(shaderURL('water.vert.glsl')),getText(shaderURL('water.frag.glsl')),getText(shaderURL('scene.glsl')),getText(shaderURL('uv.glsl')),
      getText(new URL('./source/effective-parameters.json',import.meta.url)).then(JSON.parse)
    ]);
    const defines = Object.entries(parameters).filter(([,v])=>typeof v==='number').map(([k,v])=>`#define P_${safeName(k)} ${number(v)}`).join('\n')
      + `\n#define P_Param vec3(${number(parameters.Param.R)},${number(parameters.Param.G)},${number(parameters.Param.B)})`;
    const inject = s => s.replace('// PARAMETERS: populated from source/effective-parameters.json at compile time.',defines).replace('// SCENE: shared browser studio, inserted by renderer.js.',scene).replace('// UV: shared global UV calculation, inserted by renderer.js.',uv);
    this.water = this.program(inject(vertex),inject(fragment));
    this.background = this.program(`#version 300 es\nprecision highp float;\nvoid main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2)); gl_Position=vec4(p*2.0-1.0,0,1);}`,`#version 300 es\nprecision highp float;\n${scene}\nout vec4 fragColor;\nvoid main(){fragColor=vec4(displayColor(sceneColor(uCamera,rayDirection(gl_FragCoord.xy))),1.0);}`);
    this.createSphere();
    // Source images are read top-to-bottom (UNPACK_FLIP_Y_WEBGL=false), matching UE UVs.
    const textureDefinitions = [
      ['uGradation','T_GradationPattern.png',true],['uVertexNoise','LowResBlurredNoise.png',false],
      ['uDistortionNormal','Water_normal.png',false],['uNormalA','water_n.png',false],['uNormalB','T_Water_N.png',false],
      ['uWaterColor','T_WaterColor.png',true],['uFoamTexture','T_Noise_Water.png',true],['uWaterAlpha','T_SwirlNoise.png',true]
    ];
    this.textures = await Promise.all(textureDefinitions.map(async ([uniform,file,srgb],unit)=>({uniform,unit,texture:await this.loadTexture(new URL(`./assets/${file}?v=4`,import.meta.url),srgb)})));
    return this;
  }
  program(vertex,fragment) {
    const gl=this.gl, shaders=[];
    for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]) {
      const shader=gl.createShader(type); gl.shaderSource(shader,source); gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) {const error=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error(`GLSL 编译失败：${error}`);}
      shaders.push(shader);
    }
    const program=gl.createProgram();shaders.forEach(s=>gl.attachShader(program,s));gl.linkProgram(program);
    shaders.forEach(s=>gl.deleteShader(s));
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(`GLSL 链接失败：${gl.getProgramInfoLog(program)}`);
    return {program,uniforms:new Map()};
  }
  uniform(program,name) {
    if(!program.uniforms.has(name)) program.uniforms.set(name,this.gl.getUniformLocation(program.program,name));
    return program.uniforms.get(name);
  }
  createSphere() {
    const gl=this.gl, vertices=[], indices=[], columns=160, rows=100;
    for(let y=0;y<=rows;y++) for(let x=0;x<=columns;x++) {
      const u=x/columns,v=y/rows,phi=u*Math.PI*2,theta=v*Math.PI;
      vertices.push(Math.sin(theta)*Math.cos(phi),Math.cos(theta),Math.sin(theta)*Math.sin(phi),u,v);
    }
    for(let y=0;y<rows;y++) for(let x=0;x<columns;x++) {
      const a=y*(columns+1)+x,b=a+columns+1;indices.push(a,a+1,b,b,a+1,b+1);
    }
    this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);
    const vbo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,20,0);
    gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,2,gl.FLOAT,false,20,12);
    const ibo=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ibo);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);
    this.indexCount=indices.length;gl.bindVertexArray(null);
  }
  async loadTexture(url,srgb) {
    const img=new Image();img.decoding='async';img.src=url;
    await img.decode().catch(()=>{throw new Error(`原始纹理加载失败：${url.pathname}`);});
    const gl=this.gl, tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D,0,srgb?gl.SRGB8_ALPHA8:gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,img);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
    // water_n explicitly uses Unreal TF_Bilinear; other source assets inherit filtering.
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,url.pathname.endsWith('/water_n.png')?gl.LINEAR_MIPMAP_NEAREST:gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.generateMipmap(gl.TEXTURE_2D);
    return tex;
  }
  camera(width,height) {
    const radius=4.8,eye=[Math.sin(this.yaw)*Math.cos(this.pitch)*radius,Math.sin(this.pitch)*radius+0.2,Math.cos(this.yaw)*Math.cos(this.pitch)*radius];
    const forward=normalize(eye.map((v,i)=>(i===1?-0.03:0)-v));
    const right=normalize(cross(forward,[0,1,0])),up=cross(right,forward);
    const view=new Float32Array([right[0],up[0],-forward[0],0,right[1],up[1],-forward[1],0,right[2],up[2],-forward[2],0,-dot(right,eye),-dot(up,eye),dot(forward,eye),1]);
    const f=1/Math.tan(Math.PI/10),near=.1,far=100;
    const projection=new Float32Array([f/(width/height),0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);
    return {eye,forward,right,up,matrix:matrixMultiply(projection,view)};
  }
  render(target,{time=0,progress=8,isolate=0,displacement=1,normal=1,foam=1,width=target.width,height=target.height}={}) {
    if(this.lost) throw new Error('WebGL 上下文已暂停，恢复后页面会自动重载。');
    const gl=this.gl;
    if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}
    gl.viewport(0,0,width,height);gl.clearColor(.02,.04,.05,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    const camera=this.camera(width,height);
    const setCamera=p=>{gl.useProgram(p.program);for(const [n,v] of Object.entries({uCamera:camera.eye,uForward:camera.forward,uRight:camera.right,uUp:camera.up})) gl.uniform3fv(this.uniform(p,n),v);gl.uniform2f(this.uniform(p,'uResolution'),width,height);};
    gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.bindVertexArray(null);setCamera(this.background);gl.drawArrays(gl.TRIANGLES,0,3);
    gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.frontFace(gl.CCW);
    setCamera(this.water);gl.uniformMatrix4fv(this.uniform(this.water,'uViewProjection'),false,camera.matrix);
    for(const [name,value] of Object.entries({uTime:time,uProgress:progress,uDisplacement:displacement,uNormalStrength:normal,uFoamStrength:foam})) gl.uniform1f(this.uniform(this.water,name),value);
    gl.uniform1i(this.uniform(this.water,'uIsolate'),isolate);
    this.textures.forEach(t=>{gl.activeTexture(gl.TEXTURE0+t.unit);gl.bindTexture(gl.TEXTURE_2D,t.texture);gl.uniform1i(this.uniform(this.water,t.uniform),t.unit);});
    gl.bindVertexArray(this.vao);gl.drawElements(gl.TRIANGLES,this.indexCount,gl.UNSIGNED_SHORT,0);gl.bindVertexArray(null);
    if(target.width!==width)target.width=width;if(target.height!==height)target.height=height;
    target.getContext('2d',{alpha:false}).drawImage(this.canvas,0,0);
  }
}
