# AI SciComm Frontend

This folder contains the frontend architecture for the AI science communication assistant.

## Structure

```text
app/          Next.js pages and routes
components/   Reusable UI blocks used by pages
lib/api/      Data access functions; currently backed by mock data
lib/mock/     Mock data used before the FastAPI backend is ready
lib/types.ts  Shared TypeScript data shapes
styles/       Global CSS
```

The key idea is that pages import API functions from `lib/api`, not mock data directly. Later, the mock implementation can be replaced with real FastAPI calls without rewriting the UI components.
