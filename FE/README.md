# LearnGame Frontend

This folder contains the Next.js frontend for the learning-game app. The browser calls BE_Web for game generation, review edits, approval, and publishing; it does not call BE_AI directly.

## Structure

```text
app/                                      Next.js pages and routes
app/dashboard/lesson/                    Game creation, validation, review, and publish flow
src/components/ui/                       Shared UI primitives
src/features/game-library/services/      BE_Web client and mapping helpers
src/features/game-shells/                Playable game shells
src/features/game-preview/               Teacher review workspace components
src/types/app.ts                         Shared LearnGame data shapes
public/assets/treasure-hunt/             Optional real game assets
```

Set `NEXT_PUBLIC_BE_WEB_URL` when BE_Web is not running on `http://localhost:8001`.
