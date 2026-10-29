import { stages } from './stages.js?v=16';
import { WaterRenderer } from './renderer.js?v=14';

const $ = selector => document.querySelector(selector);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const stageCount=stages.length,secondsPerStage=3,buildDuration=stageCount*secondsPerStage,cycleDuration=buildDuration+4;
const state = {progress:stageCount,playing:!reducedMotion,motion:!reducedMotion,isolate:0,time:3,speed:1,displacement:1,normal:1,foam:1};
const escapeHTML = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const activeStage = () => stages[Math.min(stageCount-1,Math.max(0,Math.ceil(state.progress)-1))];
let renderer, cycle=buildDuration-.5, dirty=true, galleryDirty=true, lastFrame=0, lastUI=0;
let visibleGallery=false,visibleBreakdown=false,visibleLab=true;
const mainCanvas=$('#water-canvas');
$('#layer-progress').max=stageCount;

$('#layer-buttons').innerHTML=stages.map(s=>`<button class="layer-button" data-stage="${s.id}" aria-pressed="false"><span class="num">0${s.id}</span><strong>${escapeHTML(s.name)}</strong><span class="indicator"></span></button>`).join('');
$('#timeline-ticks').innerHTML=Array.from({length:stageCount+1},(_,i)=>`<span>0${i}</span>`).join('');
for(const mode of ['isolated','composite']) {
  $(`#${mode}-strip`).innerHTML=stages.map(s=>`<button class="pass-card" data-preview="${s.id}" data-mode="${mode}" aria-label="${mode==='isolated'?'单独查看':'逐层叠加至'}：${escapeHTML(s.name)}"><canvas width="240" height="240" data-thumb="${mode}-${s.id}" aria-label="${escapeHTML(s.name)}${mode==='isolated'?'独立输出':'累积效果'}"></canvas><span><b>0${s.id}</b>${escapeHTML(s.name)}</span></button>`).join('');
}
$('#stage-articles').innerHTML=stages.map((s,index)=>`
  <article class="stage-article" id="stage-${s.id}" aria-labelledby="stage-title-${s.id}">
    <div class="stage-visual">
      <button class="build-preview" data-preview="${s.id}" data-mode="composite" aria-label="在实验室中查看累积至${escapeHTML(s.name)}的材质">
        <span class="build-caption"><span class="stage-number">0${s.id}</span><span>${s.id===stageCount?'完整水球':'累积材质'}<span class="build-count">${String(s.id).padStart(2,'0')} / ${String(stageCount).padStart(2,'0')}</span></span></span>
        <canvas width="720" height="720" data-build="${s.id}" aria-label="累积至${escapeHTML(s.name)}的材质效果"></canvas>
        <span class="build-action">在实验室中查看 <span aria-hidden="true">↗</span></span>
      </button>
      ${index<stages.length-1?'<div class="stage-flow" aria-hidden="true"></div>':''}
    </div>
    <div class="stage-detail">
      <div class="stage-copy${s.textures.length?' has-textures':''}">
        <div class="stage-description">
          <span class="stage-english">${escapeHTML(s.title.toUpperCase())}</span>
          <h3 id="stage-title-${s.id}">${escapeHTML(s.name)}</h3>
          ${s.logic.split("\n\n").map(paragraph=>`<p>${escapeHTML(paragraph)}</p>`).join('')}
        </div>
        ${s.textures.length?`<div class="stage-textures" aria-label="${escapeHTML(s.name)}使用的贴图">${s.textures.map(texture=>`
          <figure class="texture-card">
            <a href="${escapeHTML(texture.src)}" target="_blank" rel="noopener" aria-label="查看 ${escapeHTML(texture.name)} 贴图大图">
              <img src="${escapeHTML(texture.src)}" alt="${escapeHTML(texture.name)}：${escapeHTML(texture.usage)}" width="144" height="144" loading="lazy" decoding="async">
            </a>
            <figcaption><code>${escapeHTML(texture.name)}</code><span>${escapeHTML(texture.usage)}</span></figcaption>
          </figure>`).join('')}</div>`:''}
      </div>
      <div class="media-slot node-slot" data-media="node-${s.id}">
        <span class="slot-icon" aria-hidden="true">⌘</span>
        <h4>Unreal 节点图 · ${escapeHTML(s.name)}</h4>
        <label class="upload-button">本地预览节点图<input type="file" accept="image/*" data-upload="node-${s.id}"></label>
      </div>
    </div>
  </article>`).join('');

function updateUI() {
  const s=activeStage(),id=state.isolate||s.id;
  $('#layer-progress').value=state.progress;
  $('#layer-progress').style.background=`linear-gradient(to right,var(--accent) ${state.progress/stageCount*100}%,#2b3e45 ${state.progress/stageCount*100}%)`;
  $('#layer-progress').setAttribute('aria-valuetext',`${state.progress.toFixed(2)} / ${stageCount}，${stages[id-1].name}`);
  $('#progress-output').value=`${state.progress.toFixed(2)} / ${stageCount}`;
  $('#active-name').textContent=state.progress<.001&&!state.isolate?'基础球体':`0${id} / ${stages[id-1].name}`;
  $('#active-summary').textContent=stages[id-1].summary;
  $('#active-detail').href=`#stage-${id}`;
  $('#play-toggle').textContent=state.playing?'Ⅱ':'▶';
  $('#play-toggle').setAttribute('aria-label',state.playing?'暂停逐层循环':'播放逐层循环');
  $('#play-toggle').setAttribute('aria-pressed',String(state.playing));
  $('#motion-toggle').textContent=state.motion?'冻结水流':'恢复水流';
  $('#motion-toggle').setAttribute('aria-pressed',String(!state.motion));
  for(const button of document.querySelectorAll('[data-stage]')) {
    const n=Number(button.dataset.stage);
    button.classList.toggle('active',n===id);
    button.classList.toggle('included',state.isolate?n===id:n<=Math.ceil(state.progress));
    button.setAttribute('aria-pressed',String(n===id));
  }
  for(const [id,selected] of [['composite',!state.isolate],['isolate',!!state.isolate]]) {
    $(`#mode-${id}`).classList.toggle('selected',selected);
    $(`#mode-${id}`).setAttribute('aria-pressed',String(selected));
  }
}
function selectStage(id,isolate=!!state.isolate,scroll=false) {
  state.progress=id;state.isolate=isolate?id:0;state.playing=false;cycle=id*secondsPerStage;
  dirty=true;updateUI();
  if(scroll)$('#lab').scrollIntoView({behavior:reducedMotion?'instant':'smooth',block:'start'});
}
document.addEventListener('click',e=>{
  const stage=e.target.closest('[data-stage]'),preview=e.target.closest('[data-preview]');
  if(stage)selectStage(Number(stage.dataset.stage));
  if(preview)selectStage(Number(preview.dataset.preview),preview.dataset.mode==='isolated',true);
});
$('#layer-progress').addEventListener('input',e=>{
  state.progress=Number(e.target.value);state.playing=false;cycle=state.progress*secondsPerStage;
  if(state.isolate)state.isolate=activeStage().id;
  dirty=true;updateUI();
});
$('#play-toggle').addEventListener('click',()=>{state.playing=!state.playing;cycle=state.progress*secondsPerStage;updateUI();});
$('#motion-toggle').addEventListener('click',()=>{state.motion=!state.motion;updateUI();});
$('#mode-composite').addEventListener('click',()=>{state.isolate=0;dirty=true;updateUI();});
$('#mode-isolate').addEventListener('click',()=>{state.isolate=activeStage().id;dirty=true;updateUI();});
$('#loop-speed').addEventListener('change',e=>{state.speed=Number(e.target.value);});
$('#reset-view').addEventListener('click',()=>{if(renderer){renderer.yaw=.35;renderer.pitch=.13;}dirty=true;galleryDirty=true;});
for(const key of ['displacement','normal','foam'])$('#'+key).addEventListener('input',e=>{state[key]=Number(e.target.value);$('#'+key+'-value').value=state[key].toFixed(2)+'×';dirty=true;galleryDirty=true;});
$('#reset-material').addEventListener('click',()=>{for(const key of ['displacement','normal','foam']){state[key]=1;$('#'+key).value=1;$('#'+key+'-value').value='1.00×';}dirty=true;galleryDirty=true;});
let drag;
mainCanvas.addEventListener('pointerdown',e=>{if(!renderer)return;drag={x:e.clientX,y:e.clientY,yaw:renderer.yaw,pitch:renderer.pitch};mainCanvas.setPointerCapture(e.pointerId);});
mainCanvas.addEventListener('pointermove',e=>{if(!drag)return;renderer.yaw=drag.yaw-(e.clientX-drag.x)*.006;renderer.pitch=Math.max(-.15,Math.min(.7,drag.pitch+(e.clientY-drag.y)*.004));dirty=true;galleryDirty=true;});
for(const event of ['pointerup','pointercancel','lostpointercapture'])mainCanvas.addEventListener(event,()=>{drag=null;});
mainCanvas.addEventListener('keydown',e=>{if(!renderer||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();if(e.key==='ArrowLeft')renderer.yaw-=.08;if(e.key==='ArrowRight')renderer.yaw+=.08;if(e.key==='ArrowUp')renderer.pitch=Math.min(.7,renderer.pitch+.05);if(e.key==='ArrowDown')renderer.pitch=Math.max(-.15,renderer.pitch-.05);dirty=true;galleryDirty=true;});

const mediaURLs=new Map();
function showMedia(key,src,{poster='',alt='',local=false}={}) {
  const slot=document.querySelector(`[data-media="${key}"]`);
  if(!slot)return;
  const isVideo=key==='overall';
  const element=document.createElement(isVideo?'video':'img');
  if(isVideo){element.controls=true;element.loop=true;element.playsInline=true;element.preload='metadata';if(poster)element.poster=poster;}
  else{element.alt=alt||slot.querySelector('h4')?.textContent||'Unreal 原始节点截图';element.loading='lazy';}
  element.src=src;
  element.addEventListener('error',()=>{slot.classList.remove('has-media');slot.replaceChildren(Object.assign(document.createElement('p'),{textContent:'媒体无法加载，请检查文件格式和 media.json 路径。'}));slot.append(makeUpload(key,isVideo));});
  slot.replaceChildren(element);slot.classList.add('has-media');
  if(local)slot.append(makeUpload(key,isVideo));
}
function makeUpload(key,isVideo) {
  const label=document.createElement('label');label.className='upload-button replace-media';label.textContent='替换本地预览';
  const input=document.createElement('input');input.type='file';input.accept=isVideo?'video/*':'image/*';input.dataset.upload=key;label.append(input);return label;
}
document.addEventListener('change',e=>{
  const key=e.target.dataset?.upload,file=e.target.files?.[0];if(!key||!file)return;
  const expected=key==='overall'?'video/':'image/';
  if(!file.type.startsWith(expected)){e.target.value='';return;}
  if(mediaURLs.has(key))URL.revokeObjectURL(mediaURLs.get(key));
  const url=URL.createObjectURL(file);mediaURLs.set(key,url);showMedia(key,url,{local:true,alt:`${key==='overall'?'水球整体效果':stages[Number(key.split('-')[1])-1].name} Unreal 节点截图`});
});
fetch('./media.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('media.json');return r.json();}).then(config=>{
  if(config.overall?.src)showMedia('overall',config.overall.src,config.overall);
  for(const [id,media] of Object.entries(config.nodes||{}))if(media.src)showMedia(`node-${id}`,media.src,media);
}).catch(()=>{$('#render-status').hidden=false;$('#render-status').textContent='媒体配置读取失败；可用本地预览替换。';});

const visibility=new IntersectionObserver(entries=>{for(const e of entries){if(e.target.id==='passes'){visibleGallery=e.isIntersecting;if(visibleGallery)galleryDirty=true;}if(e.target.id==='breakdown'){visibleBreakdown=e.isIntersecting;if(visibleBreakdown)galleryDirty=true;}if(e.target.id==='lab')visibleLab=e.isIntersecting;}});
visibility.observe($('#passes'));visibility.observe($('#breakdown'));visibility.observe($('#lab'));
new ResizeObserver(()=>{dirty=true;}).observe($('#viewport'));
document.addEventListener('visibilitychange',()=>{lastFrame=0;dirty=true;});

function renderGallery() {
  for(const mode of ['isolated','composite'])for(const stage of stages){
    const thumbnail=document.querySelector(`[data-thumb="${mode}-${stage.id}"]`);
    const target=mode==='composite'?document.querySelector(`[data-build="${stage.id}"]`):thumbnail;
    const size=mode==='composite'?720:240;
    renderer.render(target,{...state,time:3,progress:stage.id,isolate:mode==='isolated'?stage.id:0,width:size,height:size});
    if(mode==='composite')thumbnail.getContext('2d',{alpha:false}).drawImage(target,0,0,thumbnail.width,thumbnail.height);
  }
  galleryDirty=false;
}
function frame(timestamp) {
  requestAnimationFrame(frame);
  if(document.hidden){lastFrame=0;return;}
  if(!renderer||timestamp-lastFrame<1000/30)return;
  // Compute animation from wall time, independent of throttled draw frequency.
  const elapsed=lastFrame?Math.min((timestamp-lastFrame)/1000,.15):0;lastFrame=timestamp;
  if(state.motion&&visibleLab)state.time+=elapsed;
  if(state.playing&&visibleLab){
    cycle=(cycle+elapsed*state.speed)%cycleDuration;
    state.progress=cycle<buildDuration?Math.min(stageCount,Math.floor(cycle/secondsPerStage)+Math.min((cycle%secondsPerStage)/1.1,1)):stageCount;
    if(state.isolate)state.isolate=activeStage().id;
    dirty=true;
  }
  if(timestamp-lastUI>100){updateUI();lastUI=timestamp;}
  try {
    if((visibleGallery||visibleBreakdown)&&galleryDirty)renderGallery();
    if(visibleLab&&(dirty||state.motion||state.playing)){
      const rect=$('#viewport').getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.5);
      const width=Math.max(1,Math.min(1500,Math.round(rect.width*dpr))),height=Math.max(1,Math.round(rect.height*width/rect.width));
      renderer.render(mainCanvas,{...state,width,height});dirty=false;
    }
  }catch(error){showError(error);renderer=null;}
}
function showError(error){$('#render-error').hidden=false;$('#render-error').textContent=error.message;state.playing=false;updateUI();console.error(error);}
updateUI();
try {
  const initialized=await new WaterRenderer().init();renderer=initialized;
  renderGallery();
  requestAnimationFrame(frame);
}catch(error){showError(error);}
