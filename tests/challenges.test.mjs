import test from 'node:test';
import assert from 'node:assert/strict';
import { games, wordleFeedback, toggleLights, scrambleLights, typingMetrics, arithmeticProblem } from '../games/challenges.mjs';

test('Wordle reserves exact letters before assigning repeated misplaced letters', () => {
  assert.deepEqual(wordleFeedback('PAPEL', 'PERRO'), ['correct', 'present', 'absent', 'absent', 'absent']);
  assert.deepEqual(wordleFeedback('PAPEL', 'PPPPP'), ['correct', 'absent', 'correct', 'absent', 'absent']);
  assert.deepEqual(wordleFeedback('TORRE', 'ERROR'), ['present', 'present', 'correct', 'present', 'absent']);
  assert.deepEqual(wordleFeedback('SILLA', 'SILLA'), Array(5).fill('correct'));
});

test('Lights Out toggles only orthogonal neighbors and never wraps rows', () => {
  const board = Array(25).fill(false);
  assert.deepEqual(toggleLights(board, 0).flatMap((value, i) => value ? [i] : []), [0, 1, 5]);
  assert.deepEqual(toggleLights(board, 4).flatMap((value, i) => value ? [i] : []), [3, 4, 9]);
  assert.deepEqual(toggleLights(board, 12).flatMap((value, i) => value ? [i] : []), [7, 11, 12, 13, 17]);
  assert.ok(board.every((value) => !value), 'input board is not mutated');
});

test('Every legal scramble can be solved by replaying its moves', () => {
  for (const moves of [[0], [1, 4, 12, 24], [3, 3, 4, 17, 12, 0, 9, 24]]) {
    const scrambled = scrambleLights(moves);
    const solved = moves.reduce((board, index) => toggleLights(board, index), scrambled);
    assert.ok(solved.every((value) => !value));
  }
});

test('Typing speed uses correct characters and actual elapsed time', () => {
  assert.deepEqual(typingMetrics('hola mundo', 'hola mundo', 30000), { wpm: 4, errors: 0, accuracy: 100 });
  assert.deepEqual(typingMetrics('hola mundo', 'hola xundo!', 60000), { wpm: 2, errors: 2, accuracy: 82 });
  assert.deepEqual(typingMetrics('hola', '', 0), { wpm: 0, errors: 0, accuracy: 100 });
  assert.equal(typingMetrics('abcdefghij', 'abcdefghij', 15000).wpm, 8);
});

test('Arithmetic includes exact integer division and nonnegative subtraction', () => {
  assert.deepEqual(arithmeticProblem('÷', 7, 3), { text: '21 ÷ 3', answer: 7 });
  assert.deepEqual(arithmeticProblem('−', 3, 9), { text: '9 − 3', answer: 6 });
  assert.equal(arithmeticProblem('+', 3, 9).answer, 12);
  assert.equal(arithmeticProblem('×', 3, 9).answer, 27);
  assert.throws(() => arithmeticProblem('÷', 2, 0));
});

test('The eight challenge games expose mount functions and unique IDs', () => {
  assert.deepEqual(games.map(({ id }) => id), ['hangman', 'wordle', 'simon', 'reaction', 'math', 'typing', 'aim', 'lightsout']);
  for (const game of games) assert.equal(typeof game.mount, 'function');
});
