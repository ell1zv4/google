import test from 'node:test';
import assert from 'node:assert/strict';
import { games, overlaps, circlesHit, wrap, clamp, turnSnake, advanceSnake, freeSnakeCell } from '../games/arcade.mjs';

test('eight distinct arcade entries expose mount functions and Spanish controls', () => {
  assert.equal(games.length, 8);
  assert.equal(new Set(games.map(g => g.id)).size, 8);
  for (const game of games) {
    assert.equal(game.category, 'Arcade');
    assert.equal(typeof game.mount, 'function');
    assert.ok(game.controls.length > 20);
  }
});

test('rectangle collisions distinguish overlap, touching and separation', () => {
  const player = { x: 10, y: 10, w: 20, h: 20 };
  assert.equal(overlaps(player, { x: 29, y: 29, w: 5, h: 5 }), true);
  assert.equal(overlaps(player, { x: 30, y: 10, w: 5, h: 5 }), false);
  assert.equal(overlaps(player, { x: 10, y: 40, w: 5, h: 5 }), false);
});

test('circle collisions include contact; wrapping handles both edges', () => {
  assert.equal(circlesHit({ x: 0, y: 0, r: 2 }, { x: 3, y: 4, r: 3 }), true);
  assert.equal(circlesHit({ x: 0, y: 0, r: 2 }, { x: 4, y: 4, r: 3 }), false);
  assert.equal(wrap(-1, 600), 599);
  assert.equal(wrap(601, 600), 1);
  assert.equal(clamp(-10, 0, 500), 0);
  assert.equal(clamp(510, 0, 500), 500);
});

test('snake rejects reversal and advances without mutating the old body', () => {
  const right = { x: 1, y: 0 }, up = { x: 0, y: -1 };
  assert.deepEqual(turnSnake(right, { x: -1, y: 0 }), right);
  assert.deepEqual(turnSnake(right, up), up);
  const body = [{ x: 2, y: 2 }, { x: 1, y: 2 }, { x: 0, y: 2 }];
  const next = advanceSnake(body, right, { x: 10, y: 10 });
  assert.deepEqual(next.body, [{ x: 3, y: 2 }, { x: 2, y: 2 }, { x: 1, y: 2 }]);
  assert.equal(next.dead, false);
  assert.equal(body.length, 3);
  assert.deepEqual(body[0], { x: 2, y: 2 });
});

test('snake grows when eating and detects walls and occupied body', () => {
  const body = [{ x: 2, y: 2 }, { x: 1, y: 2 }, { x: 0, y: 2 }];
  const grown = advanceSnake(body, { x: 1, y: 0 }, { x: 3, y: 2 });
  assert.equal(grown.ate, true);
  assert.equal(grown.body.length, 4);
  assert.equal(advanceSnake(body, { x: 1, y: 0 }, null, 3, 3).dead, true);
  assert.equal(advanceSnake(body, { x: -1, y: 0 }, null).dead, true);
});

test('snake can enter a vacated tail, and food only uses free cells', () => {
  const body = [{ x: 1, y: 1 }, { x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }];
  assert.equal(advanceSnake(body, { x: -1, y: 0 }, null, 2, 2).dead, false);
  assert.equal(advanceSnake(body, { x: -1, y: 0 }, { x: 0, y: 1 }, 2, 2).dead, true);
  assert.equal(freeSnakeCell(body, 2, 2), null);
  assert.deepEqual(freeSnakeCell(body.slice(0, -1), 2, 2, () => .99), { x: 0, y: 1 });
});

test('every arcade mounts idle, runs, pauses, restarts without stacking, and removes listeners', () => {
  const original = Object.fromEntries(['document', 'window', 'requestAnimationFrame', 'cancelAnimationFrame'].map(key => [key, globalThis[key]]));
  const targets = [];
  const drawing = new Proxy({}, { get: (target, key) => target[key] ?? (() => {}), set: (target, key, value) => { target[key] = value; return true; } });
  class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.listeners = new Map(); this.style = {}; this.textContent = ''; targets.push(this); }
    addEventListener(type, handler) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(handler); }
    removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler); }
    emit(type, event = {}) { for (const handler of this.listeners.get(type) ?? []) handler({ target: this, detail: 0, preventDefault() {}, ...event }); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    setAttribute() {}
    setPointerCapture() {}
    focus() { document.activeElement = this; }
    closest() { return this.tag === 'button' ? this : null; }
    getContext() { return drawing; }
    click() { this.focus(); this.emit('click'); }
  }
  const pending = new Map(); let nextId = 0, time = 0;
  const tick = () => { const frames = [...pending.values()]; pending.clear(); time += 16; frames.forEach(callback => callback(time)); };
  try {
    globalThis.window = new Element('window');
    globalThis.document = new Element('document');
    document.createElement = tag => new Element(tag); document.hidden = false;
    globalThis.requestAnimationFrame = callback => { const id = ++nextId; pending.set(id, callback); return id; };
    globalThis.cancelAnimationFrame = id => pending.delete(id);
    for (const game of games) {
      const root = new Element('root');
      const recorded = [];
      const destroy = game.mount(root, { recordScore: score => recorded.push(score) });
      assert.equal(pending.size, 0, `${game.id} starts idle`);
      const actions = root.children[3];
      const [toggle, restart, ...controls] = actions.children;
      toggle.click();
      assert.equal(pending.size, 1, `${game.id} starts one animation`);
      for (const control of controls) { control.emit('pointerdown', { pointerId: 1 }); tick(); control.emit('pointerup'); }
      for (let i = 0; i < 20; i++) tick();
      restart.click(); restart.click();
      assert.equal(pending.size, 1, `${game.id} restart replaces the previous animation`);
      assert.equal(document.activeElement, root.children[2].children[0], `${game.id} restart returns focus to the canvas`);
      window.emit('keydown', { code: 'KeyP', target: document.activeElement });
      assert.equal(pending.size, 0, `${game.id} keyboard works immediately after restart`);
      toggle.click();
      toggle.click();
      assert.equal(pending.size, 0, `${game.id} pauses`);
      toggle.click();
      document.hidden = true; document.emit('visibilitychange');
      assert.equal(pending.size, 0, `${game.id} pauses when hidden`);
      document.hidden = false; document.emit('visibilitychange');
      assert.equal(pending.size, 0, `${game.id} waits for explicit resume`);
      toggle.click(); tick();
      destroy();
      assert.equal(pending.size, 0, `${game.id} cancels its frame`);
      assert.equal(root.children.length, 0);
      assert.ok(recorded.every(score => Number.isFinite(score) && score >= 0));
      for (const target of targets) for (const listeners of target.listeners.values()) assert.equal(listeners.size, 0, `${game.id} removes listeners`);
    }
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
});
