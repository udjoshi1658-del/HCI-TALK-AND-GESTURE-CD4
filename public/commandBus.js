export const COMMAND_EVENT = "editor:command";

export const COMMAND_DEFAULTS = {
  moveAmount: 0.5,
  rotateDegrees: 15,
  scaleUpFactor: 1.2,
  scaleDownFactor: 0.8,
};

const VALID_ACTIONS = [
  "select", "move", "rotate", "scale", "recolor", "undo",
  "grab", "drag", "release", "gesture", "rotation-start", "rotate-gesture", "rotation-end",
  "add", "delete", "clear", "reset", "deselect",
];

let nextId = 1;

export function dispatchCommand(command) {
  if (!command || typeof command !== "object") {
    console.warn("dispatchCommand: expected an object, got", command);
    return null;
  }
  if (!VALID_ACTIONS.includes(command.action)) {
    console.warn(`dispatchCommand: unknown action "${command.action}"`);
    return null;
  }

  const fullCommand = {
    ...command,
    source: command.source ?? "unknown",
    id: nextId++,
    timestamp: Date.now(),
  };

  window.dispatchEvent(new CustomEvent(COMMAND_EVENT, { detail: fullCommand }));
  return fullCommand;
}

export function onCommand(handler) {
  const listener = (event) => handler(event.detail);
  window.addEventListener(COMMAND_EVENT, listener);
  return () => window.removeEventListener(COMMAND_EVENT, listener);
}
export const POINTER_EVENT = "editor:pointer";

export function dispatchPointer(pointer) {
  window.dispatchEvent(new CustomEvent(POINTER_EVENT, { detail: pointer }));
}

export function onPointer(handler) {
  const listener = (event) => handler(event.detail);
  window.addEventListener(POINTER_EVENT, listener);
  return () => window.removeEventListener(POINTER_EVENT, listener);
}