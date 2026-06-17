function render() {
  const app = document.getElementById('app');
  switch (S.phase) {
    case 'char_select':  app.innerHTML = rCharSelect();  break;
    case 'placement_p1': app.innerHTML = rPlacement(0);  break;
    case 'pl_switch':    app.innerHTML = rSwitch();      break;
    case 'placement_p2': app.innerHTML = rPlacement(1);  break;
    case 'game_start':   app.innerHTML = rGameStart();   break;
    case 'battle':       app.innerHTML = rBattle();      break;
    case 'pass_device':  app.innerHTML = rPassDevice();  break;
    case 'game_over':    app.innerHTML = rGameOver();    break;
  }
}

/* ── Character select ── */

function rCharSelect() {
  const both = S.players[0].av && S.players[1].av;
  return `<div class="screen">
    <div class="px-title">&#9875; TRIVIA<br>BATTLESHIP</div>
    <p class="vt-text blink">— SELECT YOUR CHARACTER —</p>
    <div class="cs-row">${rAvatarPanel(0)}${rAvatarPanel(1)}</div>
    <button class="btn" data-a="start-pl" ${both ? '' : 'disabled'}>
      ${both ? '&gt; START GAME' : '— SELECT BOTH —'}
    </button>
  </div>`;
}

function rAvatarPanel(pi) {
  const p = S.players[pi];
  return `<div class="pcard">
    <div class="px-label">&#9658; ${p.name}</div>
    <div class="av-big">${p.av ? p.av.em : '?'}</div>
    <div class="av-grid">
      ${AVATARS.map((av, i) => `<button class="av-btn ${p.av && p.av.em === av.em ? 'chosen' : ''}"
        data-a="sel-av" data-pi="${pi}" data-ai="${i}">
        <span class="em">${av.em}</span><span>${av.label}</span>
      </button>`).join('')}
    </div>
  </div>`;
}

/* ── Ship placement ── */

function rPlacement(pi) {
  const p       = S.players[pi];
  const placed  = new Set(p.ships.map(s => s.id));
  const allDone = placed.size === SHIP_DEFS.length;
  return `<div class="screen">
    <div class="px-head">${p.av ? p.av.em : ''} ${p.name} — DEPLOY FLEET</div>
    <p class="vt-text">Place your ships. Don't let the enemy see!</p>
    <div class="pl-row">
      <div class="inv">
        <div class="px-label">YOUR FLEET</div>
        <div style="height:4px;background:repeating-linear-gradient(90deg,var(--bd) 0,var(--bd) 4px,transparent 4px,transparent 8px);opacity:.5;margin:4px 0"></div>
        ${SHIP_DEFS.map((s, i) => {
          const done   = placed.has(s.id);
          const sel    = !done && S.selShip === i;
          const dotCls = sel ? 'sd on' : 'sd';
          return `<div class="ship-row ${sel ? 'sel' : ''} ${done ? 'done' : ''}"
            data-a="${done ? '' : 'sel-ship'}" data-si="${i}">
            <div class="sdots">${Array.from({ length: s.length }, () => `<div class="${dotCls}"></div>`).join('')}</div>
            <span>${s.name} (${s.length})</span>
            ${done ? '<span style="margin-left:auto;color:#00CC00">OK</span>' : ''}
          </div>`;
        }).join('')}
        <div style="margin-top:.5rem">
          <div class="px-label" style="margin-bottom:.35rem">DIRECTION:</div>
          <div class="ort">
            <button class="ob ${S.orient === 'H' ? 'on' : ''}" data-a="set-or" data-or="H">HORIZ</button>
            <button class="ob ${S.orient === 'V' ? 'on' : ''}" data-a="set-or" data-or="V">VERT</button>
          </div>
        </div>
        ${allDone ? `<button class="btn ok" data-a="done-pl" data-pi="${pi}" style="margin-top:.65rem">&gt; DONE [OK]</button>` : ''}
      </div>
      <div class="gw">
        <div class="glbl">${p.name} GRID</div>
        <div class="grid" id="pl-grid">${rCells(pi, 'pl')}</div>
      </div>
    </div>
  </div>`;
}

/* ── Battle screen ── */

function rBattle() {
  const p           = cur();
  const op          = opp();
  const opI         = oppI();
  const isTargeting = S.battleSub === 'targeting';
  const free        = S.players[opI].grid.flat().filter(c => !c.hit).length;
  return `<div class="screen">
    <div class="tbar">
      <span class="em">${p.av ? p.av.em : ''}</span>
      <span>${p.name}'S TURN</span>
      <span class="ml">HITS: ${S.hits[S.cur]}</span>
    </div>
    <div class="gw">
      <div class="glbl">${op.name} — ENEMY GRID &nbsp;[${free} CELLS LEFT]</div>
      <div class="grid${isTargeting ? ' targeting' : ''}">${rCells(opI, 'atk')}</div>
    </div>
    ${rBattleAction()}
  </div>`;
}

function rBattleAction() {
  const sunkBanner = S.sunkNote
    ? `<div class="sunk-note">-- ${S.sunkNote} DESTROYED! --</div>`
    : '';

  if (S.battleSub === 'miss') {
    return `<div class="tbox">
      <div class="rbanner bad">[ MISS! ]</div>
      <p class="vt-text">Passing turn in 3 seconds...</p>
    </div>`;
  }

  if (S.battleSub === 'targeting') {
    return `${sunkBanner}
      <div class="target-hint">&gt;&gt; SELECT TARGET ON ENEMY GRID &lt;&lt;</div>`;
  }

  if (S.battleSub === 'trivia') {
    const q = S.q;
    return `<div class="tbox">
      ${sunkBanner}
      <div class="tq">${q.question}</div>
      <div class="px-divider"></div>
      <div class="opts">
        ${S.opts.map((o, i) => `<button class="opt" data-a="ans" data-opt="${encodeURIComponent(o)}">
          <strong>[${['A', 'B', 'C', 'D'][i]}]</strong> ${o}</button>`).join('')}
      </div>
      <div class="hint">HINT: ${q.hint}</div>
    </div>`;
  }

  if (S.battleSub === 'result') {
    const q  = S.q;
    const ok = S.result === 'correct';
    return `<div class="tbox">
      ${sunkBanner}
      <div class="rbanner ${ok ? 'ok' : 'bad'}">${ok ? '[ CORRECT! ]' : '[ WRONG! ]'}</div>
      <div class="opts">
        ${S.opts.map(o => {
          const isRight = o === q.correct_answer;
          return `<button class="opt ${isRight ? 'rev' : ''}" disabled>${o}</button>`;
        }).join('')}
      </div>
      <div class="expl">INFO: ${q.explanation}</div>
      ${ok
        ? `<button class="btn ok" data-a="bomb">&gt; FIRE TORPEDO!</button>`
        : `<button class="btn sec" data-a="end-turn">&gt; END TURN</button>`}
    </div>`;
  }

  return '';
}

/* ── Grid cell rendering ── */

function rCells(pi, mode) {
  let html = '';
  const grid = S.players[pi].grid;
  const lba  = S.lastBombAnim;
  const sk   = S.sunkShip;

  for (let r = 0; r < G; r++) {
    for (let c = 0; c < G; c++) {
      const cell        = grid[r][c];
      const isAnimCell  = lba && lba.pi === pi && lba.r === r && lba.c === c;
      const isSunkCell  = sk  && sk.pi  === pi && cell.shipId === sk.id;
      let cls = 'cell';

      if (mode === 'pl') {
        if (cell.shipId) {
          cls += ' shp nc';
        } else {
          const isHvr = S.hvr.some(([hr, hc]) => hr === r && hc === c);
          if (isHvr) cls += S.hvrOk ? ' prv' : ' bad';
        }
        html += `<div class="${cls}" data-a="place" data-r="${r}" data-c="${c}" data-pi="${pi}"></div>`;

      } else if (mode === 'atk') {
        if (cell.hit) {
          if (cell.shipId) {
            const ship = S.players[pi].ships.find(s => s.id === cell.shipId);
            if (isSunkCell)      cls += ' anim-sunk nc';
            else if (isAnimCell) cls += ' anim-hit nc';
            else if (ship?.sunk) cls += ' snk nc';
            else                 cls += ' hit nc';
          } else {
            if (isAnimCell) cls += ' anim-miss nc';
            else            cls += ' mss nc';
          }
          html += `<div class="${cls}"></div>`;
        } else if (S.battleSub === 'targeting') {
          html += `<div class="${cls}" data-a="fire" data-r="${r}" data-c="${c}"></div>`;
        } else {
          html += `<div class="${cls} nc"></div>`;
        }
      }
    }
  }
  return html;
}

/* ── Splash / switch screens ── */

function rSwitch() {
  return `<div class="splash screen">
    <div class="spav">&#128584;</div>
    <div class="px-title blink">${S.sw.msg}</div>
    <p class="vt-text">${S.sw.sub}</p>
    <button class="btn" data-a="sw-ok" data-next="${S.sw.next}">&gt; ${S.sw.btn}</button>
  </div>`;
}

function rGameStart() {
  const p = S.players[0];
  return `<div class="splash screen">
    <div class="spav">&#9875;</div>
    <div class="px-title blink">BATTLE START!</div>
    <p class="vt-text">${p.av ? p.av.em : ''} ${p.name} goes first.</p>
    <button class="btn ok" data-a="begin">&gt; PRESS START</button>
  </div>`;
}

function rPassDevice() {
  const p = cur();
  return `<div class="splash screen">
    <div class="spav">${p.av ? p.av.em : '?'}</div>
    <div class="px-title blink">P${p.id} TURN!</div>
    <p class="vt-text">Hand the device to ${p.name}.<br>Enemy must not look!</p>
    <button class="btn" data-a="ready">&gt; PRESS START &#9654;</button>
  </div>`;
}

function rGameOver() {
  const w = S.players[S.winner];
  const l = S.players[S.winner === 0 ? 1 : 0];
  return `<div class="screen">
    <div class="px-title blink">GAME OVER</div>
    <div class="winner-em">${w.av ? w.av.em : '?'}</div>
    <div class="px-head">${w.name}<br>WINS!</div>
    <div class="stat-row">
      <div class="stat-box">
        <div class="v">${S.hits[S.winner]}</div>
        <div class="l">${w.name} — HITS</div>
      </div>
      <div class="stat-box">
        <div class="v">${S.hits[S.winner === 0 ? 1 : 0]}</div>
        <div class="l">${l.name} — HITS</div>
      </div>
    </div>
    <button class="btn" onclick="location.reload()">&gt; PLAY AGAIN [R]</button>
  </div>`;
}
