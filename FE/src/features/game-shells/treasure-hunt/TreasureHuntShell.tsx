'use client'

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Game } from '@/types/app'
import { Button } from '@/components/ui/button'
import {
  FINISH_POSITION,
  createTreasurePlayers,
  getMovePercent,
  getPathPoint,
  getWinner,
  isPlayerTie,
  movePlayerAfterAnswer,
  rankPlayers,
  type TreasurePlayer,
} from './engine'
import { getFeedbackCopy, type FeedbackState } from './animations'
import { normalizeTreasureQuestion } from './question-system'
import { getCharacterAsset, treasureCharacterChoices, treasureHuntAssets } from './assets'

interface TreasureHuntShellProps {
  game: Game
  previewMode?: boolean
  fullscreen?: boolean
}

const DEFAULT_CHARACTER_IDS = ['choice-01', 'choice-02']
const FULLSCREEN_STAGE_WIDTH = 1280
const FULLSCREEN_SAFE_PADDING = 48

export function TreasureHuntShell({ game, fullscreen = false }: TreasureHuntShellProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>(DEFAULT_CHARACTER_IDS)
  const [showCharacterSelect, setShowCharacterSelect] = useState(true)
  const [players, setPlayers] = useState<TreasurePlayer[]>(() => createTreasurePlayers(game.settings, DEFAULT_CHARACTER_IDS))
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const [feedback, setFeedback] = useState<FeedbackState>('idle')
  const [finished, setFinished] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [fullscreenScale, setFullscreenScale] = useState(1)
  const [stageHeight, setStageHeight] = useState(0)

  const currentItem = game.items[currentIndex]
  const currentQuestion = currentItem ? normalizeTreasureQuestion(currentItem, currentIndex) : null
  const hasAnyValidQuestion = game.items.some((item, index) => normalizeTreasureQuestion(item, index).isValid)
  const activePlayer = players[currentIndex % players.length]
  const movePercent = getMovePercent(game.items.length)
  const isRoundComplete = (currentIndex + 1) % players.length === 0

  useEffect(() => {
    if (!fullscreen) {
      setFullscreenScale(1)
      setStageHeight(0)
      return
    }

    const updateScale = () => {
      const viewport = viewportRef.current
      const stage = stageRef.current
      if (!viewport || !stage) return

      const availableWidth = Math.max(320, viewport.clientWidth - FULLSCREEN_SAFE_PADDING)
      const availableHeight = Math.max(320, viewport.clientHeight - FULLSCREEN_SAFE_PADDING)
      const measuredStageHeight = Math.max(stage.scrollHeight, stage.offsetHeight, 1)
      const nextScale = Math.min(availableWidth / FULLSCREEN_STAGE_WIDTH, availableHeight / measuredStageHeight, 1)

      setStageHeight(measuredStageHeight)
      setFullscreenScale(Number(nextScale.toFixed(4)))
    }

    updateScale()

    const resizeObserver = new ResizeObserver(updateScale)
    if (viewportRef.current) resizeObserver.observe(viewportRef.current)
    if (stageRef.current) resizeObserver.observe(stageRef.current)

    window.addEventListener('resize', updateScale)
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateScale)
    }
  }, [currentIndex, feedback, fullscreen, selectedAnswer, showCharacterSelect])

  if (game.items.length > 0 && !hasAnyValidQuestion) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-8 text-center text-destructive">
        Trò chơi này chưa có các lựa chọn trả lời hợp lệ từ AI. Vui lòng tạo lại hoặc chỉnh sửa các mục trước khi chơi.
      </div>
    )
  }

  if (!currentQuestion || !activePlayer) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-secondary/20 p-8 text-center text-muted-foreground">
        Chưa có nội dung trò chơi.
      </div>
    )
  }

  const answerQuestion = () => {
    if (feedback !== 'idle' || !selectedAnswer || !currentQuestion.isValid) return

    const isCorrect = selectedAnswer === currentQuestion.correctAnswer
    setFeedback(isCorrect ? 'correct' : 'wrong')
    setPlayers((currentPlayers) => movePlayerAfterAnswer(currentPlayers, activePlayer.id, isCorrect, game.items.length))
  }

  const goNext = () => {
    const hasWinner = players.some((player) => player.position >= FINISH_POSITION)
    const isLastQuestion = currentIndex >= game.items.length - 1

    if ((hasWinner && isRoundComplete) || isLastQuestion) {
      setFinished(true)
      return
    }

    setCurrentIndex((value) => value + 1)
    setSelectedAnswer('')
    setFeedback('idle')
    setPlayers((currentPlayers) => currentPlayers.map((player) => ({ ...player, mood: 'idle' })))
  }

  const resetGame = () => {
    setPlayers(createTreasurePlayers(game.settings, selectedCharacterIds))
    setCurrentIndex(0)
    setSelectedAnswer('')
    setFeedback('idle')
    setFinished(false)
  }

  const selectCharacter = (playerIndex: number, characterId: string) => {
    setSelectedCharacterIds((currentIds) => {
      const otherIndex = playerIndex === 0 ? 1 : 0
      if (currentIds[otherIndex] === characterId) return currentIds

      const nextIds = [...currentIds]
      nextIds[playerIndex] = characterId
      return nextIds
    })
  }

  const startGameWithCharacters = () => {
    setShowCharacterSelect(false)
    setPlayers(createTreasurePlayers(game.settings, selectedCharacterIds))
    setCurrentIndex(0)
    setSelectedAnswer('')
    setFeedback('idle')
    setFinished(false)
  }

  if (finished) {
    return <TreasureEndScreen players={players} totalQuestions={game.items.length} onRestart={resetGame} />
  }

  const feedbackCopy = getFeedbackCopy(feedback, currentQuestion.correctAnswer)
  const hasWinner = players.some((player) => player.position >= FINISH_POSITION)
  const canShowResults = (hasWinner && isRoundComplete) || currentIndex >= game.items.length - 1

  return (
    <div className={`treasureV2 ${fullscreen ? 'treasureV2Fullscreen' : ''}`} ref={viewportRef}>
      <div
        className={fullscreen ? 'treasureFullscreenScaler' : undefined}
        style={
          fullscreen
            ? {
                width: FULLSCREEN_STAGE_WIDTH * fullscreenScale,
                height: stageHeight * fullscreenScale,
              }
            : undefined
        }
      >
      <div
        className="treasureStage"
        ref={stageRef}
        style={
          fullscreen
            ? {
                width: FULLSCREEN_STAGE_WIDTH,
                transform: `scale(${fullscreenScale})`,
              }
            : undefined
        }
      >
        <header className="treasureTopbar">
          <div className="scoreWrap">
            {players.map((player, index) => (
              <ScoreCard
                key={player.id}
                player={player}
                active={player.id === activePlayer.id}
                tone={index === 0 ? 'red' : 'blue'}
              />
            ))}
          </div>

          <div className="titleWrap">
            <div className="titleRibbon">TRUY TÌM KHO BÁU</div>
          </div>

          <div className="actions">
            <button type="button" className="roundBtn" onClick={() => setSoundOn((value) => !value)} aria-label="Bật tắt âm thanh">
              {soundOn ? '🔊' : '🔇'}
            </button>
            <button type="button" className="roundBtn" onClick={() => setShowCharacterSelect(true)} aria-label="Chọn nhân vật">
              🏠
            </button>
          </div>
        </header>

        <TreasureMap players={players} activePlayerId={activePlayer.id} feedback={feedback} />

        <section className="bottomPanel">
          <div className="panel sidePanel">
            <div className="sideTitle">CÂU HỎI</div>
            <div className="questionCount">
              {currentIndex + 1} / {game.items.length}
            </div>
            <div className="moveBadge">+{Math.round(movePercent)}%</div>
          </div>

          <div className="panel questionBox">
            <div className="questionText">{currentQuestion.prompt}</div>
            {currentQuestion.isValid ? (
              <div className="answers">
                {currentQuestion.options.map((option, index) => (
                  <button
                    key={`${option}-${index}`}
                    type="button"
                    disabled={feedback !== 'idle'}
                    onClick={() => setSelectedAnswer(option)}
                    className={getAnswerButtonClass(option, selectedAnswer, currentQuestion.correctAnswer, feedback)}
                  >
                    <span>{String.fromCharCode(65 + index)}.</span> {option}
                  </button>
                ))}
              </div>
            ) : (
              <div className="invalidQuestion">
                {currentQuestion.validationErrors.map((error) => (
                  <p key={error}>{error}</p>
                ))}
              </div>
            )}
          </div>

          <div className="panel turnPanel">
            <div className="turnTitle">LƯỢT CHƠI</div>
            <div className="turnCharacter">
              <AssetImage
                src={getCharacterAsset(activePlayer.assetId, activePlayer.mood)}
                alt={activePlayer.name}
                className="turnCharacterImg"
                fallback={<span className="turnCharacterFallback">{activePlayer.avatar}</span>}
              />
              <div className="turnName">{activePlayer.name}</div>
            </div>
            <button
              type="button"
              className="submitBtn"
              disabled={!currentQuestion.isValid || (feedback === 'idle' && !selectedAnswer)}
              onClick={feedback === 'idle' ? answerQuestion : goNext}
            >
              {feedback === 'idle' ? '⚔ TRẢ LỜI' : canShowResults ? '🏆 KẾT QUẢ' : '➡ CÂU TIẾP'}
            </button>
          </div>

          <div className="panel eventPanel">
            <div className="eventTitle">SỰ KIỆN</div>
            <div className="eventItem">
              ⭐ <b>ĐÚNG</b>
              <br />
              Nhân vật tiến gần kho báu.
            </div>
            <div className="eventItem">
              ☠ <b>SAI</b>
              <br />
              Hiện đáp án đúng và đứng yên.
            </div>
          </div>
        </section>

        {/* <div className={`log ${feedback === 'correct' ? 'logCorrect' : feedback === 'wrong' ? 'logWrong' : ''}`}>
          {feedback === 'idle'
            ? '✨ Hai nhân vật xuất phát từ bên trái, mỗi người đi một đường tới kho báu! ✨'
            : `${feedbackCopy.title} ${feedbackCopy.message}${currentQuestion.explanation ? ` ${currentQuestion.explanation}` : ''}`}
        </div> */}
      </div>
      </div>

      {showCharacterSelect && (
        <CharacterSelectModal
          selectedCharacterIds={selectedCharacterIds}
          onSelect={selectCharacter}
          onStart={startGameWithCharacters}
        />
      )}

      <style>{treasureHuntStyles}</style>
    </div>
  )
}

function CharacterSelectModal({
  selectedCharacterIds,
  onSelect,
  onStart,
}: {
  selectedCharacterIds: string[]
  onSelect: (playerIndex: number, characterId: string) => void
  onStart: () => void
}) {
  return (
    <div className="selectModal">
      <div className="modalBox">
        <div className="modalTitle">CHỌN 12 NHÂN VẬT CHIBI</div>
        <div className="modalHint">Chọn 2 nhân vật khác nhau rồi bấm BẮT ĐẦU CHƠI.</div>
        <div className="chooseCols">
          <CharacterChoicePanel
            title="Người chơi 1"
            tone="red"
            playerIndex={0}
            selectedCharacterIds={selectedCharacterIds}
            onSelect={onSelect}
          />
          <CharacterChoicePanel
            title="Người chơi 2"
            tone="blue"
            playerIndex={1}
            selectedCharacterIds={selectedCharacterIds}
            onSelect={onSelect}
          />
        </div>
        <button type="button" className="startGame" onClick={onStart}>
          BẮT ĐẦU CHƠI
        </button>
      </div>
    </div>
  )
}

function CharacterChoicePanel({
  title,
  tone,
  playerIndex,
  selectedCharacterIds,
  onSelect,
}: {
  title: string
  tone: 'red' | 'blue'
  playerIndex: number
  selectedCharacterIds: string[]
  onSelect: (playerIndex: number, characterId: string) => void
}) {
  const otherPlayerIndex = playerIndex === 0 ? 1 : 0

  return (
    <div className="choosePanel">
      <div className={`chooseHead ${tone === 'blue' ? 'chooseHeadBlue' : ''}`}>{title}</div>
      <div className="charGrid">
        {treasureCharacterChoices.map((character) => {
          const selected = selectedCharacterIds[playerIndex] === character.id
          const disabled = selectedCharacterIds[otherPlayerIndex] === character.id

          return (
            <button
              key={`${tone}-${character.id}`}
              type="button"
              disabled={disabled}
              className={`charCard ${selected ? (tone === 'red' ? 'redSel' : 'blueSel') : ''}`}
              onClick={() => onSelect(playerIndex, character.id)}
            >
              <AssetImage
                src={character.image}
                alt={character.name}
                className="charSprite"
                fallback={<span className="avatarFallback">🧒</span>}
              />
              <span className="charName">{character.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ScoreCard({ player, active, tone }: { player: TreasurePlayer; active: boolean; tone: 'red' | 'blue' }) {
  return (
    <div className={`scoreCard ${active ? 'active' : ''}`}>
      <div className="miniChar">
        <AssetImage src={getCharacterAsset(player.assetId, player.mood)} alt="" className="miniImg" fallback={<span>{player.avatar}</span>} />
      </div>
      {/* <div className={`scoreTitle ${tone === 'blue' ? 'blueTitle' : ''}`}>{tone === 'red' ? 'HẢI TẶC ĐỎ' : 'HẢI TẶC XANH'}</div> */}
      <div className="scoreNum">{getDisplayProgress(player.position)}%</div>
      <div className="dots">
        <span className={`dot ${tone}`} />
        <span className="dot" />
        <span className="dot" />
      </div>
    </div>
  )
}

function TreasureMap({
  players,
  activePlayerId,
  feedback,
}: {
  players: TreasurePlayer[]
  activePlayerId: string
  feedback: FeedbackState
}) {
  return (
    <div className="mapArea">
      <AssetImage
        src={treasureHuntAssets.map.background}
        alt="Treasure hunt island map"
        className="mapBackground"
        fallback={<div className="mapFallback">Treasure Map</div>}
      />

      {players.map((player, index) => {
        const point = getPathPoint(getVisualProgress(player.position), index, players.length)
        const isActive = player.id === activePlayerId

        return (
          <div key={player.id} className={`avatar ${player.mood === 'run' ? 'running' : ''} ${isActive ? 'activeAvatar' : ''}`} style={point}>
            <div className="avatarRing">
              <AssetImage
                src={getCharacterAsset(player.assetId, player.mood)}
                alt={player.name}
                className="avatarImg"
                fallback={<span className="avatarFallback">{player.avatar}</span>}
              />
            </div>
            <div className={getFootWaveClass(isActive, feedback)} aria-hidden="true" />
          </div>
        )
      })}
    </div>
  )
}

function TreasureEndScreen({
  players,
  totalQuestions,
  onRestart,
}: {
  players: TreasurePlayer[]
  totalQuestions: number
  onRestart: () => void
}) {
  const winner = getWinner(players)
  const rankings = rankPlayers(players)
  const tiedWinners = rankings.filter((player) => isPlayerTie(player, winner))
  const hasTie = tiedWinners.length > 1

  return (
    <div className="treasureEnd">
      <div className="treasureEndBox">
        <div className="endCrown">🏆</div>
        <div className="endEyebrow">KHO BÁU ĐÃ MỞ</div>
        <h3>{hasTie ? 'Hai người chơi hòa nhau!' : `${getPlayerDisplayName(winner)} chiến thắng!`}</h3>
        <p>
          {hasTie
            ? `Cả hai có cùng kết quả sau ${totalQuestions} câu hỏi.`
            : `${getPlayerDisplayName(winner)} đã tìm thấy kho báu sau ${totalQuestions} câu hỏi.`}
        </p>

        <div className="endRanks">
          {rankings.map((player, index) => (
            <div key={player.id} className="endRankCard">
              <div className="endRank">Hạng {index + 1}</div>
              <AssetImage
                src={getCharacterAsset(player.assetId, 'celebrate')}
                alt={player.name}
                className="endAvatar"
                fallback={<div className="endEmoji">{player.avatar}</div>}
              />
              <div className="endName">{getPlayerDisplayName(player)}</div>
              <div className="endStats">
                <span>{player.correctAnswers} câu đúng</span>
                <span>{player.score} điểm</span>
              </div>
            </div>
          ))}
        </div>

        <Button onClick={onRestart} className="mt-5 h-12 w-full bg-amber-500 text-base font-black text-amber-950 hover:bg-amber-400">
          Chơi lại
        </Button>
      </div>
      <style>{treasureHuntStyles}</style>
    </div>
  )
}

function AssetImage({
  src,
  alt,
  className,
  fallback,
}: {
  src: string
  alt: string
  className?: string
  fallback: ReactNode
}) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return <>{fallback}</>
  }

  return <img src={src} alt={alt} className={className} draggable={false} onError={() => setFailed(true)} />
}

function getAnswerButtonClass(option: string, selectedAnswer: string, correctAnswer: string, feedback: FeedbackState) {
  const classes = ['answerBtn']
  const isSelected = selectedAnswer === option

  if (feedback === 'idle' && isSelected) classes.push('selected')
  if (feedback === 'correct' && isSelected) classes.push('correct')
  if (feedback === 'wrong' && isSelected) classes.push('wrong')
  if (feedback !== 'idle' && option === correctAnswer) classes.push('reveal')

  return classes.join(' ')
}

function getDisplayProgress(position: number): number {
  return Math.min(100, Math.round((position / FINISH_POSITION) * 100))
}

function getPlayerDisplayName(player: TreasurePlayer): string {
  if (player.name) return player.name
  if (player.id === 'player-1') return 'Người chơi 1'
  if (player.id === 'player-2') return 'Người chơi 2'
  return 'Người chơi'
}

function getVisualProgress(position: number): number {
  return Math.min(100, (position / FINISH_POSITION) * 100)
}

function getFootWaveClass(isActive: boolean, feedback: FeedbackState) {
  const classes = ['footWave']

  if (isActive && feedback === 'correct') classes.push('footWaveCorrect')
  if (isActive && feedback === 'wrong') classes.push('footWaveWrong')

  return classes.join(' ')
}

const treasureHuntStyles = `
.treasureV2 {
  --brown: #6a330e;
  --dark-brown: #351607;
  position: relative;
  width: 100%;
  overflow: hidden;
  border-radius: 18px;
  background: linear-gradient(#0686c2, #055d89);
  color: #4a2606;
  font-family: Arial, Helvetica, sans-serif;
  box-shadow: 0 18px 50px rgba(15, 23, 42, .18);
}
.treasureV2,
.treasureV2 * {
  box-sizing: border-box;
}
.treasureV2Fullscreen {
  height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: transparent;
}
.treasureFullscreenScaler {
  position: relative;
  flex: 0 0 auto;
  overflow: visible;
}
.treasureStage {
  position: relative;
  width: 100%;
  display: grid;
  grid-template-rows: auto auto auto;
  gap: 16px;
  min-height: 0;
  overflow: visible;
  background: linear-gradient(#0686c2, #055d89);
  padding: 14px;
}

.treasureV2Fullscreen .treasureStage {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: top left;
  min-height: 0;
  overflow: visible;
}
.treasureV2Fullscreen .treasureStage {
  gap: 10px;
  padding: 10px;
}
.treasureV2Fullscreen .treasureTopbar {
  min-height: 54px;
}
.treasureV2Fullscreen .scoreCard {
  height: 52px;
  min-width: 74px;
  width: 76px;
}
.treasureV2Fullscreen .miniChar {
  height: 46px;
  top: -7px;
}
.treasureV2Fullscreen .miniImg {
  max-height: 40px;
}
.treasureV2Fullscreen .scoreNum {
  margin-top: 20px;
  font-size: 18px;
}
.treasureV2Fullscreen .titleRibbon {
  min-width: 360px;
  font-size: 23px;
  padding: 7px 18px;
}
.treasureV2Fullscreen .roundBtn {
  width: 48px;
  height: 48px;
  border-width: 3px;
  font-size: 21px;
}
.treasureV2Fullscreen .mapArea {
  aspect-ratio: 1672 / 941;
  min-height: 0;
}
.treasureV2Fullscreen .bottomPanel {
  min-height: 150px;
  grid-template-columns: 82px minmax(0, 1fr) 150px 142px;
  gap: 9px;
}
.treasureV2Fullscreen .panel {
  border-width: 4px;
  border-radius: 14px;
  padding: 9px;
}
.treasureV2Fullscreen .sideTitle {
  font-size: 14px;
  padding: 7px 5px;
}
.treasureV2Fullscreen .questionCount {
  margin-top: 9px;
  font-size: 20px;
}
.treasureV2Fullscreen .moveBadge {
  margin-top: 10px;
  font-size: 13px;
  padding: 5px 8px;
}
.treasureV2Fullscreen .questionText {
  font-size: 20px;
  margin-bottom: 6px;
}
.treasureV2Fullscreen .answerBtn {
  min-height: 44px;
  font-size: 15px;
  padding: 7px 5px;
}
.treasureV2Fullscreen .turnTitle,
.treasureV2Fullscreen .eventTitle {
  font-size: 17px;
}
.treasureV2Fullscreen .turnCharacter {
  min-height: 86px;
  margin: 5px 0 8px;
}
.treasureV2Fullscreen .turnCharacterImg {
  width: 72px;
  height: 72px;
}
.treasureV2Fullscreen .turnName {
  font-size: 14px;
}
.treasureV2Fullscreen .submitBtn {
  font-size: 17px;
  padding: 11px 7px;
}
.treasureV2Fullscreen .eventItem {
  font-size: 13px;
  padding: 7px 3px;
}
.treasureV2Fullscreen .eventItem b {
  font-size: 15px;
}
.selectModal {
  position: absolute;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(3, 36, 58, .88);
  padding: 18px;
}
.modalBox {
  width: min(1220px, 96%);
  max-height: 92%;
  overflow: auto;
  border: 6px solid var(--brown);
  border-radius: 24px;
  background: #ffe6b4;
  box-shadow: 0 10px 0 var(--dark-brown);
  padding: 20px;
}
.modalTitle {
  margin-bottom: 6px;
  color: #b82a13;
  text-align: center;
  text-shadow: 2px 2px #ffd76b;
  font-size: clamp(26px, 3.4vw, 38px);
  font-weight: 900;
}
.modalHint {
  margin-bottom: 16px;
  color: #5a2505;
  text-align: center;
  font-size: 18px;
  font-weight: 700;
}
.chooseCols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.choosePanel {
  border: 4px solid #a15f21;
  border-radius: 18px;
  background: #fff1cc;
  padding: 14px;
}
.chooseHead {
  margin-bottom: 12px;
  color: #bf2419;
  text-align: center;
  font-size: 23px;
  font-weight: 900;
}
.chooseHeadBlue {
  color: #1866bd;
}
.charGrid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
.charCard {
  display: flex;
  height: 155px;
  cursor: pointer;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  overflow: hidden;
  border: 3px solid #af6d24;
  border-bottom-width: 6px;
  border-bottom-color: #7f4510;
  border-radius: 14px;
  background: #ffe0a4;
  padding: 8px;
  text-align: center;
}
.charCard:disabled {
  cursor: not-allowed;
  opacity: .35;
}
.charCard.redSel {
  outline: 4px solid #e74134;
}
.charCard.blueSel {
  outline: 4px solid #2b7fda;
}
.charSprite {
  width: 100%;
  height: 112px;
  object-fit: contain;
  object-position: center bottom;
}
.charName {
  margin-top: 5px;
  color: #4a2606;
  font-size: 12px;
  font-weight: 900;
  line-height: 1.1;
}
.startGame {
  display: block;
  min-width: 280px;
  cursor: pointer;
  margin: 18px auto 0;
  border: 4px solid #925109;
  border-bottom-width: 8px;
  border-bottom-color: #5d2c08;
  border-radius: 16px;
  background: linear-gradient(#ffd04e, #ef9818);
  color: #5a2505;
  font-size: 28px;
  font-weight: 900;
  padding: 16px 24px;
}
.treasureTopbar {
  position: relative;
  min-height: 74px;
  display: grid;
  grid-template-columns: minmax(180px, 250px) minmax(340px, 1fr) minmax(108px, 140px);
  gap: 14px;
  align-items: center;
  z-index: 5;
}
.scoreWrap {
  display: flex;
  gap: 10px;
}
.scoreCard {
  position: relative;
  width: min(82px, 7.2vw);
  min-width: 76px;
  height: 58px;
  overflow: hidden;
  border: 3px solid var(--brown);
  border-radius: 12px;
  background: #ffe7b6;
  box-shadow: 0 4px 0 var(--dark-brown);
  padding: 5px 7px;
}
.scoreCard.active {
  outline: 3px solid #ffd84f;
}
.miniChar {
  position: absolute;
  left: 2px;
  top: -8px;
  display: flex;
  width: 34px;
  height: 50px;
  align-items: flex-end;
  justify-content: center;
}
.miniImg {
  max-width: 32px;
  max-height: 42px;
  object-fit: contain;
}
.scoreTitle {
  position: relative;
  z-index: 2;
  color: #a12e16;
  text-align: right;
  font-size: 10px;
  font-weight: 900;
  line-height: 1.05;
}
.blueTitle {
  color: #175fa8;
}
.scoreNum {
  position: relative;
  z-index: 2;
  margin-top: 24px;
  text-align: center;
  font-size: 19px;
  font-weight: 900;
}
.dots {
  position: relative;
  z-index: 2;
  display: flex;
  justify-content: center;
  gap: 4px;
  margin-top: 4px;
}
.dot {
  width: 12px;
  height: 12px;
  border: 2px solid #72350d;
  border-radius: 50%;
  background: #fff;
}
.dot.red {
  background: #e84233;
}
.dot.blue {
  background: #2b7fda;
}
.titleWrap {
  display: flex;
  justify-content: center;
}
.titleRibbon {
  min-width: min(460px, 100%);
  margin-top: -1px;
  border: 4px solid #651208;
  border-radius: 16px;
  background: linear-gradient(#b72b14, #8d180c);
  box-shadow: 0 5px 0 #4a0f06;
  color: #ffd85b;
  text-align: center;
  text-shadow: 2px 2px #561105;
  font-size: clamp(19px, 2.35vw, 28px);
  font-weight: 900;
  line-height: 1.05;
  padding: 10px 24px;
}
.titleRibbon:before,
.titleRibbon:after {
  content: "☠";
  color: #ffe8ac;
  font-size: .85em;
  margin: 0 10px;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.roundBtn {
  width: 54px;
  height: 54px;
  cursor: pointer;
  border: 4px solid #9a580a;
  border-radius: 50%;
  background: linear-gradient(#ffcf52, #ef9c1d);
  box-shadow: 0 4px 0 #613008;
  font-size: 24px;
  font-weight: 900;
}
.mapArea {
  --map-border: 6px;
  position: relative;
  width: 100%;
  aspect-ratio: 1672 / 941;
  min-height: 360px;
  overflow: hidden;
  border: var(--map-border) solid var(--brown);
  border-radius: 26px;
  background: #10a0d4;
  box-shadow: 0 7px 0 var(--dark-brown);
}
.mapBackground {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center center;
  user-select: none;
}
.mapFallback {
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #22c7e8, #6ddc65);
  color: #064e3b;
  font-size: 34px;
  font-weight: 900;
}
.avatar {
  position: absolute;
  z-index: 18;
  width: 84px;
  height: 94px;
  transform: translate(-50%, -92%);
  transition: left .85s ease, top .85s ease, transform .2s ease;
  filter: drop-shadow(0 4px 3px rgba(0,0,0,.38));
}
.avatar.running {
  animation: treasureHop .22s infinite;
}
.activeAvatar .avatarRing {
  filter: drop-shadow(0 0 10px rgba(255, 235, 156, .95)) drop-shadow(0 6px 10px rgba(0,0,0,.28));
}
.avatarRing {
  position: absolute;
  left: 50%;
  bottom: 6px;
  display: flex;
  width: 74px;
  height: 82px;
  align-items: center;
  justify-content: center;
  overflow: visible;
  background: transparent;
  transform: translateX(-50%);
}
.avatarImg {
  width: 78px;
  height: 88px;
  object-fit: contain;
  object-position: center bottom;
}
.avatarFallback {
  font-size: 38px;
}
.footWave {
  position: absolute;
  left: 50%;
  bottom: -3px;
  z-index: -1;
  width: 80px;
  height: 34px;
  border-radius: 999px;
  opacity: 0;
  pointer-events: none;
  transform: translateX(-50%);
}
.footWave::before,
.footWave::after {
  position: absolute;
  inset: 4px 8px;
  border-radius: 999px;
  content: '';
  opacity: 0;
  transform: scale(.12);
}
.footWave::after {
  animation-delay: .28s;
}
.footWaveCorrect {
  opacity: 1;
}
.footWaveCorrect::before,
.footWaveCorrect::after {
  border: 2px solid rgba(34, 197, 94, .86);
  box-shadow: 0 0 6px rgba(34, 197, 94, .34);
  animation: footWaveGreen 1.05s ease-out infinite;
}
.footWaveWrong {
  opacity: 1;
}
.footWaveWrong::before,
.footWaveWrong::after {
  border: 2px solid rgba(239, 68, 68, .88);
  box-shadow: 0 0 6px rgba(239, 68, 68, .34);
  animation: footWaveRed .86s ease-out infinite;
}
.bottomPanel {
  position: relative;
  z-index: 20;
  display: grid;
  min-height: 190px;
  height: auto;
  grid-template-columns: minmax(94px, 110px) minmax(0, 1fr) minmax(175px, 220px) minmax(154px, 184px);
  align-items: stretch;
  gap: 12px;
}
.panel {
  min-height: 0;
  border: 5px solid var(--brown);
  border-radius: 18px;
  background: #f7dfb0;
  box-shadow: 0 6px 0 var(--dark-brown);
  padding: 12px;
}
.sideTitle {
  border-radius: 10px;
  background: #7a3a0b;
  color: #fff0bd;
  text-align: center;
  font-size: 17px;
  font-weight: 900;
  padding: 8px;
}
.questionCount {
  margin-top: 10px;
  text-align: center;
  font-size: 22px;
  font-weight: 900;
}
.moveBadge {
  width: fit-content;
  margin: 12px auto 0;
  border-radius: 999px;
  background: #fff0bd;
  color: #6a330e;
  font-size: 15px;
  font-weight: 900;
  padding: 6px 10px;
}
.questionBox {
  position: relative;
  z-index: 30;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.questionText {
  min-height: 0;
  margin-bottom: 7px;
  padding: 0 8px;
  color: #4a2606;
  text-align: center;
  overflow-wrap: anywhere;
  font-size: clamp(16px, 1.7vw, 24px);
  font-weight: 900;
  line-height: 1.18;
}
.answers {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}
.invalidQuestion {
  border: 3px solid #b91c1c;
  border-radius: 14px;
  background: #fee2e2;
  color: #7f1d1d;
  font-size: 15px;
  font-weight: 900;
  line-height: 1.35;
  padding: 14px;
}
.invalidQuestion p + p {
  margin-top: 8px;
}
.answerBtn {
  position: relative;
  z-index: 41;
  min-height: 52px;
  cursor: pointer;
  border: 3px solid #b97d2b;
  border-bottom-width: 6px;
  border-bottom-color: #88531a;
  border-radius: 14px;
  background: #ffe6b0;
  color: #5a2b05;
  overflow-wrap: anywhere;
  font-size: clamp(13px, 1.08vw, 18px);
  font-weight: 900;
  line-height: 1.18;
  padding: 9px 5px;
  pointer-events: auto;
  touch-action: manipulation;
}
.answerBtn span {
  color: #9a3117;
}
.answerBtn:hover:not(:disabled),
.answerBtn.selected {
  background: #ffba3d;
  box-shadow: 0 0 0 4px #fff0ab inset;
}
.answerBtn.correct,
.answerBtn.reveal {
  animation: answerGreen .55s ease-in-out 2;
  border-color: #047857;
  border-bottom-color: #065f46;
  background: #86efac;
}
.answerBtn.wrong {
  animation: answerRed .55s ease-in-out 2;
  border-color: #b91c1c;
  border-bottom-color: #7f1d1d;
  background: #fca5a5;
}
.turnTitle {
  color: #73400f;
  text-align: center;
  font-size: 18px;
  font-weight: 900;
}
.turnCharacter {
  display: flex;
  min-height: 118px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 4px;
  margin: 8px 0 10px;
}
.turnCharacterImg {
  width: 92px;
  height: 92px;
  object-fit: contain;
  object-position: center bottom;
  filter: drop-shadow(0 5px 4px rgba(64, 29, 5, .28));
}
.turnCharacterFallback {
  display: flex;
  width: 82px;
  height: 82px;
  align-items: center;
  justify-content: center;
  font-size: 44px;
}
.turnName {
  color: #b12517;
  text-align: center;
  font-size: 16px;
  font-weight: 900;
  line-height: 1.1;
}
.submitBtn {
  width: 100%;
  cursor: pointer;
  border: 3px solid #7e140d;
  border-bottom-width: 7px;
  border-radius: 14px;
  background: linear-gradient(#f04c22, #bc1d11);
  color: #fff;
  font-size: 20px;
  font-weight: 900;
  padding: 14px 9px;
}
.submitBtn:disabled {
  cursor: not-allowed;
  filter: grayscale(.35);
  opacity: .55;
}
.eventPanel {
  border-color: #3e1806;
  background: #6f360f;
  color: #ffefc1;
}
.eventTitle {
  margin-bottom: 8px;
  text-align: center;
  font-size: 20px;
  font-weight: 900;
}
.eventItem {
  border-top: 1px solid rgba(255,255,255,.25);
  font-size: 15px;
  padding: 10px 3px;
}
.eventItem b {
  font-size: 17px;
}
.log {
  position: absolute;
  left: 3%;
  right: 3%;
  bottom: 2px;
  z-index: 8;
  pointer-events: none;
  color: #ffe9a4;
  text-align: center;
  text-shadow: 0 2px #054662;
  font-size: 17px;
  font-weight: 900;
}
.logCorrect {
  color: #d1fae5;
}
.logWrong {
  color: #fee2e2;
}
.treasureEnd {
  display: flex;
  min-height: 620px;
  align-items: center;
  justify-content: center;
  border-radius: 18px;
  background: linear-gradient(#0686c2, #055d89);
  padding: 24px;
  font-family: Arial, Helvetica, sans-serif;
}
.treasureEndBox {
  width: min(900px, 100%);
  border: 6px solid #6a330e;
  border-radius: 24px;
  background: #ffe6b4;
  box-shadow: 0 10px 0 #351607;
  color: #4a2606;
  padding: 24px;
  text-align: center;
}
.endCrown {
  font-size: 68px;
}
.endEyebrow {
  color: #b82a13;
  font-size: 16px;
  font-weight: 900;
  letter-spacing: .16em;
  text-transform: uppercase;
}
.treasureEnd h3 {
  margin: 8px 0 0;
  color: #5a2505;
  font-size: 40px;
  font-weight: 900;
}
.treasureEnd p {
  margin: 8px 0 0;
  font-weight: 700;
}
.endRanks {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 20px;
}
.endRankCard {
  border: 4px solid #a15f21;
  border-radius: 18px;
  background: #fff1cc;
  padding: 14px;
}
.endRank {
  color: #b82a13;
  font-weight: 900;
}
.endAvatar {
  width: 110px;
  height: 120px;
  object-fit: contain;
}
.endEmoji {
  font-size: 58px;
}
.endName {
  font-size: 20px;
  font-weight: 900;
}
.endStats {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 13px;
  font-weight: 900;
}
.endStats span {
  border-radius: 999px;
  background: #ffe0a4;
  padding: 6px 10px;
}
@keyframes treasureHop {
  0%, 100% { transform: translate(-50%, -92%) rotate(-2deg); }
  50% { transform: translate(-50%, -100%) rotate(2deg); }
}
@keyframes footWaveGreen {
  0% { opacity: .85; transform: scale(.12); }
  55% { opacity: .45; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.75); }
}
@keyframes footWaveRed {
  0% { opacity: .88; transform: scale(.12); }
  50% { opacity: .48; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.78); }
}
@keyframes answerGreen {
  0%, 100% { background: #86efac; }
  50% { background: #22c55e; color: #fff; }
}
@keyframes answerRed {
  0%, 100% { background: #fca5a5; }
  50% { background: #ef4444; color: #fff; }
}
@media (max-width: 1100px) {
  .treasureTopbar {
    grid-template-columns: 210px 1fr 120px;
  }
  .titleRibbon:before,
  .titleRibbon:after {
    display: none;
  }
  .bottomPanel {
    grid-template-columns: 96px minmax(0, 1fr) 174px;
  }
  .eventPanel {
    display: none;
  }
  .answers {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 760px) {
  .chooseCols {
    grid-template-columns: 1fr;
  }
  .charGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .charCard {
    height: 138px;
  }
  .charSprite {
    height: 96px;
  }
  .treasureStage {
    gap: 12px;
    padding: 10px;
  }
  .treasureTopbar {
    min-height: 132px;
    grid-template-columns: 1fr auto;
  }
  .titleWrap {
    grid-column: 1 / -1;
    grid-row: 1;
  }
  .scoreWrap {
    grid-row: 2;
  }
  .actions {
    grid-row: 2;
  }
  .scoreCard {
    width: 92px;
    min-width: 92px;
  }
  .mapArea {
    min-height: 300px;
  }
  .bottomPanel {
    grid-template-columns: 1fr;
    min-height: 0;
  }
  .sidePanel,
  .turnPanel {
    display: none;
  }
  .questionText {
    font-size: 18px;
  }
}
`
