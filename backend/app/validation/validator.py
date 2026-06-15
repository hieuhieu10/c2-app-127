"""Schema validation gate.

A hard gate: content that does not conform to its template's Pydantic model never
leaves the pipeline. The repair loop in the worker re-prompts using these errors.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ValidationError

from app.templates.registry import content_model_for, has_content_model


class ValidationResult(BaseModel):
    ok: bool
    errors: list[str] = []
    # The parsed/normalised content (model dump) when ok is True.
    content: dict[str, Any] | None = None


def _format_errors(exc: ValidationError) -> list[str]:
    msgs = []
    for err in exc.errors():
        loc = ".".join(str(p) for p in err["loc"]) or "<root>"
        msgs.append(f"{loc}: {err['msg']}")
    return msgs


def validate(template_id: str, data: dict[str, Any]) -> ValidationResult:
    """Validate a content dict against its template schema."""
    if not has_content_model(template_id):
        return ValidationResult(ok=False, errors=[f"unknown template_id '{template_id}'"])

    model = content_model_for(template_id)
    try:
        parsed = model.model_validate(data)
    except ValidationError as exc:
        return ValidationResult(ok=False, errors=_format_errors(exc))
    return ValidationResult(ok=True, content=parsed.model_dump())


def json_schema_for(template_id: str) -> dict[str, Any]:
    """Export the template's JSON Schema (used as the worker's tool input_schema)."""
    return content_model_for(template_id).model_json_schema()
