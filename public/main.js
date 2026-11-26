import { VoiceController } from "./voice.js";
import {
  dispatchCommand,
  dispatchPointer,
  onCommand
} from "./commandBus.js";
import {
  parseVoiceCommand,
  createDuplicateFilter
} from "./voiceCommands.js";
import { HandTracker } from "./gestures.js";
import { drawHands, clearOverlay } from "./overlay.js";
import { GestureRecognizer } from "./gestureRecognizer.js";
import { GesturePointer } from "./pointer.js";
import "./gestureExtras.js";

function getElement(id) {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Missing HTML element: #${id}`);
  }

  return element;
}

const btnVoiceToggle = getElement("btn-voice-toggle");
const micIndicator = getElement("mic-indicator");
const micStatus = getElement("mic-status");
const messageBox = getElement("message");
const interimBox = getElement("interim");
const finalBox = getElement("final");
const matchResult = getElement("match-result");
const lastCommandBox = getElement("last-command");
const typeForm = getElement("type-form");
const typeInput = getElement("type-input");
const logList = getElement("log");
const btnCamToggle = getElement("btn-cam-toggle");
const camIndicator = getElement("cam-indicator");
const camStatus = getElement("cam-status");
const camMessage = getElement("cam-message");
const video = getElement("video");
const overlay = getElement("overlay");
const camPlaceholder = getElement("camera-placeholder");
const handStatus = getElement("hand-status");
const fingertipBox = getElement("fingertip");
const fpsBox = getElement("fps");
const gestureTd = getElement("gesture-td");
const pinchTd = getElement("pinch-td");
const sensitivitySlider = getElement("sensitivity");
const sensitivityValue = getElement("sensitivity-value");
const leftHandStatus = getElement("left-hand-status");
const rightHandStatus = getElement("right-hand-status");
const leftGesture = getElement("left-gesture");
const swapHands = getElement("swap-hands");

const editorFrame = getElement("editor-frame");
const btnCommands = getElement("btn-commands");
const commandMenu = getElement("command-menu");
const cmdSelect = getElement("cmd-select");
const cmdAdd = getElement("cmd-add");
const cmdDelete = getElement("cmd-delete");
const cmdColor = getElement("cmd-color");
const cmdRotate = getElement("cmd-rotate");
const cmdUndo = getElement("cmd-undo");
const deleteConfirm = getElement("delete-confirm");
const deleteConfirmText = getElement("delete-confirm-text");
const deleteYes = getElement("delete-yes");
const deleteNo = getElement("delete-no");
const qualitySelect = getElement("quality");
const qualityReadout = getElement("quality-readout");

function log(text) {
  const item = document.createElement("li");
  item.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  logList.prepend(item);

  while (logList.children.length > 150) {
    logList.lastElementChild.remove();
  }
}

function showMessage(text) {
  messageBox.textContent = text;
  messageBox.classList.toggle("hidden", !text);
}

function showCamMessage(text) {
  camMessage.textContent = text;
  camMessage.classList.toggle("hidden", !text);
}

// ---------------------------------------------------------------
// Voice: one Start/Stop toggle
// ---------------------------------------------------------------
let voiceListening = false;

function setStatus(status) {
  micIndicator.classList.remove("on", "off", "error");

  const listening = status === "listening";
  const unsupported = status === "unsupported";
  const failed = status === "error" || unsupported;
  voiceListening = listening;

  micIndicator.classList.add(
    listening ? "on" : failed ? "error" : "off"
  );

  btnVoiceToggle.disabled = unsupported;
  btnVoiceToggle.textContent = listening ? "Stop listening" : "Start listening";
  btnVoiceToggle.classList.toggle("live", listening);

  if (listening) {
    micStatus.textContent = "Listening";
    showMessage("");
  } else if (unsupported) {
    micStatus.textContent = "Speech unsupported";
  } else if (status === "error") {
    micStatus.textContent = "Microphone error";
  } else {
    micStatus.textContent = "Microphone off";
  }

  log(`Microphone: ${status}`);
}

const isDuplicate = createDuplicateFilter(1000);

function handleText(text, source) {
  const command = parseVoiceCommand(text);

  if (!command) {
    matchResult.textContent =
      `Not recognized: "${text}" (nothing changed)`;
    log(`Unrecognized: "${text}"`);
    return;
  }

  if (source === "voice" && isDuplicate(command)) {
    matchResult.textContent = `Ignored duplicate: "${text}"`;
    log(`Ignored duplicate: "${text}"`);
    return;
  }

  matchResult.textContent = `Recognized: “${text}”`;
  const sent = dispatchCommand({ ...command, source });

  if (!sent) {
    matchResult.textContent = "Command rejected by commandBus.js";
    log("ERROR: command rejected");
    return;
  }
}

let lastMotionDisplayTime = 0;
const MOTION_ACTIONS = ['drag', 'rotate-gesture', 'scale-drag', 'zoom'];

onCommand((command) => {
  const now = performance.now();

  const motion = MOTION_ACTIONS.includes(command.action);
  if (!motion || now - lastMotionDisplayTime >= 120) {
    lastCommandBox.textContent = JSON.stringify(command, null, 2);

    if (motion) lastMotionDisplayTime = now;
  }

  if (!motion) {
    const detail = command.action === "release"
      ? `, ${command.reason}`
      : command.action === "gesture"
        ? `, ${command.name}`
        : "";

    log(
      `Command #${command.id}: ${command.action} ` +
      `(${command.source}${detail})`
    );
  }
});

const voice = new VoiceController({
  onStatus: setStatus,

  onInterim: (text) => {
    interimBox.textContent = text;
  },

  onFinal: (text, confidence) => {
    finalBox.textContent = text;
    interimBox.textContent = "";

    const percentage = Number.isFinite(confidence)
      ? `${Math.round(confidence * 100)}%`
      : "unknown";

    log(`Heard: "${text}" (confidence ${percentage})`);
    handleText(text, "voice");
  },

  onError: (message, fatal) => {
    showMessage(message);
    log(`${fatal ? "ERROR" : "Note"}: ${message}`);
  }
});

btnVoiceToggle.addEventListener("click", () => {
  if (voiceListening) voice.stop();
  else voice.start();
});

typeForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const text = typeInput.value.trim();

  if (text) {
    handleText(text, "test");
    typeInput.value = "";
  }
});

// ---------------------------------------------------------------
// Command menu: dropdowns run immediately (delete asks to confirm)
// ---------------------------------------------------------------
function prettyName(name) {
  return String(name).replace(/_(\d+)$/, ' $1').replace(/^./, (ch) => ch.toUpperCase());
}

function fillObjectSelect(select, label, names) {
  select.innerHTML = '';
  select.add(new Option(label, ''));
  for (const name of names) select.add(new Option(prettyName(name), name));
  select.value = '';
}

function setObjects(names) {
  const list = Array.isArray(names) ? names : [];
  fillObjectSelect(cmdSelect, 'Select…', list);
  fillObjectSelect(cmdDelete, 'Delete…', list);
}

setObjects(['sofa', 'table', 'lamp']);

function runMenuCommand(command, message) {
  dispatchCommand({ ...command, source: 'menu' });
  matchResult.textContent = message;
}

cmdSelect.addEventListener('change', () => {
  if (!cmdSelect.value) return;
  const name = cmdSelect.value;
  cmdSelect.value = '';
  runMenuCommand({ action: 'select', target: name }, `Selected ${prettyName(name)}`);
});

cmdAdd.addEventListener('change', () => {
  if (!cmdAdd.value) return;
  const type = cmdAdd.value;
  cmdAdd.value = '';
  runMenuCommand({ action: 'add', target: type }, `Added ${prettyName(type)}`);
});

let pendingDelete = null;

cmdDelete.addEventListener('change', () => {
  if (!cmdDelete.value) return;
  pendingDelete = cmdDelete.value;
  cmdDelete.value = '';
  deleteConfirmText.textContent = `Delete ${prettyName(pendingDelete)}?`;
  deleteConfirm.hidden = false;
});

deleteYes.addEventListener('click', () => {
  if (pendingDelete) {
    runMenuCommand({ action: 'delete', target: pendingDelete }, `Deleted ${prettyName(pendingDelete)}`);
  }
  pendingDelete = null;
  deleteConfirm.hidden = true;
});

deleteNo.addEventListener('click', () => {
  pendingDelete = null;
  deleteConfirm.hidden = true;
});

cmdColor.addEventListener('change', () => {
  if (!cmdColor.value) return;
  const color = cmdColor.value;
  cmdColor.value = '';
  runMenuCommand({ action: 'recolor', color }, `Colour: ${color}`);
});

cmdRotate.addEventListener('change', () => {
  if (!cmdRotate.value) return;
  const direction = cmdRotate.value;
  cmdRotate.value = '';
  runMenuCommand({ action: 'rotate', direction }, `Rotated ${direction}`);
});

cmdUndo.addEventListener('click', () => {
  runMenuCommand({ action: 'undo' }, 'Undid the last change');
});

function setMenuOpen(open) {
  commandMenu.hidden = !open;
  btnCommands.setAttribute('aria-expanded', String(open));
  btnCommands.textContent = open ? 'Commands ▴' : 'Commands ▾';
}

btnCommands.addEventListener('click', () => setMenuOpen(commandMenu.hidden));

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') setMenuOpen(false);
});

document.addEventListener('click', (event) => {
  if (commandMenu.hidden) return;
  if (commandMenu.contains(event.target) || btnCommands.contains(event.target)) return;
  setMenuOpen(false);
});

// ---------------------------------------------------------------
// Graphics quality (Auto / Low / High), kept in the developer console
// ---------------------------------------------------------------
const QUALITY_KEY = 'gesture-quality';
let qualityMode = localStorage.getItem(QUALITY_KEY) || 'auto';
if (!['auto', 'low', 'high'].includes(qualityMode)) qualityMode = 'auto';
qualitySelect.value = qualityMode;

function applyQualityToEditor() {
  const w = editorFrame.contentWindow;
  if (w && typeof w.setQuality === 'function') w.setQuality(qualityMode);
}

function refreshObjectsFromEditor() {
  const w = editorFrame.contentWindow;
  if (w && typeof w.listObjects === 'function') setObjects(w.listObjects());
}

qualitySelect.addEventListener('change', () => {
  qualityMode = qualitySelect.value;
  localStorage.setItem(QUALITY_KEY, qualityMode);
  applyQualityToEditor();
  log(`Graphics quality: ${qualityMode}`);
});

editorFrame.addEventListener('load', () => {
  applyQualityToEditor();
  refreshObjectsFromEditor();
});

window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin) return;
  const data = event.data;
  if (!data) return;

  if (data.type === 'editor-objects') {
    setObjects(data.names);
  } else if (data.type === 'editor-quality') {
    document.body.classList.toggle('fx-low', data.level === 'low');
    const modeLabel = { auto: 'Auto', low: 'Low', high: 'High' }[data.mode] || data.mode;
    const levelLabel = data.level === 'low' ? 'Low' : 'High';
    qualityReadout.textContent = `${modeLabel} · running ${levelLabel} · ${data.fps || '-'} fps`;
  }
});

// ---------------------------------------------------------------
// Gesture recognisers and pointer
// ---------------------------------------------------------------
const recognizers = {
  right: new GestureRecognizer((gesture, previous) => {
    log(`RIGHT: ${previous} -> ${gesture}`);
    dispatchCommand({action:'gesture',name:`right:${gesture}`,previous,source:'gesture'});
  }, { framesToConfirm: 2, framesToRelease: 3, pinchOn: 0.30, pinchOff: 0.42 }),
  left: new GestureRecognizer((gesture, previous) => {
    log(`LEFT: ${previous} -> ${gesture}`);
    dispatchCommand({action:'gesture',name:`left:${gesture}`,previous,source:'gesture'});
  }, {preferFist:true})
};

const pointer = new GesturePointer({
  onPointer: position => {
    dispatchPointer(position);
  },
  onGrab: ({x,y}) => dispatchCommand({action:'grab',x,y,source:'gesture'}),
  onDrag: ({x,y,dx,dy,totalDx,totalDy}) => dispatchCommand({action:'drag',x,y,dx,dy,totalDx,totalDy,source:'gesture'}),
  onRelease: ({reason}) => dispatchCommand({action:'release',reason,source:'gesture'}),
  onRotateStart: () => dispatchCommand({action:'rotation-start',source:'gesture'}),
  onRotate: ({dx,dy}) => dispatchCommand({action:'rotate-gesture',dx,dy,source:'gesture'}),
  onRotateEnd: ({reason}) => dispatchCommand({action:'rotation-end',reason,source:'gesture'})
});

function updateSensitivity() {
  const value = Number(sensitivitySlider.value);
  pointer.settings.sensitivity = value;
  sensitivityValue.textContent = value.toFixed(1);
}

sensitivitySlider.addEventListener("input", updateSensitivity);
updateSensitivity();

let visibleHands = '';

function resetInteraction() {
  pointer.reset();
  recognizers.left.reset();
  recognizers.right.reset();
  window.dispatchEvent(new CustomEvent('editor:hands-reset'));
  window.dispatchEvent(new CustomEvent('editor:pinch', { detail: { ratio: null } }));
  gestureTd.textContent = 'none';
  leftGesture.textContent = 'none';
  pinchTd.textContent = '-';
  fingertipBox.textContent = '-';
  handStatus.textContent = 'No hands detected';
  leftHandStatus.textContent = 'Not detected';
  rightHandStatus.textContent = 'Not detected';
  fpsBox.textContent = '-';
  visibleHands = '';
}

// ---------------------------------------------------------------
// Webcam: one Start/Stop toggle
// ---------------------------------------------------------------
let camTracking = false;

function setCamStatus(status) {
  camIndicator.classList.remove("on", "off", "error");

  const starting =
    status === "loading" || status === "starting-camera";
  const tracking = status === "tracking";
  camTracking = tracking;

  btnCamToggle.disabled = starting;
  btnCamToggle.textContent = tracking ? "Stop webcam" : starting ? "Starting…" : "Start webcam";
  btnCamToggle.classList.toggle("live", tracking);

  camIndicator.classList.add(
    tracking ? "on" : status === "error" ? "error" : "off"
  );

  if (status === "loading") {
    camStatus.textContent = "Loading model…";
    camPlaceholder.textContent = "Loading hand-tracking model…";
    camPlaceholder.classList.remove("hidden");
    showCamMessage("");
  } else if (status === "starting-camera") {
    camStatus.textContent = "Starting camera…";
    camPlaceholder.textContent = "Allow camera access if asked";
  } else if (tracking) {
    camStatus.textContent = "Tracking";
    camPlaceholder.classList.add("hidden");
  } else if (status === "stopped" || status === "error") {
    camStatus.textContent =
      status === "error" ? "Webcam error" : "Webcam off";

    camPlaceholder.textContent = "Webcam is off";
    camPlaceholder.classList.remove("hidden");
    clearOverlay(overlay);
    resetInteraction();
  }

  log(`Webcam: ${status}`);
}

video.addEventListener("loadedmetadata", () => {
  overlay.width = video.videoWidth;
  overlay.height = video.videoHeight;
});

const tracker = new HandTracker({
  video,
  onStatus: setCamStatus,

  onHand: (hands, info) => {
    drawHands(overlay, hands);

    const aspect = video.videoHeight > 0
      ? video.videoWidth / video.videoHeight : 4 / 3;
    const right = hands.find(h => h.handedness === 'right');
    const left = hands.find(h => h.handedness === 'left');
    const rightL = right?.landmarks || null;
    const leftL = left?.landmarks || null;
    const now = info.now ?? performance.now();

    const rightResult = recognizers.right.update(rightL,aspect,now,right?.modelGesture,right?.modelConfidence);
    const leftResult = recognizers.left.update(leftL,aspect,now,left?.modelGesture,left?.modelConfidence);

    // Right hand owns the cursor and grab. Left hand owns rotation.
    pointer.update(rightL,rightResult.gesture,now);
    pointer.updateRotation(leftL,leftResult.gesture,now);

    // Pinch ratio drives the ring around the cursor.
    window.dispatchEvent(new CustomEvent('editor:pinch', {
      detail: { ratio: rightResult.pinchRatio }
    }));

    // Extra gestures (left pinch resize, two-palm zoom, thumbs up) listen here.
    window.dispatchEvent(new CustomEvent('editor:hands', {
      detail: {
        hands,
        aspect,
        now,
        left: leftL,
        right: rightL,
        leftGesture: leftResult.gesture,
        rightGesture: rightResult.gesture
      }
    }));

    gestureTd.textContent = rightResult.gesture;
    leftGesture.textContent = leftResult.gesture;
    pinchTd.textContent = rightResult.pinchRatio == null
      ? '-' : rightResult.pinchRatio.toFixed(2);
    leftHandStatus.textContent = left ? 'Tracking' : 'Not detected';
    rightHandStatus.textContent = right ? 'Tracking' : 'Not detected';
    if (rightL) {
      const tip = rightL[8];
      fingertipBox.textContent = `${(1-tip.x).toFixed(2)}, ${tip.y.toFixed(2)}`;
    } else { fingertipBox.textContent='-'; }
    handStatus.textContent = `${hands.length} hand${hands.length===1?'':'s'} detected`;
    fpsBox.textContent = `${info.fps} fps`;

    const visible = [left?'left':'',right?'right':''].filter(Boolean).join(' + ');
    if (visible !== visibleHands) {
      visibleHands = visible;
      log(visible ? `Tracking: ${visible}` : 'No hands visible');
    }
  },

  onError: (message) => {
    showCamMessage(message);
    log(`WEBCAM ERROR: ${message}`);
  }
});

// Default: front (selfie) camera, so no correction is needed.
// Tick the box only for a rear camera, where left and right are inverted.
swapHands.checked = false;
tracker.swapHandedness = swapHands.checked;

swapHands.addEventListener('change', () => {
  tracker.swapHandedness = swapHands.checked;
  resetInteraction();
  log('Left/right swap: ' + (swapHands.checked ? 'on (rear camera)' : 'off (front camera)'));
});

btnCamToggle.addEventListener("click", () => {
  if (camTracking) tracker.disable();
  else tracker.enable();
});

if (!voice.supported) {
  setStatus("unsupported");
  showMessage(
    "Speech recognition is unavailable in this browser. " +
    "You can still use typed commands and hand tracking."
  );
} else {
  log("Speech recognition available. Press Start listening.");
}

if (!navigator.mediaDevices?.getUserMedia) {
  btnCamToggle.disabled = true;
  camStatus.textContent = "Camera unavailable";

  showCamMessage(
    "Camera access needs a supported browser and a secure page (HTTPS or localhost)."
  );
}

log("Ready: point to aim, double pinch to select or press, pinch to move, left fist to rotate.");

window.addEventListener('editor:scene-feedback', event => {
  matchResult.textContent = event.detail.message;
  matchResult.dataset.state = event.detail.success ? 'ok' : 'error';
});
