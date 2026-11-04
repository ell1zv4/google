import { gameShell } from './common.mjs';

const W = 600, H = 400;
const COLORS = ['#00ffff', '#ff006e', '#ffff00', '#ff6aae'];
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export const circlesHit = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) <= a.r + b.r;
export const wrap = (value, limit) => ((value % limit) + limit) % limit;
export function turnSnake(current, next) {
  return next.x === -current.x && next.y === -current.y ? current : next;
}
export function advanceSnake(body, direction, food, width = 30, height = 20) {
  const head = { x: body[0].x + direction.x, y: body[0].y + direction.y };
  const ate = head.x === food?.x && head.y === food?.y;
  const occupied = ate ? body : body.slice(0, -1);
  const dead = head.x < 0 || head.x >= width || head.y < 0 || head.y >= height || occupied.some(p => p.x === head.x && p.y === head.y);
  return { body: dead ? body : [head, ...body.slice(0, ate ? body.length : -1)], ate, dead };
}
export function freeSnakeCell(body, width = 30, height = 20, random = Math.random) {
  const occupied = new Set(body.map(p => p.y * width + p.x));
  const free = [];
  for (let i = 0; i < width * height; i++) if (!occupied.has(i)) free.push(i);
  if (!free.length) return null;
  const cell = free[Math.floor(random() * free.length)];
  return { x: cell % width, y: Math.floor(cell / width) };
}

function rect(g, x, y, w, h, color = COLORS[0]) { g.fillStyle = color; g.fillRect(x, y, w, h); }
function circle(g, x, y, r, color = COLORS[0]) { g.fillStyle = color; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
function label(g, text, x, y, size = 18, align = 'left') {
  g.fillStyle = '#f4f5ff'; g.font = `600 ${size}px monospace`; g.textAlign = align; g.fillText(text, x, y);
}
function play(root, ctx, title, instructions, controls, create) {
  const shell = gameShell(root, instructions);
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H; canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `${title}: área de juego. ${instructions}`);
  canvas.style.cssText = 'display:block;width:100%;max-width:600px;height:auto;border-radius:16px;background:#0a0014;touch-action:none';
  shell.board.append(canvas);
  const g = canvas.getContext('2d');
  if (!g) { shell.status('Tu navegador no permite dibujar este juego.'); return () => shell.destroy(); }
  let running = false, started = false, ended = false, alive = true, raf = 0, previous = 0, score = 0, announcedScore = 0, lastAnnouncement = 0, message = '';
  const held = new Set();
  const keyMap = new Map(controls.flatMap(c => c.keys.map(k => [k, c.id])));
  const api = {
    held,
    score(value) { score = Math.floor(value); },
    finish(text = 'Fin de la partida') {
      if (ended) return;
      ended = true; running = false; held.clear(); message = text;
      ctx?.recordScore?.(score); updateStatus();
    },
  };
  let game;
  const toggle = shell.button('Empezar', () => {
    if (ended) return reset();
    if (running) pause('Partida en pausa');
    else { started = true; running = true; message = ''; previous = 0; updateStatus(); schedule(); canvas.focus({ preventScroll: true }); }
  });
  shell.button('Reiniciar', reset);
  function updateStatus() {
    announcedScore = score;
    toggle.textContent = ended ? 'Volver a jugar' : running ? 'Pausar' : started ? 'Continuar' : 'Empezar';
    shell.status(`${message || (running ? 'Jugando' : 'Pulsa Empezar para jugar')} · Puntos: ${score}`);
  }
  function draw() {
    g.clearRect(0, 0, W, H); rect(g, 0, 0, W, H, '#0a0014'); game.draw(g);
    rect(g, 0, 0, W, 30, '#0a0014'); label(g, `Puntos: ${score}`, 12, 22, 16);
    if (!running) {
      rect(g, 0, 135, W, 120, '#0a0014ee');
      label(g, ended ? message : started ? 'En pausa' : title, W / 2, 182, 25, 'center');
      label(g, ended ? 'Pulsa Volver a jugar' : started ? 'Pulsa Continuar' : 'Pulsa Empezar', W / 2, 218, 17, 'center');
    }
  }
  function schedule() { if (alive && running && !raf) raf = requestAnimationFrame(frame); }
  function frame(time) {
    raf = 0;
    if (!alive || !running) return;
    const dt = previous ? Math.min((time - previous) / 1000, .04) : 0;
    previous = time;
    game.update(dt);
    if (score !== announcedScore && running && time - lastAnnouncement >= 1500) { updateStatus(); lastAnnouncement = time; }
    draw(); schedule();
  }
  function pause(reason) {
    running = false; held.clear(); previous = 0; cancelAnimationFrame(raf); raf = 0;
    message = reason; updateStatus(); draw();
  }
  function reset() {
    if (score) ctx?.recordScore?.(score);
    cancelAnimationFrame(raf); raf = 0; held.clear(); score = 0; ended = false;
    started = true; running = !document.hidden; previous = 0; lastAnnouncement = 0; message = running ? '' : 'Partida en pausa';
    game = create(api); updateStatus(); draw(); schedule();
    if (running) canvas.focus({ preventScroll: true });
  }
  function press(id) { if (running && !held.has(id)) { held.add(id); game.press?.(id); } }
  for (const control of controls) {
    const button = shell.button(control.label, event => {
      if (event.detail === 0) { press(control.id); held.delete(control.id); }
    });
    button.style.touchAction = 'none';
    shell.on(button, 'pointerdown', event => { event.preventDefault(); button.setPointerCapture?.(event.pointerId); press(control.id); });
    shell.on(button, 'pointerup', () => held.delete(control.id));
    shell.on(button, 'pointercancel', () => held.delete(control.id));
    shell.on(button, 'lostpointercapture', () => held.delete(control.id));
    shell.on(button, 'keydown', event => { if (event.code === 'Space' || event.code === 'Enter') { event.preventDefault(); press(control.id); } });
    shell.on(button, 'keyup', event => { if (event.code === 'Space' || event.code === 'Enter') { event.preventDefault(); held.delete(control.id); } });
  }
  shell.on(window, 'keydown', event => {
    if (event.target?.closest?.('input,textarea,select,button,a,[contenteditable="true"]')) return;
    const id = keyMap.get(event.code);
    if (id) { event.preventDefault(); press(id); }
    if (event.code === 'KeyP' && started && !ended && !event.repeat) { event.preventDefault(); toggle.click(); }
  });
  shell.on(window, 'keyup', event => { const id = keyMap.get(event.code); if (id) held.delete(id); });
  shell.on(window, 'blur', () => { if (running) pause('Pausa al salir de la ventana'); });
  shell.on(document, 'visibilitychange', () => { if (document.hidden && running) pause('Pausa al cambiar de pestaña'); });
  game = create(api); updateStatus(); draw();
  return () => {
    alive = false; running = false; cancelAnimationFrame(raf); held.clear();
    if (score && !ended) ctx?.recordScore?.(score);
    shell.destroy();
  };
}

const leftRight = [
  { id: 'left', label: '← Izquierda', keys: ['ArrowLeft', 'KeyA'] },
  { id: 'right', label: 'Derecha →', keys: ['ArrowRight', 'KeyD'] },
];
const upDown = [
  { id: 'up', label: '↑ Arriba', keys: ['ArrowUp', 'KeyW'] },
  { id: 'down', label: '↓ Abajo', keys: ['ArrowDown', 'KeyS'] },
];
const action = (id, label) => ({ id, label, keys: ['Space'] });
const axis = (held, negative, positive) => Number(held.has(positive)) - Number(held.has(negative));

function snake(api) {
  let body = [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }];
  let direction = { x: 1, y: 0 }, pending = direction, food = freeSnakeCell(body), elapsed = 0, points = 0;
  const directions = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 } };
  return {
    press(id) { if (directions[id]) pending = turnSnake(direction, directions[id]); },
    update(dt) {
      elapsed += dt;
      if (elapsed < Math.max(.065, .14 - points * .002)) return;
      elapsed = 0; direction = pending;
      const next = advanceSnake(body, direction, food);
      if (next.dead) return api.finish('¡La serpiente ha chocado!');
      body = next.body;
      if (next.ate) { api.score(++points); food = freeSnakeCell(body); if (!food) api.finish('¡Has llenado el tablero!'); }
    },
    draw(g) {
      body.forEach((p, i) => rect(g, p.x * 20 + 1, p.y * 18 + 38, 18, 16, i ? '#009a9a' : COLORS[0]));
      if (food) circle(g, food.x * 20 + 10, food.y * 18 + 46, 7, COLORS[2]);
    },
  };
}

function pong(api) {
  let player = 160, rival = 160, ball, points = 0, lives = 3;
  const serve = () => { ball = { x: 300, y: 210, vx: -260, vy: (Math.random() - .5) * 220, r: 8 }; };
  serve();
  return {
    update(dt) {
      player = clamp(player + axis(api.held, 'up', 'down') * 340 * dt, 32, H - 80);
      rival = clamp(rival + clamp(ball.y - rival - 40, -1, 1) * 185 * dt, 32, H - 80);
      ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      if (ball.y < 40) { ball.y = 40; ball.vy = Math.abs(ball.vy); }
      if (ball.y > H - 8) { ball.y = H - 8; ball.vy = -Math.abs(ball.vy); }
      if (ball.vx < 0 && ball.x - 8 < 38 && ball.x > 18 && ball.y + 8 > player && ball.y - 8 < player + 80) {
        ball.x = 46; ball.vx = Math.min(470, Math.abs(ball.vx) + 12); ball.vy = (ball.y - player - 40) * 6;
      }
      if (ball.vx > 0 && ball.x + 8 > 562 && ball.x < 582 && ball.y + 8 > rival && ball.y - 8 < rival + 80) {
        ball.x = 554; ball.vx = -Math.min(470, Math.abs(ball.vx) + 12); ball.vy = (ball.y - rival - 40) * 6;
      }
      if (ball.x > W + 10) { api.score(++points); serve(); }
      if (ball.x < -10) { lives--; if (!lives) api.finish('Fin del partido'); else serve(); }
    },
    draw(g) {
      for (let y = 40; y < H; y += 24) rect(g, 299, y, 2, 12, '#48516a');
      rect(g, 26, player, 12, 80); rect(g, 562, rival, 12, 80, COLORS[1]);
      circle(g, ball.x, ball.y, 8, COLORS[2]); label(g, `Vidas: ${lives}`, 465, 53, 16);
    },
  };
}

function breakout(api) {
  let paddle = 250, lives = 3, points = 0, ball;
  const bricks = Array.from({ length: 40 }, (_, i) => ({ x: 16 + (i % 8) * 72, y: 55 + Math.floor(i / 8) * 25, w: 66, h: 18, alive: true, row: Math.floor(i / 8) }));
  const serve = () => { ball = { x: paddle + 50, y: 340, vx: 160, vy: -230, r: 7 }; };
  serve();
  return {
    update(dt) {
      paddle = clamp(paddle + axis(api.held, 'left', 'right') * 400 * dt, 0, W - 100);
      const oldY = ball.y;
      ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      if (ball.x < 7) { ball.x = 7; ball.vx = Math.abs(ball.vx); }
      if (ball.x > W - 7) { ball.x = W - 7; ball.vx = -Math.abs(ball.vx); }
      if (ball.y < 37) { ball.y = 37; ball.vy = Math.abs(ball.vy); }
      if (ball.vy > 0 && oldY + 7 <= 365 && ball.y + 7 >= 365 && ball.x + 7 >= paddle && ball.x - 7 <= paddle + 100) {
        ball.y = 358; ball.vy = -260; ball.vx = (ball.x - paddle - 50) * 5;
      }
      for (const brick of bricks) {
        if (!brick.alive || !overlaps({ x: ball.x - 7, y: ball.y - 7, w: 14, h: 14 }, brick)) continue;
        brick.alive = false;
        if (oldY + 7 <= brick.y || oldY - 7 >= brick.y + brick.h) ball.vy *= -1;
        else ball.vx *= -1;
        api.score(points += 10); break;
      }
      if (bricks.every(b => !b.alive)) api.finish('¡Muro despejado!');
      if (ball.y > H + 7) { lives--; if (!lives) api.finish('No quedan pelotas'); else serve(); }
    },
    draw(g) {
      bricks.forEach(b => { if (b.alive) rect(g, b.x, b.y, b.w, b.h, COLORS[b.row % 4]); });
      rect(g, paddle, 365, 100, 12); circle(g, ball.x, ball.y, 7, '#ffffff'); label(g, `Vidas: ${lives}`, 465, 340, 16);
    },
  };
}

function dodge(api) {
  let player = { x: 285, y: 345, w: 30, h: 30 }, blocks = [], spawn = 0, elapsed = 0;
  return {
    update(dt) {
      elapsed += dt; api.score(elapsed * 10);
      player.x = clamp(player.x + axis(api.held, 'left', 'right') * 330 * dt, 0, W - player.w);
      spawn -= dt;
      if (spawn <= 0) { blocks.push({ x: Math.random() * 560, y: 30, w: 24 + Math.random() * 20, h: 24, speed: 130 + Math.random() * 80 + elapsed * 3 }); spawn = Math.max(.17, .65 - elapsed * .009); }
      for (const block of blocks) { block.y += block.speed * dt; if (overlaps(player, block)) { api.finish('¡Te ha alcanzado un bloque!'); break; } }
      blocks = blocks.filter(b => b.y < H);
    },
    draw(g) { rect(g, player.x, player.y, player.w, player.h); blocks.forEach(b => rect(g, b.x, b.y, b.w, b.h, COLORS[3])); },
  };
}

function flappy(api) {
  const bird = { x: 145, y: 190, r: 12 };
  let velocity = -100, pipes = [], spawn = 1.2, points = 0;
  return {
    press(id) { if (id === 'flap') velocity = -270; },
    update(dt) {
      velocity += 760 * dt; bird.y += velocity * dt;
      spawn -= dt;
      if (spawn <= 0) { pipes.push({ x: W, gap: 80 + Math.random() * 150, passed: false }); spawn = 1.8; }
      for (const pipe of pipes) {
        pipe.x -= 160 * dt;
        if (bird.x + bird.r > pipe.x && bird.x - bird.r < pipe.x + 58 && (bird.y - bird.r < pipe.gap || bird.y + bird.r > pipe.gap + 130)) return api.finish('¡Cuidado con las columnas!');
        if (!pipe.passed && pipe.x + 58 < bird.x - bird.r) { pipe.passed = true; api.score(++points); }
      }
      pipes = pipes.filter(p => p.x > -60);
      if (bird.y - bird.r < 30 || bird.y + bird.r > H) api.finish('El vuelo ha terminado');
    },
    draw(g) {
      pipes.forEach(p => { rect(g, p.x, 30, 58, p.gap - 30, COLORS[1]); rect(g, p.x, p.gap + 130, 58, H - p.gap - 130, COLORS[1]); });
      circle(g, bird.x, bird.y, bird.r, COLORS[2]); circle(g, bird.x + 5, bird.y - 3, 3, '#0a0014');
    },
  };
}

function runner(api) {
  const player = { x: 85, y: 316, w: 30, h: 34 };
  let velocity = 0, obstacles = [], spawn = 1.3, elapsed = 0, points = 0;
  return {
    press(id) { if (id === 'jump' && player.y >= 316) velocity = -490; },
    update(dt) {
      elapsed += dt; velocity += 1250 * dt; player.y += velocity * dt;
      if (player.y > 316) { player.y = 316; velocity = 0; }
      spawn -= dt;
      if (spawn <= 0) { const height = 25 + Math.random() * 28; obstacles.push({ x: W, y: 350 - height, w: 22 + Math.random() * 15, h: height, passed: false }); spawn = 1.15 + Math.random() * .6; }
      for (const obstacle of obstacles) {
        obstacle.x -= Math.min(400, 240 + elapsed * 2) * dt;
        if (overlaps(player, obstacle)) return api.finish('¡Has tropezado!');
        if (!obstacle.passed && obstacle.x + obstacle.w < player.x) { obstacle.passed = true; api.score(++points * 10); }
      }
      obstacles = obstacles.filter(o => o.x > -50);
    },
    draw(g) {
      rect(g, 0, 350, W, 3, '#728099'); rect(g, player.x, player.y, player.w, player.h);
      obstacles.forEach(o => rect(g, o.x, o.y, o.w, o.h, COLORS[2]));
      for (let i = 0; i < 12; i++) rect(g, wrap(i * 65 - elapsed * 90, W), 375, 25, 2, '#48516a');
    },
  };
}

function asteroids(api) {
  const ship = { x: 300, y: 220, r: 11, angle: -Math.PI / 2, vx: 0, vy: 0 };
  let rocks = [], shots = [], cooldown = 0, points = 0, wave = 0, immunity = 2;
  function nextWave() {
    wave++; immunity = 2;
    for (let i = 0; i < Math.min(9, wave + 2); i++) {
      const angle = Math.random() * Math.PI * 2;
      rocks.push({ x: wrap(ship.x + Math.cos(angle) * 250, W), y: wrap(ship.y - 30 + Math.sin(angle) * 165, H - 30) + 30, r: 28, vx: (Math.random() - .5) * 100, vy: (Math.random() - .5) * 100 });
    }
  }
  nextWave();
  return {
    update(dt) {
      immunity -= dt; cooldown -= dt;
      ship.angle += axis(api.held, 'left', 'right') * 3.7 * dt;
      if (api.held.has('thrust')) { ship.vx += Math.cos(ship.angle) * 230 * dt; ship.vy += Math.sin(ship.angle) * 230 * dt; }
      ship.vx *= Math.exp(-.35 * dt); ship.vy *= Math.exp(-.35 * dt);
      const speed = Math.hypot(ship.vx, ship.vy);
      if (speed > 290) { ship.vx *= 290 / speed; ship.vy *= 290 / speed; }
      ship.x = wrap(ship.x + ship.vx * dt, W); ship.y = wrap(ship.y - 30 + ship.vy * dt, H - 30) + 30;
      if (api.held.has('fire') && cooldown <= 0) { shots.push({ x: ship.x, y: ship.y, vx: Math.cos(ship.angle) * 480, vy: Math.sin(ship.angle) * 480, r: 3, life: 1.1 }); cooldown = .18; }
      for (const rock of rocks) { rock.x = wrap(rock.x + rock.vx * dt, W); rock.y = wrap(rock.y - 30 + rock.vy * dt, H - 30) + 30; }
      const fragments = [];
      for (const shot of shots) {
        shot.x = wrap(shot.x + shot.vx * dt, W); shot.y = wrap(shot.y - 30 + shot.vy * dt, H - 30) + 30; shot.life -= dt;
        if (shot.life <= 0) continue;
        const rock = rocks.find(r => r.r > 0 && circlesHit(shot, r));
        if (rock) {
          shot.life = 0; api.score(points += rock.r > 20 ? 20 : 50);
          if (rock.r > 20) for (const sign of [-1, 1]) fragments.push({ x: rock.x, y: rock.y, r: 14, vx: rock.vx + sign * 70, vy: rock.vy - sign * 55 });
          rock.r = 0;
        }
      }
      rocks = rocks.filter(r => r.r > 0).concat(fragments); shots = shots.filter(s => s.life > 0);
      if (immunity <= 0 && rocks.some(r => circlesHit(ship, r))) return api.finish('¡La nave ha sido alcanzada!');
      if (!rocks.length) nextWave();
    },
    draw(g) {
      rocks.forEach(r => { g.strokeStyle = COLORS[1]; g.lineWidth = 2; g.beginPath(); for (let i = 0; i <= 8; i++) { const a = i * Math.PI / 4; const x = r.x + Math.cos(a) * r.r, y = r.y + Math.sin(a) * r.r; if (!i) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke(); });
      shots.forEach(s => circle(g, s.x, s.y, 3, COLORS[2]));
      g.save(); g.translate(ship.x, ship.y); g.rotate(ship.angle); g.strokeStyle = immunity > 0 ? COLORS[2] : COLORS[0]; g.lineWidth = 2; g.beginPath(); g.moveTo(16, 0); g.lineTo(-11, -10); g.lineTo(-6, 0); g.lineTo(-11, 10); g.closePath(); g.stroke(); g.restore();
      label(g, `Oleada ${wave}${immunity > 0 ? ' · Escudo' : ''}`, 350, 53, 15);
    },
  };
}

function invaders(api) {
  const player = { x: 280, y: 365, w: 36, h: 18 };
  let aliens = [], shots = [], enemyShots = [], direction = 1, cooldown = 0, enemyTimer = 1, points = 0, wave = 0;
  function nextWave() {
    wave++; direction = 1; enemyShots = []; shots = []; enemyTimer = 1;
    aliens = Array.from({ length: 24 }, (_, i) => ({ x: 70 + (i % 8) * 57, y: 60 + Math.floor(i / 8) * 38, w: 28, h: 22, alive: true }));
  }
  nextWave();
  return {
    update(dt) {
      player.x = clamp(player.x + axis(api.held, 'left', 'right') * 320 * dt, 0, W - player.w);
      cooldown -= dt; enemyTimer -= dt;
      if (api.held.has('fire') && cooldown <= 0) { shots.push({ x: player.x + 16, y: player.y, w: 4, h: 12 }); cooldown = .22; }
      const live = aliens.filter(a => a.alive);
      for (const alien of live) alien.x += direction * (28 + wave * 9 + (24 - live.length) * 2) * dt;
      if (live.some(a => a.x < 8 || a.x + a.w > W - 8)) {
        const edge = direction > 0 ? Math.max(...live.map(a => a.x + a.w)) - (W - 8) : Math.min(...live.map(a => a.x)) - 8;
        live.forEach(a => { a.x -= edge; a.y += 16; }); direction *= -1;
      }
      if (enemyTimer <= 0 && live.length) {
        const alien = live[Math.floor(Math.random() * live.length)]; enemyShots.push({ x: alien.x + 12, y: alien.y + 22, w: 5, h: 12 }); enemyTimer = Math.max(.3, 1.1 - wave * .1);
      }
      for (const shot of shots) {
        shot.y -= 420 * dt;
        const alien = live.find(a => a.alive && overlaps(shot, a));
        if (alien) { alien.alive = false; shot.y = -30; api.score(points += 10); }
      }
      for (const shot of enemyShots) { shot.y += (170 + wave * 15) * dt; if (overlaps(shot, player)) return api.finish('¡La defensa ha caído!'); }
      shots = shots.filter(s => s.y > -15); enemyShots = enemyShots.filter(s => s.y < H);
      if (live.some(a => a.alive && a.y + a.h >= player.y)) return api.finish('¡Los invasores han aterrizado!');
      if (aliens.every(a => !a.alive)) nextWave();
    },
    draw(g) {
      rect(g, player.x, player.y, player.w, player.h); rect(g, player.x + 14, player.y - 8, 8, 8);
      aliens.forEach(a => { if (a.alive) { rect(g, a.x, a.y, a.w, a.h, COLORS[1]); rect(g, a.x + 5, a.y + 6, 5, 5, '#0a0014'); rect(g, a.x + 18, a.y + 6, 5, 5, '#0a0014'); } });
      shots.forEach(s => rect(g, s.x, s.y, s.w, s.h, COLORS[2])); enemyShots.forEach(s => rect(g, s.x, s.y, s.w, s.h, COLORS[3]));
      label(g, `Oleada ${wave}`, 470, 53, 16);
    },
  };
}

function entry(id, title, description, instructions, controls, create) {
  return { id, title, category: 'Arcade', description, controls: instructions, mount: (root, ctx) => play(root, ctx, title, `${instructions} P: pausa.`, controls, create) };
}
export const games = [
  entry('snake', 'Serpiente', 'Recoge comida y crece sin chocar.', 'Flechas o WASD para girar. Cada comida vale un punto.', [...leftRight, ...upDown], snake),
  entry('pong', 'Duelo de palas', 'Supera a la pala rival y conserva tus tres vidas.', '↑/↓ o W/S para mover tu pala. Marca por la derecha.', upDown, pong),
  entry('breakout', 'Rompebloques', 'Despeja los cuarenta bloques con tres pelotas.', '←/→ o A/D para mover la pala. Cada bloque vale 10 puntos.', leftRight, breakout),
  entry('dodge', 'Esquiva', 'Sobrevive a una lluvia de bloques cada vez más rápida.', '←/→ o A/D para esquivar. Sumas 10 puntos por segundo.', leftRight, dodge),
  entry('flappy', 'Aleteo', 'Encuentra el hueco entre las columnas.', 'Espacio o Aletear para subir. Cada columna superada vale un punto.', [action('flap', 'Aletear')], flappy),
  entry('runner', 'Salto urbano', 'Salta obstáculos mientras aumenta la velocidad.', 'Espacio o Saltar para saltar desde el suelo. Cada obstáculo vale 10 puntos.', [action('jump', 'Saltar')], runner),
  entry('asteroids', 'Campo de asteroides', 'Gira, acelera y divide las rocas del espacio.', '←/→ o A/D para girar; ↑ o W para acelerar; Espacio para disparar. Escudo al empezar cada oleada.', [...leftRight, { id: 'thrust', label: '↑ Acelerar', keys: ['ArrowUp', 'KeyW'] }, action('fire', 'Disparar')], asteroids),
  entry('invaders', 'Invasores', 'Defiende el suelo de oleadas de visitantes.', '←/→ o A/D para moverte; mantén Espacio o Disparar para atacar.', [...leftRight, action('fire', 'Disparar')], invaders),
];
