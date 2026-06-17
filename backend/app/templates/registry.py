"""Game-template registry: metadata + content-model lookup.

Adding a new game = add a Pydantic content schema, map it here, and flip ``active``
in ``data/templates.json``. No pipeline change required.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Type

from pydantic import BaseModel

from .schemas.battleship import BattleshipContent
from .schemas.fill_in_blank import FillBlankContent
from .schemas.matching import MatchingContent
from .schemas.quiz import QuizContent

_TEMPLATES_JSON = Path(__file__).resolve().parents[2] / "data" / "templates.json"

# template_id -> Pydantic content model (only templates we can generate/validate).
_CONTENT_MODELS: dict[str, Type[BaseModel]] = {
    "quiz": QuizContent,
    "matching": MatchingContent,
    "fill_in_blank": FillBlankContent,
    "battleship": BattleshipContent,
}


class TemplateMeta(BaseModel):
    id: str
    name: str
    description: str
    content_type_fit: list[str]
    grade_range: tuple[int, int]
    active: bool


@lru_cache(maxsize=1)
def _load_all() -> dict[str, TemplateMeta]:
    raw = json.loads(_TEMPLATES_JSON.read_text(encoding="utf-8"))
    return {item["id"]: TemplateMeta(**item) for item in raw}


def list_templates(active_only: bool = True) -> list[TemplateMeta]:
    metas = _load_all().values()
    return [m for m in metas if m.active or not active_only]


def get_template(template_id: str) -> TemplateMeta | None:
    return _load_all().get(template_id)


def has_content_model(template_id: str) -> bool:
    return template_id in _CONTENT_MODELS


def content_model_for(template_id: str) -> Type[BaseModel]:
    """Return the Pydantic content model for a template, or raise KeyError."""
    return _CONTENT_MODELS[template_id]


def candidates_for(grade: int | None = None) -> list[TemplateMeta]:
    """Active templates the recommender may choose from, optionally grade-filtered."""
    out = []
    for meta in list_templates(active_only=True):
        if not has_content_model(meta.id):
            continue
        if grade is not None and not (meta.grade_range[0] <= grade <= meta.grade_range[1]):
            continue
        out.append(meta)
    return out
