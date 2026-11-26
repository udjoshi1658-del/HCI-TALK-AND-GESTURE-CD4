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

// Returns { type, name } such as { type: 'sofa', name: 'sofa_2' }, or null.
function extractTarget(text) {
  const words = text.split(' ');
  for (let i = 0; i < words.length; i++) {
    if (!Object.hasOwn(OBJECT_ALIASES, words[i])) continue;

    const type = OBJECT_ALIASES[words[i]];
    const next = words[i + 1];
    let number = 1;

    if (next && /^\d+$/.test(next)) number = Number(next);
    else if (next && Object.hasOwn(NUMBER_WORDS, next)) number = NUMBER_WORDS[next];

    return { type, name: number > 1 ? `${type}_${number}
