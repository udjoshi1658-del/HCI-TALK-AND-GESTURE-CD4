import { COMMAND_DEFAULTS as D } from './commandBus.js';

// The editor's furniture types. Synonyms map to one type.
export const OBJECT_ALIASES = Object.freeze({
  sofa: 'sofa', couch: 'sofa', settee: 'sofa',
  table: 'table',
  lamp: 'lamp',
});
const NUMBER_WORDS = Object.freeze({
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
});
export const COLOR_HEX = Object.freeze({
  red: '#c94f4f', blue: '#326b96', green: '#50865b', yellow: '#e7bc46',
  white: '#eeeeee', black: '#303030', purple: '#8559a5', orange: '#d78338',
  brown: '#654321',
});
export const EXAMPLE_COMMANDS = Object.freeze([
  'select sofa', 'select lamp', 'select table',
  'add sofa', 'add lamp', 'delete table',
  'rotate right', 'change color to purple', 'make bigger',
  'move left', 'delete selected', 'undo',
]);

export function normalizeSpeech(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/colour/g, 'color')
    .replace(/\bbackwards\b/g, 'backward')
    .replace(/\bforwards\b/g, 'forward')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(?:hey|um|uh|please|could|would|you|can|kindly|the|a|an|this|that|object|shape|now|for|me)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Returns { type, name }, for example { type: 'sofa', name: 'sofa_2' }, or null.
function extractTarget(text) {
  const words = text.split(' ');

  for (let i = 0; i < words.length; i++) {
    if (!Object.hasOwn(OBJECT_ALIASES, words[i])) continue;

    const type = OBJECT_ALIASES[words[i]];
    const next = words[i + 1];
    let number = 1;

    if (next && /^\d+$/.test(next)) number = Number(next);
    else if (next && Object.hasOwn(NUMBER_WORDS, next)) number = NUMBER_WORDS[next];

    return { type, name: number > 1 ? `${type}_${number}` : type };
  }

  return null;
}

export function parseVoiceCommand(input) {
  const text = normalizeSpeech(input);
  if (!text) return null;
  const target = extractTarget(text);

  if (/^(undo|go back|revert|undo last|undo change)$/.test(text)) return { action: 'undo' };
  if (/^(deselect|select none|unselect)$/.test(text)) return { action: 'deselect' };

  // Adding always uses the plain type: "add sofa" creates the next sofa.
  if (/^(?:add|create|insert|spawn|put|place|show|make new|create new|add new)\b/.test(text) && target) {
    return { action: 'add', target: target.type };
  }

  if (/^(?:delete|remove|erase|hide|discard|get rid of)\b/.test(text)) {
    if (target) return { action: 'delete', target: target.name };
    if (/\b(?:selected|current)\b/.test(text)) return { action: 'delete', target: null };
    return null;
  }

  if (/^(?:select|choose|pick|focus|highlight|click on|switch to)\b/.test(text) && target) {
    return { action: 'select', target: target.name };
  }

  if (/^(?:make|scale|increase|decrease|resize|enlarge|shrink)\b/.test(text)) {
    if (/\b(?:bigger|larger|increase|enlarge|grow|up)\b/.test(text)) {
      return { action: 'scale', factor: D.scaleUpFactor, ...(target ? { target: target.name } : {}) };
    }
    if (/\b(?:smaller|decrease|shrink|reduce|down)\b/.test(text)) {
      return { action: 'scale', factor: D.scaleDownFactor, ...(target ? { target: target.name } : {}) };
    }
  }

  if (/^(?:change|set|paint|recolor|color|turn)\b/.test(text)) {
    const color = text.split(' ').find((word) => Object.hasOwn(COLOR_HEX, word));
    if (color) {
      return { action: 'recolor', color, hex: COLOR_HEX[color], ...(target ? { target: target.name } : {}) };
    }
  }

  if (/^(?:move|shift|slide|go|nudge)\b/.test(text)) {
    const direction = text.split(' ').find((x) =>
      ['left', 'right', 'up', 'down', 'forward', 'backward', 'back'].includes(x));
    if (direction) {
      return {
        action: 'move',
        direction: direction === 'back' ? 'backward' : direction,
        amount: D.moveAmount,
        ...(target ? { target: target.name } : {}),
      };
    }
  }

  if (/^(?:rotate|spin|turn)\b/.test(text)) {
    const direction = text.split(' ').find((x) =>
      ['left', 'right', 'clockwise', 'counterclockwise', 'anticlockwise'].includes(x));
    if (direction) {
      const left = direction === 'left' || direction === 'counterclockwise' || direction === 'anticlockwise';
      return {
        action: 'rotate',
        axis: 'y',
        direction: left ? 'left' : 'right',
        angle: D.rotateDegrees,
        ...(target ? { target: target.name } : {}),
      };
    }
  }

  return null;
}

export function createDuplicateFilter(windowMs = 1000) {
  let lastKey = '';
  let lastTime = 0;

  return (command) => {
    const key = JSON.stringify(command);
    const now = Date.now();
    if (key === lastKey && now - lastTime < windowMs) return true;
    lastKey = key;
    lastTime = now;
    return false;
  };
}
