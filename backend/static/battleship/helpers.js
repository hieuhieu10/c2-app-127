function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function drawQ() {
  if (S.qIdx >= S.questions.length) {
    S.questions = shuffle(S.questions);
    S.qIdx = 0;
  }
  const q  = S.questions[S.qIdx++];
  S.q      = q;
  S.opts   = shuffle([q.correct_answer, ...q.distractors]);
  S.result = null;
  S.sunkNote = null; // fireBomb sets this AFTER drawQ if a ship just sank
}

function cur()  { return S.players[S.cur]; }
function opp()  { return S.players[S.cur === 0 ? 1 : 0]; }
function oppI() { return S.cur === 0 ? 1 : 0; }

function shipCells(r, c, len, orient) {
  return Array.from({ length: len }, (_, i) =>
    orient === 'H' ? [r, c + i] : [r + i, c]);
}

function validPlacement(pi, cells) {
  const grid = S.players[pi].grid;
  for (const [r, c] of cells) {
    if (r < 0 || r >= G || c < 0 || c >= G) return false;
    if (grid[r][c].shipId) return false;
  }
  return true;
}

function placeShip(pi, r, c) {
  const p   = S.players[pi];
  const def = SHIP_DEFS[S.selShip];
  if (!def || p.ships.find(s => s.id === def.id)) return;
  const cells = shipCells(r, c, def.length, S.orient);
  if (!validPlacement(pi, cells)) return;
  cells.forEach(([rr, cc]) => { p.grid[rr][cc].shipId = def.id; });
  p.ships.push({ id: def.id, name: def.name, length: def.length, cells, sunk: false });
  const placed = new Set(p.ships.map(s => s.id));
  const next   = SHIP_DEFS.findIndex((s, i) => i > S.selShip && !placed.has(s.id));
  if (next >= 0) S.selShip = next;
  S.hvr = [];
}

function checkWin(atkI) {
  return S.players[atkI === 0 ? 1 : 0].ships.every(s => s.sunk);
}
