"""GameSpec — the single, self-contained description of one game.

Each game lives in its own module under ``app/templates/schemas/`` and exposes a
module-level ``SPEC = GameSpec(...)`` alongside its Pydantic content model. The
registry auto-discovers every ``SPEC``, so adding a game is just: drop one file
that declares a content model + a ``SPEC``. No registry edits, no JSON, no
pipeline changes.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Type

from pydantic import BaseModel


@dataclass(frozen=True)
class GameSpec:
    """Everything the backend needs to know about one game."""

    id: str
    name: str
    description: str
    content_type_fit: tuple[str, ...]
    grade_range: tuple[int, int]
    content_model: Type[BaseModel]

    # Whether the recommender may surface it at all.
    active: bool = True
    # Whether a finished, ready-to-play frontend shell exists. Only playable games
    # are offered to teachers in the chat game-picker.
    playable: bool = False

    # Generation knobs -------------------------------------------------------
    # Floor for the number of items to request (e.g. Battleship needs a full pool).
    min_items: int = 1
    # Default item count when the caller does not specify one.
    default_num_items: int = 8

    # Lower sorts earlier in default listings (ties broken by name).
    sort_order: int = 100
