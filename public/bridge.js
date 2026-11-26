// Translates your editor:command events into her 3D editor's commands.
const frame = document.getElementById('editor-frame');

// Temporary mapping from your shape names to her furniture.
const TYPE = { sphere: 'lamp', square: 'table', triangle: 'sofa' };

function send(cmd) {
  const w = frame && frame.contentWindow;
  if (!w || typeof w.executeCommand !== 'function') {
    console.warn('3D editor not ready');
    return;
  }
  w.executeCommand(cmd);
}

function selectTarget(c) {
  const type = TYPE[c.target];
  if (type) send({ action: 'select', target: type });
}

window.addEventListener('editor:command', (e) => {
  const c = e.detail;
  switch (c.action) {
    case 'add': {
      const type = TYPE[c.target];
      if (type) send({ action: 'add', type });
      break;
    }
    case 'select':
      selectTarget(c);
      break;
    case 'delete':
      selectTarget(c);
      send({ action: 'delete' });
      break;
    case 'move':
      selectTarget(c);
      send({ action: 'move', direction: c.direction, amount: c.amount });
      break;
    case 'rotate':
      selectTarget(c);
      send({ action: 'rotate', amount: c.direction === 'left' ? 15 : -15 });
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
    default:
      break; // grab/drag/gesture events are not connected yet
  }
});
