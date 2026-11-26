// Hand tracking: 2 hands, MediaPipe GestureRecognizer with trained fist model.
// Uses MediaPipe category handedness; raw non-mirrored webcam labels are reversed
// because the model assumes selfie/mirrored input (UI lets user correct this).
const VERSION = '0.10.14';
const BUNDLE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/vision_bundle.mjs`;
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';
export function mapHandedness(categoryName, swap = true) {
  const name = String(categoryName || '').toLowerCase();
  const side = name === 'left' ? 'left' : name === 'right' ? 'right' : 'unknown';
  if (!swap || side === 'unknown') return side;
  return side === 'left' ? 'right' : 'left';
}
export class HandTracker {
  constructor({video,onStatus,onHand,onError}) {
    this.video=video;
    this.onStatus=onStatus || (()=>{});
    this.onHand=onHand || (()=>{});
    this.onError=onError || (()=>{});
    this.swapHandedness=true;
    this.model=null;
    this.stream=null;
    this.running=false;
    this.busy=false;
    this.rafId=null;
    this.lastVideoTime=-1;
    this.frameCount=0;
    this.fpsStart=performance.now();
    this.fps=0;
    this._loop=()=>this._processFrame();
  }
  async enable() {
    if (this.running || this.busy) return;
    this.busy=true;
    try {
      this.onStatus('loading');
      await this._loadModel();
      this.onStatus('starting-camera');
      this.stream=await navigator.mediaDevices.getUserMedia({
        video: {width:{ideal:640},height:{ideal:480},frameRate:{ideal:30},facingMode:'user'},
        audio:false
      });
      this.video.srcObject=this.stream;
      await this.video.play();
      this.running=true;
      this.lastVideoTime=-1;
      this.frameCount=0;
      this.fpsStart=performance.now();
      this.onStatus('tracking');
      this.rafId=requestAnimationFrame(this._loop);
    } catch(e) {
      this._stopCamera();
      this.onStatus('error');
      this.onError(`Hand tracking failed: ${e.message}`);
    } finally { this.busy=false; }
  }
  async _loadModel() {
    if (this.model) return;
    const vision=await import(BUNDLE_URL);
    const fileset=await vision.FilesetResolver.forVisionTasks(WASM_URL);
    const options=(delegate)=>({
      baseOptions:{modelAssetPath:MODEL_URL,delegate},
      runningMode:'VIDEO',numHands:2,
      minHandDetectionConfidence:0.45,
      minHandPresenceConfidence:0.45,
      minTrackingConfidence:0.42
    });
    try {
      this.model=await vision.GestureRecognizer.createFromOptions(fileset,options('GPU'));
    } catch(e) {
      console.warn('GPU model unavailable, using CPU',e);
      this.model=await vision.GestureRecognizer.createFromOptions(fileset,options('CPU'));
    }
  }
  disable() {
    this.running=false;
    if (this.rafId!==null) cancelAnimationFrame(this.rafId);
    this.rafId=null;
    this._stopCamera();
    this.onHand([],{fps:0,now:performance.now()});
    this.onStatus('stopped');
  }
  _stopCamera() {
    if (this.stream) this.stream.getTracks().forEach(t=>t.stop());
    this.stream=null;
    this.video.srcObject=null;
  }
  _processFrame() {
    if (!this.running) return;
    try {
      if (this.video.readyState>=2 && this.video.currentTime!==this.lastVideoTime) {
        this.lastVideoTime=this.video.currentTime;
        const now=performance.now();
        const result=this.model.recognizeForVideo(this.video,now);
        const hands=(result.landmarks||[]).map((lm,i)=>({
          landmarks:lm,
          handedness:mapHandedness(result.handednesses?.[i]?.[0]?.categoryName,this.swapHandedness),
          score:result.handednesses?.[i]?.[0]?.score ?? 0,
          modelGesture:result.gestures?.[i]?.[0]?.categoryName || 'None',
          modelConfidence:result.gestures?.[i]?.[0]?.score ?? 0
        }));
        this.frameCount++;
        const elapsed=now-this.fpsStart;
        if (elapsed>=1000) {
          this.fps=Math.round(this.frameCount*1000/elapsed);
          this.frameCount=0;
          this.fpsStart=now;
        }
        this.onHand(hands,{fps:this.fps,now});
      }
    } catch(e) {
      this.onError(`Tracking loop: ${e.message}`);
      this.disable();
      return;
    }
    this.rafId=requestAnimationFrame(this._loop);
  }
}
