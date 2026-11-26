import { onCommand, onPointer, dispatchCommand } from './commandBus.js';
import { SHAPE_TYPES, createInitialScene, snapshotScene, sceneSummary, applySceneCommand } from './sceneState.js';

// This is intentionally a lightweight 2D TEST scene. The centre #threejs-mount
// stays empty for the team's actual Three.js application.
const stage=document.getElementById('test-stage');
const selectedLabel=document.getElementById('test-selected');
const countLabel=document.getElementById('shape-count');
const objectList=document.getElementById('shape-list');
const result=document.getElementById('scene-status');
const PIXELS_PER_UNIT=56;
const CAMERA_WIDTH_UNITS=5.4;
const CAMERA_HEIGHT_UNITS=3.2;
const GRAB_RADIUS_PX=43;
const HISTORY_MAX=50;
let state=createInitialScene();
const history=[];
let hoverName=null;
let grabbedName=null;
let grabOrigin=null;
const elements=new Map();
let lastShapeListKey = null;

const pointerDot=document.createElement('div');
pointerDot.id='gesture-pointer';
pointerDot.setAttribute('aria-hidden','true');
stage.appendChild(pointerDot);

function clamp(n,min,max){return Math.max(min,Math.min(max,n));}
function remember(before) {
  history.push(before);
  if(history.length>HISTORY_MAX)history.shift();
}
function feedback(message,success=true) {
  result.textContent=message;
  result.dataset.state=success?'ok':'error';
  window.dispatchEvent(new CustomEvent('editor:scene-feedback',{detail:{message,success}}));
}
function announceChange() {
  window.dispatchEvent(new CustomEvent('editor:scene-state',{detail:sceneSummary(state)}));
}
function elementFor(name) {
  const el=document.createElement('div');
  el.className='test-object';
  el.dataset.shape=name;
  el.setAttribute('aria-label',`${name} test object`);
  const glyph=document.createElement('span');glyph.className=`shape-body ${name}`;
  const label=document.createElement('span');label.className='shape-caption';label.textContent=name;
  el.append(glyph,label);
  stage.appendChild(el);
  el.addEventListener('click',()=>dispatchCommand({action:'select',target:name,source:'test'}));
  return el;
}
function renderShapeList() {
  const key=SHAPE_TYPES.map(n=>`${n}:${Boolean(state.objects[n])}`).join("|")+`:${state.selected}`;
  if(key===lastShapeListKey)return;
  lastShapeListKey=key;
  objectList.replaceChildren();
  for(const name of SHAPE_TYPES){
    const present=Boolean(state.objects[name]);
    const line=document.createElement('div');line.className='shape-row';
    const nameBtn=document.createElement('button');
    nameBtn.type='button';nameBtn.className='shape-name';
    nameBtn.textContent=`${name==='sphere'?'●':name==='square'?'■':'▲'}  ${name}`;
    nameBtn.disabled=!present;
    if(state.selected===name)nameBtn.classList.add('active');
    nameBtn.addEventListener('click',()=>dispatchCommand({action:'select',target:name,source:'test'}));
    const control=document.createElement('button');
    control.type='button';control.className=present?'mini-button mini-danger':'mini-button';
    control.textContent=present?'Remove':'Add';
    control.setAttribute('aria-label',`${present?'Delete':'Add'} ${name}`);
    control.addEventListener('click',()=>dispatchCommand({action:present?'delete':'add',target:name,source:'test'}));
    line.append(nameBtn,control);objectList.appendChild(line);
  }
}
function render() {
  // Element nodes are created and removed only when a shape enters/leaves the scene.
  for(const name of SHAPE_TYPES) {
    const obj=state.objects[name];
    if(!obj){elements.get(name)?.remove();elements.delete(name);continue;}
    let el=elements.get(name);
    if(!el){el=elementFor(name);elements.set(name,el);}
    el.style.transform=`translate3d(${obj.x*PIXELS_PER_UNIT}px,${obj.z*PIXELS_PER_UNIT}px,0) rotateY(${obj.rotation}deg) rotateX(${obj.tilt}deg) scale(${obj.scale})`;
    el.style.setProperty('--shape-color',obj.color);
    el.classList.toggle('selected',state.selected===name);
    el.classList.toggle('hover',hoverName===name&&grabbedName!==name);
    el.classList.toggle('grabbed',grabbedName===name);
  }
  selectedLabel.textContent=state.selected?`Selected: ${state.selected}`:'Selected: none';
  countLabel.textContent=`${Object.keys(state.objects).length} / 3 shapes`;
  renderShapeList();
  document.getElementById('btn-undo').disabled=history.length===0;
}
function objectUnder(x,y) {
  const rect=stage.getBoundingClientRect();
  const px=x*rect.width,py=y*rect.height;
  let nearest=null,distance=GRAB_RADIUS_PX;
  for(const [name,obj] of Object.entries(state.objects)) {
    const ox=rect.width/2+obj.x*PIXELS_PER_UNIT;
    const oy=rect.height/2+obj.z*PIXELS_PER_UNIT;
    const d=Math.hypot(px-ox,py-oy);
    if(d<distance){distance=d;nearest=name;}
  }
  return nearest;
}
onPointer(p=>{
  pointerDot.style.display=p.visible?'block':'none';
  if(!p.visible){if(hoverName){hoverName=null;render();}return;}
  pointerDot.style.left=`${p.x*100}%`;
  pointerDot.style.top=`${p.y*100}%`;
  if(!grabbedName){const next=objectUnder(p.x,p.y);if(hoverName!==next){hoverName=next;render();}}
});

function handleCommand(cmd) {
  if(cmd.action==='grab') {
    if(grabbedName)return;
    const hit=objectUnder(cmd.x,cmd.y);
    if(hit){
      remember(snapshotScene(state));
      grabbedName=hit;
      grabOrigin={x:state.objects[hit].x,z:state.objects[hit].z};
      state.selected=hit;
      feedback(`Grabbing ${hit}.`);
      render();announceChange();
    }
    return;
  }
  if(cmd.action==='drag') {
    if(!grabbedName||!state.objects[grabbedName])return;
    // Absolute offset from grab time: tiny deltas never accumulate into drift.
    if(!Number.isFinite(cmd.totalDx)||!Number.isFinite(cmd.totalDy))return;
    const obj=state.objects[grabbedName];
    obj.x=clamp(grabOrigin.x+cmd.totalDx*CAMERA_WIDTH_UNITS,-2.7,2.7);
    obj.z=clamp(grabOrigin.z+cmd.totalDy*CAMERA_HEIGHT_UNITS,-1.6,1.6);
    render();announceChange();
    return;
  }
  if(cmd.action==='release') {
    grabbedName=null;grabOrigin=null;
    render();announceChange();
    return;
  }
  if(cmd.action==='rotation-start') {
    if(state.selected&&state.objects[state.selected]) remember(snapshotScene(state));
    render();return;
  }
  if(cmd.action==='rotate-gesture') {
    if(!state.selected||!state.objects[state.selected]||!Number.isFinite(cmd.dx)||!Number.isFinite(cmd.dy))return;
    const obj=state.objects[state.selected];
    obj.rotation+=cmd.dx*230;
    obj.tilt=clamp(obj.tilt+cmd.dy*160,-70,70);
    render();announceChange();return;
  }
  if(cmd.action==='rotation-end')return;
  if(cmd.action==='undo') {
    if(!history.length){feedback('Nothing to undo.',false);return;}
    state=history.pop();grabbedName=null;grabOrigin=null;hoverName=null;
    feedback('Last change undone.');render();announceChange();return;
  }
  // Remove/delete, add, select, recolor, scale, move and reset all use the
  // same pure scene-state logic, regardless of voice or mouse input.
  const before=snapshotScene(state);
  const outcome=applySceneCommand(state,cmd);
  if(outcome.changed){
    remember(before);
    if(grabbedName&&!state.objects[grabbedName]){grabbedName=null;grabOrigin=null;}
    if(hoverName&&!state.objects[hoverName])hoverName=null;
    render();announceChange();
  }
  feedback(outcome.message,outcome.changed);
}
onCommand(handleCommand);

// UI controls send the same commands as the voice controller: no duplicate logic.
document.getElementById('btn-delete-selected').addEventListener('click',()=>dispatchCommand({action:'delete',source:'test'}));
document.getElementById('btn-undo').addEventListener('click',()=>dispatchCommand({action:'undo',source:'test'}));
document.getElementById('btn-reset').addEventListener('click',()=>dispatchCommand({action:'reset',source:'test'}));
render();announceChange();
