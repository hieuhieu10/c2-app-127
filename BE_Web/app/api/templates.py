from __future__ import annotations

from fastapi import APIRouter

from app.schemas.games import ProductTemplate

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("", response_model=list[ProductTemplate])
def list_product_templates() -> list[ProductTemplate]:
    return [
        ProductTemplate(
            id="treasure_hunt",
            name="Treasure Hunt",
            description="A treasure-map game shell powered by multiple-choice quiz content.",
            ai_template_id="quiz",
        )
    ]
