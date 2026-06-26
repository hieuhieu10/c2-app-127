# Eval Evidence

Ngày ghi nhận: 2026-06-18  
Nhánh quan sát: `yennt`

File này ghi lại manual checks và output kiểm chứng local. Các manual retrieval checks không gọi LLM nên có thể chạy không cần API key.

## Bộ Lệnh Manual Test

Lệnh chạy từ thư mục `backend/`:

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
'@ | uv run python -
```

## Các Manual Test Case

### TC01 - Phép nhân lớp 3, không upload tài liệu

Mục tiêu: kiểm tra keyword retrieval map `"phep nhan la phep cong lap"` vào objective phép nhân là phép cộng lặp của lớp 3.

Đầu vào:

```json
{
  "subject": "Toan",
  "grade": 3,
  "prompt": "Tao game ve phep nhan la phep cong lap",
  "teacher_requested_difficulty": "medium"
}
```

Output thực tế:

```json
{"case": "TC01_grade3_multiplication_no_upload", "objective_id": "math_3_multiplication_repeated_addition", "matched_confidence": 0.95, "scope_status": "in_scope", "final_difficulty": "medium", "upload_type": "none", "time_limit_minutes": null, "warnings": [], "adjustments": ["Use default age-appropriate examples from the GDPT objective."]}
```

Kết quả: pass.

### TC02 - Slide lớp 3, hoạt động 10 phút

Mục tiêu: kiểm tra teacher slide context được trích xuất và time limit ngắn làm difficulty giảm xuống.

Đầu vào:

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

Output thực tế:

```json
{"case": "TC02_grade3_slide_context_10min", "objective_id": "math_3_multiplication_repeated_addition", "matched_confidence": 1.0, "scope_status": "in_scope", "final_difficulty": "easy", "upload_type": "slide", "time_limit_minutes": 10, "warnings": [], "adjustments": []}
```

Kết quả: pass.

### TC03 - Request lớp 3 vượt scope và hard

Mục tiêu: kiểm tra tín hiệu above-grade và requested difficulty ngoài range được flag/downgrade.

Đầu vào:

```json
{
  "subject": "Toan",
  "grade": 3,
  "objective_id": "math_3_multiplication_repeated_addition",
  "prompt": "Dung bieu thuc dai so va bai toan nhieu buoc phuc tap",
  "teacher_requested_difficulty": "hard"
}
```

Output thực tế:

```json
{"case": "TC03_grade3_above_scope_hard", "objective_id": "math_3_multiplication_repeated_addition", "matched_confidence": 1.0, "scope_status": "above_grade", "final_difficulty": "medium", "upload_type": "none", "time_limit_minutes": null, "warnings": ["Teacher requested difficulty is outside the GDPT allowed range for this objective.", "Teacher material or request includes content above the target grade scope."], "adjustments": ["Use medium as the highest allowed difficulty.", "Downgrade to one-step, concrete, age-appropriate tasks.", "Use default age-appropriate examples from the GDPT objective."]}
```

Kết quả: pass.

### TC04 - Tỉ số phần trăm và giảm giá lớp 5

Mục tiêu: kiểm tra prompt về phần trăm/giảm giá lớp 5 retrieve đúng percent objective.

Đầu vào:

```json
{
  "subject": "Toan",
  "grade": 5,
  "prompt": "Tao game ve ti so phan tram va giam gia",
  "teacher_requested_difficulty": "medium"
}
```

Output thực tế:

```json
{"case": "TC04_grade5_percent_discount", "objective_id": "math_5_percent_ratio", "matched_confidence": 0.95, "scope_status": "in_scope", "final_difficulty": "medium", "upload_type": "none", "time_limit_minutes": null, "warnings": [], "adjustments": ["Use default age-appropriate examples from the GDPT objective."]}
```

Kết quả: pass.

### TC05 - Cấu tạo số có ba chữ số lớp 2

Mục tiêu: kiểm tra prompt về hàng trăm/chục/đơn vị lớp 2 retrieve đúng objective.

Đầu vào:

```json
{
  "subject": "Toan",
  "grade": 2,
  "prompt": "Tao game ve so co ba chu so tram chuc don vi",
  "teacher_requested_difficulty": "easy"
}
```

Output thực tế:

```json
{"case": "TC05_grade2_place_value", "objective_id": "math_2_numbers_1000_place_value", "matched_confidence": 0.95, "scope_status": "in_scope", "final_difficulty": "easy", "upload_type": "none", "time_limit_minutes": null, "warnings": [], "adjustments": ["Use default age-appropriate examples from the GDPT objective."]}
```

Kết quả: pass.

## Bằng Chứng Kiểm Chứng Tự Động

### Test BE_Web

Lệnh:

```powershell
cd BE_Web
uv run pytest
```

Tóm tắt output thực tế:

```text
collected 19 items
tests\test_games_api.py ................... [100%]
19 passed, 2 warnings in 1.34s
```

Kết quả: pass.

### Test BE_AI Backend

Lệnh:

```powershell
cd backend
uv run pytest
```

Tóm tắt output thực tế:

```text
collected 66 items
66 passed, 2 warnings in 2.06s
```

Kết quả: pass. `/recommend/games` trả inline payload `blocked=true` khi guardrail block để frontend có thể hiển thị message mà không coi đó là lỗi HTTP bất ngờ.

### Build FE

Lệnh:

```powershell
cd FE
npm.cmd run build
```

Tóm tắt output thực tế:

```text
next/font: error:
Failed to fetch `Be Vietnam Pro` from Google Fonts.
```

Kết quả: bị chặn bởi network restriction khi `next build` fetch Google Fonts. App có thể build trong môi trường có network, hoặc nên chuyển font sang local/self-hosted để CI offline ổn định.

## Tóm Tắt Coverage

Evidence hiện bao phủ:

- Objective retrieval cho Toán lớp 2, 3 và 5.
- Teacher slide context extraction.
- Short-duration difficulty downgrade.
- Above-grade scope warning.
- BE_Web authenticated game API test suite.
- BE_AI guardrail/retrieval/recommender/generator/schema tests.

Các điểm còn thiếu:

- Chưa có manual LLM generation evidence vì không dùng API key thật.
- Chưa có browser screenshot evidence.
- Chưa có end-to-end live run đầy đủ qua FE.
- Chat-flow generated games hiện lưu local browser; chưa sync vào BE_Web DB.
