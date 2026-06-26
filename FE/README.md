# LearnGame Frontend

Thư mục này chứa frontend Next.js của LearnGame.

FE hiện gọi:

- BE_AI cho luồng tạo game mới: `/recommend/games` và `/generate/stream`.
- BE_Web cho auth, saved games, review/edit, approve/publish và avatar.

## Cấu Trúc

```text
app/                                      Next.js pages và routes
app/dashboard/game/new/                  Giao diện tạo game hiện tại
app/dashboard/game/preview/              Màn preview game tạo từ BE_AI stream
app/dashboard/lesson/[lessonId]/review/  Review saved game từ BE_Web
src/components/ui/                       Shared UI primitives
src/components/layout/                   Layout và sidebar
src/features/game-creation/              BE_AI client, template registry
src/features/game-library/services/      BE_Web client và local game helpers
src/features/game-shells/                Playable game shells
src/features/game-preview/               Teacher review workspace components
src/types/app.ts                         Shared LearnGame data shapes
public/assets/treasure-hunt/             Asset pack tùy chọn cho Treasure Hunt
```

## Biến Môi Trường

Nếu BE_Web không chạy ở `http://localhost:8001`, đặt:

```env
NEXT_PUBLIC_BE_WEB_URL=http://localhost:8001
```

Nếu BE_AI không chạy ở `http://localhost:8000`, đặt:

```env
NEXT_PUBLIC_AI_URL=http://localhost:8000
```

Để xem request/response FE gọi BE_AI/BE_Web trong browser console:

```env
NEXT_PUBLIC_API_DEBUG=true
```

Với Next.js, sau khi đổi biến môi trường cần restart `npm run dev`.

## Cài Đặt Và Chạy

```powershell
cd FE
npm install
npm run dev
```

App chạy tại:

```text
http://localhost:3000
```
