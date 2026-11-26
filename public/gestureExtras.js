// Extra hand gestures: left pinch (resize), both open palms (zoom), thumbs up (restore).
import { dispatchCommand } from './commandBus.js';
import { GesturePointer } from './pointer.js';

const ZOOM_ARM_MS = 300;        // both palms must stay open this long before zoom starts
const ZOOM_DEADBAND = 0.004;    // ignore tiny changes in hand distance
const THUMB_HOLD_MS = 450;      // hold thumbs up this long to restore
const THUMB_COOLDOWN_MS = 1500; // minimum time between restores
const THUMB_MIN_CONFIDENCE = 0.7;

const sensitivitySlider = document.getElementById('sensitivity');

function palmCenter(lm) {
  const ids = [0, 5, 9, 13, 17];
  return {
    x: 1 - ids.reduce((sum, i) => sum + lm[i].x, 0) / ids.length,
    y: ids.reduce((sum, i) => sum + lm[i].y, 0) / ids.length
  };
}

function palmDistance(a, b, aspect) {
  const p = palmCenter(a);
  const q = palmCenter(b);
  return Math.hypot((p.x - q.x) * aspect, p.y - q.y);
}

// Left-hand pinch and vertical movement resizes the selected object.
const leftPointer = new GesturePointer({
  onGrab: () => dispatchCommand({ action: 'scale-start', source: 'gesture' }),
  onDrag: ({ dy }) => dispatchCommand({ action: 'scale-drag', dy, source: 'gesture' }),
  onRelease: ({ reason }) => dispatchCommand({ action: 'scale-end', reason, source: 'gesture' })
});

let zoomArmedAt = null;
let zoomActive = false;
let lastDistance = null;

function endZoom() {
  if (zoomActive) dispatchCommand({ action: 'zoom-end', source: 'gesture' });
  zoomActive = false;
  zoomArmedAt = null;
  lastDistance = null;
}

function updateZoom({ left, right, leftGesture, rightGesture, aspect, now }) {
  const bothOpen = left && right &&
    leftGesture === 'open_palm' && rightGesture === 'open_palm';

  if (!bothOpen) {
    endZoom();
    return;
  }

  const distance = palmDistance(left, right, aspect);
  if (zoomArmedAt === null) zoomArmedAt = now;

  if (!zoomActive) {
    if (now - zoomArmedAt >= ZOOM_ARM_MS) {
      zoomActive = true;
      lastDistance = distance;
      dispatchCommand({ action: 'zoom-start', source: 'gesture' });
    }
    return;
  }

  if (Math.abs(distance - lastDistance) < ZOOM_DEADBAND) return;

  // Hands moving apart => distance grows => factor below 1 => zoom in.
  const factor = lastDistance / distance;
  lastDistance = distance;
  dispatchCommand({ action: 'zoom', factor, source: 'gesture' });
}

let thumbSince = null;
let thumbFired = false;
let lastRevertAt = -Infinity;

function updateThumbs({ hands, now }) {
  const thumbsUp = hands.some(
    (hand) => hand.modelGesture === 'Thumb_Up' && hand.modelConfidence >= THUMB_MIN_CONFIDENCE
  );

  if (!thumbsUp) {
    thumbSince = null;
    thumbFired = false;
    return;
  }

  if (thumbSince === null) thumbSince = now;

  if (!thumbFired && now - thumbSince >= THUMB_HOLD_MS && now - lastRevertAt >= THUMB_COOLDOWN_MS) {
    thumbFired = true;
    lastRevertAt = now;
    dispatchCommand({ action: 'revert', source: 'gesture' });
  }
}

window.addEventListener('editor:hands', (event) => {
  const detail = event.detail;
  if (sensitivitySlider) leftPointer.settings.sensitivity = Number(sensitivitySlider.value) || 1;
  leftPointer.update(detail.left, detail.leftGesture, detail.now);
  updateZoom(detail);
  updateThumbs(detail);
});

window.addEventListener('editor:hands-reset', () => {
  leftPointer.reset();
  endZoom();
  thumbSince = null;
  thumbFired = false;
});
