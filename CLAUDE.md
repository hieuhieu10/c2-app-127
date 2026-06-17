# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AI Learning-Game Generator (Team 127 / AI20K-064). A teacher-facing web tool that turns a lesson objective into a ready-to-play browser mini-game. Teachers prompt → AI recommends a game template → AI generates schema-valid JSON content → content passes a fidelity gate → JSON is injected into a pre-coded game shell. AI only fills content into fixed shells; it never runs arbitrary code.

The **differentiatior** is the game-template library + strict per-template JSON schema + validation layer (faithfulness > 0.80, hallucination < 5%), not content generation itself.

## Team ownership

`notnbhd` owns the **recommend + generate** slice (`backend/`). Teammates own NLI/auth/RAG/game shells.

## Setup

```bash
# From repo root — install backend in editable mode
cd backend && uv sync
# or with pip
pip install -e ".[dev]"

# Environment — copy and fill in ANTHROPIC_API_KEY and AI_LOG_* vars
cp .env.example .env
```

Settings are loaded from the **repo root `.env`** (`backend/app/config.py` walks up two levels). Key env vars: `ANTHROPIC_API_KEY`, `DEFAULT_MODEL` (default: `claude-sonnet-4-6`), `MAX_REPAIRS` (default: 2), `MAX_TOKENS` (default: 4096).

## Commands

```bash
# Run the API (from backend/)
cd backend && uvicorn app.main:app --reload

# Run all tests
cd backend && pytest

# Run a single test file
cd backend && pytest tests/test_graph.py

# Run a single test
cd backend && pytest tests/test_graph.py::test_full_workflow_success

# Live smoke test against real Claude API (requires valid ANTHROPIC_API_KEY)
cd backend && .venv/bin/python -m scripts.smoke_generate

# Log AI usage manually (ChatGPT / web tools only)
bash scripts/_pyrun.sh scripts/log_manual.py --tool chatgpt --prompt "<description>"
```

Pre-push hook auto-submits AI usage logs. Install once with `bash scripts/setup_hooks.sh`.

## Architecture

```
backend/
  app/
    main.py                  # FastAPI app, mounts routes_generate router
    models.py                # LessonRequest, GameResponse, RecommendResponse (API layer)
    config.py                # Settings (pydantic-settings, reads root .env)
    api/
      routes_generate.py     # HTTP endpoints: GET /templates, POST /recommend, /generate, /generate/full
    agents/
      state.py               # GenerationState TypedDict — shared across all nodes
      graph.py               # LangGraph wiring; build_graph() + run_workflow() entry point
      recommender.py         # Supervisor node: picks game template via Claude tool_use
      generator.py           # Worker nodes: retrieve, generate, validate, repair
      llm.py                 # Claude API wrapper (call_tool helper)
      prompts.py             # System prompts + user-message builders
    templates/
      spec.py                # GameSpec dataclass — one game's full description (metadata + content model + knobs)
      registry.py            # Auto-discovers every schemas/*.SPEC; metadata + content-model lookups
      schemas/               # One module per game = content model + module-level SPEC (quiz, matching, fill_in_blank, treasure_hunt, battleship)
    retrieval/
      context.py             # RetrievalProvider Protocol + StubRetrievalProvider (real RAG is a teammate's seam)
    validation/
      validator.py           # Schema validation gate; validate() + json_schema_for()
  data/
    fixtures/                # sample_subject.json with objectives + misconceptions for the stub retriever
  tests/
    conftest.py              # valid_content()/invalid_content() helpers + lesson_payload fixture
    test_graph.py            # End-to-end workflow + HTTP tests (LLM mocked via monkeypatch)
    test_recommender.py      # Recommender unit tests
    test_generator.py        # Generator/validator unit tests
    test_schemas.py          # Per-template Pydantic schema tests
    test_validator.py        # Validator unit tests
```

### LangGraph pipeline

```
guardrail --ok--> retrieve -> recommend -> generate -> validate --done--> END
    |                                          ^   |
    +--blocked--> END                          |   +--repair--> repair --> validate
                                               +--give_up--> finalize_failure -> END
```

- **guardrail** (`guardrail.py:guardrail_node`) — input screening before any work. Rejects requests that are out of KB scope (subject/grade), off-topic for the chosen subject, above the chosen grade, or not child-friendly, with a teacher-facing explanation + re-prompt suggestion. Layered: deterministic scope check + explicit-term screen (free, always run) then a nuanced LLM relevance/safety screen (only when an API key is set; fails open on error). HTTP endpoints return **422** with a `GuardrailReport` (`code`, `message`, `suggestion`) detail; the SSE stream emits a `blocked` event.
- **retrieve** (`generator.py:retrieve_node`) — calls `default_provider.retrieve()` to get grounding context (curriculum passages, misconceptions). Real RAG injected via `default_provider`.
- **recommend** (`recommender.py:recommend_node`) — supervisor LLM call; honours `override_template` to skip. Falls back gracefully if grade has no templates.
- **generate / repair** (`generator.py`) — worker LLM call using Claude tool_use with the template's JSON Schema as `input_schema`. Repair passes prior validation errors back in the prompt.
- **validate** — hard gate via Pydantic; non-conforming content never leaves the pipeline. Up to `MAX_REPAIRS` repair iterations.

### Adding a new game

Backend — one file, auto-discovered (no registry/JSON edits):

1. Create `backend/app/templates/schemas/<game>.py` with a Pydantic content model **and** a module-level `SPEC = GameSpec(...)` (id, name, description, `content_type_fit`, `grade_range`, `content_model`, plus optional `active`/`playable`/`min_items`/`sort_order`).
2. That's it — `registry.py` discovers the `SPEC` automatically. No pipeline changes.

Frontend — one manifest entry (only needed for `playable` games that teachers can pick/play):

3. Write the game's React shell under `FE/src/features/game-shells/<game>/`.
4. Add one entry to `GAMES` in `FE/src/features/game-shells/registry.tsx` (ties `backendId` ↔ `type` ↔ metadata ↔ `Shell`). `GameShell` and the chat game-picker both read from this list.

A game is offered in the chat picker only when its backend `SPEC.playable` is true **and** it has a frontend manifest entry.

### Retrieval seam

`app/retrieval/context.py` defines `RetrievalProvider` (Protocol) and `StubRetrievalProvider` (fixture-backed). Replace `default_provider` with a real RAG provider without touching agent code.

## Required process notes

- `JOURNAL.md` must be updated before every PR (course requirement — weekly reflection).
- `WORKLOG.md` captures technical decisions, task assignments, and important bugs.
