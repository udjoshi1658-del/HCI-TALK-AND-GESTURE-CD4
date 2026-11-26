// Pure editor state: the test stage and the future Three.js adapter can share this model.
export const SHAPE_TYPES = Object.freeze(['sphere','square','triangle']);
const HOME = Object.freeze({
  square:   {x:-1.15,z:-0.30,rotation:0,tilt:0,scale:1,color:'#6598ff'},
  sphere:   {x: 1.15,z:-0.30,rotation:0,tilt:0,scale:1,color:'#43cdb2'},
  triangle: {x: 0.00,z: 0.85,rotation:0,tilt:0,scale:1,color:'#f4c96b'},
});
const clamp = (v,min,max) => Math.min(max,Math.max(min,v));
export const isShape = (name) => SHAPE_TYPES.includes(name);
export function createInitialScene() {
  return {selected:'square',objects:{square:{...HOME.square},sphere:{...HOME.sphere}}};
}
export function snapshotScene(state) {return JSON.parse(JSON.stringify(state));}
export function sceneSummary(state) {
  return {selected:state.selected, shapes: SHAPE_TYPES.filter(s => Boolean(state.objects[s])), objects:snapshotScene(state).objects};
}
// Mutates the supplied state only after validating the command.
export function applySceneCommand(state,cmd) {
  const action=cmd?.action;
  const target=cmd?.target || state.selected;
  if (action==='add') {
    if (!isShape(cmd.target)) return {changed:false,message:'Only sphere, square and triangle are supported.'};
    if (state.objects[cmd.target]) return {changed:false,message:`${cmd.target} is already in the test area (one of each shape).`};
    state.objects[cmd.target]={...HOME[cmd.target]};
    state.selected=cmd.target;
    return {changed:true,message:`Added ${cmd.target}.`};
  }
  if (action==='delete') {
    if (!isShape(target) || !state.objects[target]) return {changed:false,message:`No ${target||'shape'} to delete.`};
    delete state.objects[target];
    if (state.selected===target) state.selected=SHAPE_TYPES.find(n=>Boolean(state.objects[n]))||null;
    return {changed:true,message:`Deleted ${target}.`};
  }
  if (action==='select') {
    if (!isShape(cmd.target) || !state.objects[cmd.target]) return {changed:false,message:`${cmd.target||'That shape'} is not in the test area. Say “add ${cmd.target||'sphere'}”.`};
    if (state.selected===cmd.target) return {changed:false,message:`${cmd.target} is already selected.`};
    state.selected=cmd.target;
    return {changed:true,message:`Selected ${cmd.target}.`};
  }
  if (action==='deselect') {
    if (!state.selected) return {changed:false,message:'Nothing is selected.'};
    state.selected=null;
    return {changed:true,message:'Selection cleared.'};
  }
  if (action==='clear') {
    if (!Object.keys(state.objects).length) return {changed:false,message:'The test area is already empty.'};
    state.objects={};state.selected=null;
    return {changed:true,message:'Cleared all shapes.'};
  }
  if (action==='reset') {
    const fresh=createInitialScene();
    if (JSON.stringify(fresh)===JSON.stringify(state)) return {changed:false,message:'The demo is already in its default state.'};
    state.objects=fresh.objects;state.selected=fresh.selected;
    return {changed:true,message:'Demo reset: square and sphere restored.'};
  }
  if (!['move','rotate','scale','recolor'].includes(action)) return {changed:false,message:'Unsupported action.'};
  if (!target || !state.objects[target]) return {changed:false,message:`Select or add a shape before ${action}.`};
  const obj=state.objects[target];
  if (action==='move') {
    const v=Number(cmd.amount);
    const amount=Number.isFinite(v)&&v>0?Math.min(v,2):0.5;
    if (cmd.direction==='left') obj.x=clamp(obj.x-amount,-2.7,2.7);
    else if (cmd.direction==='right') obj.x=clamp(obj.x+amount,-2.7,2.7);
    else if (cmd.direction==='up'||cmd.direction==='forward') obj.z=clamp(obj.z-amount,-1.6,1.6);
    else if (cmd.direction==='down'||cmd.direction==='backward') obj.z=clamp(obj.z+amount,-1.6,1.6);
    else return {changed:false,message:'Unknown movement direction.'};
  } else if (action==='rotate') {
    obj.rotation+= (cmd.direction==='left'?1:-1) * (Number.isFinite(cmd.angle)?cmd.angle:15);
  } else if (action==='scale') {
    if (!Number.isFinite(cmd.factor)||cmd.factor<=0) return {changed:false,message:'Invalid scale.'};
    obj.scale=clamp(obj.scale*cmd.factor,0.4,2.5);
  } else if (action==='recolor') {
    if (!/^#[0-9a-f]{6}$/i.test(cmd.hex||'')) return {changed:false,message:'Invalid color.'};
    obj.color=cmd.hex;
  }
  state.selected=target;
  return {changed:true,message:`Updated ${target}: ${action}.`};
}
