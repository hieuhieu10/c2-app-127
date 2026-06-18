# Evaluation Evidence

Date: 2026-06-18  
Branch observed: `yennt`

This file records manual checks and command outputs collected from the local workspace. The manual retrieval checks do not call an LLM and can run without API keys.

## Manual Test Harness

Command used from `backend/`:

```powershell
@'
import json
from app.retrieval.context import GDPT2018RetrievalProvider

provider = GDPT2018RetrievalProvider()

cases = [
    ("TC01_grade3_multiplication_no_upload", dict(subject="Toan", grade=3, objective_id=None, prompt="Tao game ve phep nhan la phep cong lap", teacher_requested_difficulty="medium")),
    ("TC02_grade3_slide_context_10min", dict(subject="Toan", grade=3, objective_id="math_3_multiplication_repeated_addition", prompt="Tao game ngan ve phep nhan", source_text="Phep nhan la phep cong lap\nVi du: 3 gio tao, moi gio 4 qua\nHoat dong 10 phut cuoi gio\nHoc sinh con nham 3 x 4 voi 3 + 4", uploaded_file_id="slide_001", upload_type="slide", teacher_requested_difficulty="medium")),
    ("TC03_grade3_above_scope_hard", dict(subject="Toan", grade=3, objective_id="math_3_multiplication_repeated_addition", prompt="Dung bieu thuc dai so va bai toan nhieu buoc phuc tap", teacher_requested_difficulty="hard")),
    ("TC04_grade5_percent_discount", dict(subject="Toan", grade=5, objective_id=None, prompt="Tao game ve ti so phan tram va giam gia", teacher_requested_difficulty="medium")),
    ("TC05_grade2_place_value", dict(subject="Toan", grade=2, objective_id=None, prompt="Tao game ve so co ba chu so tram chuc don vi", teacher_requested_difficulty="easy")),
]

for name, kwargs in cases:
    ctx = provider.retrieve(**kwargs)
    out = {
        "case": name,
        "objective_id": ctx.objective_id,
        "matched_confidence": ctx.matched_confidence,
        "scope_status": ctx.curriculum_context.scope_status if ctx.curriculum_context else None,
        "final_difficulty": ctx.difficulty_assessment.final_difficulty if ctx.difficulty_assessment else None,
        "upload_type": ctx.teacher_lesson_context.upload_type if ctx.teacher_lesson_context else None,
        "time_limit_minutes": ctx.teacher_lesson_context.time_limit_minutes if ctx.teacher_lesson_context else None,
        "warnings": ctx.alignment_result.mismatch_warnings if ctx.alignment_result else [],
        "adjustments": ctx.alignment_result.recommended_adjustments if ctx.alignment_result else [],
    }
    print(json.dumps(out, ensure_ascii=False))
'@ | python -
```

## Manual Test Cases

### TC01 - Grade 3 Multiplication, No Upload

Purpose: verify keyword retrieval maps "phep nhan la phep cong lap" to the grade 3 repeated-addition objective.

Input:

```json
{
  "subject": "Toan",
  "grade": 3,
  "prompt": "Tao game ve phep nhan la phep cong lap",
  "teacher_requested_difficulty": "medium"
}
```

Actual output:

```json
{"case": "TC01_grade3_multiplication_no_upload", "objective_id": "math_3_multiplication_repeated_addition", "matched_confidence": 0.95, "scope_status": "in_scope", "final_difficulty": "medium", "upload_type": "none", "time_limit_minutes": null, "warnings": [], "adjustments": ["Use default age-appropriate examples from the GDPT objective."]}
```

Result: pass.

### TC02 - Grade 3 Slide Context, 10-Minute Activity

Purpose: verify teacher slide context is extracted and short time limit downgrades difficulty.

Input:

```json
{
  "subject": "Toan",
  "grade": 3,
  "objective_id": "math_3_multiplication_repeated_addition",
  "prompt": "Tao game ngan ve phep nhan",
  "source_text": "Phep nhan la phep cong lap\nVi du: 3 gio tao, moi gio 4 qua\nHoat dong 10 phut cuoi gio\nHoc sinh con nham 3 x 4 voi 3 + 4",
  "uploaded_file_id": "slide_001",
  "upload_type": "slide",
  "teacher_requested_difficulty": "medium"
}
```

Actual output:

```json
{"case": "TC02_grade3_slide_context_10min", "objective_id": "math_3_multiplication_repeated_addition", "matched_confidence": 1.0, "scope_status": "in_scope", "final_difficulty": "easy", "upload_type": "slide", "time_limit_minutes": 10, "warnings": [], "adjustments": []}
```

Result: pass.

### TC03 - Grade 3 Above-Scope Hard Request

Purpose: verify above-grade signals and hard difficulty are flagged/downgraded.

Input:

```json
{
  "subject": "Toan",
  "grade": 3,
  "objective_id": "math_3_multiplication_repeated_addition",
  "prompt": "Dung bieu thuc dai so va bai toan nhieu buoc phuc tap",
  "teacher_requested_difficulty": "hard"
}
```

Actual output:

```json
{"case": "TC03_grade3_above_scope_hard", "objective_id": "math_3_multiplication_repeated_addition", "matched_confidence": 1.0, "scope_status": "above_grade", "final_difficulty": "medium", "upload_type": "none", "time_limit_minutes": null, "warnings": ["Teacher requested difficulty is outside the GDPT allowed range for this objective.", "Teacher material or request includes content above the target grade scope."], "adjustments": ["Use medium as the highest allowed difficulty.", "Downgrade to one-step, concrete, age-appropriate tasks.", "Use default age-appropriate examples from the GDPT objective."]}
```

Result: pass.

### TC04 - Grade 5 Percent And Discount

Purpose: verify grade 5 percentage/discount prompt retrieves the correct percent objective.

Input:

```json
{
  "subject": "Toan",
  "grade": 5,
  "prompt": "Tao game ve ti so phan tram va giam gia",
  "teacher_requested_difficulty": "medium"
}
```

Actual output:

```json
{"case": "TC04_grade5_percent_discount", "objective_id": "math_5_percent_ratio", "matched_confidence": 0.95, "scope_status": "in_scope", "final_difficulty": "medium", "upload_type": "none", "time_limit_minutes": null, "warnings": [], "adjustments": ["Use default age-appropriate examples from the GDPT objective."]}
```

Result: pass.

### TC05 - Grade 2 Place Value

Purpose: verify grade 2 place-value prompt retrieves the correct 3-digit number objective.

Input:

```json
{
  "subject": "Toan",
  "grade": 2,
  "prompt": "Tao game ve so co ba chu so tram chuc don vi",
  "teacher_requested_difficulty": "easy"
}
```

Actual output:

```json
{"case": "TC05_grade2_place_value", "objective_id": "math_2_numbers_1000_place_value", "matched_confidence": 0.95, "scope_status": "in_scope", "final_difficulty": "easy", "upload_type": "none", "time_limit_minutes": null, "warnings": [], "adjustments": ["Use default age-appropriate examples from the GDPT objective."]}
```

Result: pass.

## Automated Verification Evidence

### BE_Web Tests

Command:

```powershell
cd BE_Web
uv run pytest
```

Actual output summary:

```text
collected 19 items
tests\test_games_api.py ................... [100%]
19 passed, 2 warnings in 1.34s
```

Result: pass.

### BE_AI Backend Tests

Command:

```powershell
cd backend
uv run pytest
```

Actual output summary:

```text
collected 66 items
66 passed, 2 warnings in 2.06s
```

Result: pass. `/recommend/games` returns an inline `blocked=true` payload for guardrail blocks so the frontend can show the message without treating it as an unexpected HTTP failure.

### FE Build

Command:

```powershell
cd FE
npm.cmd run build
```

Actual output summary:

```text
next/font: error:
Failed to fetch `Be Vietnam Pro` from Google Fonts.
```

Result: blocked by restricted network access to Google Fonts during `next build`. The app may build in a network-enabled environment, or the font should be made local/self-hosted for offline CI.

## Coverage Summary

Current evidence covers:

- Objective retrieval for Toan grade 2, 3, and 5.
- Teacher slide context extraction.
- Short-duration difficulty downgrade.
- Above-grade scope warning.
- BE_Web authenticated game API test suite.

Known gaps:

- No manual LLM generation evidence is included because no API key was used.
- No browser screenshot evidence is included.
- No end-to-end FE -> BE_Web -> BE_AI live run is included.
- BE_Web no longer owns the old `/api/games/generate` draft-generation path; current game creation uses the BE_AI recommendation/generation flow from FE.
