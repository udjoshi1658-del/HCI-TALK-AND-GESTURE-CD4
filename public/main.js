import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';

// SCENE AND CAMERA
const scene = new THREE.Scene();
scene.background = new THREE.Color('#e8edf2');

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(8, 6, 10);

// RENDERER
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// CAMERA CONTROLS
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, 0);
controls.enableDamping = true;
controls.minDistance = 4;
controls.maxDistance = 18;
controls.maxPolarAngle = Math.PI / 2 - 0.05;
controls.update();

// LIGHTING
const ambientLight = new THREE.HemisphereLight(
  '#ffffff',
  '#8a7560',
  2
);
scene.add(ambientLight);

const sunlight = new THREE.DirectionalLight('#fff3df', 3);
sunlight.position.set(3, 8, 5);
sunlight.castShadow = true;
sunlight.shadow.mapSize.set(2048, 2048);
sunlight.shadow.camera.left = -7;
sunlight.shadow.camera.right = 7;
sunlight.shadow.camera.top = 7;
sunlight.shadow.camera.bottom = -7;
sunlight.shadow.normalBias = 0.03;
scene.add(sunlight);

// MATERIALS
function material(color) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.8,
  });
}

const wallMaterial = material('#e6dfd4');
const floorMaterial = material('#b88b60');
const blueFabric = material('#326b96');
const cushionFabric = material('#4686b3');
const wood = material('#a16d42');
const darkMetal = material('#30343b');
const shadeMaterial = material('#ffe4a1');

// HELPERS FOR BUILDING OBJECTS
function addBox(parent, size, position, surface) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...size),
    surface
  );

  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addCylinder(
  parent,
  radiusTop,
  radiusBottom,
  height,
  position,
  surface
) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(
      radiusTop,
      radiusBottom,
      height,
      32
    ),
    surface
  );

  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// ROOM: OPEN FRONT AND RIGHT SIDE
const room = new THREE.Group();
room.name = 'room';
scene.add(room);

addBox(room, [10, 0.2, 8], [0, -0.1, 0], floorMaterial);
addBox(room, [10, 3.5, 0.15], [0, 1.75, -4], wallMaterial);
addBox(room, [0.15, 3.5, 8], [-5, 1.75, 0], wallMaterial);

// SKIRTING BOARDS
const trimMaterial = material('#f7f3eb');

addBox(room, [10, 0.15, 0.08], [0, 0.075, -3.9], trimMaterial);
addBox(room, [0.08, 0.15, 8], [-4.9, 0.075, 0], trimMaterial);

// RUG
addBox(
  room,
  [5.2, 0.025, 3.8],
  [0, 0.015, 0.25],
  material('#ded2bc')
);

// SOFA
function createSofa() {
  const sofa = new THREE.Group();
  sofa.name = 'sofa';

  // Base and back
  addBox(sofa, [3.2, 0.4, 1.3], [0, 0.5, 0], blueFabric);
  addBox(sofa, [3.2, 0.95, 0.25], [0, 1, -0.55], blueFabric);

  // Arms
  addBox(sofa, [0.25, 0.65, 1.3], [-1.475, 0.8, 0], blueFabric);
  addBox(sofa, [0.25, 0.65, 1.3], [1.475, 0.8, 0], blueFabric);

  // Two seat cushions and two back cushions
  for (const x of [-0.7, 0.7]) {
    addBox(sofa, [1.3, 0.2, 1], [x, 0.8, 0.08], cushionFabric);
    addBox(sofa, [1.3, 0.6, 0.2], [x, 1.15, -0.35], cushionFabric);
  }

  // Four legs
  for (const x of [-1.3, 1.3]) {
    for (const z of [-0.45, 0.45]) {
      addBox(sofa, [0.12, 0.3, 0.12], [x, 0.15, z], wood);
    }
  }

  return sofa;
}

const sofa = createSofa();
sofa.position.set(-0.7, 0, -2);
scene.add(sofa);

// COFFEE TABLE
function createTable() {
  const table = new THREE.Group();
  table.name = 'table';

  addBox(table, [2.6, 0.15, 1.4], [0, 0.85, 0], wood);

  for (const x of [-1.05, 1.05]) {
    for (const z of [-0.5, 0.5]) {
      addBox(table, [0.12, 0.775, 0.12], [x, 0.3875, z], wood);
    }
  }

  return table;
}

const table = createTable();
table.position.set(0, 0, 0.5);
scene.add(table);

// FLOOR LAMP
function createLamp() {
  const lamp = new THREE.Group();
  lamp.name = 'lamp';

  addCylinder(lamp, 0.35, 0.4, 0.1, [0, 0.05, 0], darkMetal);
  addCylinder(lamp, 0.035, 0.035, 2.1, [0, 1.1, 0], darkMetal);
  addCylinder(lamp, 0.3, 0.5, 0.55, [0, 2.25, 0], shadeMaterial);

  const bulb = new THREE.PointLight('#ffd58a', 4, 6, 2);
  bulb.position.set(0, 1.95, 0);
  lamp.add(bulb);

  return lamp;
}

const lamp = createLamp();
lamp.position.set(2.5, 0, -2.5);
scene.add(lamp);

// Store editable objects for selection in the next step.
const editableObjects = [sofa, table, lamp];
// Give each object its own materials.
for (const object of editableObjects) {
  object.traverse((child) => {
    if (child.isMesh) {
      child.material = child.material.clone();
    }
  });
}
// OBJECT SELECTION
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let selectedObject = null;
let selectionBox = null;

// Gesture selection state.
let selectionLocked = false;   // set by a double pinch; only a double pinch releases it
let selectionSnapshot = null;  // transform when the object was selected
let hoveredObject = null;
let hoverBox = null;

// Show the selected object's name.
const selectionLabel = document.createElement('div');

Object.assign(selectionLabel.style, {
  position: 'absolute',
  bottom: '20px',
  left: '20px',
  padding: '12px 18px',
  borderRadius: '10px',
  background: '#142438',
  color: 'white',
  pointerEvents: 'none',
});

selectionLabel.textContent = 'No object selected';
document.body.appendChild(selectionLabel);

function displayName(name) {
  return String(name).replace(/_(\d+)$/, ' $1').replace(/^./, (ch) => ch.toUpperCase());
}

// Keep selection in one function so voice and gesture controls can use it.
function selectObject(object) {
  if (selectionBox) {
    scene.remove(selectionBox);
    selectionBox.geometry.dispose();
    selectionBox.material.dispose();
    selectionBox = null;
  }

  const changed = selectedObject !== object;
  selectedObject = object;

  if (selectedObject) {
    selectionBox = new THREE.BoxHelper(selectedObject, 0x0088ff);
    scene.add(selectionBox);

    if (changed) {
      selectionSnapshot = {
        object: selectedObject,
        position: selectedObject.position.clone(),
        rotation: selectedObject.rotation.clone(),
        scale: selectedObject.scale.clone(),
      };
    }

    selectionLabel.textContent = `Selected: ${displayName(selectedObject.name)}`;
  } else {
    selectionLocked = false;
    selectionSnapshot = null;
    dimTarget = 0;
    selectionLabel.textContent = 'No object selected';
  }

  updateAxes();
  notifySelection();
}

function notifySelection() {
  try {
    window.parent.postMessage(
      { type: 'editor-selection', name: selectedObject ? selectedObject.name : null },
      window.location.origin
    );
  } catch (error) {
    // Running outside the website: nothing to notify.
  }
}

// Distinguish clicking from dragging the camera.
let pointerStart = null;
let dragged = false;

renderer.domElement.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;

  pointerStart = { x: event.clientX, y: event.clientY };
  dragged = false;
});

renderer.domElement.addEventListener('pointermove', (event) => {
  if (!pointerStart) return;

  const distance = Math.hypot(
    event.clientX - pointerStart.x,
    event.clientY - pointerStart.y
  );

  if (distance > 5) dragged = true;
});

renderer.domElement.addEventListener('pointercancel', () => {
  pointerStart = null;
});

renderer.domElement.addEventListener('pointerup', (event) => {
  if (!pointerStart) return;

  pointerStart = null;
  if (dragged || event.button !== 0) return;
  if (selectionLocked) return;

  const bounds = renderer.domElement.getBoundingClientRect();

  pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
  pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);

  const hits = raycaster.intersectObjects(editableObjects, true);

  if (hits.length === 0) {
    selectObject(null);
    return;
  }

  // Find the complete furniture group, rather than one cushion or leg.
  let object = hits[0].object;

  while (object && !editableObjects.includes(object)) {
    object = object.parent;
  }

  selectObject(object);
});

// SHARED COMMAND FUNCTION
// Voice and gesture controls can call this later.
// Store previous object states for Undo.
// Functions used to create new furniture.
const objectFactories = {
  sofa: createSofa,
  table: createTable,
  lamp: createLamp,
};

// The original objects count as number 1.
const objectCounts = {
  sofa: 1,
  table: 1,
  lamp: 1,
};

function addFurniture(type) {
  const factory = objectFactories[type];

  if (!factory) {
    selectionLabel.textContent = `Unknown object type: ${type}`;
    return null;
  }

  const object = factory();

  objectCounts[type] += 1;
  object.name = `${type}_${objectCounts[type]}`;

  // Independent materials prevent changes to other objects.
  object.traverse((child) => {
    if (child.isMesh) {
      child.material = child.material.clone();
    }
  });

  // Place the new item near the front of the room.
  object.position.set(0, 0, 2);

  scene.add(object);
  editableObjects.push(object);
  selectObject(object);

  selectionLabel.textContent = `Added ${object.name}`;

  return object;
}
const undoHistory = [];

function saveUndoState() {
  const colors = [];

  selectedObject.traverse((child) => {
    if (child.isMesh) {
      colors.push({
        mesh: child,
        color: child.material.color.clone(),
      });
    }
  });

  undoHistory.push({
    object: selectedObject,
    parent: selectedObject.parent,
    position: selectedObject.position.clone(),
    rotation: selectedObject.rotation.clone(),
    scale: selectedObject.scale.clone(),
    colors,
  });

  // Keep only the latest 50 changes.
  if (undoHistory.length > 50) {
    undoHistory.shift();
  }
}

function executeCommand(command) {  
    if (!command || typeof command !== 'object') {
    selectionLabel.textContent = 'Invalid command';
    return;
  }
    if (command.action === 'add') {
    const type = String(command.type ?? '').trim().toLowerCase();

    if (!Object.hasOwn(objectFactories, type)) {
      selectionLabel.textContent = `Unknown object type: ${type}`;
      return;
    }

    const object = addFurniture(type);

    if (object) {
      undoHistory.push({
        kind: 'add',
        object,
      });

      if (undoHistory.length > 50) undoHistory.shift();
    }

    return;
  }
    if (command.action === 'undo') {
    const previous = undoHistory.pop();

    if (!previous) {
      selectionLabel.textContent = 'Nothing to undo';
      return;
    }

        // Undo adding an object by removing it.
    if (previous.kind === 'add') {
      const index = editableObjects.indexOf(previous.object);

      if (index !== -1) {
        editableObjects.splice(index, 1);
      }

      previous.object.removeFromParent();
      selectObject(null);

      selectionLabel.textContent =
        `Undid adding ${previous.object.name}`;

      return;
    }

    // Restore the object if it was deleted.
    if (!editableObjects.includes(previous.object)) {
      previous.parent.add(previous.object);
      editableObjects.push(previous.object);
    }

    previous.object.position.copy(previous.position);
    previous.object.rotation.copy(previous.rotation);
    previous.object.scale.copy(previous.scale);

    for (const entry of previous.colors) {
      entry.mesh.material.color.copy(entry.color);
    }

    selectObject(previous.object);
    selectionLabel.textContent =
      `Undid change to ${previous.object.name}`;

    return;
  }
  // Select an object by name.
  if (command.action === 'select') {
    const targetName = String(command.target ?? '')
      .trim()
      .toLowerCase();

    const target = editableObjects.find(
      (object) => object.name.toLowerCase() === targetName
    );

    if (!target) {
      selectionLabel.textContent = `Object not found: ${targetName}`;
      return;
    }

    selectObject(target);
    return;
  }
    if (!selectedObject) {
    selectionLabel.textContent = 'Select an object first';
    return;
  }

  const { action, direction } = command;
  const amount = command.amount;

  switch (action) {
    case 'move': {
      const distance = amount ?? 0.5;

      const directions = {
        left: [-1, 0, 0],
        right: [1, 0, 0],
        up: [0, 1, 0],
        down: [0, -1, 0],
        forward: [0, 0, 1],
        backward: [0, 0, -1],
      };

      const vector = directions[direction];

      if (!vector || !Number.isFinite(distance)) {
        selectionLabel.textContent = 'Invalid move command';
        return;
      }
    saveUndoState();
      selectedObject.position.addScaledVector(
        new THREE.Vector3(...vector),
        distance
      );

      selectionLabel.textContent =
        `Moved ${selectedObject.name} ${direction}`;
      break;
    }

    case 'rotate': {
      // Rotation amount is in degrees, around the vertical axis.
      const degrees = amount ?? 15;

      if (!Number.isFinite(degrees)) return;
    saveUndoState();
      selectedObject.rotation.y += THREE.MathUtils.degToRad(degrees);

      selectionLabel.textContent =
        `Rotated ${selectedObject.name} ${degrees}°`;
      break;
    }

    case 'scale': {
      // A factor of 1.1 makes the object 10% larger.
      const factor = amount ?? 1.1;

      if (!Number.isFinite(factor) || factor <= 0) return;

      const newScale = THREE.MathUtils.clamp(
        selectedObject.scale.x * factor,
        0.25,
        3
      );
    saveUndoState();
      selectedObject.scale.setScalar(newScale);

      selectionLabel.textContent =
        `Scaled ${selectedObject.name} to ${newScale.toFixed(2)}×`;
      break;
    }
    case 'color':
    case 'recolor': {
      const colors = {
        red: '#c94f4f',
        blue: '#326b96',
        green: '#50865b',
        yellow: '#e7bc46',
        white: '#eeeeee',
        black: '#303030',
        purple: '#8559a5',
        orange: '#d78338',
        brown: '#654321',
      };

      const colorName = String(command.color ?? '').toLowerCase();
      const color = colors[colorName];

      if (!color) {
        selectionLabel.textContent = 'Unknown colour';
        return;
      }
    saveUndoState();
      selectedObject.traverse((child) => {
        if (child.isMesh) {
          child.material.color.set(color);
        }
      });

      selectionLabel.textContent =
        `Changed ${selectedObject.name} to ${colorName}`;
      break;
    }

        case 'delete': {
      saveUndoState();

      const object = selectedObject;
      const name = object.name;
      const index = editableObjects.indexOf(object);

      if (index !== -1) {
        editableObjects.splice(index, 1);
      }

      object.removeFromParent();
      selectObject(null);

      selectionLabel.textContent = `Deleted ${name}`;
      break;
    }

    default:
      selectionLabel.textContent = `Unknown action: ${action}`;
  }
}

// Make the function accessible for browser testing.
window.executeCommand = executeCommand;

// ---------------------------------------------------------------
// GESTURE SUPPORT: axis guides, dimming, hover, selection, camera
// ---------------------------------------------------------------

// Axis guides through the selected object (X = red, Z = blue).
function guideMaterial(color) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
  });
}

const axisX = new THREE.Mesh(new THREE.BoxGeometry(10, 0.01, 0.05), guideMaterial('#e5484d'));
const axisZ = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.01, 8), guideMaterial('#3b82f6'));
axisX.visible = false;
axisZ.visible = false;
scene.add(axisX, axisZ);

function updateAxes() {
  const visible = Boolean(selectedObject);
  axisX.visible = visible;
  axisZ.visible = visible;

  if (visible) {
    axisX.position.set(0, 0.05, selectedObject.position.z);
    axisZ.position.set(selectedObject.position.x, 0.05, 0);
  }
}

// Dim every other piece of furniture slightly while one is being moved.
const DIM_COLOR = new THREE.Color('#8a919c');
const DIM_STRENGTH = 0.3;
let dimTarget = 0;
let dimCurrent = 0;

function applyDim() {
  if (dimCurrent === 0 && dimTarget === 0) return;

  dimCurrent += (dimTarget - dimCurrent) * 0.25;
  if (Math.abs(dimTarget - dimCurrent) < 0.01) dimCurrent = dimTarget;

  for (const object of editableObjects) {
    const amount = object === selectedObject ? 0 : dimCurrent;

    object.traverse((child) => {
      if (!child.isMesh) return;

      if (amount > 0) {
        if (!child.userData.baseColor) {
          child.userData.baseColor = child.material.color.clone();
        }
        child.material.color
          .copy(child.userData.baseColor)
          .lerp(DIM_COLOR, amount * DIM_STRENGTH);
      } else if (child.userData.baseColor) {
        child.material.color.copy(child.userData.baseColor);
        delete child.userData.baseColor;
      }
    });
  }
}

window.setDimOthers = (on) => {
  dimTarget = on ? 1 : 0;
};

// Find the furniture group under a normalised point (0-1, top-left origin).
function pickObjectAt(nx, ny) {
  pointer.set(nx * 2 - 1, -(ny * 2) + 1);
  raycaster.setFromCamera(pointer, camera);

  const hits = raycaster.intersectObjects(editableObjects, true);
  if (hits.length === 0) return null;

  let object = hits[0].object;
  while (object && !editableObjects.includes(object)) {
    object = object.parent;
  }
  return object || null;
}

function clearHoverBox() {
  if (hoverBox) {
    scene.remove(hoverBox);
    hoverBox.geometry.dispose();
    hoverBox.material.dispose();
    hoverBox = null;
  }
  hoveredObject = null;
}

window.setHover = (nx, ny) => {
  if (selectedObject) {
    clearHoverBox();
    return null;
  }

  const object = pickObjectAt(nx, ny);

  if (object !== hoveredObject) {
    clearHoverBox();
    hoveredObject = object;

    if (object) {
      hoverBox = new THREE.BoxHelper(object, 0xffd479);
      scene.add(hoverBox);
    }
  }

  return object ? object.name : null;
};

window.clearHover = () => {
  clearHoverBox();
};

// Double pinch: select the object under the cursor, or release the selection.
window.gestureSelectAt = (nx, ny) => {
  const object = pickObjectAt(nx, ny);
  if (!object) return null;

  clearHoverBox();
  selectObject(object);
  selectionLocked = true;
  return object.name;
};

window.gestureDeselect = () => {
  selectionLocked = false;
  selectObject(null);
};

// Thumbs up: put the selected object back where it was when it was selected.
window.revertSelected = () => {
  if (!selectedObject || !selectionSnapshot || selectionSnapshot.object !== selectedObject) {
    return false;
  }

  selectedObject.position.copy(selectionSnapshot.position);
  selectedObject.rotation.copy(selectionSnapshot.rotation);
  selectedObject.scale.copy(selectionSnapshot.scale);

  selectionLabel.textContent =
    `Restored ${displayName(selectedObject.name)} to its original position`;
  return true;
};

// Left fist with nothing selected: orbit the view around the room.
window.orbitBy = (deltaTheta, deltaPhi) => {
  const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
  const spherical = new THREE.Spherical().setFromVector3(offset);

  spherical.theta -= deltaTheta;
  spherical.phi = THREE.MathUtils.clamp(spherical.phi - deltaPhi, 0.1, controls.maxPolarAngle);

  offset.setFromSpherical(spherical);
  camera.position.copy(controls.target).add(offset);
  camera.lookAt(controls.target);
  controls.update();
};

// Both open palms: move the camera towards or away from the room.
window.zoomBy = (factor) => {
  if (!Number.isFinite(factor)) return;

  const limited = THREE.MathUtils.clamp(factor, 0.8, 1.25);
  const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
  const distance = THREE.MathUtils.clamp(
    offset.length() * limited,
    controls.minDistance,
    controls.maxDistance
  );

  offset.setLength(distance);
  camera.position.copy(controls.target).add(offset);
  controls.update();
};

// Temporary keyboard controls to test transformations.
window.addEventListener('keydown', (event) => {
    if (
    event.target instanceof HTMLElement &&
    (event.target.matches('input, select, textarea, button') ||
      event.target.isContentEditable)
  ) {
    return;
  }

  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const commands = {
    a: { action: 'add', type: 'sofa' },
    b: { action: 'add', type: 'table' },
    c: { action: 'add', type: 'lamp' },
    Backspace: { action: 'delete' },
    Delete: { action: 'delete' },
    z: { action: 'undo' },
    s: { action: 'select', target: 'sofa' },
    t: { action: 'select', target: 'table' },
    l: { action: 'select', target: 'lamp' },
    '1': { action: 'color', color: 'red' },
    '2': { action: 'color', color: 'blue' },
    '3': { action: 'color', color: 'green' },
    '4': { action: 'color', color: 'yellow' },
    '5': { action: 'color', color: 'white' },
    '6': { action: 'color', color: 'black' },
    '7': { action: 'color', color: 'purple' },
    '8': { action: 'color', color: 'orange' },
    '9': { action: 'color', color: 'brown' },
    ArrowLeft: { action: 'move', direction: 'left', amount: 0.25 },
    ArrowRight: { action: 'move', direction: 'right', amount: 0.25 },
    ArrowUp: { action: 'move', direction: 'backward', amount: 0.25 },
    ArrowDown: { action: 'move', direction: 'forward', amount: 0.25 },
    r: { action: 'rotate', amount: 15 },
    '+': { action: 'scale', amount: 1.1 },
    '=': { action: 'scale', amount: 1.1 },
    '-': { action: 'scale', amount: 1 / 1.1 },
  };

  const command = commands[event.key];

  if (command) {
    event.preventDefault();
    executeCommand(command);
  }
});

// ON-SCREEN OBJECT CONTROLS
document.querySelectorAll('[data-add]').forEach((button) => {
  button.addEventListener('click', () => {
    executeCommand({
      action: 'add',
      type: button.dataset.add,
    });
  });
});

document.querySelector('#delete-object').addEventListener('click', () => {
  executeCommand({ action: 'delete' });
});

document.querySelector('#undo-action').addEventListener('click', () => {
  executeCommand({ action: 'undo' });
});

// ON-SCREEN EDITING CONTROLS
document.querySelectorAll('[data-direction]').forEach((button) => {
  button.addEventListener('click', () => {
    executeCommand({
      action: 'move',
      direction: button.dataset.direction,
      amount: 0.25,
    });
  });
});

document.querySelector('#rotate-object').addEventListener('click', () => {
  executeCommand({ action: 'rotate', amount: 15 });
});

document.querySelector('#grow-object').addEventListener('click', () => {
  executeCommand({ action: 'scale', amount: 1.1 });
});

document.querySelector('#shrink-object').addEventListener('click', () => {
  executeCommand({ action: 'scale', amount: 1 / 1.1 });
});

document.querySelector('#object-color').addEventListener('change', (event) => {
  if (!event.target.value) return;

  executeCommand({
    action: 'color',
    color: event.target.value,
  });

  event.target.value = '';
});

// RESIZE WITH THE BROWSER
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
});

// DRAW THE SCENE
renderer.setAnimationLoop(() => {
  controls.update();

  if (selectionBox) {
    selectionBox.update();
  }

  if (hoverBox) {
    hoverBox.update();
  }

  applyDim();
  updateAxes();

  renderer.render(scene, camera);
});
