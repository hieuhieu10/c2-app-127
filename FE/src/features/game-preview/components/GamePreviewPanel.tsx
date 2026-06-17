import type { Game } from '@/types/app'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { GameShell } from '@/features/game-shells/GameShell'

export function GamePreviewPanel({ game }: { game: Game }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Playable Preview</CardTitle>
        <CardDescription>Exactly what the class will see after approval.</CardDescription>
      </CardHeader>
      <CardContent>
        <GameShell game={game} previewMode />
      </CardContent>
    </Card>
  )
}
