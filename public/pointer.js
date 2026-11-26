// Right-hand pinch for dragging; left-hand fist for rotating selected object.
// Positions remain index-tip-based before and during pinch: no pointer jump.
export const POINTER_SETTINGS = {
  smoothing: 0.42,
  idleSmoothing: 0.10,
  idleRadius: 0.012,
  dragDeadband: 0.009,
  deadzone: 0.0025,
  sensitivity: 1,
  trackingGraceMs: 450,
  maxFrameStep: 0.075,
};
const clamp = (n,a,b) => Math.max(a, Math.min(b,n));
const palmCenter = (lm) => {
  const ids = [0,5,9,13,17];
  return { x: 1 - ids.reduce((s,i)=>s+lm[i].x,0)/ids.length,
           y: ids.reduce((s,i)=>s+lm[i].y,0)/ids.length };
};

export class GesturePointer {
  constructor(callbacks = {}, settings = {}) {
    this.onPointer = callbacks.onPointer || (()=>{});
    this.onGrab = callbacks.onGrab || (()=>{});
    this.onDrag = callbacks.onDrag || (()=>{});
    this.onRelease = callbacks.onRelease || (()=>{});
    this.onRotateStart = callbacks.onRotateStart || (()=>{});
    this.onRotate = callbacks.onRotate || (()=>{});
    this.onRotateEnd = callbacks.onRotateEnd || (()=>{});
    this.settings = {...POINTER_SETTINGS,...settings};
    this.reset();
  }
  reset() {
    if (this.grabbing) this.onRelease({ reason: 'reset' });
    if (this.rotating) this.onRotateEnd({ reason: 'reset' });
    this.smooth = null;
    this.lastDrag = null;
    this.dragAnchor = null;
    this.dragCommitted = null;
    this.lastSeen = null;
    this.grabbing = false;
    this.rotating = false;
    this.rotationSmooth = null;
    this.lastRotation = null;
    this.rotationLastSeen = null;
    this.pointerVisible = false;
    this.onPointer({ x:0, y:0, visible:false });
  }
  smoothTo(old, target) {
    if (!old) return {...target};
    const maxStep = this.settings.maxFrameStep;
    const dx = target.x-old.x, dy = target.y-old.y;
    const magnitude = Math.hypot(dx,dy);
    const factor = magnitude > maxStep ? maxStep/magnitude : 1;
    const alpha = magnitude < this.settings.idleRadius ? this.settings.idleSmoothing : this.settings.smoothing;
    return {x: clamp(old.x + dx * factor * alpha,0,1),
            y: clamp(old.y + dy * factor * alpha,0,1)};
  }
  update(lm, gesture, now = performance.now()) {
    if (!lm) {
      if (this.lastSeen !== null && now-this.lastSeen > this.settings.trackingGraceMs) {
        if (this.grabbing) this.release('hand_lost');
        this.smooth = null;
        this.lastDrag = null;
      }
      if (this.pointerVisible) {
        this.pointerVisible = false;
        this.onPointer({x:0,y:0,visible:false});
      }
      return;
    }
    this.lastSeen = now;
    // Mirror the *camera* coordinates to match the mirrored preview.
    const target = {x: clamp(1-lm[8].x,0,1), y: clamp(lm[8].y,0,1)};
    this.smooth = this.smoothTo(this.smooth,target);
    this.pointerVisible = true;
    this.onPointer({...this.smooth,visible:true});

    if (gesture === 'pinch') {
      if (!this.grabbing) {
        this.grabbing = true;
        this.lastDrag = {...this.smooth};
        this.dragAnchor = {...this.smooth};
        this.dragCommitted = {...this.smooth};
        this.onGrab({...this.smooth});
      } else {
        const dx = this.smooth.x-this.dragCommitted.x;
        const dy = this.smooth.y-this.dragCommitted.y;
        if (Math.hypot(dx,dy) >= this.settings.dragDeadband) {
          this.dragCommitted = {...this.smooth};
          this.onDrag({ ...this.smooth, dx: dx*this.settings.sensitivity,
            dy: dy*this.settings.sensitivity,
            totalDx: (this.smooth.x-this.dragAnchor.x)*this.settings.sensitivity,
            totalDy: (this.smooth.y-this.dragAnchor.y)*this.settings.sensitivity });
        }
      }
    } else if (this.grabbing) {
      // GestureRecognizer already debounced release across multiple frames.
      this.release(gesture === 'open_palm' ? 'open_palm' : 'pinch_end');
    }
  }
  release(reason) {
    if (!this.grabbing) return;
    this.grabbing = false;
    this.lastDrag = null;
    this.dragAnchor = null;
    this.dragCommitted = null;
    this.onRelease({reason});
  }
  updateRotation(lm, gesture, now = performance.now()) {
    if (!lm) {
      if (this.rotationLastSeen !== null &&
          now-this.rotationLastSeen > this.settings.trackingGraceMs) {
        this.endRotation('hand_lost');
        this.rotationSmooth = null;
        this.lastRotation = null;
      }
      return;
    }
    this.rotationLastSeen = now;
    if (gesture !== 'fist') {
      this.endRotation('fist_opened');
      this.rotationSmooth = null;
      return;
    }
    this.rotationSmooth = this.smoothTo(this.rotationSmooth,palmCenter(lm));
    if (!this.rotating) {
      this.rotating = true;
      this.lastRotation = {...this.rotationSmooth};
      this.onRotateStart();
      return;
    }
    const dx = this.rotationSmooth.x-this.lastRotation.x;
    const dy = this.rotationSmooth.y-this.lastRotation.y;
    if (Math.hypot(dx,dy)>=this.settings.deadzone) {
      this.lastRotation = {...this.rotationSmooth};
      this.onRotate({dx:dx*this.settings.sensitivity,dy:dy*this.settings.sensitivity});
    }
  }
  endRotation(reason) {
    if (!this.rotating) return;
    this.rotating = false;
    this.lastRotation = null;
    this.onRotateEnd({reason});
  }
}
