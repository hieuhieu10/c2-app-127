// Shared mutable state — read/written directly by all other modules.
let S = {};

function makeGrid() {
  return Array.from({ length: G }, () =>
    Array.from({ length: G }, () => ({ shipId: null, hit: false })));
}

function initState() {
  const src =
    window.GAME_CONTENT &&
    Array.isArray(window.GAME_CONTENT.questions) &&
    window.GAME_CONTENT.questions.length >= 9
      ? window.GAME_CONTENT
      : DEMO_CONTENT;

  S = {
    questions:    [...src.questions],
    qIdx:         0,
    players: [
      { id: 1, name: 'PLAYER 1', av: null, grid: makeGrid(), ships: [] },
      { id: 2, name: 'PLAYER 2', av: null, grid: makeGrid(), ships: [] },
    ],
    cur:          0,
    phase:        'char_select',
    battleSub:    'trivia',   // 'trivia' | 'result' | 'targeting'
    lastBombAnim: null,       // { pi, r, c }
    sunkShip:     null,       // { pi, id }
    sunkNote:     null,       // ship name shown in the sunk banner
    q:            null,
    opts:         [],
    result:       null,
    winner:       null,
    selShip:      0,
    orient:       'H',
    hvr:          [],
    hvrOk:        true,
    hits:         [0, 0],
    sw:           null,
  };
}
