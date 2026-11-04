import { externalGames } from './catalog.mjs';
import { directory } from './directory.mjs';
import { games as arcade } from './games/arcade.mjs';
import { games as boards } from './games/boards.mjs';
import { games as challenges } from './games/challenges.mjs';
import { selectItems, readPreferences, remember, safeExternalUrl } from './portal-state.mjs';

const localGames = [...arcade, ...boards, ...challenges].map((game) => ({ ...game, kind: 'local' }));
const items = [...localGames, ...externalGames, ...directory];
const byId = new Map(items.map((item) => [item.id, item]));
const $ = (id) => document.getElementById(id);
const sections = {
  home: ['Descubre RISB', 'Juegos, música y sitios para tener a mano.'],
  games: ['Todos los juegos', 'Clásicos, arcade y el catálogo de siempre. Elige tu próxima partida.'],
  local: ['Hechos para jugar aquí', '24 juegos integrados. Sin cuentas ni páginas de juegos externas.'],
  favorites: ['Tus favoritos', 'Los juegos y sitios que guardas en este navegador.'],
  recent: ['Vuelve a jugar', 'Tus últimas visitas, empezando por la más reciente.'],
  football: ['Todo el fútbol', 'Emisiones oficiales, vídeos, resultados y tus equipos.'],
  clothing: ['Encuentra tu estilo', 'Accesos directos a las tiendas y sus colecciones.'],
  music: ['Dale al play', 'Música, sesiones y radios para descubrir.'],
  video: ['Algo para ver', 'Creadores, directos, documentales y televisión.'],
  tools: ['Herramientas a mano', 'Dibuja, diseña, traduce o resuelve una gráfica.'],
  learn: ['Sigue descubriendo', 'Idiomas, programación y recursos para aprender.'],
};
let storage;
try { storage = window.localStorage; } catch { /* Preferences stay in memory when storage is unavailable. */ }
const prefs = readPreferences(storage, new Set(byId.keys()));
const state = { section: sections[location.hash.slice(1)] ? location.hash.slice(1) : document.body.dataset.section || 'home', query: '', category: 'Todas', sort: 'recommended' };
let visible = [];
let current = null;
let dispose = () => {};
let opener = null;
let loadingTimer;
let fullscreenTransition = false;

function save() {
  try { storage.setItem('risb.preferences', JSON.stringify(prefs)); }
  catch { $('storage-note').hidden = false; }
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function artwork(item) {
  const art = element('div', `card-art art-${item.kind === 'local' ? item.category.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : item.section || 'external'}`);
  art.setAttribute('aria-hidden', 'true');
  if (item.image) {
    const image = document.createElement('img');
    image.src = item.image;
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => { image.remove(); art.append(element('span', 'art-title', item.title.slice(0, 2).toUpperCase())); }, { once: true });
    art.append(image);
  } else if (item.kind === 'local') {
    const names = { snake: 'SNAKE', pong: 'PONG', breakout: 'BREAK\nOUT', dodge: 'DODGE', flappy: 'FLAP', runner: 'RUN!', asteroids: 'ORBIT', invaders: 'INVADERS', tictactoe: 'X / O', connect4: '4 EN\nLÍNEA', reversi: 'REVERSI', memory: 'PARES', minesweeper: 'MINAS', '2048': '2048', fifteen: '01 02\n03 04', sudoku: '1 2 3\n4 5 6', hangman: 'A _ _', wordle: 'LETRAS', simon: 'SIMON', reaction: '¡YA!', math: '2 + 2', typing: 'Aa_', aim: 'APUNTA', lightsout: 'LUCES' };
    art.append(element('span', 'pixel-pattern'));
    art.append(element('span', 'art-title', names[item.id] || item.title));
  } else {
    art.append(element('span', 'site-monogram', item.title.slice(0, 2).toUpperCase()));
    art.append(element('span', 'site-domain', new URL(item.url).hostname.replace(/^www\./, '')));
  }
  return art;
}

function card(item) {
  const article = element('article', 'card');
  article.dataset.id = item.id;
  const action = element(item.kind === 'link' ? 'a' : 'button', 'card-open');
  if (item.kind === 'link') {
    action.href = safeExternalUrl(item.url);
    action.target = '_blank';
    action.rel = 'noopener noreferrer';
    action.setAttribute('aria-label', `${item.title}, abrir en otra pestaña`);
    action.addEventListener('click', () => recordVisit(item));
  } else {
    action.type = 'button';
    action.setAttribute('aria-label', `Jugar a ${item.title}`);
    action.addEventListener('click', () => openGame(item, action));
  }
  const copy = element('div', 'card-copy');
  copy.append(element('span', 'card-category', `${item.category} · ${item.kind === 'local' ? 'En RISB' : 'Web externa'}`));
  copy.append(element('h3', '', item.title));
  copy.append(element('p', '', item.description || new URL(item.url).hostname.replace(/^www\./, '')));
  action.append(artwork(item), copy);
  const favorite = element('button', 'favorite', prefs.favorites.includes(item.id) ? 'Guardado' : 'Guardar');
  favorite.id = `favorite-${item.id}`;
  favorite.type = 'button';
  favorite.setAttribute('aria-label', `Favorito: ${item.title}`);
  favorite.setAttribute('aria-pressed', String(prefs.favorites.includes(item.id)));
  favorite.addEventListener('click', () => {
    prefs.favorites = prefs.favorites.includes(item.id) ? prefs.favorites.filter((id) => id !== item.id) : [...prefs.favorites, item.id];
    save();
    render();
    ($(`favorite-${item.id}`) || $('results-title')).focus();
  });
  article.append(action, favorite);
  return article;
}

function render() {
  const [title, subtitle] = sections[state.section];
  $('page-title').textContent = title;
  $('page-description').textContent = subtitle;
  $('hero').hidden = state.section !== 'home' || Boolean(state.query);
  $('external-note').hidden = !['football', 'clothing', 'music', 'video', 'tools', 'learn'].includes(state.section);
  $('external-note').textContent = state.section === 'football'
    ? 'Enlaces a los proveedores oficiales. Las emisiones dependen de los derechos, el país y la suscripción de cada servicio.'
    : 'Estos sitios se abren en otra pestaña. Sus cuentas, condiciones y disponibilidad dependen de cada proveedor.';
  document.querySelectorAll('[data-section-link]').forEach((button) => {
    const active = button.dataset.sectionLink === state.section;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  $('favorites-count').textContent = String(prefs.favorites.length);
  const sectionItems = selectItems(items, { ...state, query: '', category: 'Todas', ...prefs });
  const categories = ['Todas', ...new Set(sectionItems.map((item) => item.category))];
  if (!categories.includes(state.category)) state.category = 'Todas';
  $('category').replaceChildren(...categories.map((category) => new Option(category, category, false, category === state.category)));
  visible = selectItems(items, { ...state, ...prefs });
  $('results-title').textContent = state.query ? 'Resultados de búsqueda' : state.section === 'home' ? 'Explora el catálogo' : 'Elige algo que te guste';
  $('result-count').textContent = `${visible.length} ${visible.length === 1 ? 'resultado' : 'resultados'}`;
  $('catalog').replaceChildren(...visible.map(card));
  $('empty-state').hidden = visible.length !== 0;
  $('empty-title').textContent = state.section === 'favorites' && !prefs.favorites.length ? 'Tu colección empieza aquí' : state.section === 'recent' && !prefs.recent.length ? 'Todavía no has abierto nada' : 'No hay coincidencias';
  $('empty-copy').textContent = ['favorites', 'recent'].includes(state.section) && !state.query ? 'Explora los juegos y guarda los que quieras tener a mano.' : 'Prueba otro nombre o quita los filtros.';
  $('random-game').disabled = !visible.some((item) => item.kind !== 'link');
  $('clear-history').hidden = state.section !== 'recent' || !prefs.recent.length;
}

function navigate(section) {
  if (!sections[section]) return;
  state.section = section;
  state.category = 'Todas';
  state.query = '';
  $('search').value = '';
  history.replaceState(null, '', `#${section}`);
  render();
}

function recordVisit(item) {
  prefs.recent = remember(prefs.recent, item.id);
  save();
}

function showBest() {
  $('best-score').textContent = current && prefs.scores[current.id] !== undefined ? `Tu récord: ${prefs.scores[current.id]}` : '';
}

function startGame() {
  clearTimeout(loadingTimer);
  dispose();
  dispose = () => {};
  $('game-root').replaceChildren();
  if (!current) return;
  $('player-status').textContent = '';
  if (current.kind === 'local') {
    try {
      const gameId = current.id;
      dispose = current.mount($('game-root'), {
        recordScore(score) {
          if (typeof score !== 'number' || !Number.isFinite(score) || score < 0) return;
          if (score > (prefs.scores[gameId] ?? -1)) { prefs.scores[gameId] = Math.round(score); save(); showBest(); }
        },
      }) || (() => {});
    } catch (error) {
      $('game-root').replaceChildren();
      $('player-status').textContent = 'No se ha podido iniciar el juego. Pulsa Reiniciar para volver a intentarlo.';
      console.error('Game failed to start', error);
    }
  } else {
    const url = safeExternalUrl(current.url);
    if (!url) { $('player-status').textContent = 'La dirección de este juego no es válida.'; return; }
    const frame = document.createElement('iframe');
    frame.title = current.title;
    frame.referrerPolicy = 'no-referrer';
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-popups');
    frame.allow = 'fullscreen; gamepad; autoplay';
    frame.allowFullscreen = true;
    frame.src = url;
    $('player-status').textContent = 'Abriendo la web del juego…';
    const availabilityMessage = 'Si el juego no aparece, prueba Abrir web. El proveedor o la red pueden impedir cargarlo aquí.';
    const loaded = () => { clearTimeout(loadingTimer); $('player-status').textContent = availabilityMessage; };
    frame.addEventListener('load', loaded, { once: true });
    loadingTimer = setTimeout(() => { $('player-status').textContent = availabilityMessage; }, 10000);
    $('game-root').append(frame);
    dispose = () => { clearTimeout(loadingTimer); frame.removeEventListener('load', loaded); frame.remove(); };
  }
}

function openGame(item, trigger) {
  if (current) return;
  current = item;
  opener = trigger;
  $('player-title').textContent = item.title;
  $('player-category').textContent = `${item.category} · ${item.kind === 'local' ? 'En RISB' : 'Web externa'}`;
  $('open-external').hidden = item.kind === 'local';
  if (item.url) $('open-external').href = safeExternalUrl(item.url);
  $('player').showModal();
  document.body.classList.add('playing');
  recordVisit(item);
  showBest();
  startGame();
  if (!$('game-root').contains(document.activeElement)) $('close-player').focus();
}

$('player').addEventListener('close', () => {
  clearTimeout(loadingTimer);
  dispose();
  dispose = () => {};
  $('game-root').replaceChildren();
  current = null;
  document.body.classList.remove('playing');
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  const restoreId = opener?.closest('[data-id]')?.dataset.id;
  render();
  const restore = restoreId ? document.querySelector(`[data-id="${CSS.escape(restoreId)}"] .card-open`) : opener;
  if (restore?.isConnected) restore.focus(); else $('results-title').focus();
});
$('close-player').addEventListener('click', () => $('player').close());
$('restart-game').addEventListener('click', startGame);
$('fullscreen').addEventListener('click', async () => {
  if (fullscreenTransition) return;
  fullscreenTransition = true;
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch { $('player-status').textContent = 'La pantalla completa no está disponible. Puedes seguir jugando en esta ventana.'; }
  finally { fullscreenTransition = false; }
});
document.addEventListener('fullscreenchange', () => { $('fullscreen').textContent = document.fullscreenElement ? 'Salir de pantalla completa' : 'Pantalla completa'; });
document.querySelectorAll('[data-section-link]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.sectionLink)));
$('search').addEventListener('input', (event) => { state.query = event.target.value; render(); });
$('clear-search').addEventListener('click', () => { state.query = ''; $('search').value = ''; render(); $('search').focus(); });
$('category').addEventListener('change', (event) => { state.category = event.target.value; render(); });
$('sort').addEventListener('change', (event) => { state.sort = event.target.value; render(); });
$('reset-filters').addEventListener('click', () => { navigate(['favorites', 'recent'].includes(state.section) ? 'games' : state.section); });
$('random-game').addEventListener('click', (event) => {
  const candidates = visible.filter((item) => item.kind !== 'link');
  if (candidates.length) openGame(candidates[Math.floor(Math.random() * candidates.length)], event.currentTarget);
});
$('featured-play').addEventListener('click', (event) => openGame(byId.get('snake'), event.currentTarget));
$('clear-history').addEventListener('click', () => { prefs.recent = []; save(); render(); $('results-title').focus(); });
window.addEventListener('hashchange', () => { if (sections[location.hash.slice(1)]) navigate(location.hash.slice(1)); });
$('local-total').textContent = String(localGames.length);
$('game-total').textContent = String(localGames.length + externalGames.length);
$('site-total').textContent = String(directory.length);
if (!storage) $('storage-note').hidden = false;
render();
