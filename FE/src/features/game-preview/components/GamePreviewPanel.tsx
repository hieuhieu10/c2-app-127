import type { Game } from '@/types/app'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { GameShell } from '@/features/game-shells/GameShell'

export function GamePreviewPanel({ game }: { game: Game }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bản xem trước có thể chơi</CardTitle>
        <CardDescription>Đây là đúng nội dung lớp học sẽ thấy sau khi được phê duyệt.</CardDescription>
      </CardHeader>
      <CardContent>
        <GameShell game={game} previewMode />
      </CardContent>
    </Card>
  )
}
