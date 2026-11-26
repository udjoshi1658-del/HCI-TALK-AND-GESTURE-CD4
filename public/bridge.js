// Bridge between the Talk & Gesture controls and the embedded 3D editor.
const frame = document.getElementById('editor-frame');
const mount = document.getElementById('threejs-mount');
const note = document.querySelector('.editor-panel .integration-note');
const noteIcon = note ? note.querySelector('.integration-icon') : null;
const noteTitle = note ? note.querySelector('b') : null;
const noteHint = note ? note.querySelector('p') : null;

// ---- Tuning ----
const DRAG_STEP = 0.03;          // right-hand travel per move step (0-1 of camera width)
const MOVE_AMOUNT = 0.15;        // scene distance per move step
const DRAG_START_DELAY_MS = 200; // ignore movement right after a pinch starts
const ROT_STEP = 0.04;           // left-fist travel per object rotation step
const ROT_DEGREES = 15;          // degrees per rotation step
const ORBIT_SPEED = 3;           // radians of camera orbit per full-width fist travel
const SCALE_STEP = 0.04;         // left-pinch vertical travel per resize step
const SCALE_FACTOR = 1.06;       // size change per resize step
const MAX_STEPS = 3;             // cap per event so fast hands do not flood the editor
const CURSOR_MARGIN = 0.12;      // unused edge of the camera frame, so edges are reachable
const TAP_MAX_MS = 700;          // longest pinch that still counts as a tap
const DOUBLE_PINCH_GAP_MS = 900; // longest pause between the two taps
// Direction names used by the editor ("Further" = backward, "Closer" = forward)
const DIR = { left: 'left', right: 'right', away: 'backward', toward: 'forward' };

const NONE_TITLE = 'No object selected';
const NONE_HINT = 'Point at an object with your right index finger and double pinch to select it. Left fist and move rotates the view. Both open palms, moved apart or together, zoom.';
const SELECTED_HINT = 'Right pinch and move repositions it. Left fist rotates it. Left pinch and move up or down resizes it. Thumbs up restores its original position. Double pinch releases it. Guides: red = left/right, blue = closer/further.';

// ---- Styles and cursor ----
const style = document.createElement('style');
style.textContent = `
.threejs-mount{position:relative;display:block;min-height:560px;border-style:solid}
.threejs-mount iframe{position:absolute;inset:0;width:100%;height:100%;min-height:0;border:0}
#gesture-cursor{position:absolute;left:0;top:0;width:26px;height:26px;border-radius:50%;
  border:2px solid #ffd479;background:rgba(255,212,121,.15);box-shadow:0 0 12px rgba(255,212,121,.6);
  transform:translate(-50%,-50%);pointer-events:none;z-index:5;display:none;
  transition:width .12s,height .12s,background .12s,border-color .12s,box-shadow .12s}
#gesture-cursor.over{border-color:#4ddab0;box-shadow:0 0 16px rgba(77,218,176,.85)}
#gesture-cursor.down{width:12px;height:12px;background:#ffd479}
`;
document.head.appendChild(style);

const cursor = document.createElement('div');
cursor.id = 'gesture-cursor';
if (mount) mount.appendChild(cursor);

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

// ---- Selection status ----
let selected = null;
let flashTimer = null;

function renderStatus() {
  if (noteTitle) noteTitle.textContent = selected ? `Selected: ${prettyName(selected)}` : NONE_TITLE;
  if (noteHint) noteHint.textContent = selected ? SELECTED_HINT : NONE_HINT;
  if (noteIcon) noteIcon.textContent = selected ? '●' : '○';
}

function flash(message) {
  if (!noteHint) return;
  noteHint.textContent = message;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(renderStatus, 2500);
}

window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin) return;
  const data = event.data;
  if (!data || data.type !== 'editor-selection') return;
  selected = data.name || null;
  if (selected) {
    cursor.classList.remove('over');
    editorCall('clearHover');
  }
  renderStatus();
});

renderStatus();

// ---- Cursor and hover ----
let lastCursor = { nx: 0.5, ny: 0.5 };

window.addEventListener('editor:pointer', (event) => {
  const p = event.detail;
  if (!p || !p.visible) {
    cursor.style.display = 'none';
    cursor.classList.remove('over', 'down');
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

  if (selected) {
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

function handleDoublePinch(info) {
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
    // ---- Voice and typed commands ----
    case 'add':
      if (c.target && send({ action: 'add', type: c.target })) feedback(`Added ${c.target}`);
      break;
    case 'select':
      selectTarget(c);
      feedback(`Selected ${c.target}`);
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

    // ---- Right hand: pinch to move, double pinch to select or release ----
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
      if (!selected || !grabInfo) break;
      if (performance.now() - grabInfo.t < DRAG_START_DELAY_MS) break;
      if (!dragging) {
        dragging = true;
        editorCall('setDimOthers', true);
      }
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
      if (dragging) {
        editorCall('setDimOthers', false);
        dragging = false;
      }
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
      scaleAcc += -c.dy; // hand up = positive = larger
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
