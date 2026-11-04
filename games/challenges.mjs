import { gameShell } from './common.mjs';

const WORDS = ['BARCO', 'CAMPO', 'CANTO', 'CARTA', 'CLAVE', 'DULCE', 'FUEGO', 'GATOS', 'GLOBO', 'JUEGO', 'LIBRO', 'LIMON', 'LUNES', 'MANOS', 'MONTE', 'NIEVE', 'NUBES', 'PAPEL', 'PARDO', 'PERRO', 'PIANO', 'PLATO', 'PLAYA', 'QUESO', 'RATON', 'RELOJ', 'SALTO', 'SELVA', 'SILLA', 'TIGRE', 'TORRE', 'VERDE', 'VIAJE'];
const LETTERS = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
const choose = (items) => items[Math.floor(Math.random() * items.length)];
const normalize = (text) => text.toLocaleUpperCase('es').replace(/[ÁÀ]/g, 'A').replace(/É/g, 'E').replace(/Í/g, 'I').replace(/Ó/g, 'O').replace(/Ú/g, 'U');
const score = (ctx, value) => ctx?.recordScore?.(Math.max(0, Math.round(value)));
function element(tag, text, parent) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  parent.append(node);
  return node;
}
function textInput(parent, label, maxLength) {
  const wrapper = element('label', label, parent);
  const input = element('input', undefined, wrapper);
  input.type = 'text';
  input.autocomplete = 'off';
  input.spellcheck = false;
  if (maxLength) input.maxLength = maxLength;
  return input;
}
function keyboard(shell, handler) {
  shell.on(window, 'keydown', (event) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (handler(event.key)) event.preventDefault();
  });
}

export function wordleFeedback(answer, guess) {
  const result = Array(answer.length).fill('absent');
  const remaining = {};
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) result[i] = 'correct';
    else remaining[answer[i]] = (remaining[answer[i]] || 0) + 1;
  }
  for (let i = 0; i < guess.length; i++) {
    if (result[i] !== 'correct' && remaining[guess[i]] > 0) {
      result[i] = 'present';
      remaining[guess[i]]--;
    }
  }
  return result;
}

export function toggleLights(board, index, size = 5) {
  const next = [...board];
  const row = Math.floor(index / size), column = index % size;
  for (const [dr, dc] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const r = row + dr, c = column + dc;
    if (r >= 0 && r < size && c >= 0 && c < size) next[r * size + c] = !next[r * size + c];
  }
  return next;
}

export function scrambleLights(moves, size = 5) {
  return moves.reduce((board, index) => toggleLights(board, index, size), Array(size * size).fill(false));
}

export function typingMetrics(expected, typed, elapsedMs) {
  let correct = 0;
  for (let i = 0; i < typed.length; i++) if (typed[i] === expected[i]) correct++;
  return {
    errors: typed.length - correct,
    wpm: elapsedMs > 0 ? Math.round((correct / 5) * 60000 / elapsedMs) : 0,
    accuracy: typed.length ? Math.round(correct / typed.length * 100) : 100,
  };
}

export function arithmeticProblem(operator, a, b) {
  if (operator === '+') return { text: `${a} + ${b}`, answer: a + b };
  if (operator === '−') return { text: `${Math.max(a, b)} − ${Math.min(a, b)}`, answer: Math.abs(a - b) };
  if (operator === '×') return { text: `${a} × ${b}`, answer: a * b };
  if (operator === '÷' && b !== 0) return { text: `${a * b} ÷ ${b}`, answer: a };
  throw new Error('Operación no válida');
}

function hangman(root, ctx) {
  const shell = gameShell(root, 'Adivina la palabra sin tildes antes de cometer 6 errores. Toca las letras o usa el teclado.');
  const display = element('p', '', shell.board);
  display.style.cssText = 'font-size:2rem;letter-spacing:.25em;text-align:center';
  const letters = element('div', undefined, shell.board);
  letters.className = 'game-actions';
  let answer, guessed, misses, ended;
  const buttons = new Map();
  function render() {
    display.textContent = [...answer].map((letter) => guessed.has(letter) ? letter : '_').join(' ');
    const won = [...answer].every((letter) => guessed.has(letter));
    ended = won || misses >= 6;
    for (const [letter, button] of buttons) button.disabled = ended || guessed.has(letter);
    shell.status(won ? `¡Acertaste! ${answer}. Errores: ${misses}/6.` : ended ? `Se acabaron los intentos. La palabra era ${answer}.` : `Errores: ${misses}/6. Letras usadas: ${[...guessed].join(', ') || 'ninguna'}.`);
    if (won) score(ctx, (6 - misses) * 100);
  }
  function guess(letter) {
    if (ended || guessed.has(letter)) return;
    guessed.add(letter);
    if (!answer.includes(letter)) misses++;
    render();
  }
  for (const letter of LETTERS) buttons.set(letter, shell.button(letter, () => guess(letter), letters));
  function start() { answer = choose(WORDS); guessed = new Set(); misses = 0; ended = false; render(); }
  keyboard(shell, (key) => {
    const letter = normalize(key);
    if (letter.length !== 1 || !LETTERS.includes(letter)) return false;
    guess(letter);
    return true;
  });
  shell.button('Nueva palabra', start);
  start();
  return () => shell.destroy();
}

function wordle(root, ctx) {
  const shell = gameShell(root, 'Descubre la palabra española de 5 letras en 6 intentos. Escribe sin tildes. Verde = posición correcta; amarillo = otra posición; gris = ausente. Se admiten combinaciones de letras.');
  const history = element('div', undefined, shell.board);
  const form = element('form', undefined, shell.board);
  const input = textInput(form, 'Tu palabra: ', 5);
  input.autocapitalize = 'characters';
  input.setAttribute('aria-label', 'Palabra de cinco letras');
  const submit = element('button', 'Comprobar', form);
  submit.type = 'submit';
  let answer, attempts, ended;
  shell.on(form, 'submit', (event) => {
    event.preventDefault();
    if (ended) return;
    const guess = normalize(input.value.trim());
    if (!/^[A-ZÑ]{5}$/.test(guess)) { shell.status('Escribe exactamente 5 letras, sin espacios.'); return; }
    attempts++;
    const result = wordleFeedback(answer, guess);
    const row = element('div', undefined, history);
    row.className = 'board-grid';
    row.style.cssText = 'grid-template-columns:repeat(5,minmax(0,1fr));margin:8px 0';
    const meanings = { correct: ['✓', 'correcta', '#17643d'], present: ['↔', 'otra posición', '#705500'], absent: ['×', 'ausente', '#3f4652'] };
    result.forEach((state, i) => {
      const [symbol, label, color] = meanings[state];
      const cell = element('span', `${guess[i]} ${symbol}`, row);
      cell.className = 'board-cell';
      cell.style.cssText = `background:${color};color:white;padding:10px 2px;text-align:center`;
      cell.setAttribute('aria-label', `${guess[i]}: ${label}`);
    });
    const won = guess === answer;
    ended = won || attempts >= 6;
    const feedback = result.map((state, i) => `${guess[i]} ${meanings[state][1]}`).join('; ');
    shell.status(won ? `¡Palabra acertada en ${attempts} intentos!` : ended ? `La palabra era ${answer}. ${feedback}.` : `Intento ${attempts}/6: ${feedback}.`);
    if (won) score(ctx, (7 - attempts) * 100);
    input.value = '';
    input.disabled = submit.disabled = ended;
    if (!ended) input.focus();
  });
  function start() {
    answer = choose(WORDS); attempts = 0; ended = false;
    history.replaceChildren(); input.value = ''; input.disabled = submit.disabled = false;
    shell.status('Intento 1 de 6. Busca una palabra de cinco letras.');
  }
  shell.button('Nueva palabra', start);
  start();
  return () => shell.destroy();
}

function simon(root, ctx) {
  const shell = gameShell(root, 'Memoriza y repite la secuencia. Usa los botones o las teclas 1–4. Cada ronda añade un paso.');
  const grid = element('div', undefined, shell.board);
  grid.className = 'board-grid';
  grid.style.gridTemplateColumns = 'repeat(2,minmax(0,1fr))';
  let sequence = [], position = 0, accepting = false, generation = 0, timers = [];
  const labels = ['1 · Verde', '2 · Rojo', '3 · Azul', '4 · Amarillo'];
  const colors = ['#17643d', '#96352f', '#244f97', '#705500'];
  const pads = labels.map((label, i) => {
    const button = shell.button(label, () => press(i), grid);
    button.style.cssText = `background:${colors[i]};color:white;min-height:90px;border:3px solid transparent`;
    return button;
  });
  function cancel() { generation++; timers.forEach(clearTimeout); timers = []; }
  function later(fn, ms) {
    const current = generation;
    timers.push(shell.later(() => { if (current === generation) fn(); }, ms));
  }
  function flash(index) {
    pads[index].style.borderColor = 'white';
    pads[index].textContent = `${labels[index]} ★`;
    later(() => { pads[index].style.borderColor = 'transparent'; pads[index].textContent = labels[index]; }, 360);
  }
  function playback() {
    accepting = false; position = 0;
    pads.forEach((pad) => { pad.disabled = true; });
    shell.status(`Observa la secuencia de ${sequence.length} pasos.`);
    sequence.forEach((value, index) => later(() => {
      flash(value);
      shell.status(`Observa: paso ${index + 1}/${sequence.length}, ${labels[value]}.`);
    }, 500 + index * 650));
    later(() => {
      accepting = true;
      pads.forEach((pad) => { pad.disabled = false; });
      shell.status(`Tu turno: repite ${sequence.length} pasos.`);
    }, 500 + sequence.length * 650);
  }
  function press(index) {
    if (!accepting) return;
    if (sequence[position] !== index) {
      accepting = false;
      pads.forEach((pad) => { pad.disabled = true; });
      shell.status(`Fin de la partida. Completaste ${sequence.length - 1} rondas. Pulsa Reiniciar.`);
      score(ctx, sequence.length - 1);
      return;
    }
    flash(index);
    position++;
    shell.status(`Correcto: ${position}/${sequence.length}.`);
    if (position === sequence.length) {
      accepting = false;
      pads.forEach((pad) => { pad.disabled = true; });
      score(ctx, sequence.length);
      later(() => { sequence.push(Math.floor(Math.random() * 4)); playback(); }, 650);
    }
  }
  function start() {
    cancel();
    pads.forEach((pad, i) => { pad.textContent = labels[i]; pad.style.borderColor = 'transparent'; });
    sequence = [Math.floor(Math.random() * 4)]; playback();
  }
  keyboard(shell, (key) => { if (!/^[1-4]$/.test(key)) return false; press(Number(key) - 1); return true; });
  shell.button('Reiniciar', start);
  start();
  return () => { cancel(); shell.destroy(); };
}

function reaction(root, ctx) {
  const shell = gameShell(root, 'Pulsa Comenzar y espera a que el botón diga ¡AHORA! Toca, haz clic o pulsa Espacio/Enter con el botón enfocado. Un clic anticipado invalida el intento.');
  let phase = 'idle', timer, started = 0;
  const target = shell.button('Comenzar', click, shell.board);
  target.style.cssText = 'width:100%;min-height:180px;font-size:1.6rem';
  function reset() {
    clearTimeout(timer); phase = 'idle'; target.textContent = 'Comenzar';
    target.style.background = ''; shell.status('Listo para medir tus reflejos.');
  }
  function click() {
    if (phase === 'idle' || phase === 'done') {
      clearTimeout(timer); phase = 'waiting'; target.textContent = 'Espera…'; target.style.background = '#705500';
      shell.status('Espera a la señal.');
      timer = shell.later(() => {
        phase = 'ready'; started = performance.now(); target.textContent = '¡AHORA!'; target.style.background = '#17643d';
        shell.status('¡Ahora!');
      }, 1400 + Math.random() * 2600);
    } else if (phase === 'waiting') {
      clearTimeout(timer); phase = 'done'; target.textContent = 'Intentar de nuevo'; target.style.background = '';
      shell.status('¡Demasiado pronto! Espera al mensaje ¡AHORA!');
    } else {
      const elapsed = Math.round(performance.now() - started);
      phase = 'done'; target.textContent = 'Intentar de nuevo'; target.style.background = '';
      shell.status(`Tiempo de reacción: ${elapsed} ms. Cuanto menos, mejor.`);
      score(ctx, Math.max(1, 10000 - elapsed));
    }
  }
  shell.on(target, 'keydown', (event) => { if (event.repeat) event.preventDefault(); });
  shell.button('Reiniciar', reset);
  reset();
  return () => { clearTimeout(timer); shell.destroy(); };
}

function math(root, ctx) {
  const shell = gameShell(root, 'Resuelve operaciones durante 30 segundos. Todas las respuestas son enteras. Cada acierto suma 100 puntos; cada fallo resta 25.');
  const prompt = element('p', '', shell.board);
  prompt.style.fontSize = '2rem';
  const form = element('form', undefined, shell.board);
  const input = textInput(form, 'Respuesta: ', 8);
  input.inputMode = 'numeric';
  const submit = element('button', 'Responder', form);
  submit.type = 'submit';
  let problem, deadline = 0, timer, running = false, correct = 0, wrong = 0;
  const points = () => Math.max(0, correct * 100 - wrong * 25);
  function next() {
    problem = arithmeticProblem(choose(['+', '−', '×', '÷']), 1 + Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 12));
    prompt.textContent = `${problem.text} = ?`; input.value = '';
  }
  function finish() {
    clearInterval(timer); running = false; input.disabled = submit.disabled = true;
    shell.status(`Tiempo agotado. ${correct} aciertos, ${wrong} fallos. ${points()} puntos.`);
    score(ctx, points());
  }
  function tick() {
    const remaining = deadline - performance.now();
    if (remaining <= 0) finish();
    else shell.status(`${Math.ceil(remaining / 1000)} s · Aciertos: ${correct} · Fallos: ${wrong} · ${points()} puntos.`);
  }
  shell.on(form, 'submit', (event) => {
    event.preventDefault();
    if (!running) return;
    if (performance.now() >= deadline) { finish(); return; }
    if (!/^\d+$/.test(input.value.trim())) { shell.status('Introduce un número entero positivo o cero.'); return; }
    const matched = Number(input.value) === problem.answer;
    if (matched) correct++; else wrong++;
    next(); tick(); input.focus();
  });
  shell.button('Comenzar / reiniciar', () => {
    clearInterval(timer); running = true; correct = wrong = 0; deadline = performance.now() + 30000;
    input.disabled = submit.disabled = false; next(); tick(); input.focus(); timer = shell.every(tick, 250);
  });
  input.disabled = submit.disabled = true;
  prompt.textContent = '¿Preparado?'; shell.status('Pulsa Comenzar. Tienes 30 segundos.');
  return () => { clearInterval(timer); shell.destroy(); };
}

function typing(root, ctx) {
  const shell = gameShell(root, 'Copia el texto respetando mayúsculas, espacios y signos. El reloj empieza al escribir. Tienes 45 segundos; puedes terminar al copiar todo. PPM cuenta caracteres correctos en bloques de cinco.');
  const samples = ['La luna ilumina el camino mientras el viento mueve las hojas del bosque.', 'Cada viaje empieza con un paso y una buena historia para compartir.', 'El gato mira por la ventana y espera que llegue otra tarde de aventuras.'];
  const passage = element('p', '', shell.board);
  const input = textInput(shell.board, 'Escribe aquí: ');
  input.style.width = '100%';
  input.autocapitalize = 'off';
  let expected, started = null, timer, ended = false;
  const finishButton = shell.button('Terminar', finish);
  function update() {
    if (started === null || ended) return;
    const elapsed = performance.now() - started;
    if (elapsed >= 45000) { finish(); return; }
    const metrics = typingMetrics(expected, input.value, elapsed);
    shell.status(`${Math.ceil((45000 - elapsed) / 1000)} s · ${metrics.wpm} PPM · ${metrics.errors} errores · ${metrics.accuracy}% de precisión.`);
    finishButton.disabled = input.value.length < expected.length;
  }
  function finish() {
    if (started === null || ended) return;
    ended = true; clearInterval(timer); input.disabled = finishButton.disabled = true;
    const elapsed = Math.min(45000, performance.now() - started);
    const metrics = typingMetrics(expected, input.value, elapsed);
    shell.status(`Resultado: ${metrics.wpm} PPM · ${metrics.errors} errores · ${metrics.accuracy}% de precisión · ${(elapsed / 1000).toFixed(1)} s.`);
    score(ctx, metrics.wpm);
  }
  shell.on(input, 'beforeinput', (event) => {
    if (started !== null && performance.now() - started >= 45000) { event.preventDefault(); finish(); }
  });
  shell.on(input, 'paste', (event) => { event.preventDefault(); shell.status('Escribe el texto con el teclado para medir tu velocidad.'); });
  shell.on(input, 'drop', (event) => event.preventDefault());
  shell.on(input, 'input', () => {
    if (ended) return;
    if (started === null && input.value.length) { started = performance.now(); timer = shell.every(update, 250); }
    update();
  });
  function start() {
    clearInterval(timer); started = null; ended = false; expected = choose(samples);
    passage.textContent = expected; input.value = ''; input.disabled = false; finishButton.disabled = true;
    shell.status('El reloj empezará cuando escribas el primer carácter.');
  }
  shell.button('Reiniciar', start); start();
  return () => { clearInterval(timer); shell.destroy(); };
}

function aim(root, ctx) {
  const shell = gameShell(root, 'Alcanza tantas dianas como puedas en 20 segundos. Cada acierto mueve la diana y suma 100 puntos. También puedes enfocarla con Tab y usar Espacio/Enter.');
  shell.board.style.cssText = 'position:relative;height:300px;overflow:hidden';
  let deadline = 0, timer, hits = 0, running = false;
  const target = shell.button('◎', hit, shell.board);
  target.setAttribute('aria-label', 'Diana: pulsar para sumar un acierto');
  target.style.cssText = 'position:absolute;width:56px;height:56px;font-size:2rem;transform:translate(-50%,-50%);border-radius:50%';
  function move() { target.style.left = `${10 + Math.random() * 80}%`; target.style.top = `${12 + Math.random() * 76}%`; }
  function finish() {
    running = false; clearInterval(timer); target.disabled = true;
    shell.status(`¡Tiempo! ${hits} dianas · ${hits * 100} puntos.`); score(ctx, hits * 100);
  }
  function tick() {
    const remaining = deadline - performance.now();
    if (remaining <= 0) finish();
    else shell.status(`${Math.ceil(remaining / 1000)} s · ${hits} dianas · ${hits * 100} puntos.`);
  }
  function hit() {
    if (!running) return;
    if (performance.now() >= deadline) { finish(); return; }
    hits++; move(); tick();
  }
  shell.on(target, 'keydown', (event) => { if (event.repeat) event.preventDefault(); });
  shell.button('Comenzar / reiniciar', () => {
    clearInterval(timer); hits = 0; running = true; deadline = performance.now() + 20000;
    target.disabled = false; move(); tick(); timer = shell.every(tick, 250);
  });
  target.disabled = true; move(); shell.status('Pulsa Comenzar. Tienes 20 segundos.');
  return () => { clearInterval(timer); shell.destroy(); };
}

function lightsout(root, ctx) {
  const shell = gameShell(root, 'Apaga las 25 luces. Cada casilla cambia su luz y las vecinas de arriba, abajo, izquierda y derecha. Todos los tableros tienen solución. Usa Tab y Espacio/Enter o toca las casillas.');
  shell.board.classList.add('board-grid');
  shell.board.style.gridTemplateColumns = 'repeat(5,minmax(0,1fr))';
  let board, moves = 0, ended = false;
  const cells = Array.from({ length: 25 }, (_, index) => {
    const button = shell.button('', () => {
      if (ended) return;
      board = toggleLights(board, index); moves++; render();
    }, shell.board);
    button.className = 'board-cell';
    button.style.minHeight = '48px';
    return button;
  });
  function render() {
    ended = board.every((light) => !light);
    cells.forEach((cell, index) => {
      cell.textContent = board[index] ? '☀' : '·';
      cell.style.background = board[index] ? '#705500' : '#242c3b';
      cell.style.color = 'white';
      cell.setAttribute('aria-label', `Fila ${Math.floor(index / 5) + 1}, columna ${index % 5 + 1}: ${board[index] ? 'encendida' : 'apagada'}`);
      cell.setAttribute('aria-pressed', String(board[index]));
      cell.disabled = ended;
    });
    shell.status(ended ? `¡Todas apagadas! Lo lograste en ${moves} movimientos.` : `${moves} movimientos · ${board.filter(Boolean).length} luces encendidas.`);
    if (ended) score(ctx, Math.max(1, 2000 - moves * 10));
  }
  function start() {
    board = scrambleLights(Array.from({ length: 12 }, () => Math.floor(Math.random() * 25)));
    if (board.every((light) => !light)) board = toggleLights(board, 12);
    moves = 0; render();
  }
  shell.button('Nuevo tablero', start); start();
  return () => shell.destroy();
}

export const games = [
  { id: 'hangman', title: 'Ahorcado', category: 'Palabras', description: 'Descubre la palabra antes de agotar seis errores.', controls: 'Letras del teclado o botones', mount: hangman },
  { id: 'wordle', title: 'Cinco letras', category: 'Palabras', description: 'Seis intentos, cinco letras y pistas en cada jugada.', controls: 'Escribe una palabra y pulsa Enter', mount: wordle },
  { id: 'simon', title: 'Simón', category: 'Reflejos', description: 'Recuerda una secuencia que crece en cada ronda.', controls: 'Teclas 1–4 o botones', mount: simon },
  { id: 'reaction', title: 'Reacción', category: 'Reflejos', description: 'Espera la señal y mide tu tiempo de respuesta.', controls: 'Clic, toque o Espacio/Enter', mount: reaction },
  { id: 'math', title: 'Cálculo exprés', category: 'Puzles', description: 'Resuelve todas las operaciones que puedas en 30 segundos.', controls: 'Números y Enter o botón Responder', mount: math },
  { id: 'typing', title: 'Tecleo veloz', category: 'Palabras', description: 'Copia un texto y descubre tu velocidad y precisión.', controls: 'Teclado físico o en pantalla', mount: typing },
  { id: 'aim', title: 'Puntería', category: 'Reflejos', description: 'Persigue las dianas durante veinte segundos.', controls: 'Clic, toque o Tab y Espacio/Enter', mount: aim },
  { id: 'lightsout', title: 'Apaga las luces', category: 'Puzles', description: 'Un toque cambia cinco luces. Consigue apagarlas todas.', controls: 'Clic, toque o Tab y Espacio/Enter', mount: lightsout },
];
