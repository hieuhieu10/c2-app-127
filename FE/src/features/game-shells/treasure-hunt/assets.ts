import type { PlayerMood } from './engine'

const BASE_PATH = '/assets/treasure-hunt'

export const treasureCharacterChoices = [
  { id: 'choice-01', name: 'Nhà thám hiểm Nhỏ', image: `${BASE_PATH}/characters/choice-01.png` },
  { id: 'choice-02', name: 'Nữ thuyền trưởng Đỏ', image: `${BASE_PATH}/characters/choice-02.png` },
  { id: 'choice-03', name: 'Kiếm sĩ Đen', image: `${BASE_PATH}/characters/choice-03.png` },
  { id: 'choice-04', name: 'Hoa tiêu Vàng', image: `${BASE_PATH}/characters/choice-04.png` },
  { id: 'choice-05', name: 'Cao bồi Rừng', image: `${BASE_PATH}/characters/choice-05.png` },
  { id: 'choice-06', name: 'Cung thủ Lá Xanh', image: `${BASE_PATH}/characters/choice-06.png` },
  { id: 'choice-07', name: 'Đèn thần Sa Mạc', image: `${BASE_PATH}/characters/choice-07.png` },
  { id: 'choice-08', name: 'Pháp sư Nước', image: `${BASE_PATH}/characters/choice-08.png` },
  { id: 'choice-09', name: 'Kỹ sư Tí Hon', image: `${BASE_PATH}/characters/choice-09.png` },
  { id: 'choice-10', name: 'Đầu bếp Nhí', image: `${BASE_PATH}/characters/choice-10.png` },
  { id: 'choice-11', name: 'Cung thủ Cam', image: `${BASE_PATH}/characters/choice-11.png` },
  { id: 'choice-12', name: 'Pháp sư Bản Đồ', image: `${BASE_PATH}/characters/choice-12.png` },
]

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
  const selectedChoice = treasureCharacterChoices.find((choice) => choice.id === playerId)

  return playerAssets?.[mood] ?? playerAssets?.idle ?? selectedChoice?.image ?? ''
}
