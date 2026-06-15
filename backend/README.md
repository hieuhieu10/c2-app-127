# Agent Workflow — backend

Team 127 AI Learning-Game Generator. This package owns the **agent workflow**:
recommend a game template (supervisor) and generate **schema-valid** game content
(worker), with a strict validation + repair loop. Built with LangGraph + the Anthropic API.

## Setup

```bash
cd backend
python3 -m venv .venv
.venv/bin/python -m pip install -e ".[dev]"
```

Set a real `ANTHROPIC_API_KEY` in the repo-root `.env` (the template value is a placeholder).
Model id is read from `.env` `DEFAULT_MODEL`; if unset it defaults to `claude-sonnet-4-6`.

## Run

```bash
.venv/bin/uvicorn app.main:app --reload      # API at http://127.0.0.1:8000 (/docs for Swagger)
.venv/bin/python -m scripts.smoke_generate   # live end-to-end run for one fixture objective
.venv/bin/python -m pytest                    # 28 tests, mocked LLM (no network/key needed)
```

## Endpoints

| Method | Path             | Purpose |
|--------|------------------|---------|
| GET    | `/templates`     | List active, generatable templates |
| POST   | `/recommend`     | Pick a template + rationale (supervisor only) |
| POST   | `/generate`      | Generate for an explicit `override_template` |
| POST   | `/generate/full` | Full flow: recommend → generate → validate/repair |
| GET    | `/health`        | Liveness |

## Flow

```
retrieve → recommend → generate → validate ⇄ repair (≤ MAX_REPAIRS) → END
```

## Seams for teammates (interfaces to implement against)

- **Retrieval / RAG / PDF parsing** — implement `app.retrieval.context.RetrievalProvider`
  (returns `RetrievedContext`: objective text, passages, misconceptions) and inject it in
  place of `StubRetrievalProvider`. The stub reads `data/fixtures/sample_subject.json`.
- **NLI fidelity / safety gate** — plugs in after `validate` in `app/agents/graph.py`. The
  workflow hands off validated `content` (+ resolved `objective_id` + grounding `context`),
  ready for per-claim entailment checks. No change to recommend/generate needed.
- **Schemas / templates (owned here)** — add a game: add a Pydantic content model under
  `app/templates/schemas/`, map it in `app/templates/registry._CONTENT_MODELS`, and flip
  `active: true` in `data/templates.json`.

## Layout

```
app/
  config.py                 # settings from .env
  models.py                 # API request/response models
  api/routes_generate.py    # FastAPI router
  agents/                   # llm, state, prompts, recommender, generator, graph
  templates/                # registry + schemas/ (source of truth)
  validation/validator.py   # schema gate + JSON-Schema export
  retrieval/context.py      # RetrievalProvider interface + stub
data/
  templates.json            # template metadata (6 listed, 3 active)
  fixtures/sample_subject.json
tests/                      # 28 tests, mocked LLM
scripts/smoke_generate.py   # live API smoke test
```
