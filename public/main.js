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

const btnStart = getElement("btn-start");
const btnStop = getElement("btn-stop");
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
const btnCamStart = getElement("btn-cam-start");
const btnCamStop = getElement("btn-cam-stop");
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

function setStatus(status) {
  micIndicator.classList.remove("on", "off", "error");

  const listening = status === "listening";
  const unsupported = status === "unsupported";
  const failed = status === "error" || unsupported;

  micIndicator.classList.add(
    listening ? "on" : failed ? "error" : "off"
  );

  btnStart.disabled = listening || unsupported;
  btnStop.disabled = !listening;

  if (listening) {
    micStatus.textContent = "Microphone active (listening)";
    showMessage("");
  } else if (unsupported) {
    micStatus.textContent = "Speech recognition unsupported";
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

btnStart.addEventListener("click", () => voice.start());
btnStop.addEventListener("click", () => voice.stop());

typeForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const text = typeInput.value.trim();

  if (text) {
    handleText(text, "test");
    typeInput.value = "";
  }
});

// Separate recognizer state by physical hand: avoids cross-hand dropouts.
const recognizers = {
  right: new GestureRecognizer((gesture, previous) => {
    log(`RIGHT: ${previous} -> ${gesture}`);
    dispatchCommand({action:'gesture',name:`right:${gesture}`,previous,source:'gesture'});
  }),
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
  gestureTd.textContent = 'none';
  leftGesture.textContent = 'none';
  pinchTd.textContent = '-';
  fingertipBox.textContent = '-';
  handStatus.textContent = 'No hands detected (camera off)';
  leftHandStatus.textContent = 'Not detected';
  rightHandStatus.textContent = 'Not detected';
  fpsBox.textContent = '-';
  visibleHands = '';
}

function setCamStatus(status) {
  camIndicator.classList.remove("on", "off", "error");

  const starting =
    status === "loading" || status === "starting-camera";
  const tracking = status === "tracking";

  btnCamStart.disabled = starting || tracking;
  btnCamStop.disabled = !tracking;

  camIndicator.classList.add(
    tracking ? "on" : status === "error" ? "error" : "off"
  );

  if (status === "loading") {
    camStatus.textContent = "Loading hand-tracking model...";
    camPlaceholder.textContent = "Loading...";
    camPlaceholder.classList.remove("hidden");
    showCamMessage("");
  } else if (status === "starting-camera") {
    camStatus.textContent = "Starting camera (allow access if asked)...";
    camPlaceholder.textContent = "Starting camera...";
  } else if (tracking) {
    camStatus.textContent = "Webcam on (tracking)";
    camPlaceholder.classList.add("hidden");
  } else if (status === "stopped" || status === "error") {
    camStatus.textContent =
      status === "error" ? "Webcam error" : "Off";

    camPlaceholder.textContent = "Camera is off";
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
    fpsBox.textContent = `${info.fps} frames/second`;

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
  // If the user reverses left/right, release any old grabbed object.
  resetInteraction();
  log('Left/right swap: ' + (swapHands.checked ? 'on (rear camera)' : 'off (front camera)'));
});

btnCamStart.addEventListener("click", () => tracker.enable());
btnCamStop.addEventListener("click", () => tracker.disable());

if (!voice.supported) {
  setStatus("unsupported");
  showMessage(
    "Speech recognition is unavailable in this browser. " +
    "You can still use typed commands and hand tracking."
  );
} else {
  log("Speech recognition available. Press Start Listening.");
}

if (!navigator.mediaDevices?.getUserMedia) {
  btnCamStart.disabled = true;
  camStatus.textContent = "Camera access unavailable";

  showCamMessage(
    "Camera access requires a supported browser and a secure context. Open localhost or an HTTPS page, then allow camera permission."
  );
}

log("Gesture v2.1.1 ready: point to aim, double pinch to select, pinch to move, left fist to rotate.");
// Clickable speech examples also work without microphone permission.
document.querySelectorAll('[data-example]').forEach(button => {
  button.addEventListener('click', () => handleText(button.dataset.example, 'test'));
});
window.addEventListener('editor:scene-feedback', event => {
  matchResult.textContent = event.detail.message;
  matchResult.dataset.state = event.detail.success ? 'ok' : 'error';
});
