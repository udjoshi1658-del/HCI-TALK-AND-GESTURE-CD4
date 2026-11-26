// Bridge between the Talk & Gesture controls and the embedded 3D editor.
const frame = document.getElementById('editor-frame');
const mount = document.getElementById('threejs-mount');

// ---- Tuning ----
const DRAG_STEP = 0.03;
const MOVE_AMOUNT = 0.15;
const DRAG_START_DELAY_MS = 200;
const ROT_STEP = 0.04;
const ROT_DEGREES = 15;
const ORBIT_SPEED = 3;
const SCALE_STEP = 0.04;
const SCALE_FACTOR = 1.06;
const MAX_STEPS = 3;
const CURSOR_MARGIN = 0.12;
const TAP_MAX_MS = 700;
const DOUBLE_PINCH_GAP_MS = 900;
const RING_MIN = 16;   // ring size in px when fully pinched
const RING_MAX = 46;   // ring size in px with an open hand
const DIR = { left: 'left', right: 'right', away: 'backward', toward: 'forward' };
// The finger cursor may only press these editor buttons.
const UI_SELECTOR = '[data-add], #delete-object, #undo-action';

// ---- Cursor ----
const style = document.createElement('style');
style.textContent = `
#gesture-cursor{position:absolute;left:0;top:0;width:var(--ring,40px);height:var(--ring,40px);border-radius:50%;
  border:2px solid #5CE1E6;background:rgba(92,225,230,.08);box-shadow:0 0 14px rgba(92,225,230,.5);
  transform:translate(-50%,-50%);pointer-events:none;z-index:5;display:none;
  transition:width .08s,height .08s,border-color .15s,background .15s,box-shadow .15s}
#gesture-cursor::after{content:'';position:absolute;left:50%;top:50%;width:6px;height:6px;margin:-3px 0 0 -3px;
  border-radius:50%;background:#5CE1E6;transition:background .15s}
#gesture-cursor.over{border-color:#E6ECF7;box-shadow:0 0 16px rgba(230,236,247,.6)}
#gesture-cursor.over::after{background:#E6ECF7}
#gesture-cursor.down{background:rgba(92,225,230,.25)}
#gesture-cursor.snap{border-color:#FFB347;background:rgba(255,179,71,.25);box-shadow:0 0 22px rgba(255,179,71,.85)}
#gesture-cursor.snap::after{background:#FFB347}
`;
document.head.appendChild(style);

const cursor = document.createElement('div');
cursor.id = 'gesture-cursor';
if (mount) mount.appendChild(cursor);

let snapTimer = null;
function snapCursor() {
  cursor.classList.add('snap');
  clearTimeout(snapTimer);
  snapTimer = setTimeout(() => cursor.classList.remove('snap'), 350);
}

// The ring tightens as the pinch ratio drops.
window.addEventListener('editor:pinch', (event) => {
  const ratio = event.detail ? event.detail.ratio : null;
  if (ratio == null || !Number.isFinite(ratio)) {
    cursor.style.setProperty('--ring', `${(RING_MIN + RING_MAX) / 2}px`);
    return;
  }
  const t = Math.max(0, Math.min(1, (ratio - 0.25) / 0.65));
  cursor.style.setProperty('--ring', `${Math.round(RING_MIN + t * (RING_MAX - RING_MIN))}px`);
});

// ---- Helpers ----
const clamp01 = (n) => Math.max(0, Math.min(1, n));

function toEditorSpace(x, y) {
  const span = 1 - 2 * CURSOR_MARGIN;
  return { nx: clamp01((x - CURSOR_MARGIN) / span), ny: clamp01((y - CURSOR_MARGIN) / span) };
}

function editorCall(name, ...args) {
  const w = frame && frame.contentWindow;
  if (!w || typeof w[name] !== 'function') return undefined;
  return w[name](...args);
}

function feedback(message, success = true) {
  window.dispatchEvent(new CustomEvent('editor:scene-feedback', { detail: { message, success } }));
}

function send(cmd) {
  const w = frame && frame.contentWindow;
  if (!w || typeof w.executeCommand !== 'function') {
    feedback('3D editor not ready', false);
    return false;
  }
  w.executeCommand(cmd);
  return true;
}

function selectTarget(c) {
  if (c.target) send({ action: 'select', target: c.target });
}

function prettyName(name) {
  return String(name).replace(/_(\d+)$/, ' $1').replace(/^./, (ch) => ch.toUpperCase());
}

// ---- Editor buttons under the cursor (only Add, Delete selected, Undo) ----
let uiHover = null;

function ensureFrameStyle(doc) {
  if (doc.getElementById('gesture-ui-style')) return;
  const s = doc.createElement('style');
  s.id = 'gesture-ui-style';
  s.textContent = '.gesture-hover{outline:2px solid #5CE1E6 !important;outline-offset:2px;filter:brightness(1.4)}';
  doc.head.appendChild(s);
}

function uiTargetAt(nx, ny) {
  try {
    const doc = frame.contentDocument;
    if (!doc) return null;
    ensureFrameStyle(doc);
    const el = doc.elementFromPoint(nx * frame.clientWidth, ny * frame.clientHeight);
    const btn = el && el.closest ? el.closest(UI_SELECTOR) : null;
    return btn && !btn.disabled ? btn : null;
  } catch (error) {
    return null;
  }
}

function setUiHover(btn) {
  if (btn === uiHover) return;
  if (uiHover) uiHover.classList.remove('gesture-hover');
  uiHover = btn;
  if (btn) btn.classList.add('gesture-hover');
}

// ---- Selection status ----
let selected = null;
let carrying = false; // a newly added object follows the fingertip until the next double pinch

function flash(message) {
  feedback(message);
}

window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin) return;
  const data = event.data;
  if (!data || data.type !== 'editor-selection') return;
  selected = data.name || null;
  if (!selected) carrying = false;
  if (selected) {
    cursor.classList.remove('over');
    editorCall('clearHover');
    feedback(`Selected ${prettyName(selected)}. Pinch and move to reposition it, or double pinch to release.`);
  } else {
    feedback('Nothing selected.');
  }
});

// ---- Cursor and hover ----
let lastCursor = { nx: 0.5, ny: 0.5 };

window.addEventListener('editor:pointer', (event) => {
  const p = event.detail;
  if (!p || !p.visible) {
    cursor.style.display = 'none';
    cursor.classList.remove('over', 'down');
    setUiHover(null);
    editorCall('clearHover');
    return;
  }

  const { nx, ny } = toEditorSpace(p.x, p.y);
  lastCursor = { nx, ny };

  const rect = frame.getBoundingClientRect();
  const mountRect = mount.getBoundingClientRect();
  cursor.style.display = 'block';
  cursor.style.left = `${rect.left - mountRect.left + nx * rect.width}px`;
  cursor.style.top = `${rect.top - mountRect.top + ny * rect.height}px`;

  if (carrying) {
    setUiHover(null);
    cursor.classList.add('over');
    editorCall('placeSelectedAt', nx, ny);
    return;
  }

  const btn = uiTargetAt(nx, ny);
  setUiHover(btn);

  if (btn) {
    cursor.classList.add('over');
    editorCall('clearHover');
  } else if (selected) {
    cursor.classList.remove('over');
  } else {
    const hovered = editorCall('setHover', nx, ny);
    cursor.classList.toggle('over', Boolean(hovered));
  }
});

// ---- Gesture state ----
let grabInfo = null;
let dragging = false;
let dragX = 0;
let dragY = 0;
let rotX = 0;
let scaleAcc = 0;
let lastTapReleaseAt = -Infinity;

function stepAxis(acc, step, onStep) {
  let n = 0;
  while (Math.abs(acc) >= step && n < MAX_STEPS) {
    const sign = Math.sign(acc);
    onStep(sign);
    acc -= sign * step;
    n++;
  }
  return acc;
}

function pressButton(btn) {
  const label = (btn.textContent || '').trim().replace(/^\+\s*/, '');
  btn.click();

  if (btn.dataset && btn.dataset.add) {
    if (editorCall('placeSelectedAt', lastCursor.nx, lastCursor.ny)) {
      carrying = true;
      flash(`${label} added. Move your hand to position it, then double pinch to place it.`);
    } else {
      flash(`${label} added.`);
    }
  } else {
    flash(`${label} done.`);
  }
}

function handleDoublePinch(info) {
  snapCursor();

  if (carrying) {
    carrying = false;
    flash('Object placed. Double pinch again to release the selection.');
    return;
  }

  const btn = uiTargetAt(info.nx, info.ny);
  if (btn) {
    pressButton(btn);
    return;
  }

  const w = frame && frame.contentWindow;
  if (!w || typeof w.gestureSelectAt !== 'function') {
    flash('The 3D editor needs the latest build before gestures can select objects.');
    return;
  }
  if (selected) {
    w.gestureDeselect();
    return;
  }
  const name = w.gestureSelectAt(info.nx, info.ny);
  if (!name) flash('No object under the cursor. Point at an object and try again.');
}

window.addEventListener('editor:command', (e) => {
  const c = e.detail;
  switch (c.action) {
    // ---- Voice, typed and menu commands ----
    case 'add':
      if (c.target && send({ action: 'add', type: c.target })) feedback(`Added ${prettyName(c.target)}`);
      break;
    case 'select':
      selectTarget(c);
      break;
    case 'delete':
      selectTarget(c);
      send({ action: 'delete' });
      feedback('Deleted');
      break;
    case 'move':
      selectTarget(c);
      send({ action: 'move', direction: c.direction, amount: c.amount });
      break;
    case 'rotate':
      selectTarget(c);
      send({ action: 'rotate', amount: c.direction === 'left' ? ROT_DEGREES : -ROT_DEGREES });
      break;
    case 'scale':
      selectTarget(c);
      send({ action: 'scale', amount: c.factor });
      break;
    case 'recolor':
      selectTarget(c);
      send({ action: 'color', color: c.color });
      break;
    case 'undo':
      send({ action: 'undo' });
      break;
    case 'deselect':
      editorCall('gestureDeselect');
      break;

    // ---- Right hand: pinch to move, double pinch to select, press or release ----
    case 'grab': {
      const { nx, ny } = toEditorSpace(c.x, c.y);
      grabInfo = { t: performance.now(), nx, ny, moved: false };
      dragging = false;
      dragX = 0;
      dragY = 0;
      cursor.classList.add('down');
      break;
    }
    case 'drag': {
      if (!selected || !grabInfo || carrying) break;
      if (performance.now() - grabInfo.t < DRAG_START_DELAY_MS) break;
      dragging = true;
      dragX += c.dx;
      dragY += c.dy;
      dragX = stepAxis(dragX, DRAG_STEP, (s) => {
        grabInfo.moved = true;
        send({ action: 'move', direction: s > 0 ? DIR.right : DIR.left, amount: MOVE_AMOUNT });
      });
      dragY = stepAxis(dragY, DRAG_STEP, (s) => {
        grabInfo.moved = true;
        send({ action: 'move', direction: s > 0 ? DIR.toward : DIR.away, amount: MOVE_AMOUNT });
      });
      break;
    }
    case 'release': {
      cursor.classList.remove('down');
      dragging = false;
      const info = grabInfo;
      grabInfo = null;
      dragX = 0;
      dragY = 0;
      const deliberate = c.reason === 'pinch_end' || c.reason === 'open_palm';
      if (info && deliberate && !info.moved) {
        const now = performance.now();
        if (now - info.t <= TAP_MAX_MS) {
          if (info.t - lastTapReleaseAt <= DOUBLE_PINCH_GAP_MS) {
            lastTapReleaseAt = -Infinity;
            handleDoublePinch(info);
          } else {
            lastTapReleaseAt = now;
          }
        }
      }
      break;
    }

    // ---- Left hand: fist rotates the object, or orbits the view when nothing is selected ----
    case 'rotation-start':
      rotX = 0;
      break;
    case 'rotate-gesture':
      if (selected) {
        rotX += c.dx;
        rotX = stepAxis(rotX, ROT_STEP, (s) =>
          send({ action: 'rotate', amount: s > 0 ? -ROT_DEGREES : ROT_DEGREES }));
      } else {
        editorCall('orbitBy', c.dx * ORBIT_SPEED, c.dy * ORBIT_SPEED);
      }
      break;
    case 'rotation-end':
      rotX = 0;
      break;

    // ---- Left hand: pinch and move up or down resizes the selected object ----
    case 'scale-start':
      scaleAcc = 0;
      break;
    case 'scale-drag':
      if (!selected) break;
      scaleAcc += -c.dy;
      scaleAcc = stepAxis(scaleAcc, SCALE_STEP, (s) =>
        send({ action: 'scale', amount: s > 0 ? SCALE_FACTOR : 1 / SCALE_FACTOR }));
      break;
    case 'scale-end':
      scaleAcc = 0;
      break;

    // ---- Both open palms: zoom the view ----
    case 'zoom':
      editorCall('zoomBy', c.factor);
      break;

    // ---- Thumbs up: restore the object to where it was when selected ----
    case 'revert':
      if (!selected) {
        flash('No object selected.');
      } else if (editorCall('revertSelected')) {
        flash(`${prettyName(selected)} restored to its original position.`);
      }
      break;

    default:
      break;
  }
});
