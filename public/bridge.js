const frame = document.getElementById('editor-frame');

// Tuning knobs
const DRAG_STEP = 0.03;   // hand travel (0-1 of camera width) per move step
const MOVE_AMOUNT = 0.15; // distance per move step in the 3D scene
const ROT_STEP = 0.04;    // fist travel per rotate step
const ROT_DEGREES = 15;   // degrees per rotate step
const MAX_STEPS = 3;      // cap per frame so fast hands don't flood the editor
// Her editor: "Further" = backward, "Closer" = forward
const DIR = { left: 'left', right: 'right', away: 'backward', toward: 'forward' };

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

let dragX = 0, dragY = 0, rotX = 0;

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

window.addEventListener('editor:command', (e) => {
  const c = e.detail;
  switch (c.action) {
    // Voice and typed commands
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

    // Right-hand pinch: move the selected object
    case 'grab':
      dragX = 0; dragY = 0;
      break;
    case 'drag':
      dragX += c.dx; dragY += c.dy;
      dragX = stepAxis(dragX, DRAG_STEP, (s) =>
        send({ action: 'move', direction: s > 0 ? DIR.right : DIR.left, amount: MOVE_AMOUNT }));
      dragY = stepAxis(dragY, DRAG_STEP, (s) =>
        send({ action: 'move', direction: s > 0 ? DIR.toward : DIR.away, amount: MOVE_AMOUNT }));
      break;
    case 'release':
      dragX = 0; dragY = 0;
      break;

    // Left-hand fist: rotate the selected object
    case 'rotation-start':
      rotX = 0;
      break;
    case 'rotate-gesture':
      rotX += c.dx;
      rotX = stepAxis(rotX, ROT_STEP, (s) =>
        send({ action: 'rotate', amount: s > 0 ? -ROT_DEGREES : ROT_DEGREES }));
      break;
    case 'rotation-end':
      rotX = 0;
      break;

    default:
      break;
  }
});
