"""Game registry: auto-discovers every game's ``GameSpec`` and exposes lookups.

Adding a new game = drop one module under ``schemas/`` that declares a Pydantic
content model and a module-level ``SPEC = GameSpec(...)``. It is picked up here
automatically — no edits to this file, no JSON, no pipeline changes.
"""

from __future__ import annotations

import importlib
import pkgutil
from functools import lru_cache
from typing import Type

from pydantic import BaseModel

from . import schemas as _schemas_pkg
from .spec import GameSpec

# Back-compat alias: callers historically typed metadata as ``TemplateMeta``.
TemplateMeta = GameSpec


@lru_cache(maxsize=1)
def _load_all() -> dict[str, GameSpec]:
    """Import every schema module and collect the ``SPEC`` each one declares."""
    specs: dict[str, GameSpec] = {}
    for mod in pkgutil.iter_modules(_schemas_pkg.__path__):
        if mod.name.startswith("_") or mod.name == "base":
            continue
        module = importlib.import_module(f"{_schemas_pkg.__name__}.{mod.name}")
        spec = getattr(module, "SPEC", None)
        if isinstance(spec, GameSpec):
            specs[spec.id] = spec
    return specs


def _sorted(specs: list[GameSpec]) -> list[GameSpec]:
    return sorted(specs, key=lambda s: (s.sort_order, s.name))


def list_templates(active_only: bool = True) -> list[GameSpec]:
    specs = [s for s in _load_all().values() if s.active or not active_only]
    return _sorted(specs)


def get_template(template_id: str) -> GameSpec | None:
    return _load_all().get(template_id)


def has_content_model(template_id: str) -> bool:
    return template_id in _load_all()


def content_model_for(template_id: str) -> Type[BaseModel]:
    """Return the Pydantic content model for a game, or raise KeyError."""
    return _load_all()[template_id].content_model


def candidates_for(grade: int | None = None) -> list[GameSpec]:
    """Active games the recommender may choose from, optionally grade-filtered."""
    out = []
    for spec in list_templates(active_only=True):
        if grade is not None and not (spec.grade_range[0] <= grade <= spec.grade_range[1]):
            continue
        out.append(spec)
    return out


def playable_candidates(grade: int | None = None) -> list[GameSpec]:
    """Grade-appropriate games that have a finished play shell — what the chat offers."""
    return [s for s in candidates_for(grade) if s.playable]


def playable_games() -> list[GameSpec]:
    """All active, playable games regardless of grade (ranked by suitability later)."""
    return [s for s in list_templates(active_only=True) if s.playable]
