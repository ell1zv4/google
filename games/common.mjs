export function gameShell(root, instructions) {
  root.replaceChildren();
  const help = document.createElement('p');
  help.className = 'game-instructions';
  help.textContent = instructions;
  const live = document.createElement('p');
  live.className = 'game-status';
  live.setAttribute('role', 'status');
  const board = document.createElement('div');
  board.className = 'game-board';
  const actions = document.createElement('div');
  actions.className = 'game-actions';
  root.append(help, live, board, actions);
  const cleanups = [];
  let alive = true;
  const on = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    cleanups.push(() => target.removeEventListener(type, handler, options));
  };
  return {
    board, actions,
    status(message) { live.textContent = message; },
    button(label, handler, parent = actions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      on(button, 'click', handler);
      parent.append(button);
      return button;
    },
    on,
    later(handler, milliseconds) {
      const id = setTimeout(() => { if (alive) handler(); }, milliseconds);
      cleanups.push(() => clearTimeout(id));
      return id;
    },
    every(handler, milliseconds) {
      const id = setInterval(() => { if (alive) handler(); }, milliseconds);
      cleanups.push(() => clearInterval(id));
      return id;
    },
    destroy() {
      if (!alive) return;
      alive = false;
      for (const cleanup of cleanups) cleanup();
      root.replaceChildren();
    },
  };
}
