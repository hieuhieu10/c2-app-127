import type { PlayerMood } from './engine'

const BASE_PATH = '/assets/treasure-hunt'

export const treasureHuntAssets = {
  characters: {
    'player-1': {
      idle: `${BASE_PATH}/characters/player-1-idle.png`,
      run: `${BASE_PATH}/characters/player-1-run.png`,
      celebrate: `${BASE_PATH}/characters/player-1-win.png`,
      sad: `${BASE_PATH}/characters/player-1-lose.png`,
    },
    'player-2': {
      idle: `${BASE_PATH}/characters/player-2-idle.png`,
      run: `${BASE_PATH}/characters/player-2-run.png`,
      celebrate: `${BASE_PATH}/characters/player-2-win.png`,
      sad: `${BASE_PATH}/characters/player-2-lose.png`,
    },
    'player-3': {
      idle: `${BASE_PATH}/characters/player-3-idle.png`,
      run: `${BASE_PATH}/characters/player-3-run.png`,
      celebrate: `${BASE_PATH}/characters/player-3-win.png`,
      sad: `${BASE_PATH}/characters/player-3-lose.png`,
    },
  },
  map: {
    background: `${BASE_PATH}/map/background.png`,
    pathOverlay: `${BASE_PATH}/map/path-overlay.png`,
  },
  objects: {
    caveClosed: `${BASE_PATH}/objects/cave-closed.png`,
    caveOpen: `${BASE_PATH}/objects/cave-open.png`,
    treasureChest: `${BASE_PATH}/objects/treasure-chest.png`,
  },
  effects: {
    correctSparkle: `${BASE_PATH}/effects/correct-sparkle.png`,
    wrongShake: `${BASE_PATH}/effects/wrong-shake.png`,
  },
}

export function getCharacterAsset(playerId: string, mood: PlayerMood): string {
  const playerAssets = treasureHuntAssets.characters[playerId as keyof typeof treasureHuntAssets.characters]
  return playerAssets?.[mood] ?? playerAssets?.idle ?? ''
}
