function fireBomb(r, c) {
  const opI  = oppI();
  const cell = S.players[opI].grid[r][c];
  if (cell.hit) return;
  cell.hit = true;

  if (cell.shipId) {
    const ship     = S.players[opI].ships.find(s => s.id === cell.shipId);
    const justSunk = ship && ship.cells.every(([rr, cc]) => S.players[opI].grid[rr][cc].hit);
    if (justSunk) ship.sunk = true;

    S.hits[S.cur]++;
    S.lastBombAnim = { pi: opI, r, c };
    S.sunkShip     = justSunk ? { pi: opI, id: ship.id } : null;

    const animDur = justSunk ? 750 : 500;

    if (checkWin(S.cur)) {
      S.winner = S.cur;
      render();
      setTimeout(() => {
        S.lastBombAnim = null;
        S.sunkShip     = null;
        S.phase        = 'game_over';
        render();
      }, animDur);
    } else {
      drawQ();
      if (justSunk) S.sunkNote = ship.name; // set AFTER drawQ (which clears it)
      S.battleSub = 'trivia';
      render();
      setTimeout(() => {
        S.lastBombAnim = null;
        S.sunkShip     = null;
        render();
      }, animDur);
    }
  } else {
    S.lastBombAnim = { pi: opI, r, c };
    S.sunkShip     = null;
    S.battleSub    = 'miss';
    render();

    // Clear animation after it finishes; keep MISS banner visible
    setTimeout(() => {
      S.lastBombAnim = null;
      render();
    }, 450);

    // Switch turn after 3-second delay
    setTimeout(() => {
      S.cur   = oppI();
      S.phase = 'pass_device';
      render();
    }, 3000);
  }
}
