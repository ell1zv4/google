import test from 'node:test';
import assert from 'node:assert/strict';
import { games, lineWinner, reversiFlips, reversiMoves, reversiTurn, merge2048, move2048, canMove2048, fifteenCanMove, fifteenSolvable, shuffleFifteen, sudokuPuzzle, sudokuSolution, sudokuConflicts, sudokuComplete, mineNeighbors, createMines } from '../games/boards.mjs';

test('eight uniquely identified playable games', () => {
  assert.equal(games.length, 8); assert.equal(new Set(games.map(g => g.id)).size, 8);
  for (const game of games) assert.equal(typeof game.mount, 'function');
});
test('three and four in a row detect axes without wrapping rows', () => {
  assert.equal(lineWinner(['X','','','','X','','','','X'],3,3,3),'X');
  assert.equal(lineWinner(['X','O','X','X','O','O','O','X','X'],3,3,3),null);
  const b = Array(42).fill(''); [35,29,23,17].forEach(i => { b[i] = 'O'; });
  assert.equal(lineWinner(b,6,7,4),'O');
  b.fill(''); [5,6,7,8].forEach(i => { b[i] = 'X'; }); assert.equal(lineWinner(b,6,7,4),null);
  b.fill(''); [1,8,15,22].forEach(i => { b[i] = 'X'; }); assert.equal(lineWinner(b,6,7,4),'X');
});
test('reversi legal moves, multiple flips, pass and game end', () => {
  const b = Array(64).fill(0); b[27] = b[36] = -1; b[28] = b[35] = 1;
  assert.deepEqual(reversiMoves(b,1),[19,26,37,44]); assert.deepEqual(reversiFlips(b,19,1),[27]);
  assert.deepEqual(reversiFlips(b,27,1),[]);
  const ray = Array(64).fill(0); ray[0] = 1; ray[1] = ray[2] = -1;
  assert.deepEqual(reversiFlips(ray,3,1),[2,1]);
  assert.deepEqual(reversiTurn(ray,1),{ player:1, passed:true, ended:false });
  assert.equal(reversiTurn(Array(64).fill(1),1).ended,true);
  assert.equal(reversiTurn(Array(64).fill(0),1).ended,true);
  assert.deepEqual(reversiTurn(b,1),{ player:-1, passed:false, ended:false });
});
test('2048 merges once per tile, scores pairs and handles all directions', () => {
  assert.deepEqual(merge2048([2,2,2,2]),{line:[4,4,0,0],points:8});
  assert.deepEqual(merge2048([2,2,4,0]),{line:[4,4,0,0],points:4});
  assert.deepEqual(merge2048([0,2,0,2]),{line:[4,0,0,0],points:4});
  const b = Array(16).fill(0); b[0] = b[4] = 2;
  assert.equal(move2048(b,'up').board[0],4); assert.equal(move2048(b,'down').board[12],4);
  assert.equal(move2048(b,'right').board[3],2); assert.equal(move2048(b,'left').changed,false);
  assert.equal(b[0],2);
  const stuck = [2,4,2,4,4,2,4,2,2,4,2,4,4,2,4,2]; assert.equal(canMove2048(stuck),false);
  stuck[0] = 4; assert.equal(canMove2048(stuck),true);
});
test('15 puzzle shuffles only into solvable, nontrivial permutations', () => {
  const solved = Array.from({length:16},(_,i)=>(i+1)%16);
  assert.equal(fifteenSolvable(solved),true); assert.equal(fifteenCanMove(solved,14),true); assert.equal(fifteenCanMove(solved,11),true); assert.equal(fifteenCanMove(solved,0),false);
  const impossible = solved.slice(); [impossible[0],impossible[1]] = [impossible[1],impossible[0]]; assert.equal(fifteenSolvable(impossible),false);
  for (let i = 0; i < 30; i++) { const b = shuffleFifteen(); assert.equal(fifteenSolvable(b),true); assert.notDeepEqual(b,solved); assert.deepEqual(b.slice().sort((a,b)=>a-b),Array.from({length:16},(_,i)=>i)); }
});
test('sudoku puzzle agrees with a complete valid solution and checks all unit types', () => {
  assert.equal(sudokuComplete(sudokuSolution),true); assert.equal(sudokuComplete(sudokuPuzzle),false);
  assert.ok(sudokuPuzzle.filter(v=>!v).length > 40);
  sudokuPuzzle.forEach((v,i)=>{ if (v) assert.equal(v,sudokuSolution[i]); assert.equal(sudokuConflicts(sudokuPuzzle,i),false); });
  for (const [first,second] of [[0,8],[0,72],[0,10]]) { const b = Array(81).fill(0); b[first] = b[second] = 7; assert.equal(sudokuConflicts(b,first),true); }
  const b = Array(81).fill(0); b[0] = b[40] = 7; assert.equal(sudokuConflicts(b,0),false);
  assert.equal(sudokuComplete(Array(81).fill(1)),false);
});
test('mines preserve first-click neighborhood safety and exact mine count', () => {
  assert.deepEqual(mineNeighbors(0),[1,8,9]);
  for (const first of [0,7,27,63]) for (let run = 0; run < 5; run++) {
    const mines = createMines(first); assert.equal(mines.size,10);
    for (const i of [first,...mineNeighbors(first)]) assert.equal(mines.has(i),false);
  }
});
