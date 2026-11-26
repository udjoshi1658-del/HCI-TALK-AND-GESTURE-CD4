import { COMMAND_DEFAULTS as D } from './commandBus.js';

// Exactly three canonical shape types. Speech synonyms do not create new types.
export const SHAPE_ALIASES = Object.freeze({
  sphere: 'sphere', circle: 'sphere', ball: 'sphere', orb: 'sphere',
  square: 'square', box: 'square', cube: 'square', rectangle: 'square',
  triangle: 'triangle', triangular: 'triangle',
});
export const COLOR_HEX = Object.freeze({
  red: '#f15d72', blue: '#6598ff', green: '#43cdb2',
  yellow: '#f4c96b', orange: '#ff994f', purple: '#af88ff',
  pink: '#f47bd6', white: '#e8edf9',
});
export const EXAMPLE_COMMANDS = Object.freeze([
  'select circle', 'select box', 'select triangle',
  'add triangle', 'delete sphere', 'add sphere',
  'move left', 'rotate right', 'make bigger',
  'change color to purple', 'delete selected', 'undo', 'reset scene',
]);

export function normalizeSpeech(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/colour/g, 'color')
    .replace(/\bbackwards\b/g, 'backward')
    .replace(/\bforwards\b/g, 'forward')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\b(?:hey|um|uh|please|could|would|you|can|kindly|the|a|an|this|that|object|shape|now|for|me)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractShape(text) {
  const words = text.split(' ');
  for (const word of words) {
    if (Object.hasOwn(SHAPE_ALIASES, word)) return SHAPE_ALIASES[word];
  }
  return null;
}

export function parseVoiceCommand(input) {
  const text = normalizeSpeech(input);
  if (!text) return null;
  const shape = extractShape(text);

  if (/^(undo|go back|revert|undo last|undo change)$/.test(text)) return {action:'undo'};
  if (/^(reset scene|reset shapes|start over|restore scene|restore defaults)$/.test(text)) return {action:'reset'};
  if (/^(clear scene|clear all|remove all|delete all|erase everything|remove everything|delete everything)$/.test(text)) return {action:'clear'};
  if (/^(deselect|select none|unselect)$/.test(text)) return {action:'deselect'};

  // Verb-first commands: "delete circle", "create a new triangle", etc.
  if (/^(?:add|create|insert|spawn|put|place|show|make new|create new|add new)\b/.test(text) && shape) {
    return {action:'add',target:shape};
  }
  if (/^(?:delete|remove|erase|hide|discard|get rid of)\b/.test(text)) {
    return shape ? {action:'delete',target:shape} : /\b(?:selected|current)\b/.test(text)
      ? {action:'delete',target:null} : null;
  }
  if (/^(?:select|choose|pick|focus|highlight|click on|switch to)\b/.test(text) && shape) {
    return {action:'select',target:shape};
  }
  // "select the object" is ambiguous, so we deliberately reject it.
  if (/^(?:make|scale|increase|decrease|resize|enlarge|shrink)\b/.test(text)) {
    if (/\b(?:bigger|larger|increase|enlarge|grow|up)\b/.test(text)) return {action:'scale', factor:D.scaleUpFactor, ...(shape?{target:shape}:{})};
    if (/\b(?:smaller|decrease|shrink|reduce|down)\b/.test(text)) return {action:'scale', factor:D.scaleDownFactor, ...(shape?{target:shape}:{})};
  }
  if (/^(?:change|set|paint|recolor|color|turn)\b/.test(text)) {
    const color = text.split(' ').find(word => Object.hasOwn(COLOR_HEX,word));
    if (color) return {action:'recolor',color,hex:COLOR_HEX[color], ...(shape?{target:shape}:{})};
  }
  if (/^(?:move|shift|slide|go|nudge)\b/.test(text)) {
    const direction = text.split(' ').find(x => ['left','right','up','down','forward','backward','back'].includes(x));
    if (direction) return {action:'move',direction: direction==='back'?'backward':direction,amount:D.moveAmount, ...(shape?{target:shape}:{})};
  }
  if (/^(?:rotate|spin|turn)\b/.test(text)) {
    const direction = text.split(' ').find(x=>['left','right','clockwise','counterclockwise','anticlockwise'].includes(x));
    if (direction) return {action:'rotate',axis:'y',direction:direction==='left'||direction==='counterclockwise'||direction==='anticlockwise'?'left':'right',angle:D.rotateDegrees,...(shape?{target:shape}:{})};
  }
  return null;
}

export function createDuplicateFilter(windowMs = 1000) {
  let lastKey = '';
  let lastTime = 0;
  return (command) => {
    const key = JSON.stringify(command);
    const now = Date.now();
    if (key === lastKey && now-lastTime < windowMs) return true;
    lastKey = key;
    lastTime = now;
    return false;
  };
}
