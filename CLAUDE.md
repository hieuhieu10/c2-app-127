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
      registry.py            # Template metadata from data/templates.json + Pydantic model lookup
      schemas/               # Per-template Pydantic content models (quiz, matching, fill_in_blank)
    retrieval/
      context.py             # RetrievalProvider Protocol + StubRetrievalProvider (real RAG is a teammate's seam)
    validation/
      validator.py           # Schema validation gate; validate() + json_schema_for()
  data/
    templates.json           # Template metadata (id, grade_range, active flag, etc.)
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
retrieve -> recommend -> generate -> validate --done--> END
                                        ^   |
                                        |   +--repair--> repair --> validate
                                        +--give_up--> finalize_failure -> END
```

- **retrieve** (`generator.py:retrieve_node`) — calls `default_provider.retrieve()` to get grounding context (curriculum passages, misconceptions). Real RAG injected via `default_provider`.
- **recommend** (`recommender.py:recommend_node`) — supervisor LLM call; honours `override_template` to skip. Falls back gracefully if grade has no templates.
- **generate / repair** (`generator.py`) — worker LLM call using Claude tool_use with the template's JSON Schema as `input_schema`. Repair passes prior validation errors back in the prompt.
- **validate** — hard gate via Pydantic; non-conforming content never leaves the pipeline. Up to `MAX_REPAIRS` repair iterations.

### Adding a new game template

1. Add a Pydantic content model in `backend/app/templates/schemas/`.
2. Register it in `_CONTENT_MODELS` in `backend/app/templates/registry.py`.
3. Add metadata (including `grade_range` and `active: true`) to `backend/data/templates.json`.
4. No pipeline changes needed.

### Retrieval seam

`app/retrieval/context.py` defines `RetrievalProvider` (Protocol) and `StubRetrievalProvider` (fixture-backed). Replace `default_provider` with a real RAG provider without touching agent code.

## Required process notes

- `JOURNAL.md` must be updated before every PR (course requirement — weekly reflection).
- `WORKLOG.md` captures technical decisions, task assignments, and important bugs.
