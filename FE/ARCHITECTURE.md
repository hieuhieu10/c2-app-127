# Frontend Architecture

This frontend uses Next.js App Router. The `app/` directory owns routing only; reusable UI, feature logic, services, and shared types live under `src/`.

## Folder Map

```txt
FE/
├─ app/                         # Next.js routes and page entrypoints
├─ public/                      # Static assets
├─ src/
│  ├─ components/
│  │  ├─ layout/                # App-level layout helpers
│  │  └─ ui/                    # Reusable UI primitives
│  ├─ features/
│  │  ├─ auth/                  # Auth state and auth-specific logic
│  │  ├─ dashboard/             # Dashboard feature components
│  │  ├─ game-creation/         # Lesson setup, template choice, generation flow
│  │  ├─ game-preview/          # Review, validation status, teacher edit flow
│  │  ├─ game-library/          # BE_Web API client and game mapping services
│  │  └─ game-shells/           # Fixed playable game shells
│  ├─ lib/                      # Small app-wide utilities
│  └─ types/                    # Shared TypeScript domain types
```

## Current Important Paths

- `src/features/auth/auth-context.tsx`: temporary client auth context until BE_Web auth is implemented.
- `src/features/game-library/services/be-web.ts`: typed client and adapters for BE_Web game APIs.
- `src/types/app.ts`: shared domain types for user, lesson, game, item, template, and curriculum objective.
- `src/components/layout/protected-layout.tsx`: route protection wrapper.
- `src/components/ui/`: shared button, card, input, label, select, spinner, and textarea primitives.

## Routing Rule

Keep `app/**/page.tsx` as thin as possible over time. When a page grows, move feature-specific UI into `src/features/<feature>/components`.
