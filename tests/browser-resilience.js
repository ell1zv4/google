async (page) => {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const context = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const touch = await context.newPage();
  const errors = [];
  touch.on('pageerror', (error) => errors.push(error.message));
  await context.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage disabled for test', 'SecurityError'); } });
  });
  try {
    await touch.goto('http://127.0.0.1:8767/index.html');
    await touch.keyboard.type('risb-local');
    await touch.waitForURL('**/search.html');
    await touch.locator('#catalog .card').first().waitFor();
    check(await touch.locator('#storage-note').isVisible(), 'Storage failure explained');
    await touch.locator('#favorite-snake').tap();
    check(await touch.locator('#favorite-snake').getAttribute('aria-pressed') === 'true', 'In-memory favorite works');
    await touch.locator('[data-id="snake"] .card-open').tap();
    await touch.locator('#game-root').getByRole('button', { name: 'Empezar', exact: true }).tap();
    await touch.locator('#game-root').getByRole('button', { name: /Abajo/ }).tap();
    await touch.locator('#game-root').getByRole('button', { name: 'Pausar', exact: true }).tap();
    check((await touch.locator('.game-status').innerText()).includes('pausa'), 'Touch controls and pause');
    await touch.locator('#close-player').tap();
    await touch.waitForFunction(() => document.getElementById('game-root').childElementCount === 0);
    await touch.locator('[data-id="wordle"] .card-open').tap();
    await touch.locator('#game-root input').fill('BARCO');
    await touch.locator('#game-root input').press('Enter');
    check((await touch.locator('.game-status').innerText()).length > 0, 'Word game accepts a guess');
    await touch.locator('#restart-game').tap();
    await touch.locator('#close-player').tap();
    await touch.waitForFunction(() => document.getElementById('game-root').childElementCount === 0);
    await touch.locator('[data-id="reaction"] .card-open').tap();
    await touch.locator('#game-root .game-board button').tap();
    await touch.locator('#game-root .game-board button').tap();
    check((await touch.locator('.game-status').innerText()).toLowerCase().includes('pronto'), 'Reaction rejects early tap');
    await touch.locator('#close-player').tap();
    await touch.waitForFunction(() => document.getElementById('game-root').childElementCount === 0);
    await touch.setViewportSize({ width: 320, height: 740 });
    check(await touch.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Small screen does not overflow');
    check(errors.length === 0, `Errors: ${errors.join('; ')}`);
    return { deniedStorage: 'passed', touchControls: 'passed', wordGuess: 'passed', reactionEarlyTap: 'passed', narrowViewport: 'passed', errors };
  } finally { await context.close(); }
}
