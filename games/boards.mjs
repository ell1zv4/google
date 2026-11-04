import { gameShell } from './common.mjs';

const directions = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const shuffle = values => {
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
};
function grid(shell, count, columns, activate) {
  shell.board.classList.add('board-grid');
  shell.board.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
  return Array.from({ length: count }, (_, i) => {
    const cell = shell.button('', () => activate(i), shell.board);
    cell.className = 'board-cell';
    cell.style.minWidth = '0';
    cell.style.aspectRatio = '1';
    return cell;
  });
}
function label(cell, text, name, disabled = false) {
  cell.textContent = text;
  cell.setAttribute('aria-label', name);
  cell.disabled = disabled;
}
const point = (i, columns) => `fila ${Math.floor(i / columns) + 1}, columna ${i % columns + 1}`;
const score = (ctx, value) => ctx?.recordScore?.(value);

export function lineWinner(board, rows, columns, length) {
  for (let i = 0; i < board.length; i++) {
    if (!board[i]) continue;
    const row = Math.floor(i / columns), col = i % columns;
    for (const [dr, dc] of [[0,1],[1,0],[1,1],[1,-1]]) {
      const endRow = row + dr * (length - 1), endCol = col + dc * (length - 1);
      if (endRow < 0 || endRow >= rows || endCol < 0 || endCol >= columns) continue;
      if (Array.from({ length }, (_, n) => board[(row + dr*n)*columns + col + dc*n]).every(v => v === board[i])) return board[i];
    }
  }
  return null;
}
function mountLines(root, ctx, connect) {
  const columns = connect ? 7 : 3, rows = connect ? 6 : 3;
  const s = gameShell(root, connect ? 'Dos personas en este dispositivo. Pulsa una casilla de la columna para dejar caer una ficha. Gana quien conecta cuatro.' : 'Dos personas en este dispositivo. X y O se alternan. Completa una línea de tres.');
  let board, player, ended;
  const cells = grid(s, rows * columns, columns, play);
  function draw() {
    cells.forEach((cell, i) => label(cell, board[i] || '·', `${point(i, columns)}: ${board[i] || 'vacía'}`, ended || (!connect && !!board[i])));
  }
  function play(index) {
    if (ended) return;
    if (connect) {
      const column = index % columns;
      index = -1;
      for (let row = rows - 1; row >= 0; row--) if (!board[row * columns + column]) { index = row * columns + column; break; }
      if (index === -1) return;
    }
    if (board[index]) return;
    board[index] = player;
    const winner = lineWinner(board, rows, columns, connect ? 4 : 3);
    ended = !!winner || board.every(Boolean);
    if (winner) { s.status(`¡Gana ${winner}! Partida local terminada.`); score(ctx, 1); }
    else if (ended) s.status('Empate. ¡Otra partida!');
    else { player = player === 'X' ? 'O' : 'X'; s.status(`Dos jugadores · Turno de ${player}`); }
    draw();
  }
  function reset() { board = Array(rows * columns).fill(''); player = 'X'; ended = false; s.status('Dos jugadores · Turno de X'); draw(); }
  s.button('Nueva partida', reset); reset();
  return () => s.destroy();
}

export function reversiFlips(board, index, player) {
  if (index < 0 || index >= 64 || board[index]) return [];
  const flips = [], row = Math.floor(index / 8), col = index % 8;
  for (const [dr, dc] of directions) {
    const run = [];
    let r = row + dr, c = col + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r * 8 + c] === -player) {
      run.push(r * 8 + c); r += dr; c += dc;
    }
    if (run.length && r >= 0 && r < 8 && c >= 0 && c < 8 && board[r * 8 + c] === player) flips.push(...run);
  }
  return flips;
}
export const reversiMoves = (board, player) => board.flatMap((_, i) => reversiFlips(board, i, player).length ? [i] : []);
export function reversiTurn(board, previousPlayer) {
  if (reversiMoves(board, -previousPlayer).length) return { player: -previousPlayer, passed: false, ended: false };
  if (reversiMoves(board, previousPlayer).length) return { player: previousPlayer, passed: true, ended: false };
  return { player: previousPlayer, passed: false, ended: true };
}
function mountReversi(root, ctx) {
  const s = gameShell(root, 'Dos jugadores locales. Negro comienza. Coloca en un punto para encerrar fichas rivales entre las tuyas. Sin jugadas, el turno pasa automáticamente.');
  let board, player, ended;
  const name = p => p === 1 ? 'Negro' : 'Blanco';
  const cells = grid(s, 64, 8, play);
  function draw() {
    const moves = reversiMoves(board, player);
    cells.forEach((cell, i) => label(cell, board[i] === 1 ? '●' : board[i] === -1 ? '○' : moves.includes(i) ? '·' : '', `${point(i,8)}: ${board[i] ? name(board[i]) : moves.includes(i) ? 'jugada válida' : 'vacía'}`, ended || !moves.includes(i)));
  }
  function play(i) {
    if (ended) return;
    const flips = reversiFlips(board, i, player);
    if (!flips.length) return;
    board[i] = player; flips.forEach(j => { board[j] = player; });
    const turn = reversiTurn(board, player); player = turn.player; ended = turn.ended;
    const black = board.filter(v => v === 1).length, white = board.filter(v => v === -1).length;
    s.status(ended ? `Final: Negro ${black}, Blanco ${white}. ${black === white ? 'Empate.' : `¡Gana ${black > white ? 'Negro' : 'Blanco'}!`}` : `${turn.passed ? `${name(-player)} no tiene jugadas; pasa. ` : ''}Turno de ${name(player)} · Negro ${black} / Blanco ${white}`);
    if (ended) score(ctx, Math.max(black, white));
    draw();
  }
  function reset() { board = Array(64).fill(0); board[27] = board[36] = -1; board[28] = board[35] = 1; player = 1; ended = false; s.status('Dos jugadores · Turno de Negro · Negro 2 / Blanco 2'); draw(); }
  s.button('Nueva partida', reset); reset(); return () => s.destroy();
}

function mountMemory(root, ctx) {
  const s = gameShell(root, 'Encuentra las ocho parejas. Destapa dos cartas por turno y recuerda sus símbolos. Menos intentos dan más puntos.');
  let cards, found, open, tries, locked, generation = 0;
  const cells = grid(s, 16, 4, play);
  function draw() {
    cells.forEach((cell, i) => { const visible = found.has(i) || open.includes(i); label(cell, visible ? cards[i] : '?', `Carta ${i+1}: ${visible ? cards[i] : 'oculta'}`, found.has(i) || open.includes(i) || locked); });
    s.status(found.size === 16 ? `¡Todas las parejas! ${tries} intentos.` : `${found.size/2} de 8 parejas · ${tries} intentos`);
  }
  function play(i) {
    if (locked || found.has(i) || open.includes(i)) return;
    open.push(i);
    if (open.length === 2) {
      tries++;
      if (cards[open[0]] === cards[open[1]]) { open.forEach(j => found.add(j)); open = []; if (found.size === 16) score(ctx, Math.max(10, 1000 - (tries-8)*25)); }
      else { locked = true; const version = generation; s.later(() => { if (version !== generation) return; locked = false; open = []; draw(); }, 900); }
    }
    draw();
  }
  function reset() { generation++; cards = shuffle(['☀','☂','★','♥','♫','✿','◆','☾'].flatMap(v => [v,v])); found = new Set(); open = []; tries = 0; locked = false; draw(); }
  s.button('Nueva partida', reset); reset(); return () => { generation++; s.destroy(); };
}

export function mineNeighbors(index, size = 8) {
  const row = Math.floor(index / size), col = index % size;
  return directions.flatMap(([dr, dc]) => row+dr >= 0 && row+dr < size && col+dc >= 0 && col+dc < size ? [(row+dr)*size+col+dc] : []);
}
export function createMines(first, size = 8, count = 10) {
  const safe = new Set([first, ...mineNeighbors(first, size)]);
  return new Set(shuffle(Array.from({ length: size*size }, (_, i) => i).filter(i => !safe.has(i))).slice(0, count));
}
function mountMines(root, ctx) {
  const s = gameShell(root, 'Tablero 8 × 8 con 10 minas. La primera apertura es segura. Los números indican minas vecinas. Activa «Poner banderas» o usa clic derecho para marcar.');
  let mines, revealed, flags, ended, flagMode;
  const cells = grid(s, 64, 8, play);
  cells.forEach((cell, i) => s.on(cell, 'contextmenu', event => { event.preventDefault(); flag(i); }));
  const toggle = s.button('Poner banderas: no', () => { flagMode = !flagMode; toggle.textContent = `Poner banderas: ${flagMode ? 'sí' : 'no'}`; toggle.setAttribute('aria-pressed', String(flagMode)); });
  function draw() {
    cells.forEach((cell, i) => { const visible = revealed.has(i), bomb = ended && mines?.has(i); const count = visible ? mineNeighbors(i).filter(j => mines.has(j)).length : 0;
      label(cell, bomb ? '✹' : flags.has(i) ? '⚑' : visible ? count || '·' : '', `${point(i,8)}: ${bomb ? 'mina' : flags.has(i) ? 'bandera' : visible ? `${count} minas vecinas` : 'oculta'}`, ended || visible);
    });
    if (!ended) s.status(`${revealed.size} de 54 casillas despejadas · ${flags.size} banderas / 10 minas`);
  }
  function flag(i) { if (ended || revealed.has(i)) return; if (flags.has(i)) flags.delete(i); else flags.add(i); draw(); }
  function play(i) {
    if (flagMode) { flag(i); return; }
    if (ended || revealed.has(i) || flags.has(i)) return;
    if (!mines) mines = createMines(i);
    if (mines.has(i)) { ended = true; s.status('¡Mina! Partida terminada. Prueba otra vez.'); draw(); return; }
    const pending = [i];
    while (pending.length) {
      const current = pending.pop();
      if (revealed.has(current) || flags.has(current) || mines.has(current)) continue;
      revealed.add(current);
      const neighbors = mineNeighbors(current);
      if (!neighbors.some(j => mines.has(j))) pending.push(...neighbors);
    }
    if (revealed.size === 54) { ended = true; s.status('¡Campo despejado! Has encontrado todas las casillas seguras.'); score(ctx, 100); }
    draw();
  }
  function reset() { mines = null; revealed = new Set(); flags = new Set(); ended = false; flagMode = false; toggle.textContent = 'Poner banderas: no'; toggle.setAttribute('aria-pressed','false'); draw(); }
  s.button('Nueva partida', reset); reset(); return () => s.destroy();
}

export function merge2048(line) {
  const values = line.filter(Boolean), result = [];
  let points = 0;
  for (let i = 0; i < values.length; i++) {
    if (values[i] === values[i+1]) { result.push(values[i]*2); points += values[i]*2; i++; }
    else result.push(values[i]);
  }
  while (result.length < line.length) result.push(0);
  return { line: result, points };
}
export function move2048(board, direction) {
  const next = board.slice(); let points = 0;
  for (let a = 0; a < 4; a++) {
    const indexes = Array.from({ length: 4 }, (_, b) => direction === 'left' ? a*4+b : direction === 'right' ? a*4+3-b : direction === 'up' ? b*4+a : (3-b)*4+a);
    const merged = merge2048(indexes.map(i => board[i])); points += merged.points;
    indexes.forEach((i, b) => { next[i] = merged.line[b]; });
  }
  return { board: next, points, changed: next.some((v,i) => v !== board[i]) };
}
export const canMove2048 = board => ['left','right','up','down'].some(direction => move2048(board, direction).changed);
function mount2048(root, ctx) {
  const s = gameShell(root, 'Une fichas iguales con las flechas del teclado o los botones. Cada movimiento válido añade una ficha. Alcanza 2048; puedes seguir jugando después.');
  let board, points, ended, won;
  const cells = grid(s, 16, 4, () => {});
  cells.forEach(cell => { cell.tabIndex = -1; cell.style.cursor = 'default'; });
  function add() { const empty = board.flatMap((v,i) => v ? [] : [i]); if (empty.length) board[empty[Math.floor(Math.random()*empty.length)]] = Math.random() < .9 ? 2 : 4; }
  function draw() {
    cells.forEach((cell,i) => { label(cell, board[i] || '', `${point(i,4)}: ${board[i] || 'vacía'}`); cell.style.background = board[i] ? `hsl(${35 + Math.log2(board[i])*5} 65% ${Math.max(22, 65-Math.log2(board[i])*3)}%)` : ''; cell.style.color = board[i] ? '#fff' : ''; });
    s.status(`${points} puntos${won ? ' · ¡Has alcanzado 2048!' : ''}${ended ? ' · No quedan movimientos. Fin de partida.' : ''}`);
  }
  function move(direction) {
    if (ended) return;
    const result = move2048(board, direction);
    if (!result.changed) return;
    board = result.board; points += result.points; add(); won ||= board.some(v => v >= 2048); ended = !canMove2048(board); score(ctx, points); draw();
  }
  for (const [text, direction] of [['↑ Arriba','up'],['← Izquierda','left'],['↓ Abajo','down'],['→ Derecha','right']]) s.button(text, () => move(direction));
  s.on(root,'keydown', event => { const dir = { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right' }[event.key]; if (dir) { event.preventDefault(); move(dir); } });
  function reset() { board = Array(16).fill(0); points = 0; ended = won = false; add(); add(); draw(); }
  s.button('Nueva partida', reset); root.tabIndex = 0; reset(); root.focus({ preventScroll: true }); return () => { root.removeAttribute('tabindex'); s.destroy(); };
}

export function fifteenCanMove(board, index) {
  const empty = board.indexOf(0);
  return Math.abs(Math.floor(empty/4)-Math.floor(index/4)) + Math.abs(empty%4-index%4) === 1;
}
export function fifteenSolvable(board) {
  let inversions = 0;
  for (let i = 0; i < 16; i++) for (let j = i+1; j < 16; j++) if (board[i] && board[j] && board[i] > board[j]) inversions++;
  return (inversions + 4 - Math.floor(board.indexOf(0)/4)) % 2 === 1;
}
export function shuffleFifteen(steps = 160) {
  const board = Array.from({ length: 16 }, (_, i) => (i+1)%16);
  let previous = -1;
  for (let n = 0; n < steps; n++) {
    const choices = board.flatMap((_,i) => fifteenCanMove(board,i) && i !== previous ? [i] : []);
    const next = choices[Math.floor(Math.random()*choices.length)], empty = board.indexOf(0);
    [board[empty],board[next]] = [board[next],board[empty]]; previous = empty;
  }
  if (board.every((v,i) => v === (i+1)%16)) [board[14],board[15]] = [board[15],board[14]];
  return board;
}
function mountFifteen(root, ctx) {
  const s = gameShell(root, 'Ordena del 1 al 15, dejando el hueco abajo a la derecha. Pulsa una ficha junto al hueco para deslizarla. Todas las partidas tienen solución.');
  let board, moves, ended;
  const cells = grid(s, 16, 4, play);
  function draw() {
    cells.forEach((cell,i) => label(cell, board[i] || '', `${point(i,4)}: ${board[i] ? `ficha ${board[i]}` : 'hueco'}`, ended || !fifteenCanMove(board,i)));
    s.status(ended ? `¡Resuelto en ${moves} movimientos!` : `${moves} movimientos`);
  }
  function play(i) { if (ended || !fifteenCanMove(board,i)) return; const empty = board.indexOf(0); [board[empty],board[i]] = [board[i],board[empty]]; moves++; ended = board.every((v,j) => v === (j+1)%16); if (ended) score(ctx, Math.max(1, 2000-moves*5)); draw(); }
  function reset() { board = shuffleFifteen(); moves = 0; ended = false; draw(); }
  s.button('Nueva partida', reset); reset(); return () => s.destroy();
}

export const sudokuPuzzle = '530070000600195000098000060800060003400803001700020006060000280000419005000080079'.split('').map(Number);
export const sudokuSolution = '534678912672195348198342567859761423426853791713924856961537284287419635345286179'.split('').map(Number);
export function sudokuConflicts(board, index) {
  const value = board[index];
  if (!value) return false;
  const row = Math.floor(index/9), col = index%9;
  return board.some((v,i) => i !== index && v === value && (Math.floor(i/9) === row || i%9 === col || (Math.floor(i/27) === Math.floor(row/3) && Math.floor((i%9)/3) === Math.floor(col/3))));
}
export const sudokuComplete = board => board.length === 81 && board.every((v,i) => Number.isInteger(v) && v >= 1 && v <= 9 && !sudokuConflicts(board,i));
function mountSudoku(root, ctx) {
  const s = gameShell(root, 'Completa cada fila, columna y bloque 3 × 3 con los números del 1 al 9. Selecciona una casilla y usa los botones o el teclado. Las pistas iniciales no se pueden cambiar.');
  let board, selected, ended;
  const cells = grid(s, 81, 9, i => { if (!sudokuPuzzle[i] && !ended) { selected = i; draw(); s.status(`Seleccionada ${point(i,9)}. Introduce un número.`); } });
  cells.forEach((cell,i) => { cell.style.padding = '0'; cell.style.fontSize = 'clamp(14px, 3.5vw, 22px)'; if (i%9 === 2 || i%9 === 5) cell.style.borderRight = '3px solid #a2a9c9'; if (Math.floor(i/9) === 2 || Math.floor(i/9) === 5) cell.style.borderBottom = '3px solid #a2a9c9'; });
  function draw() {
    cells.forEach((cell,i) => {
      label(cell, board[i] || '·', `${point(i,9)}: ${board[i] || 'vacía'}${sudokuPuzzle[i] ? ', pista fija' : ''}${sudokuConflicts(board,i) ? ', número repetido' : ''}`, ended || !!sudokuPuzzle[i]);
      cell.setAttribute('aria-pressed', String(selected === i));
      cell.style.outline = selected === i ? '3px solid #f2bc65' : '';
      cell.style.background = sudokuConflicts(board,i) ? '#812e43' : sudokuPuzzle[i] ? '#242a3e' : '';
    });
  }
  function enter(value) {
    if (ended || selected === null || sudokuPuzzle[selected]) { if (!ended) s.status('Selecciona primero una casilla vacía.'); return; }
    board[selected] = value; ended = sudokuComplete(board);
    s.status(ended ? '¡Sudoku completado correctamente!' : sudokuConflicts(board,selected) ? 'Ese número se repite en la fila, columna o bloque. Corrígelo para continuar.' : `${board.filter(Boolean).length} de 81 casillas completas`);
    if (ended) score(ctx, 100); draw();
  }
  for (let n = 1; n <= 9; n++) s.button(String(n), () => enter(n));
  s.button('Borrar', () => enter(0));
  s.button('Comprobar', () => { const wrong = board.filter((v,i) => v && v !== sudokuSolution[i]).length; s.status(ended ? '¡Todo correcto! Sudoku resuelto.' : wrong ? `${wrong} ${wrong === 1 ? 'casilla necesita' : 'casillas necesitan'} revisión. Puedes borrar y corregir.` : 'Lo escrito es correcto. Continúa con las casillas vacías.'); });
  s.on(root,'keydown', event => { if (/^[1-9]$/.test(event.key)) { event.preventDefault(); enter(Number(event.key)); } else if (['Backspace','Delete','0'].includes(event.key)) { event.preventDefault(); enter(0); } });
  function reset() { board = sudokuPuzzle.slice(); selected = null; ended = false; draw(); s.status('Selecciona una casilla vacía para empezar.'); }
  s.button('Reiniciar sudoku', reset); reset(); return () => s.destroy();
}

export const games = [
  { id: 'tictactoe', title: 'Tres en raya', category: 'Mesa', description: 'Duelo local de X y O: consigue una línea de tres.', controls: '2 jugadores · Ratón, toque o teclado', mount: (root, ctx) => mountLines(root, ctx, false) },
  { id: 'connect4', title: 'Cuatro en raya', category: 'Mesa', description: 'Deja caer tus fichas y conecta cuatro antes que tu rival.', controls: '2 jugadores · Ratón, toque o teclado', mount: (root, ctx) => mountLines(root, ctx, true) },
  { id: 'reversi', title: 'Reversi', category: 'Mesa', description: 'Encierra y voltea fichas en un duelo de estrategia local.', controls: '2 jugadores · Ratón, toque o teclado', mount: mountReversi },
  { id: 'memory', title: 'Parejas', category: 'Puzles', description: 'Encuentra ocho parejas con el menor número de intentos.', controls: 'Ratón, toque o teclado', mount: mountMemory },
  { id: 'minesweeper', title: 'Buscaminas', category: 'Puzles', description: 'Despeja 54 casillas y evita las diez minas ocultas.', controls: 'Ratón, toque o teclado · Banderas con botón', mount: mountMines },
  { id: '2048', title: '2048', category: 'Puzles', description: 'Desliza y fusiona los números hasta alcanzar 2048.', controls: 'Flechas del teclado o botones táctiles', mount: mount2048 },
  { id: 'fifteen', title: 'Puzle del 15', category: 'Puzles', description: 'Desliza las fichas y devuelve cada número a su sitio.', controls: 'Ratón, toque o teclado', mount: mountFifteen },
  { id: 'sudoku', title: 'Sudoku', category: 'Puzles', description: 'Un desafío clásico de filas, columnas y bloques.', controls: 'Seleccionar casilla + números o botones', mount: mountSudoku },
];
