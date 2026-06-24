import { EventEmitter } from 'events';

const g = global as typeof globalThis & { _twEmitter?: EventEmitter };

if (!g._twEmitter) {
  g._twEmitter = new EventEmitter();
  g._twEmitter.setMaxListeners(200);
}

export const emitter = g._twEmitter;
