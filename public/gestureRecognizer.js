// Inspired by Hand2Robot's normalized pinch hysteresis, rewritten for this app.
// Per-hand state machine. Frame debouncing prevents one bad landmark frame from
// dropping a held object. Time-based dropout handling prevents FPS dependence.
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const dist = (a, b, aspect) => Math.hypot((a.x-b.x)*aspect, a.y-b.y);

export const SETTINGS = {
  pinchOn: 0.29,     // thumb/index distance divided by palm width
  pinchOff: 0.49,    // larger than pinchOn = hysteresis
  framesToConfirm: 3,
  framesToRelease: 6,
  trackingGraceMs: 450,
  preferFist: false,
};

export class GestureRecognizer {
  constructor(onChange = () => {}, settings = {}) {
    this.onChange = onChange;
    this.s = { ...SETTINGS, ...settings };
    this.reset();
  }
  reset() {
    this.current = 'none';
    this.candidate = 'none';
    this.candidateCount = 0;
    this.pinchRatio = null;
    this.pinching = false;
    this.lastSeen = null;
  }
  classify(lm, aspect) {
    // Hand2Robot normalizes with index-MCP to pinky-MCP palm width.
    const palmWidth = Math.max(0.035, dist(lm[5], lm[17], aspect));
    const thumbIndex = dist(lm[4], lm[8], aspect);
    this.pinchRatio = thumbIndex / palmWidth;

    // Four bent fingers distinguish a fist from a pinch. Fingertip being
    // closer to wrist than middle joint is a useful 2D bend cue.
    const bent = [[8,6],[12,10],[16,14],[20,18]]
      .filter(([tip,pip]) => dist(lm[tip], lm[0], aspect) <
        dist(lm[pip], lm[0], aspect) * 1.08).length;
    const isFist = bent >= 4;
    const isOpen = bent === 0 &&
      [8,12,16,20].every((tip, i) =>
        dist(lm[tip], lm[0], aspect) >
        dist(lm[[6,10,14,18][i]], lm[0], aspect)*1.14);

    // A closed fist takes priority over a pinch: left-hand fist = rotate.
    if (isFist && this.s.preferFist) {
      this.pinching = false;
      return 'fist';
    }
    if (this.pinching) {
      if (this.pinchRatio > this.s.pinchOff) this.pinching = false;
    } else if (this.pinchRatio < this.s.pinchOn) {
      this.pinching = true;
    }
    if (this.pinching) return 'pinch';
    if (isFist) return 'fist';
    if (isOpen) return 'open_palm';
    if (bent >= 3) return 'fist';
    return 'none';
  }
  update(lm, aspect = 4/3, now = performance.now(), modelGesture = 'None', modelConfidence = 0) {
    if (!lm || lm.length !== 21) {
      this.pinchRatio = null;
      if (this.lastSeen !== null && now - this.lastSeen >= this.s.trackingGraceMs) {
        this.pinching = false;
        this.settle('none', true);
      }
      return { gesture: this.current, pinchRatio: null, tracking: false };
    }
    this.lastSeen = now;
    let raw = this.classify(lm, aspect);
    // Trained classification (as in Hand2Robot) is more reliable for fists.
    // Pinch is not a built-in model gesture, so it keeps landmark hysteresis.
    if (this.s.preferFist && modelGesture === 'Closed_Fist' && modelConfidence >= 0.62) {
      this.pinching = false;
      raw = 'fist';
    }
    if (this.s.preferFist && modelGesture === 'Open_Palm' && modelConfidence >= 0.75 && raw === 'fist') {
      raw = 'open_palm';
    }
    this.settle(raw);
    return { gesture: this.current, pinchRatio: this.pinchRatio, tracking: true };
  }
  settle(raw, force = false) {
    if (this.current === raw) {
      this.candidate = raw;
      this.candidateCount = 0;
      return;
    }
    if (this.candidate !== raw) {
      this.candidate = raw;
      this.candidateCount = 0;
    }
    this.candidateCount++;
    const needed = this.current === 'pinch' || this.current === 'fist'
      ? this.s.framesToRelease : this.s.framesToConfirm;
    if (force || this.candidateCount >= needed) {
      const previous = this.current;
      this.current = raw;
      this.candidateCount = 0;
      this.onChange(raw, previous);
    }
  }
}
