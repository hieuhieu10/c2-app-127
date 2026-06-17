function setupEvents() {
  const app = document.getElementById('app');

  app.addEventListener('click', e => {
    const el = e.target.closest('[data-a]');
    if (!el) return;
    const a = el.dataset.a;

    if (a === 'sel-av') {
      S.players[+el.dataset.pi].av = AVATARS[+el.dataset.ai];
      render();

    } else if (a === 'start-pl') {
      if (!S.players[0].av || !S.players[1].av) return;
      S.selShip = 0; S.orient = 'H'; S.hvr = [];
      S.phase   = 'placement_p1';
      render();

    } else if (a === 'sel-ship') {
      const pi = S.phase === 'placement_p1' ? 0 : 1;
      const si = +el.dataset.si;
      if (!S.players[pi].ships.find(s => s.id === SHIP_DEFS[si].id)) {
        S.selShip = si;
        render();
      }

    } else if (a === 'set-or') {
      S.orient = el.dataset.or;
      S.hvr    = [];
      render();

    } else if (a === 'place') {
      const pi = +el.dataset.pi;
      if (S.players[pi].ships.find(s => s.id === SHIP_DEFS[S.selShip]?.id)) return;
      placeShip(pi, +el.dataset.r, +el.dataset.c);
      render();

    } else if (a === 'done-pl') {
      const pi = +el.dataset.pi;
      if (S.players[pi].ships.length < SHIP_DEFS.length) return;
      if (pi === 0) {
        S.sw = {
          msg:  'PASS TO P2!',
          sub:  'Player 1 — look away from the screen!',
          next: 'placement_p2',
          btn:  "PLAYER 2 — I'M READY",
        };
        S.selShip = 0; S.orient = 'H'; S.hvr = [];
        S.phase   = 'pl_switch';
      } else {
        S.phase = 'game_start';
      }
      render();

    } else if (a === 'sw-ok') {
      S.phase = el.dataset.next;
      S.hvr   = [];
      render();

    } else if (a === 'begin') {
      S.cur       = 0;
      S.phase     = 'battle';
      S.battleSub = 'trivia';
      drawQ();
      render();

    } else if (a === 'ans') {
      const chosen = decodeURIComponent(el.dataset.opt);
      S.result    = chosen === S.q.correct_answer ? 'correct' : 'wrong';
      S.battleSub = 'result';
      render();

    } else if (a === 'bomb') {
      S.battleSub = 'targeting';
      render();

    } else if (a === 'end-turn') {
      S.sunkNote  = null;
      S.cur       = oppI();
      S.phase     = 'pass_device';
      render();

    } else if (a === 'fire') {
      if (S.battleSub !== 'targeting') return;
      const r = +el.dataset.r, c = +el.dataset.c;
      if (S.players[oppI()].grid[r][c].hit) return;
      fireBomb(r, c);

    } else if (a === 'ready') {
      drawQ();
      S.phase     = 'battle';
      S.battleSub = 'trivia';
      render();
    }
  });

  /* Placement hover preview */
  app.addEventListener('mouseover', e => {
    if (S.phase !== 'placement_p1' && S.phase !== 'placement_p2') return;
    const cell = e.target.closest('[data-a="place"]');
    if (!cell) {
      if (S.hvr.length) { S.hvr = []; render(); }
      return;
    }
    const r   = +cell.dataset.r;
    const c   = +cell.dataset.c;
    const pi  = +cell.dataset.pi;
    const def = SHIP_DEFS[S.selShip];
    const placedIds = new Set(S.players[pi].ships.map(s => s.id));
    if (!def || placedIds.has(def.id)) {
      if (S.hvr.length) { S.hvr = []; render(); }
      return;
    }
    const cells = shipCells(r, c, def.length, S.orient);
    const ok    = validPlacement(pi, cells);
    if (JSON.stringify(cells) !== JSON.stringify(S.hvr) || ok !== S.hvrOk) {
      S.hvr   = cells;
      S.hvrOk = ok;
      render();
    }
  });
}
